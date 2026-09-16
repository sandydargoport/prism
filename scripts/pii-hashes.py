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
    scan-history  every reachable blob, plus secret shapes   (CI, weekly)
                  --write-baseline accepts today's findings as known

Neither mode ever prints a matched value: `scan` reports file and line only,
which is all CI needs and all a public log should ever carry.
"""
import hashlib
import hmac
import os
import re
import subprocess
import tempfile
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



# ---------------------------------------------------------------------------
# History sweep
# ---------------------------------------------------------------------------
# Every other mode reads the CURRENT tree, via `git ls-files`. A value that was
# committed and then deleted is invisible to all of them while staying
# permanently reachable by sha, which is exactly how a real ping URL survived
# in this repository: the scanner written for that incident only ever looked at
# tracked files. This mode reads the object store instead, so "removed later"
# stops counting as "gone".

# Blobs above this are lockfiles, bundles and binaries, not prose worth
# tokenising. Keeps a full sweep to a couple of minutes.
BLOB_SIZE_CAP = 1_000_000

# Historical findings that have been reviewed and accepted. History cannot be
# edited without a rewrite, so without this the sweep reports the same known
# objects every week, and a check that is always red is one people stop
# reading. Anything NOT listed here is new, and new is the only thing worth
# waking someone for.
#
# Entries are keyed hashes of the blob id, not the id itself, for the same
# reason the denylist is hashed: this file is public, and a plain list would be
# a ready-made index pointing at exactly the objects worth looking at.
BASELINE_FILE = ".github/pii-history-baseline.txt"

SECRET_RULES_FILE = "scripts/scan-secrets.sh"
# The same paths scan-secrets.sh leaves out of its targets: the scanners hold
# these patterns as literals, and lockfiles and snapshots are noise.
SECRET_SCAN_SKIP = re.compile(
    r"^(scripts/scan-(pii|examples|hostnames|secrets)\.sh"
    r"|scripts/prism-pii-denylist\.example\.txt"
    r"|docs/code-review-modalities\.md"
    r"|package-lock\.json|.*\.lock|.*\.snap)$"
)
# Pull the rules out of the shell scanner rather than restating them, so there
# is one place to add a pattern and no way for the two to drift apart.
RULE_LINE = re.compile(r'^\s*"([a-z0-9-]+)\|(.*)"\s*$')


def secret_rules():
    """The label|ERE rules from scan-secrets.sh, compiled."""
    try:
        text = open(SECRET_RULES_FILE, encoding="utf-8").read()
    except OSError:
        return []
    uuid = None
    rules = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("UUID="):
            uuid = stripped.split("=", 1)[1].strip().strip("'\"")
            continue
        m = RULE_LINE.match(line)
        if not m:
            continue
        label, pattern = m.group(1), m.group(2)
        if uuid:
            pattern = pattern.replace("${UUID}", uuid)
        # The shell rules are ERE with \b; Python's re accepts both.
        try:
            rules.append((label, re.compile(pattern)))
        except re.error:
            continue
    return rules


def scan_history(write_baseline: bool = False) -> int:
    key = salt()
    if not os.path.exists(HASH_FILE):
        sys.exit(f"{HASH_FILE} is missing; run 'pii-hashes.py generate' first.")
    with open(HASH_FILE, encoding="utf-8") as handle:
        wanted = {l.strip() for l in handle if l.strip() and not l.startswith("#")}

    rules = secret_rules()
    # One pass instead of nine. Only "did anything match" matters per blob, and
    # the named group says which rule without searching again.
    def combine(selected):
        if not selected:
            return None
        try:
            return re.compile("|".join(
                f"(?P<r{i}>{pat.pattern})" for i, (_, pat) in selected
            ))
        except re.error:
            return None

    indexed = list(enumerate(rules))
    combined_all = combine(indexed)
    # scan-secrets.sh deliberately does not apply private-lan-ipv4 under src/:
    # the recipe importer's SSRF guard has to name the RFC1918 ranges it blocks
    # and the tests exercise them with textbook addresses. Sweeping history
    # under a stricter rule than the tree is enforced under would report a pile
    # of hits that are correct code.
    combined_src = combine([(i, r) for i, r in indexed if r[0] != "private-lan-ipv4"])

    # Hashing dominates the sweep: this history tokenises into tens of millions
    # of candidates and HMAC is not free. The distinct set is far smaller, since
    # every file repeats "const", "import" and "return", so memoising turns the
    # cost from per-occurrence into per-distinct-token.
    seen: dict[str, bool] = {}

    def hits_denylist(line: str) -> bool:
        for c in candidates(line):
            known = seen.get(c)
            if known is None:
                known = digest(c, key) in wanted
                seen[c] = known
            if known:
                return True
        return False

    # Reachable objects only, and with their paths. `--batch-all-objects` would
    # also sweep dangling local objects that no clone has, reporting findings
    # nobody else can see, and it yields no path at all. A path is needed twice
    # over: to mirror the tracked-file scanners' exclusions, and to make a hit
    # something a person can act on.
    objects = subprocess.run(
        ["git", "rev-list", "--objects", "--all"],
        capture_output=True, text=True,
    ).stdout.splitlines()

    path_of, shas = {}, []
    for row in objects:
        sha, _, path = row.partition(" ")
        if not path or sha in path_of:
            continue
        if SKIP.search(path) or SECRET_SCAN_SKIP.search(path):
            continue
        path_of[sha] = path
        shas.append(sha)

    skipped_large = 0

    if not shas:
        print("[pii-hashes] No blobs to sweep.")
        return 0

    # The sha list is fed from a temp file, never a pipe. Writing it to stdin
    # and only then reading stdout deadlocks as soon as the list outgrows the
    # 64 KiB pipe buffer (about 1,600 shas): git blocks writing output nobody
    # is reading while this process blocks writing input nobody is reading.
    # It presents as the sweep simply being slow, which is how it first read.
    with tempfile.NamedTemporaryFile("w", suffix=".shas", delete=False) as fh:
        fh.write("\n".join(shas) + "\n")
        sha_list = fh.name

    baseline = set()
    if os.path.exists(BASELINE_FILE):
        with open(BASELINE_FILE, encoding="utf-8") as handle:
            for line in handle:
                entry = line.split("#", 1)[0].strip()
                if entry:
                    baseline.add(entry)
    accepted = lambda sha: digest(sha, key) in baseline

    denylist_hits, secret_hits, known = [], [], 0
    try:
        with open(sha_list) as feed:
            proc = subprocess.Popen(
                ["git", "cat-file", "--batch"], stdin=feed, stdout=subprocess.PIPE,
            )
            out = proc.stdout
            while True:
                header = out.readline()
                if not header:
                    break
                parts = header.decode("utf-8", "replace").split()
                if len(parts) != 3:
                    continue
                sha, size = parts[0], int(parts[2])
                body = out.read(size)
                out.read(1)  # trailing newline

                if size > BLOB_SIZE_CAP:
                    skipped_large += 1
                    continue
                if b"\x00" in body[:8192]:
                    continue  # binary
                text = body.decode("utf-8", "ignore")

                for number, line in enumerate(text.splitlines(), 1):
                    if hits_denylist(line):
                        if accepted(sha[:12]):
                            known += 1
                        else:
                            denylist_hits.append(
                                f"{path_of.get(sha, '?')}:{number}  blob {sha[:12]}")
                        break
                path = path_of.get(sha, "")
                engine = combined_src if path.startswith("src/") else combined_all
                if engine is not None:
                    hit = engine.search(text)
                    if hit and hit.lastgroup:
                        label = rules[int(hit.lastgroup[1:])][0]
                        if accepted(sha[:12]):
                            known += 1
                        else:
                            secret_hits.append(
                                f"{path}  [{label}]  blob {sha[:12]}")
            proc.wait()
    finally:
        os.unlink(sha_list)

    print(f"[pii-hashes] Swept {len(shas)} reachable blobs "
          f"({skipped_large} over {BLOB_SIZE_CAP} bytes skipped, "
          f"{known} known and baselined).")

    if write_baseline:
        found = [h.rsplit("blob ", 1)[1] for h in denylist_hits + secret_hits]
        with open(BASELINE_FILE, "w", encoding="utf-8") as handle:
            handle.write("# Reviewed historical findings, accepted as known.\n")
            handle.write("# Keyed hashes of blob ids: see scripts/pii-hashes.py.\n")
            handle.write("# Regenerate deliberately, never to silence a new hit.\n")
            for sha in sorted(set(found)):
                handle.write(digest(sha, key) + "\n")
        print(f"[pii-hashes] Wrote {len(set(found))} baselined findings to {BASELINE_FILE}.")
        return 0

    if not denylist_hits and not secret_hits:
        print("[pii-hashes] Clean: no NEW denylist or secret-shaped matches in history.")
        return 0

    # Values withheld, as everywhere else: this log is public, and a hit is
    # named by object id so it can be located locally with
    #   git log --all --find-object=<sha>
    if denylist_hits:
        print("[pii-hashes] DENYLIST MATCHES IN HISTORY (values withheld):")
        for hit in denylist_hits[:50]:
            print(f"  blob {hit}")
        if len(denylist_hits) > 50:
            print(f"  ... and {len(denylist_hits) - 50} more")
    if secret_hits:
        print("[pii-hashes] SECRET-SHAPED VALUES IN HISTORY:")
        for hit in secret_hits[:50]:
            print(f"  blob {hit}")
        if len(secret_hits) > 50:
            print(f"  ... and {len(secret_hits) - 50} more")
    print("[pii-hashes] Locate one with: git log --all --find-object=<sha>")
    print("[pii-hashes] A hit here stays reachable by sha even if the file was")
    print("[pii-hashes] deleted long ago. Rotate the value; rewriting is separate.")
    return 1


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
    elif mode == "scan-history":
        sys.exit(scan_history(write_baseline="--write-baseline" in sys.argv[2:]))
    elif mode == "scan-text":
        if len(sys.argv) < 3:
            sys.exit("usage: pii-hashes.py scan-text <file>")
        sys.exit(scan_text(sys.argv[2]))
    else:
        sys.exit(__doc__)
