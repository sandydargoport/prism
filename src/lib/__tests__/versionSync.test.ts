/**
 * @jest-environment node
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// scripts/check-version-sync.sh, run against throwaway copies of the three
// version files. The HA add-on may stay on the last tagged release while a
// release is held, since HA pulls the image of that version (#751).

const SCRIPT = path.join(__dirname, '../../../scripts/check-version-sync.sh');

function run(pkg: string, ha: string): number | null {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'version-sync-'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.mkdirSync(path.join(dir, 'docs'));
  fs.mkdirSync(path.join(dir, 'ha-app'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts/check-version-sync.sh'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: pkg }));
  fs.writeFileSync(
    path.join(dir, 'docs/CHANGELOG.md'),
    '# Changelog\n\n## Unreleased\n\n## [2.1.0] – 2026-01-02\n\n## [2.0.0] – 2026-01-01\n',
  );
  fs.writeFileSync(path.join(dir, 'ha-app/config.yaml'), `name: Prism\nversion: "${ha}"\n`);
  const result = spawnSync('bash', [path.join(dir, 'scripts/check-version-sync.sh')], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  return result.status;
}

describe('check-version-sync.sh', () => {
  it('passes with the add-on on the released version', () => {
    expect(run('2.1.0', '2.1.0')).toBe(0);
  });

  it('passes with the add-on one release behind, while the release is untagged', () => {
    expect(run('2.1.0', '2.0.0')).toBe(0);
  });

  it('fails with the add-on on any other version', () => {
    expect(run('2.1.0', '1.9.0')).toBe(1);
    expect(run('2.1.0', '2.2.0')).toBe(1);
  });

  it('fails when package.json and the changelog disagree', () => {
    expect(run('2.2.0', '2.1.0')).toBe(1);
  });
});
