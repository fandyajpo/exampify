# UI/UX Guidelines — Exampify

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Proposed |
| Supersedes | Version 0.1 (materials/tutorials templates, three-block topic hub) |
| Depends on | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md), [USER_FLOWS.md](./USER_FLOWS.md) |
| Referenced by | [MVP_ROADMAP.md](./MVP_ROADMAP.md), [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) |

---

## 1. Purpose and scope

How screens are laid out and behave: templates per page type, grid and responsive rules, interaction patterns, content hierarchy, state handling, accessibility behaviour and microcopy. It is the bridge between the design system (tokens/components) and the flows (journeys).

**In scope:** layout grids, page templates (including search and the three content shapes), density, navigation behaviour, form UX, the attempt-runner interaction model, dashboard layout, studio shell, loading/empty/error patterns, microcopy and tone, responsive breakpoints.

**Out of scope:** token values and component anatomy ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)), business rules ([PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md)), endpoints ([API_CONTRACTS.md](./API_CONTRACTS.md)).

---

## 2. Layout foundations

### 2.1 Breakpoints

| Token | Min width | Layout |
|---|---|---|
| `sm` | 0 | Single column, 16 px gutters, stacked cards |
| `md` | 640 | Single column, 24 px gutters, 2-up cards |
| `lg` | 1024 | Content + 280 px sticky sidebar, 3-up cards |
| `xl` | 1280 | Max container 1280 px, content column 68ch |
| `2xl` | 1536 | Same container (no wider); more surrounding space |

Mobile-first. Every template is designed at 360 px first, then expanded. Breakpoints are content-driven: no layout may require more than one breakpoint change to stay readable.

### 2.2 Grid

- 12-column grid, 24 px gutters (`lg`+), 16 px (`sm`).
- Reading pages: content column 8/12, sidebar 4/12, content max 68ch.
- Directory grids: 1 / 2 / 3 columns at `sm` / `md` / `lg`.
- The practice runner is a **centred single column, max 720 px**, never split-pane; a side palette appears only at `lg`+ as an aside (not a second content column).

### 2.3 Vertical rhythm

| Zone | Mobile | Desktop |
|---|---|---|
| Header height | 64 | 72 |
| Page top padding | 24 | 40 |
| Section gap | 48 | 80 |
| Card padding | 16 | 24 |
| Footer top padding | 48 | 80 |

---

## 3. Page templates

### 3.1 Homepage

```
[Header]
┌─────────────────────────────────────────────┐
│  H1: "Know exactly what to study next."      │  ← display, 2 lines max
│  Sub: one sentence, 60ch max                 │
│  [Find your course] [Search]                 │  ← primary + secondary
│  Curriculum/level quick picker (chips)       │
│  Illustration (right on lg, below on sm)     │
└─────────────────────────────────────────────┘
[Popular subjects — 3-up cards, subject colours]
[How it works — 3 steps: Read / Practise / Fix]
[Browse by subject group — chip grid]
[Footer]
```

- Hero is asymmetric on `lg`: 7 columns text, 5 columns illustration; stacked on `sm`.
- No carousel, no autoplay, no video.
- The curriculum picker writes a cookie so returning visitors skip it.

### 3.2 Subject directory

- Left: filter rail (`lg`+ sticky); mobile: filter button opening a sheet.
- Filters: curriculum, level, subject group (single-select each; no multi-select in MVP).
- Result header: "24 subjects in Cambridge International · IGCSE" + sort-free (position order).
- Grid of `SubjectCard`. Each card: colour band, icon, name, group, topic count.
- Active filters render as removable chips above the grid.
- Empty state: nearest populated combination + clear filters.

### 3.3 Subject page

```
Breadcrumbs
H1 Physics            [Level chip] [Subject colour rule]
Summary (2 lines)
[Start practising →]   ← jumps to first chapter's practice
Stats strip: 8 chapters · 62 topics · 340 questions
Chapter list (numbered rows)
 01  Forces and Motion   12 topics · Study material · Practice   →
 02  ...
```

- Chapters are numbered because the syllabus is ordered; numbers are decorative (`aria-hidden`) since order is conveyed by list semantics.
- Coverage badges show **format**, not absence (Study material / Lesson + practice / Practice test). A study-only topic is a complete page, not a gap.

### 3.4 Search

```
[Header with SearchField focused]
"photosintesis"                 [Did you mean photosynthesis?]
┌ Study materials ──────────────────────────────────────────┐
│ Photosynthesis          Study material · 6 min · Biology   │
└────────────────────────────────────────────────────────────┘
┌ Lessons ───────────────────────────────────────────────────┐
│ Photosynthesis in depth Lesson + practice · 10 questions   │
└────────────────────────────────────────────────────────────┘
┌ Practice tests ────────────────────────────────────────────┐
│ Photosynthesis check    Practice test · 12 questions       │
└────────────────────────────────────────────────────────────┘
```

- Results grouped by format (read first, practise second), each row carrying a `FormatBadge` and its breadcrumb so the student sees the subject before opening it.
- The query lives in the URL (`?q=`), so results are shareable and Back restores them.
- Autocomplete opens under the field after 150–200 ms of typing; results are requested only on submit or after a longer pause — the suggestion list never triggers an embedding call.
- No results: the correction chip, then subject browse links. Never a dead end.
- `degraded: true` (vector index unavailable) shows a quiet note and still lists lexical hits.

### 3.5 Chapter page

- H1 chapter title, summary, topic count.
- Topic rows: index, title, summary, **format badges** (one per derived shape present), estimated minutes, chevron.
- Sticky "Practise this chapter" secondary action at the bottom on mobile, shown only when the chapter has published questions.
- Prev/next chapter links at the end.

### 3.6 Topic hub (the most important template)

```
Breadcrumbs
H1 Newton's First Law
Summary (2 lines)
[Objective list — 3–6 bullets, paper-accent panel]
┌ Read ──────────────────────────────┐ ┌ Practise ──────────────────┐
│ 2 resources                        │ │ 1 practice test · 18 Qs     │
│ • Study material · 6 min           │ │ • Knowledge check · 10 Qs   │
│ • Lesson + practice · 9 min        │ │ by difficulty               │
└────────────────────────────────────┘ └────────────────────────────┘
Prev / Next topic
```

- Two columns at `lg`, stacked at `sm`. Reading comes first in the DOM and in reading order: understand before practise.
- Each resource row shows its **format badge** so the student never opens a page to discover whether it contains questions.
- The practice column is absent — not disabled — when a topic has no published assessment (`E-01`). Never "Practice coming soon".
- Signed-in accuracy appears as a small line inside the practice column ("Your accuracy: 62 % · 3 attempts").

### 3.7 Study material and lesson

```
Breadcrumbs
H1 (resource title)
Meta: 6 min read · [Study material | Lesson + practice]
┌────────────── content 68ch ──────────────┐ ┌ TOC (lg+) ┐
│ blocks: prose, h2/h3, callouts, tables,   │ │ sections  │
│ figures, formulas, video, download        │ │ progress  │
└───────────────────────────────────────────┘ └───────────┘
[Resource 2 of 4 — Next: ...]   (practice section, lessons only)
```

- Reading width fixed; TOC highlights the section in view (`IntersectionObserver`).
- Figures are full content width with captions; formulas never wrap mid-expression.
- On a **study material** page there is no practice UI at all — not a disabled button, not a teaser.
- On a **lesson**, the practice section sits after the last block (or inline where authored) with its own heading, question count and duration; it never auto-starts and the student can leave without interacting.
- "Next resource" is the dominant action at the end.

### 3.8 Practice section on a lesson

- A bordered section with a format badge, question count, estimated duration and a single primary `Start practice` button.
- When the assessment is `test`/`mock`, show the duration prominently; when `practice`, show "instant feedback".
- If the linked assessment is unpublished, staff see a placeholder; students do not see the section.
- It is a section, not a modal: it must be shareable via `#practice` and crawlable at its own URL.

### 3.9 Practice configuration

- Container 640 px, single column.
- Step 1: scope (already known when entered from a topic; editable via a change link).
- Step 2: count as a segmented control (5/10/20/40) with availability shown ("18 available").
- Step 3: difficulty chips (Any / Easy / Medium / Hard / Very hard) with counts.
- Step 4: question types checkboxes with counts.
- Sticky summary bar: "10 questions · Any difficulty · 2 types" + `Start practice`.
- If availability is 0: the start button is disabled and an inline hint suggests "Any difficulty".
- No timer, no name field, no setup wizard with progress dots (one screen is enough).

### 3.10 Practice runner

```
┌───────────────────────────────────────────────┐
│ Q3 of 10        ●●●●○○○○○○        [Exit]      │  ← progress by count
├───────────────────────────────────────────────┤
│ [Difficulty badge] [Type badge]               │
│ Stem (text-lg, max 3 lines visible, scrolls)  │
│ [Optional image]                              │
│                                               │
│ ┌ A ───────────────────────────────────────┐  │
│ │ ...                                      │  │
│ └──────────────────────────────────────────┘  │
│  ... options ...                              │
├───────────────────────────────────────────────┤
│ [Previous]                        [Next →]    │
└───────────────────────────────────────────────┘
   (lg+: question palette aside)
```

Interaction rules:
- Selecting an option immediately saves (no "save" button). The next question is one click away.
- `Next` is always enabled; the runner never blocks progress on an answer.
- `Previous` preserves the selection.
- Last question's primary action is `Review answers` (not `Submit`); a review screen lists answered/unanswered with jump links, then `Submit`.
- Exit shows a dialog: "Your answers are saved. Resume anytime." with `Exit` / `Keep going`.
- Keyboard: `1–8` select options, `←/→` navigate, `Enter` next, `Esc` exit dialog.

### 3.11 Review screen

```
[Score card: 7 / 10 · 70%]  [Time 6:12] [Retry] [Back to topic]
[Filter: All · Incorrect · Unanswered]
Question 1  ✓ correct        [expand]
Question 2  ✗ incorrect      [expanded by default]
   Your answer: B   Correct: C
   Explanation (rich text)
   Why B is wrong (option feedback)
Question 3  — not answered   [expand]
```

- Score is prominent but not celebratory; no confetti, no streak effects.
- Incorrect and unanswered are expanded; correct collapsed.
- Each question links to its topic ("Revise this topic") and the page ends with `Practise again` and `Go to dashboard`.
- If `contentUpdated`, a small notice appears inside that question.

### 3.12 Dashboard

```
H1 Your progress                     [Period: 30 days ▾]
[4 stat cards: sessions · questions · accuracy · study time]
[Focus topics — up to 5 rows, weakest first, each with "Practise" button]
[Activity chart — 30-day bars, no gradients]
[Recent sessions — table/list, link to review]
```

- Empty state replaces the whole dashboard body for new users: "No practice yet. Pick a topic to start." with three suggested topics.
- Accuracy is shown as a percentage with the fraction beneath ("62 % · 31/50") so it is never unexplained.
- No streaks, badges or leaderboards (`§4.2` non-goals).

### 3.13 Studio shell

```
┌ Header (logo, "Studio" badge, search, user) ─────────────┐
│ Rail 264px        │ Content                            │
│ Curricula         │ Page header + status + actions      │
│ Subjects          │ Form / table / editor              │
│ Questions         │                                     │
│ Media             │                                     │
│ Users (admin)     │                                     │
│ Audit (admin)     │                                     │
└───────────────────┴─────────────────────────────────────┘
```

- Rail collapses to a sheet under `lg`.
- The entity header is sticky: title, status badge, `Preview`, `Save`, `Submit for review` / `Publish`.
- Editors use a two-column form at `xl` (fields + side panel for status/metadata) and one column below.
- Studio is deliberately denser than the public site: 14 px labels, 44 px rows, hairline dividers — but still uses the same ink borders and paper surfaces so it feels like the same product.
- A global "unsaved changes" indicator appears in the header; the browser unload guard is only enabled when dirty.

---

## 4. Interaction patterns

| Pattern | Rule |
|---|---|
| Navigation | Links are real `<a>`; never a click handler that calls `router.push` on a div |
| Optimistic UI | Allowed for answer selection and reorder; not for publish, delete, role changes |
| Loading | Skeletons that match final layout; buttons show inline spinners and lock |
| Errors | Inline at the field for validation; banner for page-level; toast for background save success/failure |
| Confirmation | Required for: unpublish, archive, delete, role change, discarding unsaved changes, submitting with unanswered questions |
| Destructive colour | `danger` variant only; the primary button in a destructive dialog is the *safe* action |
| Autosave | Never on a form with a submit button (studio metadata), always in the block editor and long-form prose |
| Undo | Not available in MVP; confirmations are the substitute (recorded limitation) |
| Empty states | Always include one action and one sentence of orientation |
| Pagination | "Load more" buttons, never infinite scroll on content or tables |

---

## 5. Forms

- Labels above inputs, always visible; placeholder is an example, never the label.
- Required fields marked with a `*` and an explanatory note at the top of the form ("* required").
- Validate on blur and on submit; not on every keystroke for text fields (reduces noise), but yes on keystroke for the question-editor gates that show live character counts.
- Error summary at the top of long forms with anchor links, plus inline messages.
- Server errors map to fields via `details[].path`; unknown server errors show a banner with `requestId`.
- Submit button shows "Saving…", is disabled during save, and re-enables on failure with the message preserved.
- Multi-step forms: the practice config is not a wizard (single screen). Studio editors use tabs for sections, not a wizard.

---

## 6. Typography and content hierarchy per screen

| Screen | H1 | H2 | Body |
|---|---|---|---|
| Home | Value proposition (text-5xl) | Section titles (text-2xl) | 17 px, ≤ 60ch |
| Directory | "Subjects" (text-3xl) | Filter group labels (text-sm uppercase) | Card text 14–17 px |
| Subject | Subject name (text-4xl) | "Chapters" (text-2xl) | Summary 20 px lead |
| Topic | Topic title (text-4xl) | Block titles (text-xl) | Objectives 17 px |
| Study material / lesson | Resource title (text-3xl) | `##` sections (text-2xl) | 17 px / 1.7, 68ch |
| Search results | Query echo (text-2xl) | Group labels (text-sm uppercase) | Rows 15–17 px |
| Practice | Question stem (text-xl–2xl) | — | Options 17 px |
| Dashboard | "Your progress" (text-3xl) | Panel titles (text-xl) | Numbers tabular |
| Studio | Entity title (text-2xl) | Section headers (text-lg) | 14 px dense |

One `h1` per page, no skipped heading levels (a callout label is not a heading).

---

## 7. Microcopy and tone

| Principle | Example |
|---|---|
| Direct, second person | "Practise 10 questions on this topic." |
| State the fact, then the action | "8 of 10 questions available. Start practice." |
| No hype, no emoji in UI | ~~"Let's crush this! 🚀"~~ → "Ready for 10 questions?" |
| Errors explain the fix | "That answer wasn't saved. Check your connection and try again." |
| Empty states orient | "This chapter has no topics yet. Browse another chapter." |
| Formats are named, not implied | "Study material · 6 min" / "Lesson + practice · 10 questions" / "Practice test · 20 min" |
| Buttons are verbs | "Start practice", "Submit answers", "Publish topic" |
| Scores are neutral | "7 of 10 correct" not "Great job!" |

Vocabulary (fixed): **study material**, **lesson**, **practice test**, **practice** (noun/verb), **topic**, **chapter**, **subject**, **assessment**, **attempt**, **review**, **dashboard**, **studio**. Never "notes" as an entity name, never "quiz" (use practice test), never "session" in UI copy (use attempt). Keep British/American spelling consistent with the launch market (`OQ-01`); the current docs use British-influenced spelling for "practise" (verb) and "practice" (noun) — implement one locale's conventions consistently in UI copy.

---

## 8. Accessibility behaviour (beyond tokens)

- Skip link to `#main` as the first focusable element.
- Page `title` follows `"{Page} — Exampify"`; on submit/review screens include the result ("Review — 7 of 10").
- Route changes announce the new page name via a polite live region (App Router client boundary).
- Question/answer groups use `fieldset` + `legend`; option state is announced by real input semantics, not `aria-checked` on divs.
- Progress bars have `aria-valuetext` ("Question 3 of 10").
- Dialogs: focus trap, `aria-modal`, labelled by their heading, `Esc` closes, focus returns.
- Form errors: `aria-invalid`, `aria-describedby`, and an `aria-live` summary.
- Tables: `<th scope>`, caption where the table has no visible heading.
- Charts: the activity chart has a text summary ("14 questions on 12 Nov") in an accessible table alternative.
- Colour is never the only signal for correct/incorrect (icon + label).
- Practice-mode feedback is announced when it appears ("Correct. Explanation available."), and focus is not stolen from the next question.
- Reduced motion and 200 % zoom are part of the PR checklist.

---

## 9. Responsive specifics

| Surface | Mobile (< 640) | Tablet | Desktop |
|---|---|---|---|
| Header | Logo + menu button + search icon | Logo + nav + search | Full nav |
| Filters | Bottom sheet | Inline chips | Sticky rail |
| Practice palette | Bottom sheet | Hidden | Aside |
| Studio rail | Sheet | Collapsed icons | 264 px |
| Tables | Card list | Card list | Table |
| TOC | `<details>` at top | `<details>` | Sticky aside |
| Topic blocks | Stacked | 2-up | 3-up |
| Footer | Accordion columns | 2 columns | 4 columns |

---

## 10. State handling matrix

| Surface | Loading | Empty | Error | Partial |
|---|---|---|---|---|
| Topic hub | Section skeletons | Cannot occur for a published topic; a child 404 explains and links up | Retry banner | Practice column omitted when no assessment exists |
| Search | Inline spinner in field | Recent searches + popular subjects | "Search unavailable" + browse links | `degraded: true` note above results |
| Attempt runner | Card skeleton | n/a | Save failure inline | Some answers unsaved flagged |
| Review | Skeleton list | n/a | Retry fetch | `contentUpdated` per item |
| Dashboard | Stat skeletons | Onboarding with 3 topics | Retry | Accuracy `null` shown as "—" |
| Studio list | Row skeletons | "No questions yet" + create | Retry | Validation warnings |

---

## 11. Dependencies

- Requires the primitives from `DESIGN_SYSTEM.md` §9 before templates can be built.
- Uses route shapes from `INFORMATION_ARCHITECTURE.md` §4.
- Implements the states described in `USER_FLOWS.md` §12.
- Practice/review templates depend on the DTO shapes in `API_CONTRACTS.md` §5.

---

## 12. Edge cases

| # | Case | Behaviour |
|---|---|---|
| UX-01 | Question stem longer than the viewport | Stem region scrolls independently; options stay reachable; no page-level jump |
| UX-02 | 8 options on a 360 px screen | Full-width stacked options, 48 px min height, no horizontal scroll |
| UX-03 | Very long topic title | 3-line clamp in cards, full title on the page, `title` attribute on links |
| UX-04 | Zero available questions for the chosen filters | Start disabled + one-click "Any difficulty" fix |
| UX-05 | Answer save fails | Persistent inline "Not saved — retry", submit blocked until resolved or explicitly overridden |
| UX-06 | Sign-in session expires while an attempt is open | On next action, a dialog explains and returns to sign-in with a return path; saved answers are restored, unsaved ones are not graded |
| UX-07 | Dark-mode OS setting | UI stays light; no half-themed components |
| UX-08 | Slow network on a content page | Server-rendered HTML appears first; TOC and images hydrate progressively |
| UX-09 | User opens a review link for someone else's attempt | 404 page with "find your own results" link to the dashboard (never a 403 that confirms the attempt exists) |
| UX-10 | Screen reader on the runner | Question change announced ("Question 4 of 10"), option group labelled, save status polite |
| UX-11 | Print a study material or lesson | Nav and practice UI hidden, text black on white, URLs printed after links, page breaks kept off headings and figures |
| UX-13 | A study material has no practice | No empty practice affordance is rendered anywhere on the page |
| UX-14 | Search returns nothing for a typo | "Did you mean …?" suggestion plus browse links, never a bare "0 results" |
| UX-12 | Studio table with 1 row | Table renders with header, plus an empty-state prompt below (not a broken grid) |

---

## 13. Acceptance criteria

1. Every template in §3 exists at 360 px, 768 px and 1280 px with no horizontal scroll and no clipped text.
2. The practice runner is fully operable with keyboard only and announces question changes.
3. Answer options meet 44 px touch targets and use real radio/checkbox semantics.
4. Review expands incorrect/unanswered items by default and shows explanations for every question.
5. Dashboard empty state offers three concrete topic suggestions instead of blank panels.
6. Studio forms surface server `details[].path` errors inline and show a `requestId` for unknown failures.
7. Every destructive action requires confirmation, with the safe action as the primary button.
8. Loading skeletons match final layout footprints (no content shift on arrival).
9. Microcopy contains no hype, no emoji, and uses the fixed vocabulary of §7.
10. Print and 200 % zoom remain usable on study material, lesson and review pages.

---

## 14. Open questions

| # | Question | Impact |
|---|---|---|
| OQ-UX1 | Which English variant is canonical for UI copy (UK vs US)? | Spelling consistency across all strings — **Open — needs:** spelling variant follows `OQ-01`'s launch market; **blocks Phase 1**. |
| OQ-UX2 | Is the two-column Read/Practise topic hub the right emphasis, or should practice be a single full-width band? | Template redesign risk — **Open — needs:** decide the topic-hub layout emphasis; **blocks Phase 2**. |
| OQ-UX3 | Do students need a "flag question" control at launch? | Adds a report table/flow; currently excluded — **Open — needs:** decide whether a flag-question control ships at launch; **blocks Phase 4**. |
| OQ-UX4 | Should the runner show a countdown in `test`/`mock` mode (duration is already enforced server-side)? | UI scope in Phase 5 — **Open — needs:** decide whether test/mock shows a countdown; **blocks Phase 4**. |
| OQ-UX5 | Is a mobile bottom navigation bar expected for the student area? | Adds a persistent nav surface; currently header-only — **Open — needs:** decide whether the student area gets mobile bottom navigation; **blocks Phase 2**. |
