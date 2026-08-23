// Builds the body for the pinned "Install stats" dashboard issue.
//
// Reads:
//   stats.json     - the current /stats snapshot from the collector Worker
//   downloads.json - optional registry download counts (fetch-ghcr-downloads.mjs)
//   prev.md        - the existing issue body (may be empty on first run); its
//                    embedded history block is the rolling time-series datastore
// Writes:
//   body.md     - the new issue body (tables + stacked-bar charts + refreshed
//                 hidden history)
//
// The issue is both the display and the datastore, so no branch, file, or
// database is needed to keep adoption history. One data point per day, deduped.
// The arch table and new-installs sections render only when the collector
// provides those fields, so this script is forward-compatible with a Worker
// that has not been redeployed yet.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MARKER = '<!-- PRISM_STATS_DASHBOARD -->';
const HISTORY_OPEN = '<!-- PRISM_STATS_HISTORY';
const HISTORY_CLOSE = '-->';
const CHART_WINDOW = 90; // most-recent days to plot

// Stable colors for known sources; versions/others draw from the palette.
const SOURCE_COLORS = {
  docker: '#2496ed',
  ha: '#41bdf5',
  pikapods: '#7b61ff',
  local: '#8395a7',
  unknown: '#b2bec3',
};
const PALETTE = ['#0984e3', '#00b894', '#fdcb6e', '#e17055', '#6c5ce7', '#d63031', '#00cec9', '#e84393'];

// Published images, coloured to match the source palette above.
const PACKAGE_COLORS = {
  prism: '#2496ed',
  'prism-ha-amd64': '#41bdf5',
  'prism-ha-aarch64': '#7b61ff',
};

// The embedded block holds two independent series: `points` (install snapshots,
// one per run) and `downloads` (registry pulls, one per calendar day). A body
// written before downloads existed simply yields an empty second series.
function readStore(prev) {
  const empty = { points: [], downloads: [] };
  const start = prev.indexOf(HISTORY_OPEN);
  if (start === -1) return empty;
  const rest = prev.slice(start + HISTORY_OPEN.length);
  const end = rest.indexOf(HISTORY_CLOSE);
  const raw = (end === -1 ? rest : rest.slice(0, end)).trim();
  try {
    const parsed = JSON.parse(raw);
    return {
      points: Array.isArray(parsed.points) ? parsed.points : [],
      downloads: Array.isArray(parsed.downloads) ? parsed.downloads : [],
    };
  } catch {
    return empty;
  }
}

const QC = 'https://quickchart.io/chart?bkg=white&v=4';

function stackedBarUrl(points, dimension, title, fixedColors) {
  const keys = [...new Set(points.flatMap((p) => Object.keys(p[dimension] || {})))].sort();
  let pi = 0;
  const colorFor = (k) => fixedColors[k] || PALETTE[pi++ % PALETTE.length];
  const datasets = keys.map((k) => ({
    label: k,
    data: points.map((p) => (p[dimension] || {})[k] ?? 0),
    backgroundColor: colorFor(k),
  }));
  const cfg = {
    type: 'bar',
    data: { labels: points.map((p) => p.date), datasets },
    options: {
      plugins: { title: { display: true, text: title }, legend: { position: 'bottom' } },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
    },
  };
  return `${QC}&w=760&h=360&c=${encodeURIComponent(JSON.stringify(cfg))}`;
}

function barUrl(rows, labelKey, title) {
  const cfg = {
    type: 'bar',
    data: {
      labels: rows.map((r) => r[labelKey]),
      datasets: [{ label: 'newly visible', data: rows.map((r) => r.n), backgroundColor: '#00b894' }],
    },
    options: {
      plugins: { title: { display: true, text: title }, legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  };
  return `${QC}&w=760&h=300&c=${encodeURIComponent(JSON.stringify(cfg))}`;
}

const stats = JSON.parse(readFileSync('stats.json', 'utf8'));
const prev = existsSync('prev.md') ? readFileSync('prev.md', 'utf8') : '';
const { points: history, downloads: dlHistoryPrev } = readStore(prev);
const today = (process.env.STATS_DATE || new Date().toISOString().slice(0, 10)).trim();

const toMap = (arr, key) =>
  Object.fromEntries((arr || []).map((r) => [String(r[key] ?? 'unknown').trim(), r.n]));

// Upsert today's point (deduped) with both source and version breakdowns.
const point = { date: today, sources: toMap(stats.byDeployment, 'deployment'), versions: toMap(stats.byVersion, 'version') };
const idx = history.findIndex((p) => p.date === today);
if (idx >= 0) history[idx] = point;
else history.push(point);
history.sort((a, b) => a.date.localeCompare(b.date));

const plotted = history.slice(-CHART_WINDOW);
const sourceChart = stackedBarUrl(plotted, 'sources', 'Installs by source over time', SOURCE_COLORS);
const versionChart = stackedBarUrl(plotted, 'versions', 'Installs by version over time', {});

const rows = (arr, key) =>
  arr && arr.length ? arr.map((r) => `| ${r[key]} | ${r.n} |`).join('\n') : '| _(none yet)_ | |';

// Sections that only appear once the collector exposes the fields.
// "Newly visible", not "new": the collector's first_seen is the first time an
// install ever checked in, which for anything installed before the update check
// shipped (1.15.0, 2026-08-19) is its upgrade date, not its install date. Older
// installs therefore arrive as they upgrade, and labelling that "new installs"
// would read as growth that never happened.
const newInstallsRows =
  stats.newInstalls7d != null || stats.newInstalls30d != null
    ? `| Newly visible (7 days) | ${stats.newInstalls7d ?? 0} |\n| Newly visible (30 days) | ${stats.newInstalls30d ?? 0} |\n`
    : '';

const growthSection =
  Array.isArray(stats.newInstallsByWeek) && stats.newInstallsByWeek.length
    ? `\n## Newly visible installs per week

_First check-in, not install date. Installs predating 1.15.0 appear here when
they upgrade, so expect a ramp that reflects upgrade adoption, not new users._

![Newly visible installs per week](${barUrl(stats.newInstallsByWeek, 'week', 'Newly visible installs per week')})\n`
    : '';

const archSection =
  Array.isArray(stats.byArch) && stats.byArch.length
    ? `\n## By architecture (last 30 days)\n\n| Arch | Installs |\n|---|---|\n${rows(stats.byArch, 'arch')}\n`
    : '';

// --- Registry downloads -----------------------------------------------------
// GitHub serves a rolling 30-day window per package, so every run backfills
// anything we missed and corrects the most recent day (which arrives partial).
// We keep our own copy so the series survives past GitHub's 30-day horizon.
const dlPackages = existsSync('downloads.json')
  ? JSON.parse(readFileSync('downloads.json', 'utf8')).packages ?? {}
  : {};

const byDate = new Map(dlHistoryPrev.map((p) => [p.date, p]));
for (const [name, info] of Object.entries(dlPackages)) {
  for (const { date, count } of info.daily || []) {
    const point = byDate.get(date) ?? { date, byPkg: {} };
    point.byPkg = { ...point.byPkg, [name]: count };
    byDate.set(date, point);
  }
}
// Bounded so the embedded datastore can't grow the issue body past GitHub's
// 65k limit — a couple of years of daily points is far more than we plot.
const DL_RETENTION_DAYS = 400;
const dlHistory = [...byDate.values()]
  .sort((a, b) => a.date.localeCompare(b.date))
  .slice(-DL_RETENTION_DAYS);

// Drop the newest day from the chart only: it is still accumulating and would
// draw a false cliff. It stays in history and is corrected on the next run.
const dlPlotted = dlHistory.slice(-CHART_WINDOW).slice(0, -1);

const downloadRows = Object.entries(dlPackages)
  .map(([name, info]) => {
    const last30 = (info.daily || []).reduce((sum, d) => sum + d.count, 0);
    return `| \`${name}\` | ${info.total ?? '—'} | ${last30} |`;
  })
  .join('\n');

const downloadsSection = Object.keys(dlPackages).length
  ? `\n## Registry downloads (GHCR)

_Pulls, not installs. Mirrors, scanners and auto-updaters poll continuously, so
the flat daily baseline is mostly automated traffic. Read the **shape** — bumps
above baseline after a release are real people updating — not the total._

| Image | Total (all time) | Last 30 days |
|---|---|---|
${downloadRows}
${dlPlotted.length ? `\n![Registry downloads per day](${stackedBarUrl(dlPlotted, 'byPkg', 'Registry downloads per day', PACKAGE_COLORS)})\n` : ''}`
  : '';

const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

const body = `${MARKER}
# Prism install stats

_Auto-updated ${stamp} UTC. Anonymous opt-out check-ins — a floor, not a census._

| Metric | Count |
|---|---|
| Total installs (ever seen) | ${stats.totalInstalls ?? 0} |
| Active (7 days) | ${stats.activeInstalls7d ?? 0} |
| **Active (30 days)** | ${stats.activeInstalls30d ?? 0} |
${newInstallsRows}
_**Active (30 days)** is the figure to quote: an exact, de-duplicated count of
installs still checking in — one install counts once however often it updates.
**Total** never decays, since check-in rows are never deleted, so it drifts above
reality as installs are retired. Both undercount: anything below 1.15.0 has no
check-in code at all, and opted-out or offline installs never report._

## Installs by source over time

![Installs by source over time](${sourceChart})

## Installs by version over time

![Installs by version over time](${versionChart})
${growthSection}
## By source (last 30 days)

| Source | Installs |
|---|---|
${rows(stats.byDeployment, 'deployment')}

## By version (last 30 days)

| Version | Installs |
|---|---|
${rows(stats.byVersion, 'version')}
${archSection}${downloadsSection}
${HISTORY_OPEN}
${JSON.stringify({ points: history, downloads: dlHistory })}
${HISTORY_CLOSE}
`;

writeFileSync('body.md', body);
console.log(
  `Wrote body.md: ${history.length} day(s) of history; sources+versions charted` +
    `${archSection ? ', arch table' : ''}${growthSection ? ', new-installs chart' : ''}` +
    `${downloadsSection ? `, downloads (${dlHistory.length} day(s), ${Object.keys(dlPackages).length} image(s))` : ''}.`,
);
