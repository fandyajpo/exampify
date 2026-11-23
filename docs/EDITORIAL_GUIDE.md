# Editorial Guide — Exampify

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Proposed |
| Depends on | [CONTENT_MODEL.md](./CONTENT_MODEL.md), [QUESTION_ENGINE.md](./QUESTION_ENGINE.md), [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Referenced by | [SEO_AND_CONTENT_STRATEGY.md](./SEO_AND_CONTENT_STRATEGY.md), [MVP_ROADMAP.md](./MVP_ROADMAP.md) |

---

## 1. Purpose and scope

`CONTENT_MODEL.md` defines what a resource *is* and when it may publish. This document defines what a **good** one looks like — the part that cannot be expressed as a constraint: how to explain, how to write a question, how to label a diagram, how much is too much.

**Readers:** authors (`author` role) and reviewers (`reviewer` role). If a rule here conflicts with a publish gate in `CONTENT_MODEL.md`, the gate wins; fix this document.

**Out of scope:** curriculum scope decisions (which topics exist), brand voice for the marketing site, translation workflow ([INTERNATIONALIZATION.md](./INTERNATIONALIZATION.md)).

---

## 2. The writer's contract

1. **Explain first.** Every resource must leave a student able to answer "what is this, why does it matter, how does it work" without a follow-up question.
2. **One resource, one job.** A resource titled "Photosynthesis" that also covers respiration is two resources.
3. **No assessment required.** Never write "now test yourself" as a requirement; practice is an offer.
4. **Original and attributable.** No copied text, no re-drawn figure without a licence, no past-paper question unless licensed (`A-07`, `A-08`).
5. **Syllabus-anchored.** Name the curriculum and level in the summary, not in every paragraph.
6. **No invented facts.** A claim that cannot be sourced is either removed or marked as a simplification ("at this level, we treat…").
7. **British or American spelling, chosen once per market** (`OQ-01`) and never mixed within a resource.

---

## 3. Resource structure

### 3.1 Required shape

| Order | Block | Rule |
|---|---|---|
| 1 | `rich_text` intro | 60–120 words answering "what and why". No heading inside |
| 2 | `heading` + body | One `h2` per major idea, 3–7 sections typical |
| 3 | Illustrations | At least one figure or table for any visual concept |
| 4 | `callout` | At least one `examtip` or `warning` per resource |
| 5 | Summary | Optional closing `rich_text` "In short" (≤ 80 words) |
| 6 | `related_material` | 2–4 links, only to published siblings |

A resource with no image, table or formula is allowed only when the topic is purely verbal — and then the prose must carry an example.

### 3.2 Length

| Signal | Target | Hard limit |
|---|---|---|
| Study material | 600–1,200 words | 2,500 (split into two resources beyond that) |
| Lesson (reading part) | 400–900 words | 1,800 |
| Section | 80–250 words | 400 without a sub-heading |
| Paragraph | ≤ 4 sentences | 6 |

**Reading time** = `ceil(words / 200) + ceil(figures × 0.25) + ceil(tables × 0.25)`, in whole minutes, minimum 1. It is computed, never typed by the author (`reading_minutes`).

### 3.3 Headings

- Sentence case, no terminal punctuation, ≤ 60 characters: "How the light reaction works".
- Never "Introduction" as the only heading; the intro is unheaded prose.
- No heading levels inside a `rich_text` block beyond `###`.
- A heading promises content; "Overview" over a single paragraph is noise.

### 3.4 Prose

- Second person for instructions ("you can see…"), impersonal for definitions.
- Active voice; present tense; no "we" for the product in student-facing content.
- Define a term the first time it appears, in the sentence, not in a glossary block.
- Symbols: define on first use; keep one symbol per quantity within a resource.
- No "simply", "just", "obviously" — they punish the struggling reader.
- Emoji: none. Em dashes: sparing. Exclamation marks: none.

---

## 4. Blocks

| Block | Rules |
|---|---|
| `rich_text` | Markdown subset: paragraphs, lists, bold/italic, inline code, links, `###`. Raw HTML is stripped. Max 4,000 characters |
| `heading` | `h2` only; the renderer owns `h1`. Anchor generated from the text; duplicates get `-2` |
| `image` | Alt text required and descriptive ("Mitochondrion with inner membrane folds labelled"); caption ≤ 120 chars; explicit width/height; ≤ 400 KB after optimisation; no text baked into an image unless it is a diagram label |
| `formula` | LaTeX only, no images of formulas; display formulas on their own block; units outside the math where possible |
| `table` | ≤ 4 columns, ≤ 12 rows on mobile-sensitive pages; header row always; no merged cells (they break on mobile) |
| `callout` | One of `tip`, `warning`, `example`, `examtip`, `definition`; ≤ 120 words; at most two consecutive callouts |
| `video` | ≤ 6 minutes, hosted with a transcript link; never the only explanation of a concept; poster image required |
| `download` | PDF ≤ 5 MB, named `topic-slug-handout.pdf`, licence stated |
| `question_section` | References an assessment; shows count and mode; never embeds answers |
| `related_material` | 2–4 published siblings with a one-line reason |

**Block budget:** a resource over 12 blocks is usually two resources. Over 20 is a defect.

**Maths and units:** `$…$` inline, `$$…$$` display; decimal separator follows the market; units with a non-breaking space (`5\ \text{m/s}`); significant figures consistent within a question set; `×` not `*`; no `\dfrac` inside inline math on mobile.

---

## 5. Writing questions

### 5.1 The one rule

A question has **exactly one defensible answer** at the stated level. If two answers can be argued, the question is wrong regardless of the key.

### 5.2 Stems

- One idea per stem; ≤ 60 words; the question mark at the end.
- State units, rounding and assumptions in the stem, not the options.
- Avoid negatives; if unavoidable, capitalise the negation (NOT) and keep it in one clause.
- No "which of the following is true" when a direct question works.
- Numbers in the stem, units in the options only when the unit is the thing being tested.

### 5.3 Options

| Rule | Detail |
|---|---|
| Count | 4 for `multiple_choice`; 3–6 for `multiple_select`; 2 for `true_false` |
| Length parity | Options within ±30 % of each other's length; the longest option being correct is a giveaway |
| Grammar | All options complete the stem grammatically |
| Distractors | Model a real misconception ("mitochondria make glucose" beats "the nucleus") |
| Forbidden | "All of the above", "None of the above", "Both A and B", joke options, "It depends" |
| Ordering | Numeric options ascending; text options in a stable, non-alphabetical author order |
| Duplicates | Semantically distinct, not just reworded |
| Keys | Not always A/B; distribute keys across a set (checked by a studio warning, not a hard gate) |

### 5.4 Short answer

- Prefer one unambiguous answer; provide accepted variants (`inertia`, `law of inertia`), case-insensitive, trimmed, punctuation-normalised.
- Do not use short answer for anything requiring a specific phrasing; if two phrasings are equally right, both must be accepted.
- Numeric answers: fixed tolerance documented in the key, units required or explicitly forbidden.

### 5.5 Explanations

Every question has an explanation, in two parts:

1. **Why the key is right** (1–2 sentences, references the concept, not the option letter).
2. **Why each distractor is wrong** — one clause per distractor. "B confuses mass with weight."

An explanation that only restates the answer is a defect. Explanations are shown after submit and, in practice mode, per answered question.

### 5.6 Difficulty

| Level | Definition | Typical |
|---|---|---|
| `easy` | Recall of a single fact or definition | One-step |
| `medium` | Apply a concept to a familiar situation | 2–3 steps |
| `hard` | Transfer to an unfamiliar context or combine two concepts | Multi-step, one trap |
| `very_hard` | Multi-concept, precise reasoning, or a common expert trap | Exam-final standard |

Difficulty is a property of the *question*, judged by the author and confirmed by the reviewer's accuracy data once available — not of the topic.

### 5.7 Sets

- A 10-question set covers ≥ 3 difficulty levels and ≥ 2 topics when it is course-scoped.
- No more than 2 questions from the same sub-idea in a 10-question set.
- Cross-listed questions: allowed, but the same question must not appear twice in one assessment (`UNIQUE (assessment_id, question_id)`).

---

## 6. Review checklist (reviewer role)

- [ ] The resource answers the title's promise in the first two screens.
- [ ] Every factual claim is either common syllabus knowledge or sourced.
- [ ] No copied text or unlicensed figure; adapted questions carry provenance.
- [ ] Heading hierarchy is `h2`/`h3` only; sentence case.
- [ ] Alt text on every image; captions read as captions.
- [ ] Tables fit 360 px without horizontal scroll.
- [ ] Callouts are used for a reason, not decoration.
- [ ] Every question has one defensible answer and a two-part explanation.
- [ ] Distractors are plausible and none is a joke.
- [ ] Difficulty labels are consistent with §5.6.
- [ ] Reading time is plausible for the word count.
- [ ] Format label matches reality: a "Lesson + practice" has a published, non-empty assessment.
- [ ] Internal links resolve to published content.
- [ ] Spelling variant is consistent.

Rejection message must name the rule, not the taste ("§5.3: two options are the same idea").

---

## 7. Topic and hub copy

| Field | Rule | Limit |
|---|---|---|
| Subject summary | What the subject covers and for whom | 160 chars (becomes meta description) |
| Chapter summary | The syllabus arc of the chapter | 160 chars |
| Topic summary | One sentence a student would say out loud | 200 chars |
| Topic objectives | 3–6 verbs ("Explain…", "Calculate…"), answerable from the resources | 12 words each |
| Resource title | Names the concept, no clickbait, no level duplication unless the level differs | 70 chars |
| Resource subtitle | Who it is for and what it covers | 120 chars |
| Assessment title | Scope + purpose ("Cell structure knowledge check") | 70 chars |

Objectives are a contract: if an objective is not covered by the resources, either add the content or remove the objective.

---

## 8. Naming and slugs

- Slugs are lowercase, hyphenated, ASCII, ≤ 60 characters, no stop words where avoidable: `light-dependent-reactions`, not `the-light-dependent-reactions-of-photosynthesis`.
- Never reuse a slug for a different concept; a rename creates a redirect (`SEO_AND_CONTENT_STRATEGY.md` §6).
- Reserved slugs are rejected at creation (`INFORMATION_ARCHITECTURE.md` §4.5).
- File names follow the same pattern (`cell-structure-diagram.png`), never `IMG_2043.png`.

---

## 9. Accessibility of content

- Alt text describes the information, not the medium ("Bar chart showing rate rising then plateauing", not "chart image").
- Never put essential information only in an image of text.
- Link text states the destination ("the photosynthesis handout", not "click here").
- Tables have a header row; a table without one becomes a list.
- Video has a transcript; audio-only content is not used.
- Colour is never the only carrier of meaning in a diagram; label series directly where possible.

---

## 10. Consistency rules

| Thing | Convention |
|---|---|
| Numbers | Numerals for 10+, words below, except in measurements and question stems (always numerals) |
| Units | SI, non-breaking space, consistent per resource |
| Chemical notation | Standard formulae with subscripts (`H₂O`), state symbols in equations |
| Dates | "12 November 2026" in prose; ISO in metadata |
| Percentages | `62 %` with a space, per the market's convention chosen once |
| Quotations | Quotation marks per chosen market; attribution inline |
| Abbreviations | Expanded on first use, then consistent |
| Terminology | One term per concept across the whole subject (a synonym list is kept per subject) |

---

## 11. Dependencies

| Needs | From |
|---|---|
| Publish gates, block schema, format derivation | `CONTENT_MODEL.md` §3–§5 |
| Question types, keys, scoring | `QUESTION_ENGINE.md` §3–§6 |
| Callout kinds, typography | `DESIGN_SYSTEM.md` §9.5 |
| Title and summary formulas | `SEO_AND_CONTENT_STRATEGY.md` §3.2, §4.2 |
| Market spelling decision | `OQ-01` |

---

## 12. Edge cases

| # | Case | Behaviour |
|---|---|---|
| ED-01 | A resource grows past 2,500 words | Split at a heading boundary; the new resource gets its own slug and redirect is unnecessary (both stay) |
| ED-02 | Two subjects need the same explanation | One resource lives in the primary topic; the other topic links via `related_material` — do not duplicate the prose |
| ED-03 | A formula cannot render on a small screen | Use a scrollable display block; never shrink below 14 px |
| ED-04 | A diagram contains English labels but the market is Indonesian | Re-label; do not ship a translated caption over English artwork |
| ED-05 | A licensed figure is withdrawn | Replace with an original or remove the block; never leave a hotlinked image |
| ED-06 | Reviewer disagrees with difficulty | Reviewer sets final difficulty; author is told which rubric line applied |
| ED-07 | Question with two correct answers is found after publishing | Archive the question; the assessment keeps the item as archived (DB-02) and studio warns |
| ED-08 | Author writes in a second locale | Blocked at publish until the locale workflow exists (`INTERNATIONALIZATION.md` §6) |

---

## 13. Acceptance criteria

1. Every published resource satisfies §3.1's shape and §3.2's limits.
2. Reading time is computed, and differs from the formula in no published resource.
3. Every image has descriptive alt text and explicit dimensions.
4. Every published question has a two-part explanation.
5. No published question uses a forbidden option pattern (§5.3).
6. The review checklist is applied before publish; a rejected item names the rule.
7. Format labels match the actual assessment link state in 100 % of published topics (tested via the derived-format service).
8. No resource contains raw HTML, an unlicensed figure, or a hotlinked image.
9. Slugs follow §8 and never collide with reserved slugs.
10. A new author can publish a compliant resource using this document alone (usability check with one editor before launch).

---

## 14. Open questions

| # | Question | Impact |
|---|---|---|
| OQ-ED1 | Which spelling variant (`OQ-01`)? | Every string — **Open — needs:** spelling variant follows `OQ-01`'s launch market; **blocks Phase 1**. |
| OQ-ED2 | Do we require a subject-level glossary resource? | Content volume, internal linking — **Open — needs:** decide whether a per-subject glossary resource is required; **blocks Phase 2**. |
| OQ-ED3 | Minimum review depth for a `very_hard` question (two reviewers?) | Throughput vs quality — **Open — needs:** decide whether `very_hard` questions need two reviewers; **blocks Phase 3**. |
| OQ-ED4 | Are worked-solution videos in scope for MVP? | Production cost, hosting — **Open — needs:** decide whether worked-solution videos are in MVP; **blocks Phase 3**. |
| OQ-ED5 | Do we display provenance/licence per resource? | Legal clarity vs UI clutter — **Open — needs:** decide whether provenance/licence is displayed per resource; **blocks Phase 7**. |
