/**
 * The workflows that run on pull_request_target (#1260). They run with this
 * repository's token and secrets on pull requests from forks, so they must
 * never run the pull request's code, never paste event text into a shell, and
 * ask for no more than they use. GitHub blocks pull_request_target unless an
 * Actions event policy allows it (Settings > Actions > Policies); ours allows
 * it for these workflow files and these events only, so a new trigger here is
 * blocked until the policy lists it too.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const DIR = join(__dirname, '../../../.github/workflows');
const read = (file: string) => readFileSync(join(DIR, file), 'utf8');
const files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));

/** The event policy "Allow pull_request_target for the CLA, Dependabot and needs-reply workflows". */
const POLICY = {
  files: ['cla.yml', 'dependabot-auto-merge.yml', 'needs-reply.yml'],
  events: ['pull_request_target', 'pull_request', 'issue_comment', 'issues', 'pull_request_review', 'pull_request_review_comment'],
};

/** The events a workflow listens to: the keys under its top-level `on:`. */
function eventsOf(text: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^on:\s*$/.test(l));
  const events: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const m = /^ {2}([a-z_]+):/.exec(line);
    if (m) events.push(m[1]!);
  }
  return events;
}

/** Every `run:` script in a workflow, inline or as a block. */
function runScripts(text: string): string[] {
  const lines = text.split('\n');
  const scripts: string[] = [];
  lines.forEach((line, i) => {
    const m = /^(\s*)(?:- )?run:\s*(.*)$/.exec(line);
    if (!m) return;
    if (!/^[|>]/.test(m[2]!)) { scripts.push(m[2]!); return; }
    const indent = m[1]!.length;
    const body: string[] = [];
    for (const next of lines.slice(i + 1)) {
      if (next.trim() && next.search(/\S/) <= indent) break;
      body.push(next);
    }
    scripts.push(body.join('\n'));
  });
  return scripts;
}

const targeted = files.filter((f) => eventsOf(read(f)).includes('pull_request_target'));

describe('pull_request_target workflows', () => {
  it('are only the CLA check and needs-reply, both under the event policy', () => {
    expect(targeted.sort()).toEqual(['cla.yml', 'needs-reply.yml']);
    for (const f of targeted) expect(POLICY.files).toContain(f);
  });

  it('listen only to events the policy allows, so no trigger of theirs is blocked', () => {
    for (const f of POLICY.files) {
      for (const event of eventsOf(read(f))) expect(`${f}: ${event}`).toBe(`${f}: ${POLICY.events.includes(event) ? event : 'not in the policy'}`);
    }
  });

  it.each(POLICY.files)('%s never checks out, fetches or builds the pull request', (f) => {
    const text = read(f);
    expect(text).not.toMatch(/actions\/checkout|gh pr checkout|git (fetch|checkout|clone)|\bnpm |\bnpx |\byarn |\bpnpm /);
  });

  it.each(POLICY.files)('%s passes event values to its scripts through env, never pasted into the shell', (f) => {
    for (const script of runScripts(read(f))) expect(script).not.toContain('${{');
  });
});

describe('the CLA check', () => {
  const cla = read('cla.yml');

  it('asks only for what the CLA action uses', () => {
    // actions: re-runs the check after a signature; contents: commits the signature
    // to cla-signatures; pull-requests: comments and locks. It sets no commit status.
    const block = /^permissions:\n((?: {2}.*\n)+)/m.exec(cla)![1]!;
    expect(block.trim().split('\n').map((l) => l.trim()).sort()).toEqual(['actions: write', 'contents: write', 'pull-requests: write']);
  });

  it('is given only the built-in token', () => {
    // The action uses a personal token only for signatures kept in another repository.
    expect([...cla.matchAll(/secrets\.(\w+)/g)].map((m) => m[1])).toEqual(['GITHUB_TOKEN']);
    expect(cla).not.toMatch(/remote-(organization|repository)-name/);
  });
});

describe('Dependabot auto-merge', () => {
  const auto = read('dependabot-auto-merge.yml');

  it('runs on pull_request, where a fork gets a read-only token and no secrets', () => {
    expect(eventsOf(auto)).toEqual(['pull_request']);
  });

  it('acts only on a pull request Dependabot opened, in this repository', () => {
    expect(auto).toMatch(/if: github\.event\.pull_request\.user\.login == 'dependabot\[bot\]' && !github\.event\.repository\.fork/);
    const conditions = auto.match(/^\s*if: .*$/gm)!.join('\n');
    expect(conditions).not.toMatch(/github\.actor/);
  });
});
