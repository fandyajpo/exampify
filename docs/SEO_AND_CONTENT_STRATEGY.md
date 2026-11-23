# SEO and Content Strategy — Exampify

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Proposed |
| Supersedes | Version 0.1 (materials/tutorials, exam-first content strategy) |
| Depends on | [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md), [CONTENT_MODEL.md](./CONTENT_MODEL.md), [SEARCH_ARCHITECTURE.md](./SEARCH_ARCHITECTURE.md) |
| Referenced by | [MVP_ROADMAP.md](./MVP_ROADMAP.md) Phase 1 & 6, [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) |

---

## 1. Purpose and scope

How public content is discovered and ranked, and how content is planned and produced so the site is worth ranking. Search is the primary acquisition channel for an exam-preparation product, so SEO is treated as a product requirement (`FR-DISC-10`, `FR-DISC-14`, `NFR-01`), not a post-launch task.

**In scope:** technical SEO rules, metadata, structured data, sitemaps, robots, canonicalisation, indexation policy, internal linking, content planning and quality standards, measurement, redirect and migration policy.

**Out of scope:** paid acquisition, email marketing, brand campaigns, social strategy, keyword-volume research (which requires tooling and market data we do not have — `OQ-01`).

**Honest constraint:** no keyword research has been performed. This document defines the *system* that turns a chosen curriculum into indexable pages and the *process* for prioritising them. It deliberately does not invent search volumes or competitor gaps.

---

## 2. Strategic position

### 2.1 Why structure wins

Exam-preparation queries are syllabus-shaped: "cambridge igcse physics forces and motion notes", "a level chemistry mole calculations questions". A competitor with flat article URLs cannot be certain which syllabus a page covers. Exampify's URLs and breadcrumbs state the curriculum, level, subject, chapter and topic explicitly — which is both a ranking signal (relevance, specificity) and a user signal (the searcher immediately sees it is *their* syllabus).

That is the core SEO bet: **specificity of structure over volume of pages.**

### 2.2 Launch content strategy

| Decision | Approach |
|---|---|
| Depth before breadth | One subject with **complete** chapter/topic coverage beats six half-covered subjects. Launch target: 1 curriculum, 1–2 levels, 3–5 subjects, every chapter with ≥ 1 published topic. |
| Topic completeness | Each topic ships with ≥ 1 study material (≥ 300 words) **and, where the syllabus warrants it, a practice set**. Practice is strongly recommended, never a publish requirement — a topic with only a resource is a complete page (`CONTENT_MODEL.md` §4.5). |
| No thin pages | A topic whose resources total less than ~300 words is not published (gate in `CONTENT_MODEL.md`). |
| Three indexable shapes | Study material, lesson + practice and practice test each get their own URL and their own structured-data `learningResourceType`, so one topic can rank for "notes", "lesson" and "practice questions" intents without thin duplicates. |
| No past papers at launch | Licensing risk (`A-07`); revisit with legal. |
| Original content only | No scraped or paraphrased competitor content (`A-08`). Every explanation is written by the team or licensed with recorded provenance. |
| Authoring cadence | Content ops owns a weekly target; engineering is not on the critical path for content volume. |
| Programme pages exist | Curriculum and level landing pages explain the syllabus, list subjects and link onward — they capture broader queries and pass authority down. |

### 2.3 Content quality bar (what makes a page worth indexing)

1. Answers the searcher's intent in the first two screens (summary + objectives).
2. Is syllabus-specific (names the curriculum and level in the H1 context and metadata).
3. Contains worked reasoning, not just facts ("why", "common mistake", "exam tip").
4. Has a next step the searcher can act on immediately — another resource or, when it exists, practice.
5. Is linked from at least one other published page (`IA §7` orphan rule).
6. Is not duplicated across levels without genuine differentiation.

---

## 3. Technical SEO rules (normative)

### 3.1 Indexation policy

| Page type | Indexable | Notes |
|---|---|---|
| Homepage | ✅ | |
| Curriculum / level landing | ✅ (only if it has ≥ 1 published subject) | Otherwise `noindex, follow` |
| Subject directory `/subjects` | ✅ | Filters via query string are canonicalised to the unfiltered page |
| Subject page | ✅ (≥ 1 published chapter) | |
| Chapter page | ✅ (≥ 1 published topic) | |
| Topic hub | ✅ (published, complete per gates) | |
| Study material page | ✅ | No assessment required |
| Lesson page (resource + practice) | ✅ | Practice section is part of the page |
| Practice test page | ✅ shell, `noindex` on the attempt itself | Scope/duration/start indexable; the runner and review are not |
| Search results | ❌ `noindex, follow` | Prevents infinite crawlable query space |
| Practice, dashboard, auth | ❌ `noindex, nofollow` | Authenticated |
| Studio | ❌ `noindex, nofollow` | |
| Draft preview | ❌ `noindex` + `X-Robots-Tag` | Staff only |
| Paginated list page 2+ | ❌ `noindex, follow` | |
| 404 / 500 | ❌ | Status codes are correct, never a 200 soft 404 |

Thin-page rule: a page that renders fewer than ~300 words of unique content (excluding navigation) is `noindex, follow` until enriched. This is enforced by a computed check in the metadata builder, not left to authors.

### 3.2 Metadata rules

| Element | Rule |
|---|---|
| `<title>` | 45–60 chars. Formula per level below. Always unique on the site. |
| `meta description` | 120–158 chars. `subject.seo_description` → `summary` → generated sentence. Unique per page. |
| `<h1>` | Exactly one; matches search intent; may differ from `<title>` |
| Canonical | Absolute URL, no query string (unless the page *is* a filtered view we intentionally canonicals to itself), no trailing slash |
| `lang` attribute | `en` (or launch locale) on `<html>` |
| `og:title` / `og:description` / `og:image` | Present on every indexable page; OG image is a generated 1200×630 card |
| `twitter:card` | `summary_large_image` |
| `robots` | Explicit `index, follow` or `noindex, follow` — never omitted for public pages |
| `hreflang` | Not used (single locale, unprefixed — `OQ-IA5` resolved by ADR-033) |

**Title formulas**

| Page | Pattern | Example |
|---|---|---|
| Homepage | `{Brand} — Study notes, lessons & practice questions` | |
| Curriculum | `{Curriculum} revision notes & practice — {Brand}` | |
| Level | `{Curriculum} {Level} revision notes & practice — {Brand}` | |
| Subject | `{Subject} {Level} {Curriculum short} — Notes, lessons & practice` (seo_title override wins) | "Physics IGCSE Cambridge — Notes, lessons & practice" |
| Chapter | `{Chapter} — {Subject} {Level}` | "Forces and Motion — Physics IGCSE" |
| Topic hub | `{Topic}: study notes & practice questions — {Subject}` | |
| Study material | `{Resource title} — {Topic}` | |
| Lesson | `{Resource title}: notes & practice — {Topic}` | |
| Practice test | `{Assessment title} — {Topic} practice questions` | Course-wide: `{Assessment title} — {Subject} {Level}` |

Titles are built by `lib/seo/metadata.ts` from resolved entities; authors override only via the documented `seo_title` field. No page assembles a title inline.

### 3.3 Heading structure

- One `h1`. Sections use `h2`, subsections `h3`. No skipping.
- Material bodies start at `##` (the template owns `h1`) — enforced by the renderer which demotes an authored `#` to `h2` with a warning.
- Callout labels are not headings (they are `<p>`/`<span>` inside an aside).
- Card titles are not headings unless they head a section; use `<p>` with typographic weight for card titles inside lists (avoids 40 `h3`s in a directory).

### 3.4 Structured data (JSON-LD)

| Page | Types |
|---|---|
| All | `WebSite` + `SearchAction` (site-wide search box), `Organization` |
| Content pages | `BreadcrumbList` mirroring the visible breadcrumb |
| Subject page | `Course` (`name`, `description`, `provider`, `educationalLevel`, `inLanguage`) — **not** `CourseInstance` (no schedule/price) |
| Study material / lesson | `LearningResource` (`learningResourceType`: "article" / "lesson"`, `educationalLevel`, `teaches`, `isPartOf`, `timeRequired` from `reading_minutes`) |
| Practice test | `Quiz` (`educationalLevel`, `assesses`, `numberOfQuestions`, `timeRequired`) wrapped in `LearningResource` where valid |
| Topic hub | `LearningResource` + `ItemList` of resources and assessments (ordered, with each item's format) |
| FAQ | Not used in MVP (no Q&A content type) |

Rules: JSON-LD is server-rendered, one `<script type="application/ld+json">` per schema graph, validated in CI against a fixture schema, and never contains fields the page does not visibly support (no fake ratings, no fake prices).

### 3.5 Sitemaps and robots

- Sitemap index at `/sitemap.xml` referencing `/sitemap/static.xml`, `subjects.xml`, `chapters.xml`, `topics.xml`, `resources.xml`, `assessments.xml` (`IA §9`).
- `lastmod` reflects the newest `published_at` in the subtree — not the build time.
- Segments split at 45,000 URLs.
- `robots.txt` allows content paths, disallows `/studio`, `/dashboard`, `/practice`, `/api`, `/search`, and points to the sitemap index.
- Sitemaps contain **only** published URLs; an archived entity disappears on the next regeneration.

### 3.6 Internal linking

- Every content page links up (breadcrumb), across (prev/next), and down (children).
- Subject pages link to every chapter; chapter pages to every topic.
- Topic hubs link to their resources and assessments, each labelled with its format.
- Resources link forward/backward within the topic and, when present, to their practice section.
- A lesson links to its assessment page so the practice surface is crawlable independently of the reading page.
- Anchor text is descriptive and includes the topic name ("Revise Newton's First Law"), never "click here".
- No page is reachable only via the sitemap (orphan rule).
- Footer links to the subject directory and top-level curricula only — no sitewide keyword stuffing.

### 3.7 Performance and Core Web Vitals

SEO depends on `NFR-01`. Specific to content pages:

- Text is server-rendered (no client-only content).
- LCP element is the `h1` or hero image, never a webfont-dependent block; fonts preloaded with `display: swap`.
- Images have explicit dimensions and `loading="lazy"` except the first hero image.
- No layout-shifting ad/CTA injection.
- Third-party scripts: none in MVP beyond error tracking.

---

## 4. Content architecture for search

### 4.1 Keyword-to-page mapping process

Applied per subject before authoring:

1. List the syllabus chapters and topics (from the official specification the team is licensed to reference structurally).
2. For each topic, define the primary intent: *understand* (study material), *learn then apply* (lesson), *test* (practice test).
3. Map one page per intent **where content exists**. A topic hub serves the navigational intent; resources serve specific sub-intents (e.g. "inertia definition", "Newton's first law examples").
4. Split resources when a sub-intent deserves its own page and ≥ 300 words (`CONTENT_MODEL.md` §10 rule 2). Do not manufacture a practice test to capture a query if no questions exist — a thin quiz page is worse than none.
5. Record the mapping in the content plan (spreadsheet, not code). Titles must read like the searcher's phrase without keyword stuffing.

### 4.2 Page-level content checklist (author-facing)

- [ ] Title states subject + level + curriculum where relevant.
- [ ] Summary is a complete, useful sentence (it becomes the meta description).
- [ ] Objectives are answerable from the page.
- [ ] At least one worked example or diagram.
- [ ] At least one callout (exam tip or common mistake).
- [ ] Heading structure is `##`/`###` only.
- [ ] ≥ 1 inbound internal link exists.
- [ ] Practice available, or the absence is a deliberate editorial choice (not a content-gap ticket).
- [ ] No competitor text, no unlicensed diagram.
- [ ] British/American spelling consistent with the chosen market.

### 4.3 What not to publish

- Duplicate topics differing only by level (differentiate or omit).
- "Coming soon" pages (use `noindex` or don't create them).
- Auto-generated pages from a keyword list with no real content.
- Question pages (practice content is never public per-question — it would leak answers).
- Tag/archive pages (no taxonomy beyond the hierarchy).

---

## 5. Measurement

| Metric | Tool | Target |
|---|---|---|
| Indexed pages vs published pages | Search Console coverage | ≥ 95 % of published indexable pages indexed |
| Impressions/clicks per subject | Search Console | Establish baseline at launch; review monthly |
| Average position for topic queries | Search Console | Track, no fixed target pre-data |
| Core Web Vitals (p75) | CrUX / Lighthouse CI | LCP < 2.5 s, INP < 200 ms, CLS < 0.1 |
| Crawl errors | Search Console | Zero 5xx on content URLs |
| Rich result validity | Search Console enhancements | Zero errors on Breadcrumb/Course/LearningResource |
| Internal link orphans | Nightly integrity check (Phase 5+) | Zero |

No third-party analytics beyond first-party product events in MVP. Search Console is the primary SEO instrument.

---

## 6. Redirects and migrations

- Slug change on published content ⇒ `301` (old → new), written automatically (`FR-CMS-12`).
- Topic moved between chapters ⇒ `301` for the topic and every descendant path.
- Curriculum/level slug change ⇒ prefix redirect; collapse chains to one hop.
- Unpublished content does not redirect by default; if it had been published and has traffic, an admin may map it to the nearest published ancestor.
- Redirects are stored in the `redirects` table, not in config files, so content editors can create them and they survive deploys.
- Never redirect to a 404; validate the target exists and is published at write time (and re-check in the nightly integrity job).

---

## 7. Dependencies

| Module | Relationship |
|---|---|
| Information architecture | URL shapes, breadcrumbs, sitemap segments |
| Content model | Titles, summaries, `seo_*` fields, publish gates |
| Design system | OG image template, typography for `h1` |
| Product architecture | ISR, cache tags, metadata builders |
| Testing | Metadata/JSON-LD fixtures, sitemap tests, redirect tests |

---

## 8. Edge cases

| # | Case | Behaviour |
|---|---|---|
| SEO-01 | Subject name duplicated across levels | URLs differ; titles include the level; internal links disambiguate |
| SEO-02 | Empty subject published | Blocked by publish gate; if it happens, page is `noindex, follow` |
| SEO-03 | Two resources with near-identical content | Allowed but flagged in review; canonical is self (no cross-canonical) |
| SEO-04 | Query-string filters crawled | Canonical to the unfiltered directory; filters are `noindex, follow` when not the canonical form |
| SEO-05 | Slug changed twice in a week | Redirects collapse to the latest target; no chains |
| SEO-06 | Content archived but ranking | Page returns 404 (or a mapped 301); sitemap drops it within 60 s of publish invalidation |
| SEO-07 | Sitemap exceeds 45k URLs | Split by segment and, if needed, by first letter |
| SEO-08 | Title longer than 60 chars from a long topic name | Template truncates at the last word boundary before 60; full title remains the `h1` |
| SEO-09 | Locale decision changes post-launch | Requires a prefix and mass redirects; the launch answer is recorded in `OQ-IA5` (no prefix), so this is a cost of a later change, not an open item |
| SEO-10 | JS disabled | All content and metadata present in the initial HTML |
| SEO-11 | Paginated resource index | Indexable only if it is the primary topic content; otherwise `noindex, follow` |
| SEO-12 | Search engine crawls an attempt | `noindex` + auth redirect; answers never in HTML |
| SEO-13 | A lesson and its assessment both rank for the same query | Different intents (read vs practise); both canonical to themselves; the lesson links to the test |
| SEO-14 | A resource is edited and its reading time changes | `timeRequired` updates on revalidation; no URL change |

---

## 9. Acceptance criteria

1. Every indexable page has a unique `<title>`, a unique meta description, one `<h1>`, and an absolute canonical URL.
2. `robots.txt` and the sitemap index validate, and the sitemap contains only published URLs with real `lastmod` values.
3. Breadcrumb JSON-LD matches the visible breadcrumb on every content level (test).
4. `Course`, `LearningResource` and `Quiz` JSON-LD validate in the rich-results test with zero errors.
5. Thin pages (< 300 words) are automatically `noindex, follow`.
6. Draft previews return `noindex` and are inaccessible to anonymous users.
7. Search result pages are `noindex`.
8. A slug change produces a working `301` in one hop, verified by an automated test.
9. Lighthouse mobile on a topic page scores SEO ≥ 95 and performance ≥ 90.
10. No page depends on client-side JavaScript for its primary text content.
11. Zero orphan pages among published content (integrity check).
12. OG images render for every content type at 1200×630.

---

## 10. Open questions

| # | Question | Impact |
|---|---|---|
| OQ-SEO1 | What is the launch market/locale (`OQ-01`)? | Spelling, `lang`, hreflang decision — **Open — needs:** decide the launch market/locale (`OQ-01`); **blocks Phase 1**. |
| OQ-SEO2 | Do we invest in keyword research tooling before launch? | Content prioritisation accuracy — **Open — needs:** decide whether keyword research tooling is bought before launch; **blocks Phase 7**. |
| OQ-SEO3 | Is a blog/learning-hub content type in scope within 6 months? | Adds a content type, indexation policy, author pages — **Open — needs:** decide whether a blog/learning hub ships within 6 months; **blocks Phase 7**. |
| OQ-SEO4 | Should subject pages show a syllabus/specification reference (and is that licensed)? | Content strategy and legal — **Open — needs:** decide whether to cite syllabi and whether that needs a licence; **blocks Phase 2**. |
| OQ-SEO5 | Do we need author bio pages for E-E-A-T signals? | Trust signals; currently `author` role exists but no public profile — **Open — needs:** decide whether public author bio pages are needed; **blocks Phase 7**. |
| OQ-SEO6 | Is a separate `/subjects/{group}` path needed for category queries (`OQ-IA3`)? | Additional indexable page type — **Open — needs:** decide whether `/subjects/{group}` is indexable (ties `OQ-IA3`); **blocks Phase 6**. |
