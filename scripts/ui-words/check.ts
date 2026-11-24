/**
 * Finds retired UI words (#1337) in the text a user reads: JSX text and
 * string literals in `src/**\/*.tsx`, the English messages, Help and the
 * feature docs. The words and their replacements are in `src/lib/uiWords.ts`.
 *
 * While the screens redesign is in flight this is a ratchet: the committed
 * baseline holds the count of each word in each file, and the check fails
 * when a count changes. A rise means new text used a retired word; a drop
 * means the baseline should be lowered so the word cannot come back.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { RETIRED_UI_WORDS, type RetiredUiWord } from '../../src/lib/uiWords';

export const ROOT = path.resolve(__dirname, '../..');
export const BASELINE_PATH = path.join(ROOT, 'scripts/ui-words-baseline.json');

/** A piece of user-visible text and the line it starts on. */
export type Segment = { line: number; text: string };

export type Hit = { file: string; word: string; line: number; text: string };

/** file -> word -> count. Files and words with no hits are left out. */
export type Counts = Record<string, Record<string, number>>;

// Attributes whose values are never read by a user.
const CODE_ATTRS = new Set([
  'className', 'key', 'id', 'href', 'src', 'type', 'name', 'htmlFor', 'role', 'rel',
  'target', 'method', 'action', 'inputMode', 'autoComplete', 'lang', 'dir', 'ref',
  'style', 'viewBox', 'd', 'fill', 'stroke', 'xmlns', 'as', 'variant', 'size',
]);
// Calls whose string arguments are class names, keys, selectors or logs.
const CODE_CALLS = new Set([
  'cn', 'clsx', 'classNames', 'twMerge', 'cva', 'require', 'getItem', 'setItem',
  'removeItem', 'addEventListener', 'removeEventListener', 'querySelector',
  'querySelectorAll', 'getElementById', 'fetch', 'useTranslations', 'matchMedia',
  'log', 'warn', 'error', 'info', 'debug', 'startsWith', 'endsWith', 'includes',
  'split', 'replace', 'join', 'getAttribute', 'setAttribute', 'hasAttribute',
  'createElement', 'dispatchEvent', 'postMessage', 'mark', 'measure',
]);

/**
 * A string with no space that starts lower case or carries code punctuation
 * is a key, a mode value or a path (`'resting'`, `'prism-screensaver-on'`),
 * not a label. A one-word label starts upper case (`'Resting'`).
 */
export function looksLikeIdentifier(s: string): boolean {
  const t = s.trim();
  if (t === '') return true;
  if (/\s/.test(t)) return false;
  return /^[a-z0-9]/.test(t) || /[-_/.:#@=[\]{}()]/.test(t) || /[a-z][A-Z]/.test(t);
}

function calleeName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return undefined;
}

function isCodeString(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isLiteralTypeNode(parent)) return true;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent)) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isComputedPropertyName(parent)) return true;
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  if (ts.isCaseClause(parent)) return true;
  if (ts.isBinaryExpression(parent) && [
    ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
  ].includes(parent.operatorToken.kind)) return true;
  // Walk up through expressions to the attribute or call that owns the string.
  for (let n: ts.Node | undefined = parent; n; n = n.parent) {
    if (ts.isJsxAttribute(n)) {
      const attr = n.name.getText();
      return CODE_ATTRS.has(attr) || attr.startsWith('data-');
    }
    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      const name = calleeName(n.expression);
      if (name && CODE_CALLS.has(name)) return true;
      if (ts.isNewExpression(n) && name && /^(URL|RegExp|Error)$/.test(name)) return true;
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
    }
    if (ts.isStatement(n) || ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) break;
  }
  return false;
}

/** The user-visible text in a .tsx source: JSX text and string literals that are not code. */
export function tsxSegments(source: string, fileName = 'file.tsx'): Segment[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Segment[] = [];
  const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, ' ').trim();
      if (text) out.push({ line: lineOf(node.getStart(sf)), text });
    } else if (
      ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)
    ) {
      const owner = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node : node.parent;
      if (!looksLikeIdentifier(node.text) && !isCodeString(owner)) {
        out.push({ line: lineOf(node.getStart(sf)), text: node.text });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** The prose in a Markdown page: code, comments and link targets left out. */
export function markdownSegments(source: string): Segment[] {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  const text = source
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, blank)
    .replace(/`[^`\n]*`/g, blank)
    .replace(/\]\([^)\s]*\)/g, (m) => ']' + blank(m.slice(1)))
    .replace(/\{#[^}]*\}/g, blank)
    .replace(/https?:\/\/\S+/g, blank);
  return text.split('\n')
    .map((t, i) => ({ line: i + 1, text: t.trim() }))
    .filter((s) => s.text !== '');
}

/** Every string value in a messages file, with its line. */
export function jsonSegments(source: string): Segment[] {
  return source.split('\n').flatMap((t, i) => {
    const m = t.match(/^\s*"(?:[^"\\]|\\.)*"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    return m ? [{ line: i + 1, text: JSON.parse(`"${m[1]}"`) as string }] : [];
  });
}

export function segmentsFor(file: string, source: string): Segment[] {
  if (file.endsWith('.tsx')) return tsxSegments(source, file);
  if (file.endsWith('.md')) return markdownSegments(source);
  if (file.endsWith('.json')) return jsonSegments(source);
  return [];
}

export function findRetired(file: string, segments: Segment[], words: readonly RetiredUiWord[] = RETIRED_UI_WORDS): Hit[] {
  const hits: Hit[] = [];
  for (const seg of segments) {
    for (const w of words) {
      for (const _ of seg.text.matchAll(w.pattern)) hits.push({ file, word: w.word, line: seg.line, text: seg.text });
    }
  }
  return hits;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ['__tests__', 'test-utils', 'node_modules'].includes(e.name) ? [] : walk(p);
    return [p];
  });
}

/** The files the check reads, relative to the repo root. The changelog is a record of past releases and is left out. */
export function targetFiles(root = ROOT): string[] {
  const rel = (p: string) => path.relative(root, p).split(path.sep).join('/');
  const tsx = walk(path.join(root, 'src'))
    .filter((p) => p.endsWith('.tsx') && !/\.(test|spec|stories)\.tsx$/.test(p))
    .map(rel);
  const features = fs.readdirSync(path.join(root, 'docs/features'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => `docs/features/${f}`);
  return [...tsx, 'src/i18n/messages/en.json', 'docs/HELP.md', ...features].sort();
}

export function scan(root = ROOT): Hit[] {
  return targetFiles(root).flatMap((file) =>
    findRetired(file, segmentsFor(file, fs.readFileSync(path.join(root, file), 'utf8'))));
}

export function countHits(hits: Hit[]): Counts {
  const counts: Counts = {};
  for (const h of hits) {
    const byWord = (counts[h.file] ??= {});
    byWord[h.word] = (byWord[h.word] ?? 0) + 1;
  }
  return sortCounts(counts);
}

export function sortCounts(counts: Counts): Counts {
  const out: Counts = {};
  for (const file of Object.keys(counts).sort()) {
    const words = Object.entries(counts[file] ?? {}).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b));
    if (words.length) out[file] = Object.fromEntries(words);
  }
  return out;
}

export type Change = { file: string; word: string; baseline: number; now: number };

/** Every file and word whose count differs from the baseline. */
export function compare(baseline: Counts, now: Counts): { increases: Change[]; decreases: Change[] } {
  const increases: Change[] = [];
  const decreases: Change[] = [];
  const files = new Set([...Object.keys(baseline), ...Object.keys(now)]);
  for (const file of [...files].sort()) {
    const words = new Set([...Object.keys(baseline[file] ?? {}), ...Object.keys(now[file] ?? {})]);
    for (const word of [...words].sort()) {
      const b = baseline[file]?.[word] ?? 0;
      const n = now[file]?.[word] ?? 0;
      if (n > b) increases.push({ file, word, baseline: b, now: n });
      else if (n < b) decreases.push({ file, word, baseline: b, now: n });
    }
  }
  return { increases, decreases };
}

export function readBaseline(file = BASELINE_PATH): Counts {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Counts) : {};
}

export function formatBaseline(counts: Counts): string {
  return JSON.stringify(sortCounts(counts), null, 2) + '\n';
}

/** The report for a set of changes, with the line of each new hit. Empty when nothing changed. */
export function report(changes: { increases: Change[]; decreases: Change[] }, hits: Hit[]): string {
  const lines: string[] = [];
  if (changes.increases.length) {
    lines.push('Retired UI words went up (see src/lib/uiWords.ts for what to write instead):');
    for (const c of changes.increases) {
      const use = RETIRED_UI_WORDS.find((w) => w.word === c.word)?.use;
      lines.push(`  ${c.file}: "${c.word}" ${c.baseline} -> ${c.now}${use ? ` (use: ${use})` : ''}`);
      for (const h of hits.filter((x) => x.file === c.file && x.word === c.word)) {
        lines.push(`    ${h.file}:${h.line}: ${h.text.slice(0, 120)}`);
      }
    }
  }
  if (changes.decreases.length) {
    lines.push('Retired UI words went down. Lower the baseline so they stay gone:');
    for (const c of changes.decreases) lines.push(`  ${c.file}: "${c.word}" ${c.baseline} -> ${c.now}`);
    lines.push('  Run: npm run check:ui-words -- --update');
  }
  return lines.join('\n');
}
