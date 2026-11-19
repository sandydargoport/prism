/**
 * scripts/backup.sh, run for real against a local folder standing in for the
 * off-site remote. pg_dump and rclone are small stand-ins on PATH: pg_dump
 * writes a dump-sized blob, rclone copies and checks plain folders.
 */
import { execFileSync } from 'child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const SCRIPT = resolve(__dirname, '../../../scripts/backup.sh');

const FAKE_PG_DUMP = `#!/bin/sh
head -c 40000 /dev/urandom
`;

// Just enough of rclone: copy (a file or a folder, with one --include
// pattern), check --one-way (every source file must be at the destination),
// delete and sync do nothing here.
const FAKE_RCLONE = `#!/bin/sh
cmd="$1"; shift
src="$1"; dst="$2"; shift 2
pat='*'
while [ $# -gt 0 ]; do
  if [ "$1" = "--include" ]; then pat="$2"; shift; fi
  shift
done
case "$cmd" in
  copy)
    mkdir -p "$dst"
    if [ -d "$src" ]; then
      for f in "$src"/$pat; do [ -f "$f" ] && cp "$f" "$dst/"; done
    else
      cp "$src" "$dst/"
    fi ;;
  check)
    missing=0
    for f in "$src"/*; do
      [ -f "$f" ] || continue
      if ! cmp -s "$f" "$dst/$(basename "$f")"; then echo "missing: $(basename "$f")"; missing=1; fi
    done
    exit $missing ;;
esac
exit 0
`;

/** A dump name for `daysAgo` days back, in the form the script writes. */
function dumpName(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `prism_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_030000.sql.gz`;
}

describe('backup.sh off-site copy', () => {
  let root: string;
  let local: string;
  let remote: string;
  let bin: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'prism-backup-'));
    local = join(root, 'backups');
    remote = join(root, 'remote', 'backups');
    bin = join(root, 'bin');
    mkdirSync(local);
    mkdirSync(remote, { recursive: true });
    mkdirSync(bin);
    writeFileSync(join(bin, 'pg_dump'), FAKE_PG_DUMP);
    writeFileSync(join(bin, 'rclone'), FAKE_RCLONE);
    chmodSync(join(bin, 'pg_dump'), 0o755);
    chmodSync(join(bin, 'rclone'), 0o755);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const run = (env: Record<string, string> = {}): string =>
    execFileSync('sh', [SCRIPT], {
      env: {
        ...process.env,
        HC_URL: '',
        PATH: `${bin}:${process.env.PATH}`,
        BACKUP_DIR: local,
        RCLONE_REMOTE: remote,
        RETENTION_DAYS: '7',
        RCLONE_RETENTION_DAYS: '30',
        ...env,
      },
      encoding: 'utf8',
    });

  it('uploads an earlier night that never reached off-site, and the verify passes', () => {
    const missed = dumpName(2);
    writeFileSync(join(local, missed), 'an earlier dump whose upload failed');

    const out = run();

    expect(existsSync(join(remote, missed))).toBe(true);
    expect(readdirSync(remote).filter((f) => f.startsWith('prism_'))).toHaveLength(2);
    expect(out).toContain('Database off-site verify OK');
    expect(out).toContain('Backup process complete.');
  });

  it('says why when off-site copies are kept shorter than local ones', () => {
    const out = run({ RCLONE_RETENTION_DAYS: '3' });

    expect(out).toContain('RCLONE_RETENTION_DAYS (3) is shorter than RETENTION_DAYS (7)');
    expect(out).toContain('off-site sync had failures');
  });
});
