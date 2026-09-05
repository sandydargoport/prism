#!/usr/bin/env node
/**
 * Render the UI audit punch-list (e2e/ui-audit-artifacts/report.json) into a
 * self-contained HTML "blue-tape board" — one card per finding, screenshot
 * embedded as a data URI so the page has no external dependencies and can be
 * published directly as an Artifact.
 *
 * Usage:  node scripts/ui-audit-board.mjs
 * Output: e2e/ui-audit-artifacts/board.html
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const DIR = path.join('e2e', 'ui-audit-artifacts');
const REPORT = path.join(DIR, 'report.json');
const OUT = path.join(DIR, 'board.html');

if (!existsSync(REPORT)) {
  console.error(`No report at ${REPORT}. Run the sweep first: npm run test:ui-audit`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(REPORT, 'utf-8'));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function dataUri(file) {
  const p = path.join(DIR, file);
  if (!existsSync(p)) return '';
  return `data:image/png;base64,${readFileSync(p).toString('base64')}`;
}

const BADGE = { high: '#dc2626', medium: '#d97706', ok: '#16a34a' };

function card(f) {
  const uri = dataUri(f.screenshot);
  const overflowers = (f.probe?.overflowers || [])
    .map((o) => `<li><code>${esc(o.desc)}</code> — overhang ${o.overflow}px (w ${o.w})</li>`)
    .join('');
  // Listed separately from overhang: this is content the widget hides inside
  // itself, which leaves no visible trace in the screenshot above.
  const clipped = (f.probe?.clippedWidgets || [])
    .map((c) => `<li><code>${esc(c.widget)}</code> — ${c.hiddenY}px cut from a ${c.boxH}px box</li>`)
    .join('');
  return `
  <article class="card sev-${f.severity}">
    <header>
      <span class="badge" style="background:${BADGE[f.severity]}">${f.severity.toUpperCase()}</span>
      <strong>${esc(f.route)}</strong>
      <span class="meta">${esc(f.viewport)} · ${f.width}×${f.height} · scale ${f.scale}%</span>
    </header>
    <p class="summary">${esc(f.summary)}</p>
    ${overflowers ? `<details><summary>overhanging elements</summary><ul>${overflowers}</ul></details>` : ''}
    ${clipped ? `<details><summary>widgets hiding content</summary><ul>${clipped}</ul></details>` : ''}
    ${uri ? `<a href="${uri}" target="_blank"><img loading="lazy" src="${uri}" alt="${esc(f.route)} ${esc(f.viewport)}"></a>` : '<p class="noshot">(no screenshot)</p>'}
  </article>`;
}

const t = report.totals || { checks: 0, high: 0, medium: 0, ok: 0 };
const flagged = (report.findings || []).filter((f) => f.severity !== 'ok');
const okCount = t.ok;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prism UI Audit — blue-tape board</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#111; --card:#f6f7f9; --line:#e3e6ea; --muted:#667; }
  @media (prefers-color-scheme: dark){ :root{ --bg:#0f1115; --fg:#e8eaed; --card:#181b21; --line:#282d36; --muted:#99a; } }
  *{box-sizing:border-box} body{margin:0;font:15px/1.5 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
  header.top{padding:24px;border-bottom:1px solid var(--line)}
  h1{margin:0 0 6px;font-size:20px} .tallies{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted)}
  .tally b{font-size:20px;color:var(--fg)}
  main{padding:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
  .card{background:var(--card);border:1px solid var(--line);border-left-width:4px;border-radius:10px;padding:12px;overflow:hidden}
  .card.sev-high{border-left-color:${BADGE.high}} .card.sev-medium{border-left-color:${BADGE.medium}} .card.sev-ok{border-left-color:${BADGE.ok}}
  .card header{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}
  .badge{color:#fff;font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px}
  .meta{color:var(--muted);font-size:12px} .summary{margin:4px 0 8px}
  code{font-size:12px;background:rgba(127,127,127,.15);padding:1px 4px;border-radius:4px}
  details{margin:0 0 8px;font-size:13px} details ul{margin:6px 0 0;padding-left:18px}
  img{width:100%;height:auto;border:1px solid var(--line);border-radius:6px;display:block}
  .noshot{color:var(--muted);font-size:13px} section h2{padding:0 20px;margin:18px 0 0;font-size:15px;color:var(--muted)}
</style></head>
<body>
<header class="top">
  <h1>🩹 Prism UI Audit — blue-tape board</h1>
  <div class="tallies">
    <span class="tally"><b>${t.checks}</b> checks</span>
    <span class="tally" style="color:${BADGE.high}"><b>${t.high}</b> high</span>
    <span class="tally" style="color:${BADGE.medium}"><b>${t.medium}</b> medium</span>
    <span class="tally" style="color:${BADGE.ok}"><b>${okCount}</b> clean</span>
  </div>
</header>
${flagged.length ? `<section><h2>Flagged (${flagged.length})</h2></section><main>${flagged.map(card).join('')}</main>` : '<section><h2>No layout issues flagged 🎉</h2></section>'}
</body></html>`;

writeFileSync(OUT, html);
console.log(`Board written to ${OUT} (${flagged.length} flagged of ${t.checks} checks)`);
