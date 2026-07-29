/**
 * UI audit rig.
 *
 * Sweeps the app across routes × viewports × display-scales, runs the
 * `layoutProbe` detectors at each stop, screenshots it, and writes a punch-list
 * to e2e/ui-audit-artifacts/report.json (render into a board with
 * `node scripts/ui-audit-board.mjs`).
 *
 * This is a DIAGNOSTIC, not a gate — it collects findings and never fails the
 * build on a layout issue (so it can run in CI and upload the board as an
 * artifact). Assertions are limited to "the sweep ran".
 *
 * TEST-ENVIRONMENT DEPENDENCY (same as visual-regression.spec.ts):
 * - Requires a fresh, synthetic-seed DB. Gated on E2E_HAS_TEST_DB=1; without
 *   it the sweep is skipped by design (login PINs are unknown on a live
 *   deployment, and resetAll would wipe real data). NEVER run against a live
 *   instance.
 *
 * Display scale note: the setting is `layouts.font_scale`, applied as CSS
 * `zoom` on a server-rendered wrapper (src/app/page.tsx). It is read from the
 * DB at SSR time, so the rig sets it via a DB UPDATE before navigating — a
 * client-side localStorage tweak would not take effect.
 */

import { test, expect, Page } from '@playwright/test';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { loginViaAPI } from './helpers/auth';
import { resetAll } from './helpers/reset';
import { ALL_NAV_ITEMS } from '../src/lib/constants/navItems';
import { layoutProbe, gradeProbe, type LayoutProbeResult, type Severity } from './helpers/ui-detectors';

const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const TOLERANCE = 2; // px slack before flagging overflow
const OUT_DIR = path.join('e2e', 'ui-audit-artifacts');

const VIEWPORTS = [
  { name: 'mobile', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'wall', width: 1920, height: 1080 },
] as const;

// Display-scale is only applied on the dashboard/display wrapper, so the scale
// sweep targets '/' (the reported "navbar cut off at 75%" repro).
const SCALES = [75, 125, 150] as const; // 100 covered by the viewport sweep

interface Finding {
  route: string;
  viewport: string;
  width: number;
  height: number;
  scale: number;
  severity: Severity;
  summary: string;
  probe: LayoutProbeResult;
  screenshot: string;
}

/** Run a DB statement through the same channel resetAll/getSeededParentName use. */
function execDb(sql: string): void {
  const cmd = process.env.DATABASE_URL
    ? `psql "${process.env.DATABASE_URL}" -c "${sql}"`
    : `docker exec prism-db psql -U prism -d ${process.env.E2E_DB_NAME || 'prism'} -c "${sql}"`;
  execSync(cmd, { encoding: 'utf-8' });
}

function getSeededParentName(): string {
  const sel = "SELECT name FROM users WHERE role = 'parent' ORDER BY created_at LIMIT 1";
  const cmd = process.env.DATABASE_URL
    ? `psql "${process.env.DATABASE_URL}" -At -c "${sel}"`
    : `docker exec prism-db psql -U prism -d ${process.env.E2E_DB_NAME || 'prism'} -At -c "${sel}"`;
  const out = execSync(cmd, { encoding: 'utf-8' }).trim();
  if (!out) throw new Error('No seeded parent in DB — did seeds run?');
  return out;
}

function setDefaultFontScale(scale: number | null): void {
  execDb(`UPDATE layouts SET font_scale = ${scale === null ? 'NULL' : scale} WHERE is_default = true`);
}

function slug(route: string): string {
  return route === '/' ? 'dashboard' : route.replace(/^\//, '').replace(/\//g, '-');
}

async function probeRoute(
  page: Page,
  route: string,
  viewport: { name: string; width: number; height: number },
  scale: number,
): Promise<Finding> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(route);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);

  const probe = await page.evaluate(layoutProbe, TOLERANCE);
  const { severity, summary } = gradeProbe(probe);

  const name = `${slug(route)}__${viewport.name}__s${scale}.png`;
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false, animations: 'disabled' });

  return {
    route,
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    scale,
    severity,
    summary,
    probe,
    screenshot: name,
  };
}

test.describe('UI audit sweep', () => {
  let parentName: string;

  test.beforeAll(() => {
    if (HAS_TEST_DB) {
      resetAll();
      parentName = getSeededParentName();
      mkdirSync(OUT_DIR, { recursive: true });
    }
  });

  test.afterAll(() => {
    if (HAS_TEST_DB) setDefaultFontScale(null); // restore default zoom
  });

  test('sweep routes × viewports × scale', async ({ page }) => {
    test.skip(!HAS_TEST_DB, 'Set E2E_HAS_TEST_DB=1 against a fresh-seeded DB');
    test.setTimeout(10 * 60 * 1000);

    await page.addInitScript(() => {
      localStorage.setItem('prism-theme', 'light');
      localStorage.setItem('prism:auto-hide-ui', 'false');
    });
    await loginViaAPI(page, parentName);

    const findings: Finding[] = [];
    const routes = ALL_NAV_ITEMS.map((n) => n.href);

    // 1) Every route across every viewport at default scale (100%).
    for (const route of routes) {
      for (const vp of VIEWPORTS) {
        findings.push(await probeRoute(page, route, vp, 100));
      }
    }

    // 2) Display-scale sweep on the dashboard (where the zoom wrapper applies).
    for (const scale of SCALES) {
      setDefaultFontScale(scale);
      for (const vp of [VIEWPORTS[3], VIEWPORTS[4]]) {
        // laptop + wall
        findings.push(await probeRoute(page, '/', vp, scale));
      }
    }
    setDefaultFontScale(null);

    const summary = {
      generatedAtNote: 'timestamp added by scripts/ui-audit-board.mjs at render time',
      totals: {
        checks: findings.length,
        high: findings.filter((f) => f.severity === 'high').length,
        medium: findings.filter((f) => f.severity === 'medium').length,
        ok: findings.filter((f) => f.severity === 'ok').length,
      },
      findings: findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    };
    writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(summary, null, 2));

    // Surface a console summary; do not fail the build (diagnostic only).
    console.log(
      `[ui-audit] ${summary.totals.checks} checks — ` +
        `${summary.totals.high} high, ${summary.totals.medium} medium, ${summary.totals.ok} ok`,
    );
    for (const f of summary.findings.filter((x) => x.severity !== 'ok')) {
      console.log(`  [${f.severity}] ${f.route} @ ${f.viewport} ×${f.scale}% — ${f.summary}`);
    }

    expect(summary.totals.checks).toBeGreaterThan(0);
  });
});

function severityRank(s: Severity): number {
  return s === 'high' ? 2 : s === 'medium' ? 1 : 0;
}
