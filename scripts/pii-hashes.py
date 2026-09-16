#!/usr/bin/env python3
"""Keyed-hash PII scanning, so CI can enforce the denylist without holding it.

The denylist is a concentrated list of a real household's names, town, postal
code and network addresses. Storing it as a repository secret would put that
list inside GitHub, readable by any workflow that runs with secrets, which is
the opposite of what the list exists to achieve.

Instead: commit HMAC-SHA256 of each entry, keyed by a salt that lives only in
`PRISM_PII_SALT`. The committed file is unusable without the salt, and the salt
is high-entropy so it cannot be guessed. Without the key, a hash of a short
name would be trivially brute-forced; with it, it is not.

    generate    read the denylist, write the hash file  (local, needs denylist)
    scan        hash tracked-file tokens, compare       (CI, needs no denylist)
    scan-text   same, over one file of outbound text    (CI, for PR/issue text)

Neither mode ever prints a matched value: `scan` reports file and line only,
which is all CI needs and all a public log should ever carry.
"""
import hashlib
import hmac
import os
import re
import subprocess
import sys

HASH_FILE = ".github/pii-hashes.txt"
SALT_ENV = "PRISM_PII_SALT"

# A token is a word, an IP literal, a postal code, or a hostname. The split
# characters are also component boundaries, so "host.example" is tested whole
# and in pieces, which is how a surname hides inside a hostname.
TOKEN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._'-]*")
# Two splits, because an apostrophe is both a separator and part of a name.
# Splitting on it finds a first name inside its possessive form; not splitting
# on it keeps an apostrophe surname intact when it sits between separators.
# Neither alone is enough.
SPLIT = re.compile(r"[._'-]+")
SPLIT_KEEP_APOSTROPHE = re.compile(r"[._-]+")
# camelCase and PascalCase glue a value to another word with no separator, so
# "alexSetting" would otherwise hide a name that `grep -w` also misses.
# (The example is a fictional stand-in on purpose: this comment is the exact
# place a real one gets typed while explaining what the scanner catches.)
CAMEL = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")
# An IP literal is destroyed by splitting on dots, so pull it out whole first.
# "prefix-192.0.2.1-suffix" tokenises as one blob that then splits into octets,
# and the address itself would never be tested.
IPV4 = re.compile(r"\d{1,3}(?:\.\d{1,3}){3}")

# Files that legitimately carry the detector patterns, or are too noisy to
# tokenise usefully. Mirrors scan-pii.sh's own exclusions.
SKIP = re.compile(r"(^|/)(package-lock\.json|.*\.lock)$|^\.github/pii-hashes\.txt$")


def salt() -> bytes:
    value = os.environ.get(SALT_ENV, "")
    if not value:
        sys.exit(f"{SALT_ENV} is not set. Generate one with:\n"
                 f"  openssl rand -hex 32 > ~/.config/prism-pii-salt")
    return value.strip().encode()


def digest(text: str, key: bytes) -> str:
    return hmac.new(key, text.lower().strip().encode(), hashlib.sha256).hexdigest()


def candidates(line: str):
    """Every substring of a line worth testing against the hash list."""
    for address in IPV4.findall(line):
        yield address
    for token in TOKEN.findall(line):
        yield token
        # A name containing an apostrophe, quoted or made possessive, collides
        # with its own punctuation and hides inside it.
        trimmed = token.strip("'")
        if trimmed.endswith("'s"):
            trimmed = trimmed[:-2]
        if trimmed and trimmed != token:
            yield trimmed
        pieces = SPLIT.split(token) + SPLIT_KEEP_APOSTROPHE.split(token)
        for piece in pieces:
            if len(piece) >= 3:
                yield piece
            for word in CAMEL.split(piece):
                if len(word) >= 3:
                    yield word


def read_denylist(path: str):
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            entry = line.strip()
            if entry and not entry.startswith("#"):
                yield entry


def generate(paths):
    key = salt()
    entries = set()
    for path in paths:
        if os.path.exists(path):
            entries.update(read_denylist(path))
    if not entries:
        sys.exit("No denylist entries found; refusing to write an empty hash file.")
    hashes = sorted(digest(e, key) for e in entries)
    with open(HASH_FILE, "w", encoding="utf-8") as handle:
        handle.write("# HMAC-SHA256 of each PII denylist entry, keyed by PRISM_PII_SALT.\n")
        handle.write("# Useless without the salt. Regenerate with scripts/pii-hashes.py generate.\n")
        handle.write("\n".join(hashes) + "\n")
    print(f"wrote {len(hashes)} hashes to {HASH_FILE}")


def scan() -> int:
    key = salt()
    if not os.path.exists(HASH_FILE):
        sys.exit(f"{HASH_FILE} is missing; run 'pii-hashes.py generate' first.")
    with open(HASH_FILE, encoding="utf-8") as handle:
        wanted = {l.strip() for l in handle if l.strip() and not l.startswith("#")}

    files = subprocess.run(["git", "ls-files"], capture_output=True, text=True).stdout.split("\n")
    hits = []
    for path in files:
        if not path or SKIP.search(path):
            continue
        try:
            with open(path, "rb") as probe:
                if b"\x00" in probe.read(8192):
                    continue          # binary: tokenising it yields noise, not text
            with open(path, encoding="utf-8", errors="ignore") as handle:
                for number, line in enumerate(handle, 1):
                    if any(digest(c, key) in wanted for c in candidates(line)):
                        hits.append(f"{path}:{number}")
        except (IsADirectoryError, PermissionError, FileNotFoundError):
            continue

    if hits:
        print("[pii-hashes] DENYLIST MATCHES (values withheld by design):")
        for hit in hits[:50]:
            print(f"  {hit}")
        if len(hits) > 50:
            print(f"  ... and {len(hits) - 50} more")
        print("[pii-hashes] Run scripts/scan-pii.sh locally to see which value matched.")
        return 1

    print(f"[pii-hashes] Clean: {len(wanted)} hashed entries, no matches in tracked files.")
    return 0


def scan_text(path: str) -> int:
    """Scan one file of outbound text: a PR body, an issue comment, a release note.

    Typing into github.com is the one publishing surface no local hook can see,
    and it is how a contributor email reached a public issue body years after
    the scanners existed. This cannot prevent the keystroke; it fails fast
    enough that the text is still editable.
    """
    key = salt()
    with open(HASH_FILE, encoding="utf-8") as handle:
        wanted = {l.strip() for l in handle if l.strip() and not l.startswith("#")}
    hits = []
    with open(path, encoding="utf-8", errors="ignore") as handle:
        for number, line in enumerate(handle, 1):
            if any(digest(c, key) in wanted for c in candidates(line)):
                hits.append(number)
    if hits:
        print("[pii-hashes] This text matches the PII denylist (values withheld).")
        print(f"[pii-hashes] Offending line(s): {', '.join(str(h) for h in hits[:20])}")
        print("[pii-hashes] Edit it now, while it is still editable, and use a stand-in.")
        return 1
    print("[pii-hashes] Outbound text is clean.")
    return 0


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "generate":
        # Deliberately NOT the history-only list: its entries were put there
        # because they collide with ordinary words in this codebase, so hashing
        # them would fire on every commit. That list is for the history rewrite.
        lists = sys.argv[2:] or [os.path.expanduser("~/.config/prism-pii-denylist.txt")]
        generate(lists)
    elif mode == "scan":
        sys.exit(scan())
    elif mode == "scan-text":
        if len(sys.argv) < 3:
            sys.exit("usage: pii-hashes.py scan-text <file>")
        sys.exit(scan_text(sys.argv[2]))
    else:
        sys.exit(__doc__)
