/**
 * Prism telemetry collector — Cloudflare Worker.
 *
 * Receives the weekly anonymous check-in from each Prism install, records it in
 * a D1 table de-duplicated by the random install id, and replies with the
 * latest published version so the install can show an "update available" line.
 *
 * Privacy contract (must match src/lib/telemetry/constants.ts on the app side):
 *   - The ONLY fields stored are {id, version, deployment, arch, first_seen,
 *     last_seen}. The client IP is never read, never logged, never stored.
 *   - No cookies, no fingerprinting, no cross-request linking beyond the id the
 *     install generated for itself.
 *
 * Endpoints:
 *   POST /            → record a check-in, return { latestVersion }.
 *   GET  /stats?token=…  → aggregate counts (maintainer only, STATS_TOKEN gated).
 *   GET  /health      → "ok".
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/health') return new Response('ok', { headers: CORS });

    if (request.method === 'POST' && (url.pathname === '/' || url.pathname === '/v1/checkin')) {
      return handleCheckIn(request, env);
    }
    if (request.method === 'GET' && url.pathname === '/stats') {
      return handleStats(url, env);
    }
    return json({ error: 'not found' }, 404);
  },
};

async function handleCheckIn(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  // Validate + clamp. Anything unexpected is dropped rather than stored.
  const id = typeof body.id === 'string' ? body.id.slice(0, 64) : null;
  if (!id) return json({ error: 'missing id' }, 400);
  const version = typeof body.version === 'string' ? body.version.slice(0, 32) : null;
  // Channel slug (ha | docker | pikapods | render | …). Sanitised, not forced to
  // a binary, so installs can be counted by source without a schema change.
  const deployment =
    typeof body.deployment === 'string'
      ? body.deployment.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 16) || 'docker'
      : 'docker';
  const arch = typeof body.arch === 'string' ? body.arch.slice(0, 16) : null;
  const now = new Date().toISOString();

  // Upsert de-duplicated by id — one install counts once no matter how often it
  // updates. Deliberately no IP column.
  await env.DB.prepare(
    `INSERT INTO checkins (id, version, deployment, arch, first_seen, last_seen)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5)
     ON CONFLICT(id) DO UPDATE SET
       version = ?2, deployment = ?3, arch = ?4, last_seen = ?5`,
  )
    .bind(id, version, deployment, arch, now)
    .run();

  const latestVersion = await getLatestVersion(env);
  return json({ ok: true, latestVersion });
}

/** Latest release tag from GitHub, cached at the edge for 1 hour. */
async function getLatestVersion(env) {
  const repo = env.GITHUB_REPO || 'sandydargoport/prism';
  const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
  const cache = caches.default;
  const cacheKey = new Request(apiUrl);

  let res = await cache.match(cacheKey);
  if (!res) {
    res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'prism-telemetry-collector', Accept: 'application/vnd.github+json' },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (res.ok) {
      const copy = new Response(res.body, res);
      copy.headers.set('Cache-Control', 'max-age=3600');
      await cache.put(cacheKey, copy.clone());
      res = copy;
    }
  }
  if (!res || !res.ok) return null;
  try {
    const data = await res.json();
    return typeof data.tag_name === 'string' ? data.tag_name.replace(/^v/, '') : null;
  } catch {
    return null;
  }
}

/** Aggregate counts for the maintainer. Gated by STATS_TOKEN. */
async function handleStats(url, env) {
  if (!env.STATS_TOKEN || url.searchParams.get('token') !== env.STATS_TOKEN) {
    return json({ error: 'unauthorized' }, 401);
  }

  const q = (sql) => env.DB.prepare(sql).all().then((r) => r.results);

  const [total, active7, active30, byVersion, byDeployment] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM checkins').first('n'),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM checkins WHERE last_seen >= datetime('now','-7 days')`).first('n'),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM checkins WHERE last_seen >= datetime('now','-30 days')`).first('n'),
    q(`SELECT version, COUNT(*) AS n FROM checkins WHERE last_seen >= datetime('now','-30 days') GROUP BY version ORDER BY n DESC`),
    q(`SELECT deployment, COUNT(*) AS n FROM checkins WHERE last_seen >= datetime('now','-30 days') GROUP BY deployment ORDER BY n DESC`),
  ]);

  return json({
    totalInstalls: total,
    activeInstalls7d: active7,
    activeInstalls30d: active30,
    byVersion,
    byDeployment,
    generatedAt: new Date().toISOString(),
  });
}
