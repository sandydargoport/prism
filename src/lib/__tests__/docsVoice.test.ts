import fs from 'fs';
import path from 'path';

/**
 * The docs speak in one voice (#1122): each page in the menu is titled with
 * the plain name the menu shows, engineering specs stay out of the menu, and
 * every docs link in the app lands on a page and heading that exist.
 */
const ROOT = path.resolve(__dirname, '../../..');
const DOCS = path.join(ROOT, 'docs');
const mkdocs = fs.readFileSync(path.join(ROOT, 'mkdocs.yml'), 'utf8');
const nav = mkdocs.slice(mkdocs.indexOf('\nnav:'), mkdocs.indexOf('\nnot_in_nav:'));

/** [menu name, page] for every page in the menu. */
const pages = [...nav.matchAll(/^\s+- ([^:\n]+): (\S+\.md)$/gm)].map((m) => [m[1]!.trim(), m[2]!] as const);

const title = (file: string) => fs.readFileSync(path.join(DOCS, file), 'utf8').match(/^# (.+)$/m)?.[1]?.trim();

/** Python-Markdown's toc slug, which mkdocs uses for heading anchors. */
const slug = (h: string) => h.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/[\s-]+/g, '-');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

describe('docs voice', () => {
  it('finds the menu', () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  it('titles each page with its menu name', () => {
    const mismatched = pages
      .filter(([, file]) => !['index.md', 'screenshots.md'].includes(file))
      .filter(([name, file]) => title(file)?.toLowerCase() !== name.toLowerCase())
      .map(([name, file]) => `${file}: menu "${name}", title "${title(file)}"`);
    expect(mismatched).toEqual([]);
  });

  it('keeps engineering specs and the unhosted demo out of the menu', () => {
    const files = pages.map(([, f]) => f);
    expect(files).not.toContain('features/global-input-system.md');
    expect(files).not.toContain('demo-deployment.md');
  });

  it('links between docs pages land on headings that exist', () => {
    const anchorsOf = (file: string) => {
      const text = fs.readFileSync(file, 'utf8').replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
      return [...text.matchAll(/^#{1,6} (.+)$/gm)].map((h) => slug(h[1]!));
    };
    const broken: string[] = [];
    for (const [, page] of pages) {
      const from = path.join(DOCS, page);
      const text = fs.readFileSync(from, 'utf8');
      for (const m of text.matchAll(/\]\(([\w./-]*?\.md)?#([\w-]+)\)/g)) {
        const target = m[1] ? path.resolve(path.dirname(from), m[1]) : from;
        if (!fs.existsSync(target) || !anchorsOf(target).includes(m[2]!)) broken.push(`${page} -> ${m[1] ?? ''}#${m[2]}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('orders each feature page as Set it up, then Use it, then Details', () => {
    const grouped = ['DASHBOARD', 'CALENDAR', 'SHOPPING', 'RECIPES', 'TASKS', 'CHORES', 'GOALS', 'MESSAGES', 'WISHES',
      'PHOTOS', 'TRAVEL', 'WEEKEND', 'BUS', 'DISPLAY-MODES', 'MOBILE', 'KROGER', 'BIRTHDAYS'];
    const order = ['Set it up', 'Use it', 'Details'];
    for (const name of grouped) {
      const text = fs.readFileSync(path.join(DOCS, 'features', `${name}.md`), 'utf8').replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
      const h2 = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]!.trim());
      // Only the three groups at the top level, in order, Use it always there.
      expect([name, h2]).toEqual([name, order.filter((g) => h2.includes(g))]);
      expect([name, h2.includes('Use it')]).toEqual([name, true]);
    }
  });

  it('lists every integration on the services page (#1145)', () => {
    // Each integration file and the service name its row on the page carries.
    const listed: Record<string, string> = {
      'aurora.ts': 'NOAA aurora forecast',
      'bus-email-parser.ts': 'FirstView bus emails',
      'caldav.ts': 'CalDAV servers',
      'carddav.ts': 'Contacts over CardDAV',
      'gmail.ts': 'Gmail',
      'google-calendar.ts': 'Google Calendar',
      'immich.ts': 'Immich',
      'kroger/client.ts': 'Kroger',
      'mealie.ts': 'Mealie',
      'onedrive.ts': 'OneDrive',
      'openmeteo.ts': 'Open-Meteo',
      'openweather.ts': 'OpenWeatherMap',
      'pirateweather.ts': 'Pirate Weather',
      'product-lookup.ts': 'Open Food Facts and UPCitemdb',
      'shopping/microsoft-todo.ts': 'Microsoft To Do: shopping lists',
      'tandoor.ts': 'Tandoor',
      'tasks/google-tasks.ts': 'Google Tasks',
      'tasks/microsoft-todo.ts': 'Microsoft To Do: tasks',
      'wish-items/microsoft-todo.ts': 'Microsoft To Do: wish lists',
    };
    // Sign-in plumbing, provider registries and on-device sky maths: no service of their own.
    const helpers = new Set([
      'credentialStore.ts', 'eclipse.ts', 'googleCalendarStore.ts', 'googleManualConnect.ts',
      'googleManualScopes.ts', 'googleScopes.ts', 'kroger/redirect.ts', 'kroger/tokens.ts', 'moon.ts',
      'oauth-userinfo.ts', 'oauthSetupRedirect.ts', 'resolveRedirectUri.ts', 'weather.ts',
      'shopping/index.ts', 'shopping/types.ts', 'tasks/index.ts', 'tasks/providerAuth.ts', 'tasks/types.ts',
      'wish-items/index.ts', 'wish-items/types.ts',
    ]);
    const dir = path.join(ROOT, 'src/lib/integrations');
    const files = sourceFiles(dir).map((f) => path.relative(dir, f).split(path.sep).join('/'));
    // A new integration file needs a row on the page (and an entry above) before it ships.
    expect(files.filter((f) => !(f in listed) && !helpers.has(f))).toEqual([]);

    expect(pages.map(([, f]) => f)).toContain('integrations.md');
    const rows = fs.readFileSync(path.join(DOCS, 'integrations.md'), 'utf8')
      .split('\n').filter((l) => l.startsWith('| **'));
    const missing = Object.entries(listed)
      .filter(([, name]) => !rows.some((r) => r.includes(name)))
      .map(([file, name]) => `${file}: no row naming "${name}"`);
    expect(missing).toEqual([]);
  });

  it('sends every docs link in the app to a page and heading that exist', () => {
    const broken: string[] = [];
    for (const file of sourceFiles(path.join(ROOT, 'src'))) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/sandydargoport\.github\.io\/prism\/([\w\-/]*?)\/?(?:#([\w-]+))?['"`]/g)) {
        const page = m[1] ? `${m[1]}.md` : 'index.md';
        const md = path.join(DOCS, page);
        if (!fs.existsSync(md)) { broken.push(`${path.relative(ROOT, file)}: ${page}`); continue; }
        const anchor = m[2];
        if (anchor) {
          const anchors = [...fs.readFileSync(md, 'utf8').matchAll(/^#{1,6} (.+)$/gm)].map((h) => slug(h[1]!));
          if (!anchors.includes(anchor)) broken.push(`${path.relative(ROOT, file)}: ${page}#${anchor}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});
