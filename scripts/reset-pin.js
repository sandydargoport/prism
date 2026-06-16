#!/usr/bin/env node
'use strict';

/**
 * scripts/reset-pin.js
 *
 * Offline PIN recovery — reset a family member's PIN without being logged in.
 * Use when someone is locked out: they forgot their PIN, or set one that no
 * longer matches the family PIN length (Settings → Security).
 *
 * Run INSIDE the app container (it has DATABASE_URL and the deps):
 *
 *   # See member names:
 *   docker compose exec app node scripts/reset-pin.js --list
 *
 *   # Reset a member's PIN (new PIN must match the family PIN length):
 *   docker compose exec app node scripts/reset-pin.js "Jordan" 1234
 *
 * It hashes the PIN exactly like the app (bcrypt, 12 rounds) and updates only
 * that member's row. Nothing else is touched.
 */

const postgres = require('postgres');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[reset-pin] ERROR: DATABASE_URL is not set — run this inside the app container.');
  process.exit(1);
}

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;
const DEFAULT_PIN_LENGTH = 4;

async function main() {
  const args = process.argv.slice(2);
  const sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 10, onnotice: () => {} });

  try {
    const members = await sql`
      SELECT id, name, role, (pin IS NOT NULL) AS has_pin
      FROM users ORDER BY sort_order, created_at
    `;

    if (args.length === 0 || args[0] === '--list') {
      console.log('Family members:');
      for (const m of members) {
        console.log(`  - ${m.name}  (${m.role}${m.has_pin ? ', PIN set' : ', no PIN'})`);
      }
      console.log('\nUsage: node scripts/reset-pin.js "<member name>" <new-pin>');
      return;
    }

    const [name, newPin] = args;
    if (!name || !newPin) {
      console.error('Usage: node scripts/reset-pin.js "<member name>" <new-pin>   (or --list)');
      process.exit(1);
    }

    // Resolve the family-wide PIN length so the reset PIN can actually be entered.
    const [setting] = await sql`SELECT value FROM settings WHERE key = 'pinLength'`;
    let pinLength = DEFAULT_PIN_LENGTH;
    const parsed = Math.round(Number(setting && setting.value));
    if (Number.isFinite(parsed) && parsed >= MIN_PIN_LENGTH && parsed <= MAX_PIN_LENGTH) {
      pinLength = parsed;
    }

    if (!new RegExp(`^\\d{${pinLength}}$`).test(newPin)) {
      console.error(
        `[reset-pin] ERROR: PIN must be exactly ${pinLength} digits (the family PIN length). ` +
        `Change it in Settings → Security if you want a different length.`
      );
      process.exit(1);
    }

    const matches = members.filter((m) => m.name.toLowerCase() === name.toLowerCase());
    if (matches.length === 0) {
      console.error(`[reset-pin] ERROR: no member named "${name}". Run with --list to see names.`);
      process.exit(1);
    }
    if (matches.length > 1) {
      console.error(`[reset-pin] ERROR: ${matches.length} members are named "${name}" — rename one, or reset via the UI.`);
      process.exit(1);
    }

    const hash = await bcrypt.hash(newPin, 12);
    await sql`UPDATE users SET pin = ${hash}, updated_at = NOW() WHERE id = ${matches[0].id}`;
    console.log(`[reset-pin] ✓ Reset PIN for "${matches[0].name}". They can log in now with the new ${pinLength}-digit PIN.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('[reset-pin] Fatal error:', err.message);
  process.exit(1);
});
