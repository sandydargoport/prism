/**
 * Finds retired UI words (#1337) in the text a user reads: JSX text and
 * string literals in `src/**\/*.tsx`, the English messages, Help and the
 * feature docs. The words and their replacements are in `src/lib/uiWords.ts`.
 *
 * Zero tolerance (#1352): one retired word anywhere it reads fails the check.
 * There is no baseline and no way to accept a hit. A word that is still right
 * somewhere a user sees it belongs out of RETIRED_UI_WORDS, not in an
 * exception here.
 *
 * What it does not read, and why: comments, keys, class names and other code
 * strings (see isCodeString), test and story files, docs/MODEL.md (it lists
 * the retired words on purpose), and docs/CHANGELOG.md (a record of past
 * releases, which names old controls by their old names).
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { RETIRED_UI_WORDS, type RetiredUiWord } from '../../src/lib/uiWords';

export const ROOT = path.resolve(__dirname, '../..');

/** A piece of user-visible text and the line it starts on. */
export type Segment = { line: number; text: string };

export type Hit = { file: string; word: string; line: number; text: string };

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

/** The report for a scan: every hit with its file, line and what to write instead. Empty when there are none. */
export function report(hits: Hit[]): string {
  if (!hits.length) return '';
  const lines = [`${hits.length} retired UI word${hits.length === 1 ? '' : 's'} (see src/lib/uiWords.ts):`];
  for (const h of hits) {
    const use = RETIRED_UI_WORDS.find((w) => w.word === h.word)?.use;
    lines.push(`  ${h.file}:${h.line}: "${h.word}"${use ? ` (use: ${use})` : ''}`);
    lines.push(`    ${h.text.slice(0, 120)}`);
  }
  return lines.join('\n');
}
