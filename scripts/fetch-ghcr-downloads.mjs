// Pulls registry download counts for Prism's published container images and
// writes downloads.json for build-stats-issue.mjs to render.
//
// Why scrape: GitHub's Packages REST API exposes no download_count for
// container packages (it exists for npm/maven/etc. but not GHCR), and the
// GraphQL package fields are deprecated. The public package page is the only
// place the number is published, so we read it there. That makes this step
// inherently fragile — it parses HTML GitHub can change at any time — so the
// workflow runs it fail-soft and the dashboard simply omits the section when
// the parse comes back empty.
//
// What the page gives us, per package:
//   - an exact all-time total (the abbreviated "2.22K" text carries the real
//     number in the h3's title attribute)
//   - a 30-day daily series encoded in the sparkline's rects
// The daily series is retroactive, so the first run already backfills a month.
//
// Output: downloads.json
//   { fetchedAt, packages: { <name>: { total, daily: [{date, count}] } } }

import { writeFileSync } from 'node:fs';

const OWNER = process.env.GHCR_OWNER || process.env.GITHUB_REPOSITORY_OWNER || 'sandydargoport';
const PACKAGES = (process.env.GHCR_PACKAGES || 'prism,prism-ha-amd64,prism-ha-aarch64')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** Exact all-time total: <span>Total downloads</span> <h3 title="2222">2.22K</h3> */
function parseTotal(html) {
  const m = html.match(/Total downloads<\/span>\s*<h3[^>]*\btitle="(\d+)"/);
  return m ? Number(m[1]) : null;
}

/** 30-day daily series from the sparkline rects. */
function parseDaily(html) {
  return [...html.matchAll(/data-merge-count="(\d+)"\s+data-date="(\d{4}-\d{2}-\d{2})"/g)]
    .map((m) => ({ date: m[2], count: Number(m[1]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** User and org accounts live on different paths; try both before giving up. */
async function fetchPackagePage(name) {
  const paths = [
    `https://github.com/users/${OWNER}/packages/container/package/${name}`,
    `https://github.com/orgs/${OWNER}/packages/container/package/${name}`,
  ];
  for (const url of paths) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'prism-install-stats' } });
      if (res.ok) return await res.text();
    } catch {
      // Network hiccup on one path; fall through and try the other.
    }
  }
  return null;
}

const packages = {};
for (const name of PACKAGES) {
  const html = await fetchPackagePage(name);
  if (!html) {
    console.log(`::warning::${name}: package page unreachable; skipping`);
    continue;
  }
  const total = parseTotal(html);
  const daily = parseDaily(html);
  if (total == null && !daily.length) {
    console.log(`::warning::${name}: no download figures found (page markup may have changed)`);
    continue;
  }
  packages[name] = { total, daily };
  console.log(`${name}: total=${total ?? 'n/a'} dailyPoints=${daily.length}`);
}

writeFileSync('downloads.json', JSON.stringify({ fetchedAt: new Date().toISOString(), packages }));
console.log(`Wrote downloads.json for ${Object.keys(packages).length}/${PACKAGES.length} package(s).`);
