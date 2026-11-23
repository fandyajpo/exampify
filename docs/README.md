# Exampify — Documentation

**Status:** Phase 0 complete (specification at v1.4); Phase 1 in progress — scaffold, tokens and the public homepage exist, the infrastructure spike and the seeded public site do not yet.
**Product working name:** Exampify (directory `exampify`). Placeholder pending brand validation.
**Last structural revision:** 2026-11-20 — architecture revised to Turso/Kysely/Better Auth/Tigris/Qdrant/Upstash on Vercel + Bun, and the product reframed as a **learning platform** with three content shapes.

This directory is the implementation reference for Exampify. It is written so an implementation agent can build the MVP without guessing product requirements, and so a future maintainer can see *why* each structural choice was made — including the ones that were replaced.

---

## Document map

| # | Document | What it answers | Primary readers |
|---|----------|-----------------|-----------------|
| 1 | [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) | What are we building, for whom, what is in/out of MVP? | Everyone |
| 2 | [PRODUCT_ARCHITECTURE.md](./PRODUCT_ARCHITECTURE.md) | How do the runtime pieces fit together, and why these? | Engineers, DevOps |
| 3 | [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) | How is content organised, and what are the URLs? | Designers, engineers, SEO |
| 4 | [USER_FLOWS.md](./USER_FLOWS.md) | What are the end-to-end journeys and their states? | Designers, engineers, QA |
| 5 | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Tables, types, keys, indexes, ownership, SQLite constraints | Backend engineers |
| 6 | [CONTENT_MODEL.md](./CONTENT_MODEL.md) | What is a resource, block and assessment as a domain object? | Authors, backend engineers |
| 7 | [QUESTION_ENGINE.md](./QUESTION_ENGINE.md) | How are questions authored, selected, graded and reviewed? | Backend + frontend engineers, authors |
| 8 | [API_CONTRACTS.md](./API_CONTRACTS.md) | Every endpoint, schema, error, pagination and conflict rule | Full-stack engineers |
| 9 | [SEARCH_ARCHITECTURE.md](./SEARCH_ARCHITECTURE.md) | How semantic, lexical, prefix and fuzzy search work together | Engineers, search owner |
| 10 | [BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md) | What runs async, how it retries, how duplicates are harmless | Backend engineers |
| 11 | [SEO_AND_CONTENT_STRATEGY.md](./SEO_AND_CONTENT_STRATEGY.md) | How public pages get discovered and rank | Marketing, engineers |
| 12 | [UI_UX_GUIDELINES.md](./UI_UX_GUIDELINES.md) | How screens behave, lay out and adapt | Designers, frontend engineers |
| 13 | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Tokens, type, colour, spacing, components | Designers, frontend engineers |
| 14 | [MVP_ROADMAP.md](./MVP_ROADMAP.md) | In what order do we build it, and what blocks what? | Product + engineering leads |
| 15 | [TECHNICAL_STANDARDS.md](./TECHNICAL_STANDARDS.md) | How is code written, typed, named and reviewed? | All engineers |
| 16 | [SECURITY_AND_PERMISSIONS.md](./SECURITY_AND_PERMISSIONS.md) | Who may do what, and how is it enforced? | Backend engineers, reviewers |
| 17 | [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | What do we test, at which level, and how? | All engineers, QA |
| 18 | [DEPLOYMENT_AND_ENVIRONMENTS.md](./DEPLOYMENT_AND_ENVIRONMENTS.md) | Vercel/Bun config, env vars, CI, migration plan | DevOps, engineers |
| 19 | [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md) | Which decisions were made, which were superseded, and why | Engineers, future maintainers |
| 20 | [OBSERVABILITY_AND_ANALYTICS.md](./OBSERVABILITY_AND_ANALYTICS.md) | Errors, logs, SLOs, and the closed product-event taxonomy | Backend engineers, product |
| 21 | [EMAIL_AND_NOTIFICATIONS.md](./EMAIL_AND_NOTIFICATIONS.md) | Which emails exist, how they are queued, delivered and tested | Backend engineers |
| 22 | [PRIVACY_AND_DATA_PROTECTION.md](./PRIVACY_AND_DATA_PROTECTION.md) | What personal data exists, why, for how long, and how it is removed | Engineers, ops, legal review |
| 23 | [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) | What to do when each alert fires | On-call (founder), engineers |
| 24 | [EDITORIAL_GUIDE.md](./EDITORIAL_GUIDE.md) | How to write a good resource, question and explanation | Authors, reviewers |
| 25 | [INTERNATIONALIZATION.md](./INTERNATIONALIZATION.md) | What must be true so a second locale is a data change | Engineers, product |
| 26 | [TRACEABILITY_MATRIX.md](./TRACEABILITY_MATRIX.md) | Which requirement is implemented where, and what has no home | Everyone |

---

## Delivery phases

There are **eight phases, numbered 0–7**. [MVP_ROADMAP.md](./MVP_ROADMAP.md) §2 is the source of truth for scope, dependencies, deliverables, acceptance criteria and the cut list; the table below is a summary of that section, not a second specification. Adjust the roadmap first and this table in the same change.

| Phase | Name | Effort (eng-days) | Ends with | Status |
|---|---|---|---|---|
| 0 | Product discovery and documentation | 4 | Approved `/docs` set | **Complete** (v1.4) |
| 1 | Infrastructure spike, foundation and public site | 14–18 | Deployed, seeded, indexable public site on the real stack | **In progress** — scaffold, tokens, primitives, `lib/db` (migration runner + seed) and the seeded public template set (home, directory, curriculum, level, subject, chapter, topic, resource) done; 8 of 10 block types render (`question_section`, `related_material` await Phase 3); metadata builders, OG card, sitemap index + six segments, robots, the 404/error/loading screens and per-page JSON-LD (`BreadcrumbList` on every content level, `Course` on subject pages, `LearningResource` on resource pages, checked by `bun run seo:check`) are in; remaining: `Quiz`/`ItemList` JSON-LD (Phase 3), `/design`, the operational baseline (§4.6) and the spike |
| 2 | Auth and authoring studio | 16–19 | An author publishes a study resource and a lesson | Not started |
| 3 | Question bank and assessments | 9–11 | A lesson's practice section is live and a practice test is publishable | Not started |
| 4 | Attempt engine | 11–13 | A student practises, is graded, and resumes | Not started |
| 5 | Progress and dashboard | 5–7 | Students see accuracy and weak topics | Not started |
| 6 | Search: hybrid, suggest, fuzzy, index sync | 9–12 | Natural-language and misspelled queries return the right page | Not started |
| 7 | Hardening, performance, launch | 8–10 | Production release | Not started |

**Total: 76–94 engineering days** for one experienced full-stack engineer. Phases 1, 4 and 5 form the product loop and are never cut; Phase 6 cannot start before Phase 3 has published content to index (`MVP_ROADMAP.md` §11–§12).

---

## How to read this set

1. **First time?** `PRODUCT_REQUIREMENTS.md` → `INFORMATION_ARCHITECTURE.md` → `MVP_ROADMAP.md` (phases are summarised above).
2. **Before writing schema or API code?** `DATABASE_SCHEMA.md` → `API_CONTRACTS.md` → `SECURITY_AND_PERMISSIONS.md`.
3. **Before writing search or jobs?** `SEARCH_ARCHITECTURE.md` → `BACKGROUND_JOBS.md`.
4. **Before writing UI?** `DESIGN_SYSTEM.md` → `UI_UX_GUIDELINES.md` → `USER_FLOWS.md`.
5. **Disagree with a decision?** Change `ARCHITECTURE_DECISIONS.md` first, then propagate. A decision that lives only in code is considered accidental.
6. **Writing or reviewing content?** `EDITORIAL_GUIDE.md` (quality) on top of `CONTENT_MODEL.md` (validity).
7. **On call?** `OPERATIONS_RUNBOOK.md`, with `OBSERVABILITY_AND_ANALYTICS.md` §5 for what the alert means.
8. **Wondering why something is not Postgres-shaped?** `PRODUCT_ARCHITECTURE.md` §3.3 lists every replacement.

## The one-paragraph product principle

Exampify is a **learning platform**, not an exam website. A student must be able to arrive, read an explanation, and leave without being asked a question. Practice is an option on the page, never a toll gate. The content model enforces this: `learning_resources` (readable) and `assessments` (gradable) are independent entities joined by an optional link, and the label a student sees — **Study material**, **Lesson + practice**, **Practice test** — is derived from that link rather than stored ([ADR-024](./ARCHITECTURE_DECISIONS.md#adr-024--one-resourceassessment-model-for-the-three-content-shapes)).

---

## Stack at a glance

| Layer | Choice |
|---|---|
| App | Next.js App Router, React, TypeScript (strict) |
| Styling / motion | Tailwind + design tokens, Motion |
| Client state | TanStack Query, TanStack Table, React Hook Form + Zod |
| Utilities | Remeda |
| Database | Turso (libSQL), Kysely, `@libsql/kysely-libsql` |
| Auth | Better Auth on Turso via `LibsqlDialect` |
| Media | Tigris (S3-compatible, presigned) |
| Search | Qdrant Cloud (dense) + Turso FTS5 (lexical) + app-side fuzzy/RRF |
| Jobs | Upstash QStash + a transactional outbox; Redis for rate limits only |
| Deploy | Vercel, Bun runtime (`bunVersion: "1.x"`, Node fallback) |

Full rationale and rejected alternatives: [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md).

---

## Conventions used across all documents

- **Requirement IDs:** `FR-<AREA>-<nn>`. Areas: `DISC` discovery, `SEARCH`, `AUTH`, `CMS`, `QB` question bank, `PRAC` attempt engine, `PROG` progress, `OPS` platform. Non-functional: `NFR-nn`.
- **Assumption IDs:** `A-nn`, all listed in [PRODUCT_REQUIREMENTS.md §7](./PRODUCT_REQUIREMENTS.md#7-assumptions).
- **Decision IDs:** `ADR-nnn`, all listed in [ARCHITECTURE_DECISIONS.md](./ARCHITECTURE_DECISIONS.md). Superseded ones are retained and marked.
- **Open-question namespaces:** `OQ-nn` are **global**, registered in [PRODUCT_REQUIREMENTS.md §12](./PRODUCT_REQUIREMENTS.md#12-open-questions). `OQ-<AREA>n` (`OQ-SEO1`, `OQ-S3`, `OQ-PR1`, `OQ-OBS1`…) are **local to one document** and are not referenced from outside it. A local question that starts blocking another document gets promoted to a global `OQ-nn`. Every open question is also indexed by blocking phase — with duplicate clusters flagged — in [ARCHITECTURE_DECISIONS.md §8](./ARCHITECTURE_DECISIONS.md#8-open-question-index); that index is derived, so the row in the owning document stays the place to answer it.
- **Identifiers:** database columns `snake_case`; JSON payload keys `camelCase`; TypeScript types `PascalCase`; routes `kebab-case`.
- **Timestamps:** stored as `INTEGER` Unix epoch milliseconds; ISO-8601 UTC at the API boundary.
- **IDs:** UUID v7 (time-ordered), generated in the application, stored as `TEXT`.
- **Scores:** integers in hundredths (`points_x100`); never floating point.
- **Enumerations** are closed sets repeated identically everywhere:
  - `content_status` = `draft` | `in_review` | `published` | `archived`
  - `difficulty` = `easy` | `medium` | `hard` | `very_hard`
  - `question_type` = `multiple_choice` | `multiple_select` | `true_false` | `short_answer`
  - `role` = `student` | `author` | `reviewer` | `admin`
  - `attempt_status` = `in_progress` | `submitted` | `abandoned` | `expired`
  - `assessment_mode` = `practice` | `test` | `mock`
  - `derived_format` = `study_material` | `lesson_with_practice` | `practice_test` (computed, not stored)
  - `block_type` = `rich_text` | `heading` | `image` | `formula` | `table` | `callout` | `video` | `download` | `question_section` | `related_material`

## Documentation maintenance rules

- A change to an entity, endpoint, route or token **must** update every document that references it in the same change set.
- Every document ends with an **Open questions** section (or, in `ARCHITECTURE_DECISIONS.md`, **Open decisions**). Unresolved items are never silently decided in code.
- Diagrams are Mermaid and must render on GitHub and in VS Code without plugins.
- Third-party capability claims must be traceable to provider documentation. Anything unverified is labelled a spike item, not stated as fact.
- Out-of-scope items are listed explicitly. Ambiguity in scope is a defect in this set.

## Known gaps in this revision

- **ADR-016 (Turso + Vercel) and ADR-026 (embedding model) still await sign-off** (`D-01`/`D-02` in `ARCHITECTURE_DECISIONS.md` §5); ADR-017 (Better Auth) is settled, with only its Phase 1 spike gate left. Every other ADR is accepted. ADR-030 is accepted, with its transport now set by ADR-035.
- **Provider decisions now have recommended defaults** (`ARCHITECTURE_DECISIONS.md` §5.1): `@sendust/ts` over Google SMTP for email (ADR-035 for the transport, ADR-037 for the relay, superseding the HTTP adapter in ADR-031), Sentry for error tracking (ADR-032), `en` as launch locale with `id-ID` next (ADR-033), and a 16+ self-attested age gate (ADR-034). Email is Google-only, so there is no fallback relay. Each records the evidence that would reverse it. **`D-08` is decided** (ADR-037) and no longer awaits sign-off; `D-09`–`D-11` still do, and **`D-11` needs legal review: Indonesia's PDP Law requires parental consent for a child's data, so a 16+ gate may have to become 18+ or gain a consent flow before Indonesian sign-ups open.**
- **The email transport contract is read from the published package, not from vendor docs.** `@sendust/ts` 1.0.0 publishes no documentation site and no repository field, so ADR-035 cites its tarball type definitions, and its integration behaviours (addon load, alias handling, the quota reply) are Phase 1 spike gates rather than settled facts. Google's relay facts in ADR-037 come from Google's own docs, but Vercel egress to port 465 and `From`-alias survival are gates.
- **Email delivery is only partly observable.** Google SMTP provides no delivery or bounce events (`ADR-037`), so asynchronous bounces and complaints are reconciled by hand from the sending account's inbox. The suppression list is exact for synchronous rejections and operator-maintained for everything after `DATA` — a deliberate accepted cost of a Google-only stack.
- No keyword research, pricing research or competitor content audit has been done; the SEO document defines a system, not volumes.
- Brand, domain, monetisation and launch curriculum are undecided (`OQ-01`, `OQ-02`, `OQ-03`).
- Two provider behaviours must be proven in the Phase 1 spike before they are relied on: Better Auth through `LibsqlDialect` on Bun, and Qdrant Cloud Inference's prefix handling for `multilingual-e5-small`. Both are documented as gates in `MVP_ROADMAP.md` §4.1.
- No curriculum content has been authored. Real subject lists and exam-board structures are content-operations work; `EDITORIAL_GUIDE.md` is the quality bar once they are.
- GDPR-shaped posture only: no lawyer has reviewed `PRIVACY_AND_DATA_PROTECTION.md`, and the deletion model (`D-05`) is a recommendation, not a signed decision.
- Operations assume one person. `OPERATIONS_RUNBOOK.md` states best-effort response, not an SLA.
