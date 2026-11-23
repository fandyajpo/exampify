#!/usr/bin/env python3
"""Conformance checks for the Exampify doc set.

Checks, over docs/*.md:
  1. Relative links and images resolve (file exists, anchor exists).
  2. The ADR index table matches the ADR headings in ARCHITECTURE_DECISIONS.md.
  3. IDs are unique across namespaces: D-, DEP-, E-, QE-, SEC-, EM-, ED-,
     TS- and OQ-*. An ID is "defined" by a table row whose first cell is the ID.
  4. Ordered lists number sequentially (a new list must restart at 1).
  5. The open-question index in ARCHITECTURE_DECISIONS.md §8 lists exactly the
     open `OQ-*` rows in the set, each under the phase its source row states.
     Fix drift here by editing the source row and rerunning
     `python3 docs/gen_index.py`, which rewrites §8 from the rows.
  6. TRACEABILITY_MATRIX.md traces every `FR-*`/`NFR-*` row defined in
     PRODUCT_REQUIREMENTS.md exactly once, and traces nothing else.

Markdown inside fenced code blocks and inline code spans is ignored, so
deliberate inline examples such as `![alt](/media/…)` are not link targets.

Usage: python3 docs/check.py            # from the project root
       python3 docs/check.py docs       # explicit directory
Exit status is 0 when clean, 1 when anything is reported.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

FENCE_RE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")
HEADING_RE = re.compile(r"^\s{0,3}(#{1,6})\s+(.*?)\s*$")
LINK_RE = re.compile(r"!?\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+\"[^\"]*\")?\s*\)")
ORDERED_RE = re.compile(r"^(\s*)(\d+)\.\s+")
INLINE_CODE_RE = re.compile(r"(`+)(.+?)\1")
SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:")

# A definition is a table row whose first cell is the ID.
ID_DEF_RE = re.compile(
    r"^\|\s*(?:\*\*)?"
    r"(?:DEP-\d{1,3}|[DQE]-\d{1,3}|SEC-\d{1,3}|EM-\d{1,3}|ED-\d{1,3}"
    r"|TS-\d{1,3}|OQ-[A-Za-z0-9]*\d{1,3})"
    r"(?:\*\*)?\s*\|"
)

INDEX_HEADING_RE = re.compile(r"^##\s+8\.\s+Open-question index\s*$")
INDEX_ROW_RE = re.compile(r"^\|\s*`(OQ-[A-Za-z0-9]*\d{1,3})`\s*\|")
open_phase_RE = re.compile(r"\*\*blocks (Phase \d+|post-MVP)\*\*")


REQ_ROW_RE = re.compile(r"^\|\s*((?:FR|NFR)-[A-Z]*-?\d+)\s*\|")

ADR_INDEX_RE = re.compile(r"^\|\s*(\d{3})\s*\|")
ADR_HEADING_RE = re.compile(r"^###\s+ADR-(\d{3})\b")


def slug(text: str) -> str:
    """GitHub-style anchor: lowercase, drop punctuation, spaces to hyphens."""
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\*\*|__", "", text)
    text = re.sub(r"[^\w\- ]", "", text.lower())
    return text.replace(" ", "-")


def strip_inline_code(line: str) -> str:
    return INLINE_CODE_RE.sub("", line)


def read_lines(path: Path) -> list[tuple[int, str, bool]]:
    """Return (line number, text, in_code_fence) for each line."""
    out: list[tuple[int, str, bool]] = []
    fence: str | None = None
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        match = FENCE_RE.match(raw)
        if fence is None:
            if match:
                fence = match.group(1)[0]
                out.append((number, raw, True))
                continue
            out.append((number, raw, False))
        else:
            out.append((number, raw, True))
            if match and match.group(1)[0] == fence and len(match.group(1)) >= 3:
                fence = None
    return out


def anchors(doc: Path) -> set[str]:
    found: set[str] = set()
    seen: dict[str, int] = {}
    for _, text, in_fence in read_lines(doc):
        if in_fence:
            continue
        match = HEADING_RE.match(text)
        if not match:
            continue
        base = slug(match.group(2).rstrip("#").strip())
        count = seen.get(base, 0)
        seen[base] = count + 1
        found.add(base if count == 0 else f"{base}-{count}")
    return found


def check_links(directory: Path) -> list[str]:
    problems: list[str] = []
    anchor_cache: dict[Path, set[str]] = {}
    docs = sorted(directory.glob("*.md"))
    for doc in docs:
        for number, text, in_fence in read_lines(doc):
            if in_fence:
                continue
            for match in LINK_RE.finditer(strip_inline_code(text)):
                target = match.group(1)
                if target.startswith("<") and target.endswith(">"):
                    target = target[1:-1]
                if not target or target.startswith("#"):
                    anchor = target[1:] if target.startswith("#") else ""
                    path = doc
                else:
                    if SCHEME_RE.match(target) or target.startswith("//"):
                        continue
                    path_part, _, anchor = target.partition("#")
                    path = (doc.parent / path_part).resolve()
                    if not path.exists():
                        problems.append(
                            f"{doc.name}:{number}: broken relative link -> {target}"
                        )
                        continue
                if anchor:
                    if path.suffix != ".md":
                        continue
                    if path not in anchor_cache:
                        anchor_cache[path] = anchors(path)
                    if anchor not in anchor_cache[path]:
                        problems.append(
                            f"{doc.name}:{number}: missing anchor #{anchor} in {path.name}"
                        )
    return problems


def check_adr_index(doc: Path) -> list[str]:
    problems: list[str] = []
    if not doc.exists():
        return [f"{doc.name} not found"]
    lines = read_lines(doc)
    index_numbers: list[tuple[int, str]] = []
    headings: list[tuple[int, str]] = []
    in_index = False
    for number, text, in_fence in lines:
        if in_fence:
            continue
        if text.strip() == "### Index":
            in_index = True
            continue
        if in_index and text.startswith("## "):
            in_index = False
        if in_index:
            match = ADR_INDEX_RE.match(text)
            if match:
                index_numbers.append((number, match.group(1)))
        match = ADR_HEADING_RE.match(text)
        if match:
            headings.append((number, match.group(1)))

    for label, entries in (("index row", index_numbers), ("heading", headings)):
        seen: dict[str, int] = {}
        for number, value in entries:
            if value in seen:
                problems.append(
                    f"{doc.name}:{number}: duplicate ADR {label} {value} "
                    f"(first at line {seen[value]})"
                )
            else:
                seen[value] = number

    indexed = {value for _, value in index_numbers}
    headed = {value for _, value in headings}
    for value in sorted(indexed - headed):
        problems.append(f"{doc.name}: ADR {value} is in the index but has no heading")
    for value in sorted(headed - indexed):
        problems.append(f"{doc.name}: ADR {value} has a heading but no index row")
    return problems


def check_ids(directory: Path) -> list[str]:
    problems: list[str] = []
    seen: dict[str, tuple[Path, int]] = {}
    for doc in sorted(directory.glob("*.md")):
        for number, text, in_fence in read_lines(doc):
            if in_fence:
                continue
            match = ID_DEF_RE.match(text)
            if not match:
                continue
            ident = match.group(0).strip("| ").replace("*", "")
            if ident in seen:
                first_doc, first_line = seen[ident]
                problems.append(
                    f"{doc.name}:{number}: {ident} is defined twice "
                    f"(first at {first_doc.name}:{first_line})"
                )
            else:
                seen[ident] = (doc, number)
    return problems


def open_questions(directory: Path) -> dict[str, tuple[str, int, str]]:
    """id -> (document, line, phase) for every row marked Open."""
    found: dict[str, tuple[str, int, str]] = {}
    for doc in sorted(directory.glob("*.md")):
        for number, text, in_fence in read_lines(doc):
            if in_fence or not text.startswith("| OQ-"):
                continue
            if "**Open — needs:**" not in text:
                continue
            ident = text.split("|")[1].strip()
            match = open_phase_RE.search(text)
            found.setdefault(
                ident, (doc.name, number, match.group(1) if match else "untagged")
            )
    return found


def check_open_index(directory: Path) -> list[str]:
    """The derived index must match the source rows exactly, phase included."""
    doc = directory / "ARCHITECTURE_DECISIONS.md"
    if not doc.exists():
        return [f"{doc.name} not found"]
    source = open_questions(directory)
    entries: dict[str, tuple[int, str]] = {}
    problems: list[str] = []
    in_index = False
    phase = "untagged"
    for number, text, in_fence in read_lines(doc):
        if in_fence:
            continue
        if INDEX_HEADING_RE.match(text):
            in_index = True
            continue
        if in_index and text.startswith("## "):
            break
        if not in_index:
            continue
        if text.startswith("### "):
            match = re.search(r"Phase \d+|post-MVP", text)
            phase = match.group(0) if match else "untagged"
            continue
        row = INDEX_ROW_RE.match(text)
        if not row:
            continue
        ident = row.group(1)
        if ident in entries:
            first = entries[ident][0]
            problems.append(
                f"{doc.name}:{number}: {ident} appears twice in §8 (first at line {first})"
            )
        else:
            entries[ident] = (number, phase)

    for ident in sorted(set(source) | set(entries)):
        if ident not in entries:
            name, line, _ = source[ident]
            problems.append(
                f"{doc.name}: {ident} is open at {name}:{line} but missing from §8"
            )
        elif ident not in source:
            line, _ = entries[ident]
            problems.append(
                f"{doc.name}:{line}: {ident} is in §8 but is not an open row in any document"
            )
        elif entries[ident][1] != source[ident][2]:
            name, line, expected = source[ident]
            problems.append(
                f"{doc.name}:{entries[ident][0]}: {ident} is indexed under "
                f"{entries[ident][1]} but {name}:{line} says {expected}"
            )
    return problems


def requirement_ids(doc: Path) -> list[tuple[int, str]]:
    """(line, ID) for each table row that starts with a requirement ID."""
    found: list[tuple[int, str]] = []
    for number, text, in_fence in read_lines(doc):
        if in_fence:
            continue
        match = REQ_ROW_RE.match(text)
        if match:
            found.append((number, match.group(1)))
    return found


def check_traceability(directory: Path) -> list[str]:
    """Every requirement is traced once, and the matrix invents no IDs."""
    source = directory / "PRODUCT_REQUIREMENTS.md"
    matrix = directory / "TRACEABILITY_MATRIX.md"
    for doc in (source, matrix):
        if not doc.exists():
            return [f"{doc.name} not found"]
    defined = {ident for _, ident in requirement_ids(source)}
    problems: list[str] = []
    seen: dict[str, int] = {}
    for line, ident in requirement_ids(matrix):
        if ident in seen:
            problems.append(
                f"{matrix.name}:{line}: {ident} is traced twice "
                f"(first at line {seen[ident]})"
            )
        else:
            seen[ident] = line
    for ident in sorted(defined - set(seen)):
        problems.append(
            f"{matrix.name}: {ident} is defined in {source.name} but not traced"
        )
    for ident in sorted(set(seen) - defined):
        problems.append(
            f"{matrix.name}:{seen[ident]}: {ident} is traced but not defined in "
            f"{source.name}"
        )
    return problems


def check_ordered_lists(directory: Path) -> list[str]:
    problems: list[str] = []
    for doc in sorted(directory.glob("*.md")):
        last: dict[int, int] = {}
        for number, text, in_fence in read_lines(doc):
            if in_fence:
                continue
            match = ORDERED_RE.match(text)
            if not match:
                if text.strip() and not text[:1].isspace():
                    # A new top-level block ends the top-level list run.
                    last.pop(0, None)
                continue
            indent = len(match.group(1))
            value = int(match.group(2))
            for deeper in [level for level in last if level > indent]:
                del last[deeper]
            previous = last.get(indent)
            if previous is not None:
                if value == previous:
                    problems.append(
                        f"{doc.name}:{number}: ordered list repeats item {value}"
                    )
                elif value == 1 and previous != 1:
                    pass  # a new list may restart at 1
                elif value != previous + 1:
                    problems.append(
                        f"{doc.name}:{number}: ordered list expected "
                        f"{previous + 1}, found {value}"
                    )
            last[indent] = value
    return problems


def main(argv: list[str]) -> int:
    directory = Path(argv[1] if len(argv) > 1 else "docs").resolve()
    if not directory.is_dir():
        print(f"error: {directory} is not a directory", file=sys.stderr)
        return 2

    checks = [
        ("relative links and anchors", lambda: check_links(directory)),
        (
            "ADR index vs headings",
            lambda: check_adr_index(directory / "ARCHITECTURE_DECISIONS.md"),
        ),
        ("unique IDs", lambda: check_ids(directory)),
        ("open-question index", lambda: check_open_index(directory)),
        ("requirement traceability", lambda: check_traceability(directory)),
        ("ordered list numbering", lambda: check_ordered_lists(directory)),
    ]

    total = 0
    for label, run in checks:
        problems = run()
        total += len(problems)
        status = "ok" if not problems else f"{len(problems)} problem(s)"
        print(f"{label}: {status}")
        for problem in problems:
            print(f"  {problem}")
    print(f"\n{total} problem(s) across {len(list(directory.glob('*.md')))} documents")
    return 0 if total == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
