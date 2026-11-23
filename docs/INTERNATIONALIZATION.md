# Internationalization — Exampify

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Proposed — MVP ships `en` ([ADR-033](./ARCHITECTURE_DECISIONS.md#adr-033--launch-locale-is-en-with-routes-unprefixed)); this document defines what must be true so that a second locale is a data change, not a rewrite |
| Depends on | [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md), [SEARCH_ARCHITECTURE.md](./SEARCH_ARCHITECTURE.md), [EDITORIAL_GUIDE.md](./EDITORIAL_GUIDE.md), [SEO_AND_CONTENT_STRATEGY.md](./SEO_AND_CONTENT_STRATEGY.md) |
| Referenced by | [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md), [MVP_ROADMAP.md](./MVP_ROADMAP.md) |

---

## 1. The decision, stated honestly

**MVP ships in one locale: `en`.** The interface and the content are English, `<html lang="en">`, routes unprefixed, no locale negotiation, no translations stored ([ADR-033](./ARCHITECTURE_DECISIONS.md#adr-033--launch-locale-is-en-with-routes-unprefixed)). `id-ID` is the first expansion target, added as a path prefix once there is Indonesian content to serve.

**This is re-affirmed before Phase 6 indexes content.** Locale is cheap to change before indexing and expensive after: the Qdrant payload gains `language`, every point is re-embedded, and every URL needs a redirect. Treat the date of the first index run as the decision deadline.

The rest of this document is the constraint set that makes that reversal affordable — not a feature list:

1. No user-visible string is hard-coded inside a component.
2. No string is built by concatenation.
3. Routes stay unprefixed until a locale decision is made (retrofitting a prefix later is a mass redirect — see §5).
4. Content carries an explicit language as soon as a second language exists (§6, requires a schema change).
5. Search and embeddings are chosen to work for Indonesian *and* English from day one ([ADR-026](./ARCHITECTURE_DECISIONS.md#adr-026--embeddings-via-qdrant-cloud-inference), `SEARCH_ARCHITECTURE.md` §7).

**Why not ship two locales at launch:** a second locale doubles the editorial burden, doubles the thin-page risk, and needs a translation review path that does not exist yet. Embedding support is cheap to have ready; content is not.

**Why English first, when the market may be Indonesian:** editorial capacity, not code, is the constraint. A machine-translated physics corpus published unreviewed is worse than an honest English one, and the multilingual embedding model ([ADR-026](./ARCHITECTURE_DECISIONS.md#adr-026--embeddings-via-qdrant-cloud-inference)) means the search investment survives the language decision either way. The reversal condition is specific: if `OQ-01` lands on an Indonesian exam board, or content operations confirms a complete Indonesian subject before indexing, `id-ID` becomes the launch locale instead.

---

## 2. Terminology

| Term | Meaning here |
|---|---|
| Locale | A language + regional conventions, e.g. `en-GB`, `id-ID` |
| UI copy | Strings owned by the product (buttons, labels, errors) |
| Content | Resources, assessments, questions, topic copy — owned by authors, stored in Turso |
| Content language | The language a resource is written in |
| Fallback | What is shown when a locale is unavailable |

For this product the two are separate problems: UI copy is a small, finite string catalogue; content is a large, editorial corpus. A translation of the interface without translated content would produce English physics inside an Indonesian shell — worse than either alone.

---

## 3. MVP rules (enforced now)

### 3.1 Copy

| Rule | Detail |
|---|---|
| No literal copy in components | All strings come from `lib/copy/<area>.ts` (typed objects, not JSON), imported by the component |
| No concatenation | Use whole sentences with placeholders: `"Question {current} of {total}"`, never `"Question " + current + " of " + total` |
| No grammar by string surgery | Plurals and genders use `Intl.PluralRules`/`Intl.ListFormat` when a locale needs them; at MVP the copy is written in one language but the helper is used where a count is interpolated |
| No copy inside Zod messages | Validation messages are keys resolved at render (`errors.slug_taken`), so the same schema serves any locale |
| No copy in the database | Error strings, email subjects, and labels are code; only *content* is data |

### 3.2 Formatting

| Value | API | Never |
|---|---|---|
| Dates | `Intl.DateTimeFormat(locale, {dateStyle:'medium'})` | `toLocaleDateString()` with no locale, manual `dd/mm` strings |
| Numbers | `Intl.NumberFormat(locale)` | `toFixed` for display |
| Percentages | `Intl.NumberFormat(locale, {style:'percent'})` from `x100` integers | Concatenating `%` |
| Relative time | `Intl.RelativeTimeFormat` | "2 days ago" hand-built |
| Lists | `Intl.ListFormat` | `join(', ')` in user-visible copy |
| Time zones | Store epoch ms; render in the viewer's zone, label it when ambiguous | Storing local times |

The *server* renders dates in the request's resolved locale, so ISR pages do not bake a locale-specific date into HTML unless the page is locale-scoped.

### 3.3 Layout resilience

- No fixed-width button sized to an English label; buttons use padding and `min-width`.
- No text baked into images for anything a user must read (`EDITORIAL_GUIDE.md` §9).
- German-length expansion is the stress test: a 30 % longer string must not break the layout. Tested with a pseudo-locale in development (`?pseudo=1` doubles vowels and adds brackets).
- `lang` is set on `<html>` from the resolved locale, and on content blocks whose language differs from the page (e.g. an Indonesian quotation inside an English resource).

### 3.4 Typography

Font stack must cover Latin Extended (Indonesian is Latin, so this is about diacritics in names and scientific terms, not a second script). If a second *script* is ever needed (Arabic, Javanese), that is a design-system change, not a copy change.

---

## 4. Search and content language

| Concern | MVP behaviour | Second-locale behaviour |
|---|---|---|
| Embeddings | One multilingual model for both languages (`intfloat/multilingual-e5-small`, 384 dims) | Unchanged — a single collection serves both, with a `language` filter |
| Lexical (FTS5) | `unicode61 remove_diacritics 2` tokenizer; no stemming | Per-language tokenizer (`porter` for English) requires a second FTS table — documented, not built |
| Autocomplete | Prefix over `search_terms` (language-agnostic strings) | Suggestions filtered by content language |
| Fuzzy | App-side edit distance over the vocabulary | Unchanged; still no cross-language correction |
| Cross-language query | An Indonesian query can retrieve English content semantically — **a feature, not a bug** | Same; optionally boost same-language results |

Rule: never claim lexical search is multilingual. FTS5 matching is per-token; only the dense side crosses languages, which is exactly why the hybrid design exists.

---

## 5. Routes and SEO if a locale is added

Current routes are unprefixed ([INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) §4). Adding a locale means choosing one of:

| Option | URLs | Cost | Verdict |
|---|---|---|---|
| Path prefix | `/en/...`, `/id/...` | Every existing URL gets a 301; sitemap and canonical logic change once | **Recommended when the time comes** |
| Subdomain | `id.example.com` | Separate authority, simpler routing, worse link consolidation | Acceptable |
| Query/cookie | `?lang=id` | Invisible to crawlers, cannot rank | Rejected |

Prerequisites for any option: `hreflang` pairs on every page, per-locale sitemaps, per-locale canonicals, and a redirect map generated from the old unprefixed URLs. This is a planned migration (`SEO_AND_CONTENT_STRATEGY.md` §6), not a switch.

---

## 6. Content language (the schema gap)

**There is no `language` column on `learning_resources` or `assessments` today.** That is correct for a single-locale MVP and becomes a blocking gap the moment a second language is introduced.

When that happens, the additive migration is:

| Change | Notes |
|---|---|
| `learning_resources.language TEXT NOT NULL DEFAULT '<launch locale>'` | Existing rows backfilled by the default |
| `assessments.language TEXT NOT NULL DEFAULT '<launch locale>'` | Same |
| `topics` copy stays single-language per topic row, or gains a per-locale table | A per-locale table is the honest model but a bigger change; decide then |
| Unique `(topic_id, slug)` becomes `(topic_id, language, slug)` | Slug collisions across languages become legal |
| Search documents and Qdrant payloads gain `language` | Filterable in Qdrant, filterable in FTS5 |

Until this exists, authors must not publish content in a second language and the studio should not offer a language field (ED-08).

Translation of *existing* content is an editorial workflow (source → translate → review by a subject teacher), not an engineering one. Machine translation may be used for a draft but never published unreviewed — a wrong physics explanation in translation is worse than no translation.

---

## 7. Dependencies

| Needs | From |
|---|---|
| Slug budgets, reserved slugs, route shapes | `INFORMATION_ARCHITECTURE.md` §4 |
| Language-agnostic embedding choice, FTS tokenizer | `SEARCH_ARCHITECTURE.md` §7, §5 |
| Market/spelling decision | `OQ-01` (the locale prefix itself is settled by ADR-033) |
| Copy rules for email | `EMAIL_AND_NOTIFICATIONS.md` §7 |
| Content conventions | `EDITORIAL_GUIDE.md` §10 |

---

## 8. Edge cases

| # | Case | Behaviour |
|---|---|---|
| I18N-01 | A user's browser prefers Indonesian, MVP is English | UI stays English; no negotiation until locales exist |
| I18N-02 | A resource quotes a source in another language | `lang` on that block; the surrounding explanation stays in the page language |
| I18N-03 | A subject name differs by locale | Subject name is content, so it is per-locale when content is; slugs do not change |
| I18N-04 | Search query in Indonesian against English content | Semantic hits are expected; lexical hits are not. Documented, not "fixed" |
| I18N-05 | Pseudo-locale breaks a layout in development | Fix the layout, not the pseudo-locale |
| I18N-06 | Date rendered server-side at build time | Use a locale-neutral format on ISR pages, or scope the page by locale |
| I18N-07 | Email in English to an Indonesian user after launch of `id` | Emails follow the account locale, defaulting to launch locale |

---

## 9. Acceptance criteria

1. `grep` for user-visible string literals in `app/**` and `components/**` returns only non-copy (ids, class names) — enforced by review plus a lint rule on JSX text.
2. No user-visible string is produced by `+` concatenation (test: a lint rule for string concatenation in copy modules).
3. Dates, numbers, percentages and lists in the UI go through `Intl` helpers (unit test on the formatters).
4. The whole UI renders without layout break under the pseudo-locale at 360 px and 1280 px.
5. `<html lang>` matches the resolved locale on every page (integration test).
6. A second locale cannot be selected anywhere in the UI, and no component branches on locale.
7. Content in a second language cannot be published (studio rejects it) until §6 is implemented.
8. The documented migration path in §5 and §6 exists in writing, with the exact schema diff, before any translation work starts.

---

## 10. Open questions

| # | Question | Impact |
|---|---|---|
| OQ-I18N1 | ~~Launch locale and interface language?~~ Resolved to `en` ([ADR-033](./ARCHITECTURE_DECISIONS.md#adr-033--launch-locale-is-en-with-routes-unprefixed)), conditional on `OQ-01` | Everything in this document |
| OQ-I18N2 | Is Indonesian content required at launch for the local market? | Editorial scope, possibly the whole launch market — **Open — needs:** decide whether Indonesian content is in the launch corpus (`OQ-04`); **blocks Phase 1**. |
| OQ-I18N3 | Buy/build the translation review workflow (teacher reviewers)? | Cost and quality — **Open — needs:** decide buy vs build the translation review workflow; **blocks Phase 7**. |
| OQ-I18N4 | Accept machine-translated drafts with human review? | Throughput vs risk — **Open — needs:** decide whether machine-translated drafts with human review are allowed; **blocks Phase 7**. |
| OQ-I18N5 | Does the second locale also need a second curriculum taxonomy (national curriculum vs Cambridge)? | Taxonomy is per-curriculum already; content mapping is not — **Open — needs:** decide whether the second locale also needs its own curriculum taxonomy; **blocks Phase 7**. |
