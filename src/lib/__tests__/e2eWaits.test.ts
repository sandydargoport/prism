/**
 * API responses are sent Cache-Control: no-store, and with nothing stored
 * Chromium keeps any response body the page never reads open for the life of
 * the page. waitForLoadState('networkidle') then never resolves on a page that
 * ignores one (a 401 checked only by status), and the suite times out. e2e
 * waits use waitForQuiet (e2e/helpers/network.ts) instead.
 */
import fs from 'node:fs';
import path from 'node:path';

const E2E = path.resolve(__dirname, '../../../e2e');

function specFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return specFiles(full);
    return /\.ts$/.test(entry.name) && entry.name !== 'network.ts' ? [full] : [];
  });
}

it('no e2e code waits for networkidle', () => {
  const found = specFiles(E2E).flatMap((file) =>
    fs.readFileSync(file, 'utf8').split('\n').flatMap((line, i) =>
      /networkidle/.test(line) ? [`${path.relative(E2E, file)}:${i + 1}`] : [],
    ),
  );
  expect(found).toEqual([]);
});
