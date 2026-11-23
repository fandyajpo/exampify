#!/usr/bin/env python3
"""Regenerate the open-question index in ARCHITECTURE_DECISIONS.md §8.

The index is derived data: every open `OQ-*` row in docs/*.md is the source
of truth, and this script rewrites §8 (plus §8.1, its cluster list) from
those rows in place. Run it after editing, adding or resolving a source row:

    python3 docs/gen_index.py            # from the project root
    python3 docs/gen_index.py docs       # explicit directory

`docs/check.py` fails when §8 and the source rows disagree; rerunning this
script is the fix. Nothing else in ARCHITECTURE_DECISIONS.md is touched: the
section runs from the `## 8.` heading to the next `## ` heading or EOF.

Output is deterministic, so running the script twice changes nothing the
second time. Standard library only.
"""

from __future__ import annotations

import re
import sys
from collections import OrderedDict
from pathlib import Path

# Preferred order inside a phase: product intent before its consequences.
# Documents not named here are appended in alphabetical order, so a new
# document's rows are never silently dropped.
DOC_ORDER = [
    "PRODUCT_REQUIREMENTS", "PRODUCT_ARCHITECTURE", "INFORMATION_ARCHITECTURE",
    "USER_FLOWS", "DATABASE_SCHEMA", "CONTENT_MODEL", "QUESTION_ENGINE",
    "API_CONTRACTS", "SEARCH_ARCHITECTURE", "BACKGROUND_JOBS",
    "SEO_AND_CONTENT_STRATEGY", "UI_UX_GUIDELINES", "DESIGN_SYSTEM",
    "MVP_ROADMAP", "TECHNICAL_STANDARDS", "SECURITY_AND_PERMISSIONS",
    "TESTING_STRATEGY", "DEPLOYMENT_AND_ENVIRONMENTS",
    "OBSERVABILITY_AND_ANALYTICS", "EMAIL_AND_NOTIFICATIONS",
    "PRIVACY_AND_DATA_PROTECTION", "OPERATIONS_RUNBOOK", "EDITORIAL_GUIDE",
    "INTERNATIONALIZATION",
]

# cluster label -> (controlling row, member rows, note)
CLUSTERS = OrderedDict([
    ("deletion", ("D-05", ["OQ-06", "OQ-DB4", "OQ-SEC1"],
        "One policy call — whether deletion anonymises or erases attempts — seen from legal, schema and permission sides. `OQ-PR3` already fixed the *implementation* (anonymise, with a hard-delete branch specified in `PRIVACY_AND_DATA_PROTECTION.md` §5.2); do not reopen it.")),
    ("bahasa", ("OQ-04", ["OQ-I18N2", "OQ-R6", "OQ-S1"],
        "Four documents ask whether Indonesian is in the launch corpus. `OQ-04` is the product call; the others restate only the consequence for their area.")),
    ("market", ("OQ-01", ["OQ-SEO1", "OQ-ED1", "OQ-UX1"],
        "Spelling, `lang`, hreflang and UI copy all follow the launch market. `D-03` tracks the same row for curriculum seeding.")),
    ("paths", ("OQ-IA3", ["OQ-SEO6"],
        "Indexable filtered paths and `/subjects/{group}` are the same page-type decision; `SEO_AND_CONTENT_STRATEGY.md` says so inline.")),
    ("practice-url", ("OQ-IA6", ["OQ-UF6"],
        "Anchor versus own URL for a lesson's practice section is one URL decision, currently specified both ways.")),
    ("downloads", ("OQ-11", ["OQ-CM2"],
        "Whether a `download` block is gated by account or email. `OQ-11` is the product call; `CONTENT_MODEL.md` carries the content-model consequence.")),
    ("residency", ("D-07", ["OQ-D3", "OQ-PR4", "OQ-PA2"],
        "Region, data residency and a second read region are one answer about the launch audience and its legal requirements; the three rows are deployment, privacy and architecture views.")),
    ("status-page", ("OQ-OBS5", ["OQ-OPS2"],
        "A public status page versus an in-app banner is one operational surface, asked once for launch scope and once for on-call load.")),
    ("qdrant-tier", ("OQ-R5", ["OQ-S2"],
        "Whether Qdrant is paid at launch, asked as a budget question and as a latency/size measurement. The measurement decides the budget.")),
    ("bm25", ("OQ-PA5", ["OQ-S4"],
        "Qdrant BM25 as a third result list versus keeping FTS5 as the lexical store — the same architecture choice from the caching and the search sides.")),
    ("vercel-tier", ("OQ-D2", ["OQ-09"],
        "The plan tier and the monthly budget are one number. `OQ-D2` is the provider-terms question (commercial use requires Pro); `OQ-09` is the amount.")),
    ("bun", ("D-06", ["OQ-D1"],
        "Bun 1.4 timing is tracked as a decision and restated as a deployment question.")),
    ("embedding", ("D-02", ["OQ-S5"],
        "Sign-off on ADR-026 and the fallback model if `e5-small` misses Recall@5 are the same budget decision.")),
    ("monetisation", ("D-04", ["OQ-03"],
        "Free forever versus a paywall is the same policy call, tracked from the product side.")),
    ("age", ("D-11", ["OQ-PR1"],
        "The 16+ recommendation is decided; the jurisdiction's consent age is not. `OQ-PR1` and `D-11` are the same open legal input.")),
])

INDEX_HEADING = "## 8. Open-question index"
OPEN_RE = re.compile(r"^## (\d+)\. Open questions\s*$")
PHASE_RE = re.compile(r"\*\*blocks (Phase \d+|post-MVP)\*\*")
ROW_PREFIX = "| OQ-"
NEEDS_MARKER = "**Open — needs:**"

ORDER = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5", "Phase 6",
         "Phase 7", "post-MVP", "untagged"]
LABEL = {
    "Phase 1": "Phase 1 — foundations",
    "Phase 2": "Phase 2 — content and accounts",
    "Phase 3": "Phase 3 — question bank",
    "Phase 4": "Phase 4 — practice engine",
    "Phase 5": "Phase 5 — progress and retention",
    "Phase 6": "Phase 6 — search and indexing",
    "Phase 7": "Phase 7 — launch readiness",
    "post-MVP": "post-MVP",
    "untagged": "Not phase-tagged in the source row",
}


def document_order(docs: list[Path]) -> list[str]:
    """Preferred order, then any document the list does not name."""
    names = [doc.stem for doc in docs]
    known = [name for name in DOC_ORDER if name in names]
    extra = sorted(name for name in names if name not in DOC_ORDER)
    return known + extra


def open_sections(docs: list[Path]) -> dict[str, str]:
    """document -> its `Open questions` section number, when it has one."""
    found: dict[str, str] = {}
    for doc in docs:
        number = None
        for line in doc.read_text(encoding="utf-8").splitlines():
            match = OPEN_RE.match(line)
            if match:
                number = match.group(1)
        if number:
            found[doc.stem] = number
    return found


def source_rows(docs: list[Path], order: list[str]) -> list[dict]:
    """Every open row, with the text this index quotes."""
    rows: list[dict] = []
    by_name = {doc.stem: doc for doc in docs}
    for name in order:
        doc = by_name.get(name)
        if doc is None:
            continue
        for line in doc.read_text(encoding="utf-8").splitlines():
            if not line.startswith(ROW_PREFIX) or NEEDS_MARKER not in line:
                continue
            cells = [cell.strip() for cell in line.split("|")]
            five_column = len(cells) == 7
            body = line.split(NEEDS_MARKER, 1)[1]
            needs = re.split(r";\s*\*\*blocks|\*\*blocks", body)[0]
            needs = needs.strip().rstrip("|").strip().rstrip(".").strip()
            match = PHASE_RE.search(line)
            rows.append({
                "id": cells[1],
                "question": cells[2],
                "needs": needs,
                "phase": match.group(1) if match else "untagged",
                "doc": name,
                "blocks": cells[4] if five_column else None,
            })
    return rows


def render(directory: Path) -> str:
    docs = sorted(directory.glob("*.md"))
    order = document_order(docs)
    sections = open_sections(docs)
    rows = source_rows(docs, order)
    unsectioned = sorted({row["doc"] for row in rows} - set(sections))
    if unsectioned:
        raise SystemExit(
            "error: open rows in %s but no '## <n>. Open questions' section"
            % ", ".join(unsectioned)
        )

    cluster_of: dict[str, str] = {}
    for label, (control, members, _note) in CLUSTERS.items():
        for ident in [control] + members:
            if ident.startswith("OQ-"):
                cluster_of[ident] = label

    position = {name: index for index, name in enumerate(order)}

    def sort_key(row: dict) -> tuple[int, str]:
        return (position.get(row["doc"], len(position)), row["id"])

    by_phase: dict[str, list[dict]] = {phase: [] for phase in ORDER}
    for row in rows:
        by_phase[row["phase"]].append(row)
    for group in by_phase.values():
        group.sort(key=sort_key)

    total = len(rows)
    documents = len({row["doc"] for row in rows})
    counts = {phase: len(by_phase[phase]) for phase in ORDER}

    lines = [
        INDEX_HEADING,
        "",
        "Every open question in the set, in one index sorted by the phase it blocks. "
        "**Each source row is the source of truth** — this index is derived from it, quotes its "
        "`**Open — needs:**` text, and must be updated by changing the source row, never by "
        "editing this table alone. `docs/check.py` fails when the two disagree; the fix is to "
        "edit the source row and rerun `python3 docs/gen_index.py`, which rewrites §8 and §8.1 "
        "in place. Resolved rows are excluded; their closures are in place in their own "
        "documents.",
        "",
        (
            "**{total} open** across {documents} documents, plus the open "
            "decisions in §5 (`D-01`–`D-07`, `D-09`–`D-11`) and the sign-off gates in §7 "
            "(criterion 5). Open per phase: Phase 1 **{p1}**, Phase 2 **{p2}**, Phase 3 "
            "**{p3}**, Phase 4 **{p4}**, Phase 5 **{p5}**, Phase 6 **{p6}**, Phase 7 **{p7}**, "
            "post-MVP **{pm}**, not phase-tagged **{pt}**. §8.1 lists the clusters where "
            "several rows are one question — answer the controlling row, not each copy."
        ).format(
            total=total,
            documents=documents,
            p1=counts["Phase 1"], p2=counts["Phase 2"], p3=counts["Phase 3"],
            p4=counts["Phase 4"], p5=counts["Phase 5"], p6=counts["Phase 6"],
            p7=counts["Phase 7"], pm=counts["post-MVP"], pt=counts["untagged"],
        ),
        "",
    ]

    for phase in ORDER:
        group = by_phase[phase]
        if not group:
            continue
        count = len(group)
        lines.append("### %s (%d open question%s)" % (
            LABEL[phase], count, "" if count == 1 else "s"))
        lines.append("")
        if phase == "untagged":
            lines.append(
                "These rows carry no phase; the `Blocks` cell in the source row says why "
                "nothing in the plan waits on it."
            )
            lines.append("")
        lines.append("| ID | Question | What is needed | Cluster | Source |")
        lines.append("|---|---|---|---|---|")
        for row in group:
            label = cluster_of.get(row["id"])
            if label:
                control = CLUSTERS[label][0]
                cluster = ("`%s` (control)" if control == row["id"] else "`%s`") % label
            else:
                cluster = "—"
            section = sections[row["doc"]]
            source = "[%s §%s](./%s.md#%s-open-questions)" % (
                row["doc"], section, row["doc"], section)
            if row["phase"] == "untagged" and row["blocks"]:
                source += " — blocks: *%s*" % row["blocks"]
            lines.append("| `%s` | %s | %s | %s | %s |" % (
                row["id"], row["question"], row["needs"], cluster, source))
        lines.append("")

    clustered = [row for row in rows if row["id"] in cluster_of]
    lines.append("### 8.1 Question clusters")
    lines.append("")
    lines.append(
        "%d clusters cover %d of the %d open rows; the rest stand alone. They are listed "
        "together so an answer lands once and propagates; the duplicate rows keep their own "
        "wording because each records a different consequence, and none of them is deleted."
        % (len(CLUSTERS), len(clustered), total)
    )
    lines.append("")
    lines.append("| Cluster | Rows | Answer lands in | Note |")
    lines.append("|---|---|---|---|")
    for label, (control, members, note) in CLUSTERS.items():
        ids = ", ".join(["`%s`" % control] + ["`%s`" % member for member in members])
        where = ("§5 `%s`" % control) if control.startswith("D-") else ("`%s`" % control)
        lines.append("| `%s` | %s | %s | %s |" % (label, ids, where, note))
    lines.append("")

    return "\n".join(lines)


def main(argv: list[str]) -> int:
    directory = Path(argv[1] if len(argv) > 1 else "docs").resolve()
    if not directory.is_dir():
        print(f"error: {directory} is not a directory", file=sys.stderr)
        return 2

    target = directory / "ARCHITECTURE_DECISIONS.md"
    if not target.exists():
        print(f"error: {target.name} not found", file=sys.stderr)
        return 2

    text = target.read_text(encoding="utf-8")
    lines = text.splitlines()

    start = next(
        (index for index, line in enumerate(lines) if line.strip() == INDEX_HEADING),
        None,
    )
    if start is None:
        print(f"error: {target.name} has no '{INDEX_HEADING}' heading", file=sys.stderr)
        return 1
    end = next(
        (index for index in range(start + 1, len(lines)) if lines[index].startswith("## ")),
        len(lines),
    )

    section = render(directory)
    updated = "\n".join(lines[:start] + section.splitlines() + lines[end:]) + "\n"
    if updated == text:
        print(f"{target.name}: §8 already up to date")
        return 0
    target.write_text(updated, encoding="utf-8")
    print(f"{target.name}: rewrote §8 from the source rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
