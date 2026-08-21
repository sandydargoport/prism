// Builds the body for the pinned "Install stats" dashboard issue.
//
// Reads:
//   stats.json  - the current /stats snapshot from the collector Worker
//   prev.md     - the existing issue body (may be empty on first run); its
//                 embedded history block is the rolling time-series datastore
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

function readHistory(prev) {
  const start = prev.indexOf(HISTORY_OPEN);
  if (start === -1) return [];
  const rest = prev.slice(start + HISTORY_OPEN.length);
  const end = rest.indexOf(HISTORY_CLOSE);
  const raw = (end === -1 ? rest : rest.slice(0, end)).trim();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.points) ? parsed.points : [];
  } catch {
    return [];
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
      datasets: [{ label: 'new installs', data: rows.map((r) => r.n), backgroundColor: '#00b894' }],
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
const history = readHistory(prev);
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
const newInstallsRows =
  stats.newInstalls7d != null || stats.newInstalls30d != null
    ? `| New installs (7 days) | ${stats.newInstalls7d ?? 0} |\n| New installs (30 days) | ${stats.newInstalls30d ?? 0} |\n`
    : '';

const growthSection =
  Array.isArray(stats.newInstallsByWeek) && stats.newInstallsByWeek.length
    ? `\n## New installs per week\n\n![New installs per week](${barUrl(stats.newInstallsByWeek, 'week', 'New installs per week')})\n`
    : '';

const archSection =
  Array.isArray(stats.byArch) && stats.byArch.length
    ? `\n## By architecture (last 30 days)\n\n| Arch | Installs |\n|---|---|\n${rows(stats.byArch, 'arch')}\n`
    : '';

const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

const body = `${MARKER}
# Prism install stats

_Auto-updated ${stamp} UTC. Aggregate opt-out telemetry, so treat it as a floor, not a census._

| Metric | Count |
|---|---|
| Total installs | ${stats.totalInstalls ?? 0} |
| Active (7 days) | ${stats.activeInstalls7d ?? 0} |
| Active (30 days) | ${stats.activeInstalls30d ?? 0} |
${newInstallsRows}
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
${archSection}
${HISTORY_OPEN}
${JSON.stringify({ points: history })}
${HISTORY_CLOSE}
`;

writeFileSync('body.md', body);
console.log(
  `Wrote body.md: ${history.length} day(s) of history; sources+versions charted` +
    `${archSection ? ', arch table' : ''}${growthSection ? ', new-installs chart' : ''}.`,
);
