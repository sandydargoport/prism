/**
 * @jest-environment node
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// scripts/check-ha-image.sh against a throwaway add-on config, with a fake
// curl standing in for GHCR. A release PR must not merge while the version
// it offers Home Assistant has no image (#751, #757).

const SCRIPT = path.join(__dirname, '../../../scripts/check-ha-image.sh');

/** Answers like GHCR: a token, then 200 for a published image and 404 otherwise. */
const FAKE_CURL = `#!/usr/bin/env bash
url="\${@: -1}"
case "$url" in
  */token*) echo '{"token":"t"}' ;;
  */manifests/*)
    repo=$(echo "$url" | sed -E 's#.*/v2/(.*)/manifests/(.*)#\\1:\\2#')
    if [[ " $FAKE_PUBLISHED " == *" $repo "* ]]; then echo -n 200; else echo -n 404; fi ;;
esac
`;

function run(version: string, published: string[]): { status: number | null; out: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ha-image-'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.mkdirSync(path.join(dir, 'ha-app'));
  fs.mkdirSync(path.join(dir, 'bin'));
  fs.copyFileSync(SCRIPT, path.join(dir, 'scripts/check-ha-image.sh'));
  fs.writeFileSync(
    path.join(dir, 'ha-app/config.yaml'),
    `name: Prism\nversion: "${version}"\narch:\n  - amd64\n  - aarch64\ninit: false\n`,
  );
  fs.writeFileSync(path.join(dir, 'bin/curl'), FAKE_CURL, { mode: 0o755 });
  const result = spawnSync('bash', [path.join(dir, 'scripts/check-ha-image.sh')], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`, FAKE_PUBLISHED: published.join(' ') },
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return { status: result.status, out: result.stdout + result.stderr };
}

const both = (v: string) => [`sandydargoport/prism-ha-amd64:${v}`, `sandydargoport/prism-ha-aarch64:${v}`];

describe('check-ha-image.sh', () => {
  it('passes when every architecture has the offered version', () => {
    expect(run('2.1.0', both('2.1.0')).status).toBe(0);
  });

  it('fails a release whose tag has not been built yet, naming what is missing', () => {
    const { status, out } = run('2.1.0', both('2.0.0'));
    expect(status).toBe(1);
    expect(out).toContain('prism-ha-amd64:2.1.0');
    expect(out).toContain('prism-ha-aarch64:2.1.0');
  });

  it('fails while one architecture is still building', () => {
    const { status, out } = run('2.1.0', ['sandydargoport/prism-ha-amd64:2.1.0']);
    expect(status).toBe(1);
    expect(out).toContain('prism-ha-aarch64:2.1.0');
    expect(out).not.toContain('prism-ha-amd64:2.1.0\n');
  });
});
