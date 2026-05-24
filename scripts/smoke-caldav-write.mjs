#!/usr/bin/env node
// Smoke test for CalDAV two-way write against a live iCloud calendar.
// Runs inside the prism-app container (uses DATABASE_URL + ENCRYPTION_KEY from env).
//
// Drives tsdav directly (no Prism API layer) so we test the unknown:
// iCal serialization + iCloud's CalDAV write protocol. The API wrapper
// is a thin auth+arg-marshal layer on top of the same tsdav calls.
//
// Usage:  docker exec prism-app node /app/scripts/smoke-caldav-write.mjs <sourceId>

import postgres from 'postgres';
import { createDAVClient } from 'tsdav';
import ICAL from 'ical.js';
import { createDecipheriv } from 'node:crypto';

const SOURCE_ID = process.argv[2];
if (!SOURCE_ID) {
  console.error('Usage: node smoke-caldav-write.mjs <sourceId>');
  process.exit(1);
}

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ALGORITHM = 'aes-256-gcm';

function decrypt(encoded) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || process.env.PIN_ENCRYPTION_KEY, 'hex');
  const data = Buffer.from(encoded, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

function buildVEventICalString({ uid, title, startTime, endTime, description, location }) {
  const vcalendar = new ICAL.Component(['vcalendar', [], []]);
  vcalendar.updatePropertyWithValue('prodid', '-//Prism//CalDAV smoke//EN');
  vcalendar.updatePropertyWithValue('version', '2.0');

  const vevent = new ICAL.Component('vevent');
  vevent.updatePropertyWithValue('uid', uid);
  vevent.updatePropertyWithValue('summary', title);
  if (description) vevent.updatePropertyWithValue('description', description);
  if (location) vevent.updatePropertyWithValue('location', location);

  const dtstamp = ICAL.Time.now();
  dtstamp.zone = ICAL.Timezone.utcTimezone;
  vevent.updatePropertyWithValue('dtstamp', dtstamp);

  vevent.updatePropertyWithValue('dtstart', ICAL.Time.fromJSDate(startTime, true));
  vevent.updatePropertyWithValue('dtend', ICAL.Time.fromJSDate(endTime, true));

  vcalendar.addSubcomponent(vevent);
  return vcalendar.toString();
}

const sql = postgres(process.env.DATABASE_URL);

try {
  const [src] = await sql`SELECT display_name, source_calendar_id, access_token, provider_config
                          FROM calendar_sources WHERE id = ${SOURCE_ID}`;
  if (!src) { console.error('Source not found'); process.exit(1); }

  // postgres.js returns column names as-is (snake_case from the SELECT)
  console.log(`[smoke] DEBUG keys: ${Object.keys(src).join(', ')}`);
  console.log(`[smoke] Target calendar: ${src.display_name}`);
  console.log(`[smoke] Calendar URL:    ${src.source_calendar_id}`);
  console.log(`[smoke] provider_config: ${JSON.stringify(src.provider_config)}`);

  const password = decrypt(src.access_token);
  const cfg = src.provider_config || {};
  const serverUrl = cfg.serverUrl || cfg.server_url;
  const username = cfg.username;
  console.log(`[smoke] User:            ${username}`);

  const client = await createDAVClient({
    serverUrl, credentials: { username, password },
    authMethod: 'Basic', defaultAccountType: 'caldav',
  });

  const calendars = await client.fetchCalendars();
  const calendar = calendars.find(c => c.url === src.source_calendar_id);
  if (!calendar) { console.error('Calendar not found on server'); process.exit(1); }

  const uid = `prism-smoke-${Date.now()}@prism.local`;
  // 11pm tomorrow, 30 min
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(23, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  console.log('\n[smoke] STEP 1: CREATE');
  const createRes = await client.createCalendarObject({
    calendar,
    iCalString: buildVEventICalString({
      uid, title: 'Prism CalDAV smoke test', startTime: start, endTime: end,
      description: 'Created by scripts/smoke-caldav-write.mjs — safe to ignore',
    }),
    filename: `${uid}.ics`,
  });
  console.log(`[smoke]   status: ${createRes.status} ${createRes.statusText}`);
  if (!createRes.ok) { console.error('[smoke] CREATE FAILED'); process.exit(1); }
  const createdHref = createRes.headers.get('Location') || new URL(`${uid}.ics`, src.source_calendar_id).toString();
  console.log(`[smoke]   href:   ${createdHref}`);

  console.log('\n[smoke] STEP 2: READ-BACK to verify create');
  await new Promise(r => setTimeout(r, 3000)); // iCloud eventual-consistency
  let objs = await client.fetchCalendarObjects({ calendar });
  const found = objs.find(o => o.url.includes(uid) || (o.data || '').includes(uid));
  if (!found) { console.error('[smoke] CREATE READ-BACK FAILED — event not in calendar'); process.exit(1); }
  console.log(`[smoke]   confirmed: found at ${found.url}`);
  console.log(`[smoke]   etag:      ${found.etag}`);

  console.log('\n[smoke] STEP 3: UPDATE title');
  const updateRes = await client.updateCalendarObject({
    calendarObject: {
      url: found.url,
      etag: found.etag,
      data: buildVEventICalString({
        uid, title: 'Prism CalDAV smoke test (UPDATED)', startTime: start, endTime: end,
      }),
    },
  });
  console.log(`[smoke]   status: ${updateRes.status} ${updateRes.statusText}`);
  if (!updateRes.ok) { console.error('[smoke] UPDATE FAILED'); process.exit(1); }

  console.log('\n[smoke] STEP 4: READ-BACK to verify update');
  await new Promise(r => setTimeout(r, 3000));
  objs = await client.fetchCalendarObjects({ calendar });
  const updated = objs.find(o => o.url.includes(uid) || (o.data || '').includes(uid));
  const updatedTitle = updated?.data?.match(/SUMMARY:(.+)/)?.[1]?.trim();
  console.log(`[smoke]   title now: ${updatedTitle}`);
  if (!updatedTitle?.includes('UPDATED')) {
    console.error('[smoke] UPDATE READ-BACK FAILED');
    console.error('[smoke]   raw vcard preview:', (updated?.data || '').slice(0, 400));
    process.exit(1);
  }

  console.log('\n[smoke] STEP 5: DELETE');
  const deleteRes = await client.deleteCalendarObject({
    calendarObject: { url: updated.url, etag: updated.etag, data: '' },
  });
  console.log(`[smoke]   status: ${deleteRes.status} ${deleteRes.statusText}`);
  if (!deleteRes.ok) { console.error('[smoke] DELETE FAILED'); process.exit(1); }

  console.log('\n[smoke] STEP 6: READ-BACK to verify delete');
  objs = await client.fetchCalendarObjects({ calendar });
  const stillThere = objs.find(o => o.url.includes(uid));
  if (stillThere) { console.error('[smoke] DELETE READ-BACK FAILED — event still on server'); process.exit(1); }
  console.log('[smoke]   confirmed: event removed');

  console.log('\n[smoke] ✅ ALL STEPS PASSED');
} finally {
  await sql.end();
}
