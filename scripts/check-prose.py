#!/usr/bin/env python3
"""
Flag writing patterns that make the README and the docs read as machine
written (#1143): dashes, "not X but Y" contrasts, a short list of hype words,
and two-word sentences dropped in for punch.

Checks README.md, overrides/*.html and every page in the docs menu
(mkdocs.yml nav) except the changelog, which is a record of past releases.
Code blocks, inline code, front matter, HTML comments and Jinja comments are
skipped.

A hit that is right as written (a quoted UI string, a product name) goes in
scripts/check-prose-allow.txt as `path: the exact text matched`.

    python3 scripts/check-prose.py          # report and exit 1 on any hit
    python3 scripts/check-prose.py FILE...  # check only these files
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

CHECKS = [
    ('dash', re.compile(r'[—–]|\s--\s')),
    ('contrast', re.compile(
        r"\bnot (?:just|only|merely)\b"
        r"|\b(?:isn't|is not|it's not|aren't|are not|doesn't|does not)\b[^.;:]{0,40}, (?:it's|it|but|they're|they)\b"
        r"|\brather than\b",
        re.I)),
    ('hype word', re.compile(
        r"\b(?:delve|robust|seamless(?:ly)?|leverag(?:e|es|ed|ing)|utili[sz]e[sd]?|empower(?:s|ed)?|facilitates?"
        r"|streamline[sd]?|showcas(?:e|es|ed|ing)|crucial|moreover|additionally|effortless(?:ly)?"
        r"|elevate[sd]?|game-changer|testament|pivotal|tapestry|in order to|it's worth noting|look no further)\b",
        re.I)),
    # A sentence of exactly two words, used for rhythm: "Every one." "That's it."
    # A list item that is only two words is a label, not a sentence, and is
    # skipped below; so is an abbreviation like "vs." or "e.g.".
    ('two-word sentence', re.compile(r"(?:^|(?<=[.!?] ))[A-Z][\w']*\s(?!vs\.|etc\.)[\w']+[.!?](?=\s|$)")),
]


def menu_pages() -> list[pathlib.Path]:
    text = (ROOT / 'mkdocs.yml').read_text()
    nav = text[text.index('\nnav:'):text.index('\nnot_in_nav:')]
    pages = re.findall(r':\s*(\S+\.md)\s*$', nav, re.M)
    return [ROOT / 'docs' / p for p in pages if p != 'CHANGELOG.md']


def targets() -> list[pathlib.Path]:
    return [ROOT / 'README.md', *sorted((ROOT / 'overrides').glob('*.html')), *menu_pages()]


def prose_lines(text: str):
    """Yield (line number, line) for prose, with code and comments blanked."""
    text = re.sub(r'<!--.*?-->', lambda m: '\n' * m.group().count('\n'), text, flags=re.S)
    text = re.sub(r'\{#.*?#\}', lambda m: '\n' * m.group().count('\n'), text, flags=re.S)
    text = re.sub(r'<(pre|code)\b.*?</\1>', lambda m: '\n' * m.group().count('\n'), text, flags=re.S)
    lines = text.split('\n')
    fence = None
    front = lines[:1] == ['---']
    for i, line in enumerate(lines, 1):
        if front:
            if i > 1 and line == '---':
                front = False
            continue
        m = re.match(r'\s*(```|~~~)', line)
        if m:
            fence = None if fence == m.group(1) else (fence or m.group(1))
            continue
        if fence:
            continue
        # Inline code, link targets and HTML tags are not prose.
        line = re.sub(r'`[^`]*`', '``', line)
        line = re.sub(r'\]\([^)]*\)', ']()', line)
        line = re.sub(r'<[^>]+>', ' ', line)
        yield i, line


def allowlist() -> set[tuple[str, str]]:
    path = ROOT / 'scripts' / 'check-prose-allow.txt'
    if not path.exists():
        return set()
    out = set()
    for line in path.read_text().splitlines():
        if line.strip() and not line.startswith('#'):
            file, _, text = line.partition(': ')
            out.add((file.strip(), text))
    return out


def check(files: list[pathlib.Path]) -> list[str]:
    allowed = allowlist()
    hits = []
    for path in files:
        rel = str(path.relative_to(ROOT))
        for n, line in prose_lines(path.read_text()):
            # Sentences start after a list marker or heading marker too.
            body = re.sub(r'^\s*(?:[-*+]|\d+\.|#+|>)\s+', '', line)
            for name, pattern in CHECKS:
                if name == 'two-word sentence' and pattern.fullmatch(body.strip()) and body != line:
                    continue
                for m in pattern.finditer(body):
                    if (rel, m.group()) not in allowed:
                        hits.append(f'{rel}:{n}: {name}: "{m.group()}"  in: {line.strip()[:110]}')
    return hits


def main(argv: list[str]) -> int:
    files = [pathlib.Path(a).resolve() for a in argv] if argv else targets()
    hits = check(files)
    for h in hits:
        print(h)
    print(f'check-prose: {len(hits)} hit(s) in {len(files)} file(s)', file=sys.stderr)
    return 1 if hits else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
