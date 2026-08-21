// Builds the body for the pinned "Install stats" dashboard issue.
//
// Reads:
//   stats.json  - the current /stats snapshot from the collector Worker
//   prev.md     - the existing issue body (may be empty on first run); its
//                 embedded history block is the rolling time-series datastore
// Writes:
//   body.md     - the new issue body (current tables + stacked-bar chart +
//                 refreshed hidden history)
//
// The issue is both the display and the datastore, so no branch, file, or
// database is needed to keep adoption history. One data point per day, deduped.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const MARKER = '<!-- PRISM_STATS_DASHBOARD -->';
const HISTORY_OPEN = '<!-- PRISM_STATS_HISTORY';
const HISTORY_CLOSE = '-->';
const CHART_WINDOW = 90; // most-recent days to plot

// Stable colors for known sources; anything new draws from the fallback palette.
const SOURCE_COLORS = {
  docker: '#2496ed',
  ha: '#41bdf5',
  pikapods: '#7b61ff',
  local: '#8395a7',
  unknown: '#b2bec3',
};
const FALLBACK = ['#e17055', '#00b894', '#fdcb6e', '#0984e3', '#d63031', '#a29bfe'];

function readHistory(prev) {
  const start = prev.indexOf(HISTORY_OPEN);
  if (start === -1) return [];
  const rest = prev.slice(start + HISTORY_OPEN.length);
  const end = rest.indexOf(HISTORY_CLOSE);
  const json = (end === -1 ? rest : rest.slice(0, end)).trim();
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed.points) ? parsed.points : [];
  } catch {
    return [];
  }
}

const stats = JSON.parse(readFileSync('stats.json', 'utf8'));
const prev = existsSync('prev.md') ? readFileSync('prev.md', 'utf8') : '';
const history = readHistory(prev);

const today = (process.env.STATS_DATE || new Date().toISOString().slice(0, 10)).trim();

const sources = {};
for (const row of stats.byDeployment ?? []) {
  sources[(row.deployment || 'unknown').trim()] = row.n;
}

// Upsert today's point so re-runs on the same day overwrite rather than dupe.
const point = { date: today, sources };
const idx = history.findIndex((p) => p.date === today);
if (idx >= 0) history[idx] = point;
else history.push(point);
history.sort((a, b) => a.date.localeCompare(b.date));

// ---- stacked bar chart (QuickChart) ----
const plotted = history.slice(-CHART_WINDOW);
const allSources = [...new Set(plotted.flatMap((p) => Object.keys(p.sources)))].sort();
let fi = 0;
const datasets = allSources.map((s) => ({
  label: s,
  data: plotted.map((p) => p.sources[s] ?? 0),
  backgroundColor: SOURCE_COLORS[s] ?? FALLBACK[fi++ % FALLBACK.length],
}));
const chartConfig = {
  type: 'bar',
  data: { labels: plotted.map((p) => p.date), datasets },
  options: {
    plugins: {
      title: { display: true, text: 'Prism installs by source over time' },
      legend: { position: 'bottom' },
    },
    scales: {
      x: { stacked: true },
      y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
    },
  },
};
const chartUrl =
  'https://quickchart.io/chart?bkg=white&w=760&h=360&v=4&c=' +
  encodeURIComponent(JSON.stringify(chartConfig));

// ---- current snapshot tables ----
const rows = (arr, key) =>
  arr && arr.length ? arr.map((r) => `| ${r[key]} | ${r.n} |`).join('\n') : '| _(none yet)_ | |';

const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);

const body = `${MARKER}
# Prism install stats

_Auto-updated ${stamp} UTC. Aggregate opt-out telemetry, so treat it as a floor, not a census._

| Metric | Count |
|---|---|
| Total installs | ${stats.totalInstalls ?? 0} |
| Active (7 days) | ${stats.activeInstalls7d ?? 0} |
| Active (30 days) | ${stats.activeInstalls30d ?? 0} |

## Adoption by source over time

![Prism installs by source over time](${chartUrl})

## By source (last 30 days)

| Source | Installs |
|---|---|
${rows(stats.byDeployment, 'deployment')}

## By version (last 30 days)

| Version | Installs |
|---|---|
${rows(stats.byVersion, 'version')}

${HISTORY_OPEN}
${JSON.stringify({ points: history })}
${HISTORY_CLOSE}
`;

writeFileSync('body.md', body);
console.log(
  `Wrote body.md: ${history.length} day(s) of history, sources = ${allSources.join(', ') || 'none'}, chart url ${chartUrl.length} chars`,
);
