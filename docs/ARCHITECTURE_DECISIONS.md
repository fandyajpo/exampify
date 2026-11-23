# Architecture Decisions — Exampify

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Accepted — decision record current; the only approvals left are the sign-off gates `D-01` (ADR-016) and `D-02` (ADR-026) in §5 |
| Supersedes | Version 0.1 (PostgreSQL, Drizzle, no queue, Markdown-only content) |
| Depends on | [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md), [PRODUCT_ARCHITECTURE.md](./PRODUCT_ARCHITECTURE.md) |
| Referenced by | All documents |

---

## 1. Purpose and how to read this

A permanent record of the decisions that shape the system: context, decision, rejected alternatives, consequences, revisit trigger.

**History rule:** superseded decisions are kept, marked, and linked to their replacement. They are never rewritten to look as though today's choice had always been made — the old reasoning is the evidence that the new choice was considered rather than assumed.

**Format:** Context → Decision → Alternatives rejected → Consequences → Status → Revisit trigger.

**Open questions:** decisions still owed to this document are §5; every open `OQ-*` row across the whole set is indexed by blocking phase in §8.

### Index

| ADR | Decision | Status |
|---|---|---|
| 001 | Single Next.js monolith + managed PostgreSQL + Drizzle | **Superseded by ADR-016** |
| 002 | Explicit taxonomy tables over a generic tree | Accepted |
| 003 | Questions reusable by cross-listing; content copied | Accepted |
| 004 | One JSON scoring payload (`answer_key`), no `is_correct` column | Accepted |
| 005 | Attempts snapshot `question_version` and points, not question text | Accepted |
| 006 | Database-backed auth with a library (Better Auth recommended) | **Superseded by ADR-017** |
| 007 | Postgres full-text search; no external search engine | **Superseded by ADR-018** |
| 008 | App-layer authorization; no RLS | Accepted (caveat: token scoping replaces DB roles) |
| 009 | REST route handlers as the single mutation contract; TanStack Query on the client | Accepted (reaffirmed) |
| 010 | ISR + tag invalidation for public pages | **Superseded by ADR-019** |
| 011 | Canonical URL `/{curriculum}/{level}/{subject}/...` | Accepted |
| 012 | No payments or entitlements in MVP; single content read choke point | Accepted (entitlements table added, inert) |
| 013 | Drizzle ORM with SQL migrations | **Superseded by ADR-020** |
| 014 | No background queue or worker in MVP | **Superseded by ADR-021** |
| 015 | Markdown as the single content format | **Superseded by ADR-022** |
| 016 | Vercel + Bun monolith with Turso (libSQL) | Accepted (sign-off gate: `D-01`) |
| 017 | Better Auth on Turso via Kysely + `LibsqlDialect` | Accepted |
| 018 | Hybrid search: Turso lexical + Qdrant dense, app-side fusion | Accepted |
| 019 | ISR with tag invalidation (reaffirmed for Vercel) | Accepted |
| 020 | Kysely + libSQL with reviewed SQL migrations | Accepted |
| 021 | QStash with a transactional outbox | Accepted |
| 022 | Block-based content with Markdown inside rich-text blocks | Accepted |
| 023 | Tigris for media with presigned uploads | Accepted |
| 024 | One resource/assessment model for the three content shapes | Accepted |
| 025 | Bun on Vercel with a Node fallback | Accepted |
| 026 | Embeddings via Qdrant Cloud Inference (`multilingual-e5-small`) | Accepted (sign-off gate: `D-02`) |
| 027 | Redis limited to rate limits and short locks | Accepted |
| 028 | Remeda replaces es-toolkit | Accepted |
| 029 | Server-authoritative product events; no third-party analytics | Accepted |
| 030 | Transactional email through a provider adapter, queued on QStash | Accepted (transport: ADR-035; relay: ADR-037) |
| 031 | Resend as the first `EmailProvider` implementation | **Superseded by ADR-035** |
| 032 | Sentry for error tracking and source maps | Accepted |
| 033 | Launch locale `en`, routes unprefixed | Accepted |
| 034 | Minimum age 16, self-attested, no date of birth stored | Accepted |
| 035 | `@sendust/ts` as the mail transport over an SMTP relay | Accepted (relay: ADR-037) |
| 036 | Brevo SMTP as the mail relay | **Superseded by ADR-037** |
| 037 | Google SMTP as the mail relay | Accepted (closes `D-08`) |

---

## 2. Superseded decisions (retained)

### ADR-001 — Backend and database shape

**Status:** Superseded by [ADR-016](#adr-016--vercel--bun-monolith-with-turso) (2026-11-20).

**Original decision.** One Next.js application on a Node.js runtime, managed PostgreSQL (Neon class), Drizzle ORM, object storage, no queue, no microservice.

**Why it was right then.** Strongly relational content, transactional grading, and a brief that left the backend open. Postgres gave `tsvector`, JSONB, partial indexes and RLS-free but role-based least privilege with no compromises.

**Why it changed.** The product direction fixed a different stack (Turso/libSQL, Kysely, Better Auth, Tigris, Qdrant, Upstash, Vercel/Bun). Re-litigating the database against an explicit direction would produce a document that disagrees with the team building it. The original reasoning is preserved because its *criteria* still govern the replacement: relational integrity, transactional grading, cacheable public reads, provider portability.

**What survives.** All database access behind `lib/db`; all search behind one adapter; all content reads behind one service. Those seams were the real content of this ADR and they made the substitution containable.

---

### ADR-006 — Database-backed auth with a library

**Status:** Superseded by [ADR-017](#adr-017--better-auth-on-turso-via-kysely--libsqldialect).

**Original decision.** A library-provided auth layer (Better Auth recommended, Auth.js acceptable) with application-owned `users`/`accounts`/`sessions`/`verification_tokens`, opaque hashed tokens in HttpOnly cookies.

**Why it changed.** The stack names Better Auth, and its Turso path is now confirmed. The previously "proposed, needs sign-off" status is resolved.

**What survives.** Session opacity, server-side revocation, auth isolated behind `lib/auth` with `getActor`/`requireActor`, and authorization kept separate from authentication.

---

### ADR-007 — Postgres full-text search; no external search engine

**Status:** Superseded by [ADR-018](#adr-018--hybrid-search-turso-lexical--qdrant-dense).

**Original decision.** Generated `tsvector` columns + GIN indexes, unioned in one adapter with `websearch_to_tsquery` and `ts_rank_cd`; no external search engine.

**Why it was right then.** Immediate consistency, no sync path, no second vendor — for a product whose search was keyword lookup over a curated catalogue.

**Why it changed.** The product now requires semantic retrieval across Indonesian and English ("how do plants make food?" must find photosynthesis), plus autocomplete and typo tolerance. No single engine in this stack does all three, and the previous decision's own revisit trigger — "relevance complaints that weights cannot fix" — is met by design.

**What survives.** One search adapter, no search logic in components, public search excludes questions and drafts.

---

### ADR-010 — ISR + tag invalidation for public pages

**Status:** Superseded by [ADR-019](#adr-019--isr-with-tag-invalidation), which reaffirms the approach for Vercel and adds per-route cache classes.

**Original decision.** Public content with `revalidate = 60` and tag invalidation; personalised fragments hydrate client-side.

**Why it changed.** Not a reversal: the mechanism is retained. It is restated because Vercel's cache tags and the Bun runtime change the operational details, and because search introduces a cacheable API route that the original ADR did not cover.

---

### ADR-013 — Drizzle ORM with SQL migrations

**Status:** Superseded by [ADR-020](#adr-020--kysely--libsql-with-reviewed-sql-migrations).

**Original decision.** Drizzle for schema and queries, generated SQL migrations reviewed by a human.

**Why it changed.** Drizzle's libSQL support exists, but the stack specifies Kysely, and Kysely's SQL-first model fits a schema that must be hand-tuned for SQLite (partial indexes, `changes()` semantics, table rebuilds).

**What survives.** Forward-only, additive-first migrations, human review of every generated statement, no `SELECT *` for student-facing reads.

---

### ADR-014 — No background queue or worker in MVP

**Status:** Superseded by [ADR-021](#adr-021--qstash-with-a-transactional-outbox).

**Original decision.** Cron-triggered idempotent HTTP endpoints; lazy expiry on read; no queue.

**Why it changed.** This ADR named its own trigger: "any user-visible asynchronous work (emails with retry guarantees, AI generation, exports)". Derived vector indexing is exactly that — it is asynchronous, must retry, and cannot be fire-and-forget after a commit.

**What survives.** No long-running worker; jobs are HTTP endpoints; expiry is still evaluated lazily so correctness never depends on a schedule.

---

### ADR-015 — Markdown as the single content format

**Status:** Superseded by [ADR-022](#adr-022--block-based-content-with-markdown-inside-rich-text-blocks).

**Original decision.** GFM plus a closed callout extension, stored as text, rendered through a sanitising pipeline, no block JSON.

**Why it changed.** A resource must now be able to contain an assessment section, a downloadable file, a captioned figure with known dimensions and a formula with validation. Markdown cannot express those with integrity, and the previous ADR's own revisit trigger — "authors cannot produce acceptable layouts, or embedded interactive content is required" — is met.

**What survives.** Markdown remains the authoring format *inside* prose blocks; raw HTML stays stripped; MDX stays rejected because it executes content.

---

## 3. Retained decisions

### ADR-002 — Explicit taxonomy tables over a generic tree

**Status:** Accepted (unchanged).

**Decision.** Five explicit tables (`curricula`, `education_levels`, `subjects`, `chapters`, `topics`) with typed FKs, per-parent slug uniqueness and `position`.

**Rejected.** A generic `nodes(parent_id, type)` tree (every read becomes a recursive CTE; constraints impossible; slugs ambiguous); flat `subject → topic` with a free-text board (cannot host two syllabi); a shared subject across levels.

**Consequences.** A sixth level is a migration, not a configuration change. "Course" in the UI maps to `subjects`; "subtopic" maps to `chapters`. Depth is carried by ordered resources and assessments inside a topic.

**Revisit trigger:** authors routinely produce topics with clearly separable sub-parts that need their own URLs.

---

### ADR-003 — Questions reusable by cross-listing; content copied

**Status:** Accepted (unchanged).

**Decision.** Three mechanisms: cross-listing for questions (`question_topics`, one primary), membership for curated sequences (`assessment_items`), linking for resources ↔ assessments, and copy for prose.

**Rejected.** A universal `content_topic_links` table (canonical-URL ambiguity, per-topic ordering and ownership conflicts); full versioned fragments (a CMS inside a CMS).

**Consequences.** Reviewing a question fixes it everywhere; editing a resource does not propagate; analytics count a cross-listed question in every topic it appears in, documented in `QUESTION_ENGINE.md` §11.

**Revisit trigger:** > 20 % of resources are duplicated across topics.

---

### ADR-004 — One JSON scoring payload

**Status:** Accepted (unchanged; column is now `TEXT` JSON instead of `JSONB`, semantics identical).

**Decision.** `questions.answer_key` is a single versioned discriminated union. `question_options` is presentational and carries no correctness flag. Grading reads only `answer_key`.

**Rejected.** `is_correct` on options (two sources of truth); a table per question type (seven tables, seven joins); storing correctness only in the answer after grading (no regrade, no audit).

**Consequences.** Cross-field validation is Zod's job, not the database's. Adding a type is an enum value, a union variant and one grading branch. Reading the key requires parsing — done once, in the grader and the editor.

**Revisit trigger:** a question type whose answer cannot be expressed as labelled options or normalised text.

---

### ADR-005 — Attempts snapshot versions and points, not question text

**Status:** Accepted (unchanged; "session" is now "attempt").

**Decision.** `attempt_items` stores `question_id`, `question_version`, `points_x100_max`, the answer and the grading result — not the stem, options or explanation.

**Rejected.** A full content snapshot per item (storage grows with attempts × question size, and a second rendering corpus); no snapshot at all (a points change silently rewrites history).

**Consequences.** Review renders current content with a "content updated" notice. Points stay self-consistent. True text history is unavailable (accepted; content revisions are an extension point).

**Revisit trigger:** a legal/audit requirement to reproduce exactly what a student saw.

---

### ADR-008 — App-layer authorization; no RLS

**Status:** Accepted, with an amended mechanism.

**Context.** Roles are global and ordered; ownership is per-user for attempts; content is shared among staff. One tenant.

**Decision.** Authorization lives in `lib/rbac` (capability matrix) and the service layer (ownership, scope, transition validity). The database enforces **token scoping**: `app_rw`, `app_read` and `migrator` tokens with per-table/action permissions, `audit_logs` insert-only. LibSQL has no row-level security, so row visibility is an application responsibility without exception.

**Rejected.** Postgres RLS (unavailable on libSQL, and unnecessary for one tenant); route-only checks (bypassable by any service call).

**Consequences.** Every service takes an `actor` and asserts. Review must catch service functions that skip it — this is now the *only* enforcement for row ownership, so the review checklist item is mandatory rather than defence-in-depth. The token list must be updated when a table is added.

**Revisit trigger:** more than one tenant, or a compliance requirement for database-enforced isolation.

---

### ADR-009 — REST route handlers as the single mutation contract

**Status:** Accepted (reaffirmed; extended to search and media).

**Decision.** All mutations go through `/api/v1/**`, invoked from the client with TanStack Query. Server components call services directly for reads (no HTTP hop). Validation, error mapping and audit writes live in one place per use case.

**Rejected.** Server actions (a second mutation surface with different error semantics, no HTTP contract); GraphQL (no over-fetching problem).

**Consequences.** More boilerplate per mutation (route + hook) for one contract, one error taxonomy and testability. Uploads add a two-step presign flow, still under this contract.

**Revisit trigger:** a mutation that needs progressive enhancement without JS (then a documented server-action exception).

---

### ADR-011 — Canonical URL structure

**Status:** Accepted, extended.

**Decision.** `/{curriculum}/{level}/{subject}/chapters/{chapter}/{topic}` with children `/learn/{resourceSlug}` and `/practice/{assessmentSlug}`; course-wide assessments at `/{curriculum}/{level}/{subject}/assessments/{assessmentSlug}`. The explicit `chapters` segment disambiguates a chapter slug from a topic slug permanently. No IDs in public URLs, no locale prefix, no trailing slashes.

**Consequences.** URLs are deep but meaningful. Moving a topic requires redirects for descendants. A locale later requires a prefix and mass redirects (`OQ-IA5`).

**Revisit trigger:** a second language.

---

### ADR-012 — No payments or entitlements in MVP

**Status:** Accepted, with an inert `entitlements` table.

**Decision.** All published content is public and free. No billing, no entitlement checks in the request path. An `entitlements` table exists for future metadata but **no code reads it** — documented as inert so it is not mistaken for a working paywall. All public reads funnel through one service function per page type.

**Consequences.** Risk: a paywall within months would force an SEO revisit. Mitigation is architectural (one choke point) and now also structural (the table exists).

**Revisit trigger:** a decided business model.

---

## 4. New decisions

### ADR-016 — Vercel + Bun monolith with Turso

**Status:** Accepted. `D-01` — sign-off on the Turso + Vercel platform and the spend it commits — is still outstanding (§5); the rest of the docs are already written against it.

**Context.** The direction fixes Next.js, Turso, Kysely, Better Auth, Tigris, Qdrant, Upstash and Vercel. Two questions remain architectural rather than mechanical: is a single libSQL database sufficient for a relational content product, and does the app stay one deployable?

**Decision.** One Next.js application on Vercel, Bun runtime (`bunVersion: "1.x"`), backed by a single Turso (libSQL) database accessed through Kysely, plus Tigris for media, Qdrant for dense retrieval, Upstash for jobs and rate limits. No BFF, no microservice, no second database.

**Alternatives rejected**

| Alternative | Why not |
|---|---|
| Managed PostgreSQL (Neon class) | The previously recommended option; technically stronger SQL but contradicts the fixed direction and adds no capability this product needs |
| Cloudflare Workers + D1 | Would force the Edge runtime, breaking Better Auth's scrypt and the AWS SDK; Next.js support lags |
| Supabase (Postgres + auth + storage) | Couples identity to a vendor and replaces Better Auth |
| Turso + a separate search engine (Meilisearch/Typesense) | A third derived service; Qdrant + FTS5 covers the required capabilities |
| Database-per-service | No service boundaries exist to justify it |

**Consequences**

- Positive: one deploy, one database URL, 5 GB and 500 M row reads free, branching for preview databases, per-table tokens, FTS5 included, no connection-pool problem.
- Negative: SQLite feature ceiling (documented replacements in `PRODUCT_ARCHITECTURE.md` §3.3); single-writer contention; the vendor is mid-rewrite from libSQL to Turso Database; Bun is beta on Vercel.
- Mitigation: all DB access through `lib/db`; no SQLite-specific SQL outside migrations; the driver swap is contained.
- Enforcement: `lib/db` is the only module that imports `kysely` or `@libsql/*`.

**Revisit trigger:** sustained write contention, a required Postgres feature with no workaround, or Turso Database becoming the supported target.

---

### ADR-017 — Better Auth on Turso via Kysely + `LibsqlDialect`

**Status:** Accepted — sign-off resolved when ADR-006 was superseded (§2). Kysely + `LibsqlDialect` on Bun remains a Phase 1 spike gate, not an unsettled decision.

**Context.** Better Auth must persist users, sessions, accounts and verification tokens in Turso, in a Bun runtime on Vercel, with email/password and optional Google OAuth, and without inventing an adapter.

**Decision.** Better Auth with its built-in **Kysely adapter**, configured with a `LibsqlDialect` over a `@libsql/client/web` client:

```ts
database: { dialect: new LibsqlDialect({ client }), type: 'sqlite' }
```

Auth tables are library-owned and singular (`user`, `session`, `account`, `verification`); application fields (`role`, `status`, `deleted_at`) are added through Better Auth's schema extension so its CLI keeps working.

**Why this is a supported path, not a guess.** Better Auth's documentation states that any Kysely dialect is supported and shows `LibsqlDialect` explicitly; `@libsql/kysely-libsql` is the dialect package for `@libsql/client`. Both facts are verified before implementation, not assumed from "SQLite-compatible".

**Alternatives rejected**

- Hand-rolled auth: password reset, verification and session rotation are where homegrown auth fails.
- JWT-only stateless sessions: cannot revoke on role change without a blocklist.
- Hosted auth (Clerk/Auth0): per-MAU cost and a vendor dependency for the core identity of a product that may later sell to institutions.
- Prisma/Drizzle adapters: the stack is Kysely, and a second query layer for auth only would be a needless seam.

**Consequences**

- Positive: sessions are revocable rows in the same database, no second service, no extra vendor.
- Negative: auth schema upgrades must be reviewed (auth `migrate`/`generate` is Kysely-only, so the CLI works — but a library major version can add columns); scrypt cost must be measured under Bun; mixing singular auth table names with plural domain tables needs a documented exception (done in `DATABASE_SCHEMA.md` §5).
- Risk: if `LibsqlDialect` misbehaves under Bun's HTTP client, the fallback is the same dialect over Node (`runtime = 'nodejs'` on auth routes), **not** a different database.

**Revisit trigger:** an auth library major version that drops Kysely, or a requirement for institutional SSO.

---

### ADR-018 — Hybrid search: Turso lexical + Qdrant dense

**Status:** Accepted.

**Context.** Search must do three different jobs: instant prefix autocomplete, typo tolerance, and semantic retrieval across Indonesian and English, with metadata filters, and without exposing drafts.

**Decision.** Allocate capabilities explicitly instead of expecting one engine to do everything:

- **Autocomplete:** Turso `search_terms` prefix index (plus FTS5 prefix tokens). No embeddings per keystroke.
- **Typo tolerance:** normalisation + bounded Levenshtein in the application (SQLean Fuzzy only as a verified optimisation); corrections offered, not silently applied.
- **Semantic retrieval:** Qdrant dense vectors, 384 dims, payload filters, `status='published'` enforced in one query builder.
- **Lexical ranking:** Turso FTS5 + `bm25()`.
- **Fusion:** RRF (k = 60) in the application, with small documented boosts; exact title match pinned first.

**Alternatives rejected**

- Qdrant alone: it has no autocomplete API and no spelling correction; a misspelling returns semantically adjacent noise.
- FTS5 alone: cannot answer "how do plants make food?".
- Algolia/Meilisearch + Qdrant: two search vendors, two sync paths, two bills.
- Qdrant native hybrid as the *only* path: BM25-in-Qdrant is viable but removes the independent fallback that keeps search usable when Qdrant is down.
- LLM query rewriting in MVP: latency, cost and unpredictability before relevance is even measured.

**Consequences**

- Positive: each capability is testable in isolation; search degrades to lexical when Qdrant fails; no draft can leak through a filter miss because lexical rows are deleted, not flagged.
- Negative: two indexes to keep consistent (solved by the outbox, ADR-021); fusion must be tuned against an evaluation set; Indonesian affixes are not stemmed in MVP.
- Cost: an embedding call per search query (free model, metered cluster time) and one extra network hop.

**Revisit trigger:** evaluation shows Recall@5 < 0.70 on semantic queries, or FTS5 becomes the bottleneck above ~100k documents.

---

### ADR-019 — ISR with tag invalidation

**Status:** Accepted (reaffirms ADR-010; adds cache classes and routes).

**Decision.** Public content pages are statically rendered with `revalidate = 60` and invalidated by entity tags (`topic:<id>`, `subject:<id>`, `curriculum:<id>`, `sitemap`). Search and suggest are cacheable API routes with their own TTLs. Authenticated routes are dynamic and `private, no-store`. Personalised fragments hydrate client-side.

**Rejected.** Fully dynamic SSR (slower TTFB, higher row-read cost); full rebuilds on publish (slow, couples publishing to a build); client-side rendering (destroys the primary acquisition channel); caching authenticated pages "briefly" (a leak waiting to happen).

**Consequences.** Up to 60 s of staleness is product-visible (`OQ-A5`). Publish must call `revalidateTag` and report `cacheInvalidated` so a failure is visible. A personalised value must never reach a cached shell — enforced by a test that renders the same URL under two sessions and compares bytes.

**Revisit trigger:** a requirement for zero-stale publishing, or a CDN without tag support.

---

### ADR-020 — Kysely + libSQL with reviewed SQL migrations

**Status:** Accepted.

**Context.** Need typed queries, transparent SQL, migration control, and no runtime magic hiding N+1s or `SELECT *` on a table containing `answer_key`.

**Decision.** Kysely with a hand-written `DB` interface, the `LibsqlDialect` from `@libsql/kysely-libsql`, and Kysely's `Migrator` with numbered TypeScript migrations; each migration also emits a committed `.sql` snapshot for review. Forward-only in production, additive-first, with explicit 12-step table rebuilds where SQLite cannot alter in place.

**Alternatives rejected**

- Drizzle: good DX, but the fixed stack is Kysely, and SQLite needs hand-tuned DDL that a schema-diff generator handles poorly (partial indexes, `CHECK` rebuilds).
- Raw `@libsql/client` only: maximum control, no type inference for hundreds of simple reads.
- Prisma: a separate schema language, a query engine binary, and an abstraction that hides the SQL that matters here.
- An external migration tool (Atlas, Flyway): another dependency for a small schema.

**Consequences.** The team must be fluent in SQL and in SQLite's rebuild procedure. `EXPLAIN QUERY PLAN` review becomes a routine part of index changes. Derived types come from the `DB` interface; API DTOs stay explicit so a column rename cannot silently change the contract.

**Revisit trigger:** a provider without libSQL, or Kysely's migrator proving unsuitable for branching workflows.

---

### ADR-021 — QStash with a transactional outbox

**Status:** Accepted.

**Context.** Publishing must update two derived indexes (FTS5, Qdrant) that live outside the content transaction. A fire-and-forget call after commit cannot guarantee convergence; an inline call would put a vendor's latency in the author's publish request.

**Decision.** Upstash **QStash** as the delivery mechanism, with a **transactional outbox** (`search_events`) written in the same transaction as the content change. The worker endpoint verifies QStash's signature, claims the event atomically, re-reads the authoritative row, performs the side effect and marks it done. A sweeper re-enqueues due events; a nightly reconciler repairs drift. Upstash Workflow is not adopted.

**Alternatives rejected**

- Fire-and-forget `fetch` after commit: loses events silently.
- Inline indexing in the publish request: slow, and a Qdrant outage blocks publishing.
- Redis as the queue (BullMQ): needs a long-running consumer, which Vercel does not provide.
- Upstash Workflow: designed for multi-step durable runs; nothing here has more than one step.
- Vercel Cron only: no per-event delivery or retries.

**Consequences.** At-least-once delivery, so every handler is idempotent (deterministic point ids, delete-then-insert FTS rows, claim-before-work). QStash's free 1,000 messages/day constrains bulk reindexing — batching is documented. A `failed` event is user-visible in the studio rather than silently dropped.

**Revisit trigger:** a job that genuinely needs multi-step durability or human approval (bulk import), or QStash volume exceeding the fixed plans.

---

### ADR-022 — Block-based content with Markdown inside rich-text blocks

**Status:** Accepted.

**Context.** A learning resource must contain prose, headings, images with dimensions, formulas, tables, a captioned download, an embedded video, a question section referencing an assessment, and related-material links. Some of these need validation the database cannot provide; some need layout Markdown cannot express.

**Decision.** `content_blocks` rows with `kind` + `position` + a `v`-versioned JSON payload, validated by one Zod discriminated union; `rich_text` and `callout` payloads contain **GitHub-Flavored Markdown** rendered server-side and sanitised.

**Alternatives rejected**

- Markdown-only (previous ADR-015): cannot validate an assessment reference or a figure's dimensions; cannot represent a download or video with integrity.
- A table per block type: ten tables, ten joins, ten validators for content always read as a whole.
- A generic Notion-style page builder: a large editor investment, an uncontrolled schema, and painful diffs.
- Rich-text HTML storage: unsafe and unreadable in review.
- MDX: executes author-supplied code.

**Consequences.** Payload shape is enforced by Zod on read and write, not by the database — accepted, and the reason every read parses. Ten block types is a closed set; adding one is a union variant plus a renderer. Authors still write prose, so the editor can stay simple (a Markdown area plus block insertion), and the "no page builder" constraint holds.

**Revisit trigger:** block types exceed ~15, or authors need inline interactive widgets.

---

### ADR-023 — Tigris for media with presigned uploads

**Status:** Accepted.

**Context.** Media must not pass through serverless request bodies (4.5 MB limit), must not live in Turso, and must support both public content images and private files.

**Decision.** Tigris via its S3-compatible API. The browser requests a presigned PUT (5 min, exact `Content-Type`/`Content-Length`), uploads directly, then confirms; the server verifies with `HEAD` and marks the row `ready`. Public assets are served from the bucket's public domain (or a custom domain) and configured in `next/image` `remotePatterns`; private assets use presigned GET (≤ 10 min). All access goes through `lib/storage`, which knows nothing about content tables.

**Alternatives rejected**

- Uploading through a route handler: 4.5 MB platform cap and memory pressure for no benefit.
- Storing bytes in Turso: bloats the database, breaks backup and row-read economics.
- Vercel Blob: ties storage to the hosting vendor; the stack specifies Tigris.
- Public-read everything: leaks draft and private media.

**Consequences.** A `pending` state is required because a presigned URL can be issued and never used. Deleting is soft and reference-checked; blob purge is a job. Tigris has no egress fees and a global endpoint, which suits a text-first product with occasional diagrams. Presigned URLs are valid up to 90 days but the application never issues more than 10 minutes.

**Revisit trigger:** a need for on-the-fly transforms or video transcoding, which Tigris does not provide.

---

### ADR-024 — One resource/assessment model for the three content shapes

**Status:** Accepted.

**Context.** The product must support explanation-only material, lesson-with-practice, and standalone assessments, without rigid per-variation tables and without forcing every resource to contain a test.

**Decision.** Two content entities — `learning_resources` (readable, block-composed) and `assessments` (gradable, ordered questions) — joined many-to-many by `resource_assessments`. The student-facing shape is **derived**, never stored: no assessment → "study material"; assessment linked → "lesson + practice"; assessment with no resource → "practice test". A topic publishes with either entity present.

**Alternatives rejected**

- `content_type` enum on one table with nullable columns per variant: sparse columns, contradictory states, and a gate for every combination.
- Separate tables per shape (`articles`, `lessons`, `tests`): duplicated fields, three editors, three search paths, and a resource that becomes a lesson must be migrated.
- Mandatory assessment on every resource (the previous publish gate): encodes the exam-platform assumption the product explicitly rejects.
- One polymorphic `content_items` table: hides the real difference between reading and grading behind a type column.

**Consequences.** The label can never contradict the data, and unlinking an assessment needs no migration. The cost is a join and a derivation function that must be tested for all three shapes plus the unlink case. Attempts unify against `assessments`, so practice inside a lesson and a standalone mock exam share one engine and one history.

**Revisit trigger:** a fourth shape that is neither readable nor gradable (e.g. an interactive simulation), which would arrive as a new block type, not a new entity.

---

### ADR-025 — Bun on Vercel with a Node fallback

**Status:** Accepted.

**Context.** Bun is the requested runtime; Vercel supports it in **beta** via `bunVersion`, and Next.js ISR requires `bun run --bun next build`.

**Decision.** Deploy with `bunVersion: "1.x"`, `--bun` on build and dev, and **no `engines.node`** in `package.json`. No application code may depend on a Bun-only API. If a critical dependency fails under Bun, that route may pin `runtime = 'nodejs'`; if more than two fail, `bunVersion` is removed.

**Alternatives rejected**

- Node runtime everywhere: contradicts the direction without a demonstrated need.
- Bun 1.4 (`1.4.x`) at launch: a Rust rewrite with breaking changes; adopt deliberately later.
- Bun outside Vercel (self-hosted): adds infrastructure the MVP does not need.

**Consequences.** The runtime is a configuration concern, not an architectural one — the fallback is one line. Beta risk is contained by the Phase 1 spike and by the compatibility matrix in `DEPLOYMENT_AND_ENVIRONMENTS.md` §2.2. `@libsql/client/web` is mandatory in the function bundle to avoid native bindings.

**Revisit trigger:** Vercel GA for Bun (then re-evaluate), or two or more blocking incompatibilities.

---

### ADR-026 — Embeddings via Qdrant Cloud Inference

**Status:** Accepted. `D-02` — sign-off on the embedding model and the paid inference budget — is still outstanding (§5); model choice and prefix handling remain Phase 1 spike gates.

**Context.** Semantic search needs an embedding model that handles Indonesian and English, with dimensions fixed at collection creation, and the stack does not name an embedding provider.

**Decision.** Use **Qdrant Cloud Inference** with `intfloat/multilingual-e5-small` (384 dims, cosine, free tier). Passages embedded with the `passage:` prefix, queries with `query:` — or verify that Cloud Inference applies the prefix itself in the Phase 1 spike. Store the model id, prefix scheme and dimensions in `search_config` and assert them at startup.

**Alternatives rejected**

- A separate embedding API (OpenAI/Cohere/Jina): one more key, one more bill, one more outage domain for a capability Qdrant already exposes; can be added later through the same interface.
- A larger model (`mxbai-embed-large`, 1024): better recall, paid, and 2.7× the index size — evaluate only if the golden set fails.
- Client-side FastEmbed: would put model weights and CPU in a serverless function.
- Keyword-only search: cannot answer natural-language questions, which is a stated requirement.

**Consequences.** One vendor for vectors and vectorisation, no separate embedding pipeline. Model choice is effectively a schema decision: changing it means a new collection and a full reindex. Free tier is fine for development; metered inference must be budgeted before launch traffic.

**Revisit trigger:** Recall@5 < 0.70 on the semantic evaluation set, or Indonesian quality complaints.

---

### ADR-027 — Redis limited to rate limits and short locks

**Status:** Accepted.

**Context.** Upstash Redis is in the stack, and a Redis in the stack invites caching everything in it.

**Decision.** Redis is used only for (a) rate-limit counters, (b) short-lived job dedupe/concurrency locks, and (c) optionally a 60 s suggest cache. Durable job state lives in Turso (`search_events`, `job_runs`); content caching lives in ISR/CDN; sessions live in Turso.

**Alternatives rejected**

- Redis as a content cache: a second stale copy of the truth, invalidated by a different mechanism.
- Redis as the job store: durability and consistency questions that the outbox already answers.
- Redis for sessions: splits identity across two stores for no benefit.
- No Redis at all: rate limiting would write a counter row per request to the primary database.

**Consequences.** If Redis is unavailable, rate limits fail open (availability over strictness) and the DB claim still prevents duplicate work. Redis is never on the critical path of a read.

**Revisit trigger:** a genuine sub-10 ms hot-path cache requirement.

---

### ADR-028 — Remeda replaces es-toolkit

**Status:** Accepted

**Context.** Utility helpers are needed for grouping, sorting and null handling; the previous stack specified es-toolkit.

**Decision.** **Remeda** (`remeda`) is the single utility library. `es-toolkit` is removed from the dependency list and from every document.

**Alternatives rejected.** Keeping both (duplicate capability, review ambiguity); hand-rolling (inconsistent semantics).

**Consequences.** Remeda's data-first/data-last duality needs one convention in `TECHNICAL_STANDARDS.md` (data-last in `pipe`, data-first for single calls). No behavioural risk: these are pure helpers.

---

### ADR-029 — Server-authoritative product events, no third-party analytics

**Status:** Accepted

**Context.** We need to know whether students actually read, practise and return. Every analytics vendor is a subprocessor, a consent question, a script that ad blockers remove, and a second definition of "active user".

**Decision.** A closed event taxonomy lives in `lib/analytics/events.ts`. Facts about learning (resource read, attempt started/submitted, publish, upload) are written **server-side, inline, in the same transaction as the action**. Only two UI-level events (suggest selection, result click) come from the browser, through `POST /api/v1/events`. Everything lands in `usage_events` in Turso, is pruned at 90 days, and is queried only by staff analytics endpoints. No pixels, no session replay, no cross-site identifiers.

**Alternatives rejected**

- GA4 / Plausible / PostHog: external subprocessor, consent surface, script blocked for a meaningful share of students, and no join to `learning_resources`/`assessment_attempts`.
- Vercel Analytics: page views only; cannot answer "which topic has readers but no attempts".
- A separate event pipeline (Kafka/Kinesis): operational weight with no MVP requirement.
- Client-side tracking for everything: loses events to blockers and to tab closes, and lets the browser assert facts it does not own.

**Consequences.** Analytics accuracy is bounded by our own uptime, which is the honest bound. Queries are SQL over one indexed table. Marketing attribution and ad conversion are explicitly out of reach; adding them is a new ADR. Retention and deletion are covered by `PRIVACY_AND_DATA_PROTECTION.md`.

**Revisit trigger:** a funnel outside our own entities, paid acquisition, or `usage_events` exceeding ~50 M rows.

---

### ADR-030 — Transactional email through a provider adapter, queued on QStash

**Status:** Accepted, amended. The provider was named in [ADR-031](#adr-031--resend-as-the-first-emailprovider-implementation), the transport replaced in [ADR-035](#adr-035--sendust-as-the-mail-transport-over-an-smtp-relay) and the relay in [ADR-037](#adr-037--google-smtp-as-the-mail-relay); the adapter shape below is otherwise unchanged except that the bounce webhook it assumed does not exist.

**Context.** Better Auth requires `sendVerificationEmail` / `sendResetPassword` callbacks. Sending inline couples sign-up latency and success to a third-party API, and QStash retries would happily send twice unless the send is keyed.

**Decision.** One `EmailProvider` interface with a single implementation per provider, selected by `EMAIL_PROVIDER`; a `stub` adapter is the default in tests and local development. Sends are queued: `job_runs` row keyed `email:<template>:<tokenId>` then a QStash message; the worker claims the key, sends with a provider idempotency key, and marks it done. If enqueueing fails, the callback performs one bounded direct send. A hashed suppression list blocks bouncing addresses. Auth mail only — no marketing, no digests, no tracking pixels.

**Alternatives rejected**

- In-house SMTP: IP reputation, TLS, bounce handling and deliverability become our problem.
- Sending inline from the Better Auth callback: no retry, sign-up p95 tied to a third party, and a duplicate submit sends two emails.
- Calling a provider SDK from domain code: swaps become a refactor instead of one file.
- Marketing platform for transactional mail: mixes consent models and adds unsubscribe obligations to password resets.

**Consequences.** Two failure domains (queue, provider), both with runbook entries. Bounce/complaint handling assumed a webhook endpoint; [ADR-037](#adr-037--google-smtp-as-the-mail-relay) removed that assumption — synchronous rejections are handled automatically, later bounces are reconciled by hand. Provider choice stays reversible until the first production send.

**Revisit trigger:** deliverability below 99 %, or a need for non-auth notifications (which would need consent design first).

---

### ADR-031 — Resend as the first `EmailProvider` implementation

**Status:** Superseded by [ADR-035](#adr-035--sendust-as-the-mail-transport-over-an-smtp-relay) (2026-11-21). The relay it names is still the relay; the HTTP send path is what changed.

**Why it was superseded.** The team standardised on `@sendust/ts` as the mail transport, so the application owns the SMTP conversation instead of calling a provider's HTTP API. The relay, the sending subdomain and the webhook story survive unchanged; the `Idempotency-Key` HTTP header becomes the `Resend-Idempotency-Key` email header, and the typed `429 daily_quota_exceeded` becomes an SMTP reply classification. The reasoning below is retained because it is the record of what the HTTP option actually offered, and it is the fallback if the addon fails its spike.

**Context.** ADR-030 fixed the adapter, the queue and the suppression list, and deliberately left the provider open so the choice could be made with facts rather than memory. Five templates, low volume, one operator: verification, reset, email change, password-changed, account-deleted. Required properties are an HTTP send callable from a Bun function, idempotency, signed bounce/complaint webhooks, and DKIM/DMARC setup on a sending subdomain (`EMAIL_AND_NOTIFICATIONS.md` §2.2).

**Decision.** **Resend** implements `EmailProvider` first. `EMAIL_PROVIDER=resend` in deployed environments, `stub` in tests and local development. Sending subdomain `mail.<domain>`; the webhook subscribes to `email.bounced`, `email.complained` and `email.suppressed`, plus `email.delivered` for the delivery SLO. The endpoint verifies the Svix signature with `EMAIL_WEBHOOK_SECRET`. The provider idempotency key is the `job_runs` key, sent as `Idempotency-Key`.

**Facts relied on** (read 2026-11-21; re-check before launch, prices and limits change):

| Fact | Value | Source |
|---|---|---|
| Free transactional quota | 3,000 emails/month, 100/day, 3 verified domains | [resend.com/pricing](https://resend.com/pricing), [quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits) |
| Daily cap behaviour | `429` with `daily_quota_exceeded`; Resend does **not** queue or retry the message | [usage limits](https://resend.com/docs/api-reference/rate-limit) |
| Idempotency | `Idempotency-Key` header, ≤ 256 chars, dedupe window 24 h, same response returned | [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys) |
| Webhook events | `email.bounced` (permanent rejection), `email.complained` (spam), `email.suppressed`, `email.delivered`, `email.failed`, `email.delivery_delayed` | [event types](https://resend.com/docs/webhooks/event-types) |
| Webhook signing | Svix signature headers; retries reuse `svix-id`, so dedupe on it | [webhooks](https://resend.com/docs/webhooks/create-webhook) |

**Alternatives rejected**

- **Postmark** — strong transactional reputation and a clean template model, but paid-first at a volume we have not reached yet; it is the named fallback, not the default.
- **Amazon SES** — cheapest at scale, but IAM, sandbox exit, dedicated-IP reputation management and abuse handling are real work for five templates.
- **Knock** (orchestration) — a notification layer that still requires a delivery provider underneath: a second subprocessor and a second failure domain for five templates.
- **In-house SMTP** — already rejected in ADR-030.

**Consequences.** The 100/day free cap is the real ceiling: roughly 30–50 sign-ups a day with resends. Hitting it is not a soft failure — Resend rejects with `429` and does not queue, so our worker must record `quota_exhausted`, stop retrying until the UTC reset, and alert (runbook `R10`). Resend's 24 h idempotency window is shorter than `job_runs` retention, so the database key remains authoritative; the header is defence in depth, not the guarantee. The provider is one file plus one webhook handler, so a swap never touches `sendEmail()` callers.

**Evidence that would reverse this decision**

1. **Deliverability:** over 1,000 production sends, hard-bounce + complaint > 1 %, or repeated SPF/DKIM/DMARC alignment failures at Gmail/Outlook. → Evaluate Postmark.
2. **Quota:** `daily_quota_exceeded` more than twice in one month, or any day where queued auth mail is delayed past 10 minutes by the cap. → Upgrade to Pro ($20/mo, 50,000/month) before considering a swap.
3. **Trust surface:** no DPA, or the available sending region is unacceptable under `PRIVACY_AND_DATA_PROTECTION.md` §8. → Swap provider; the adapter makes it a file.
4. **Reliability:** a provider outage longer than 30 minutes during Phase 2 acceptance, or a webhook signature scheme we cannot verify in workerd.

---

### ADR-032 — Sentry for error tracking and source maps

**Status:** Accepted (recommended default for `D-09`)

**Context.** `OBSERVABILITY_AND_ANALYTICS.md` §3 requires fingerprints, release tagging, route patterns, `requestId` correlation, a redaction hook and readable stack traces on a Bun/Vercel deployment. `D-09` chose no vendor, which left Phase 1's instrumentation blocked (`MVP_ROADMAP.md` §4.6).

**Decision.** **Sentry**, via `@sentry/nextjs`. `ERROR_TRACKING_DSN` is a server variable; an empty value disables the SDK in local development and tests, and production fails at boot if it is missing. `SENTRY_AUTH_TOKEN` (build/CI only) plus `SENTRY_ORG`/`SENTRY_PROJECT` drive source-map upload through `withSentryConfig` in `next.config.ts`. Server capture uses `instrumentation.ts` `onRequestError`; client capture uses `error.tsx` and `global-error.tsx`; the `beforeSend` hook enforces the §3.3 denylist. Session replay is **disabled** — it is a privacy liability we do not need.

**Facts relied on** (read 2026-11-21): Developer plan is free for one user with 5,000 errors/month, 5 GB logs, 5 M spans and 50 replays ([sentry.io/pricing](https://sentry.io/pricing)); source maps upload during `next build` and the SDK removes them from build output ([source maps](https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/), [build options](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/build/)); a Vercel integration can upload maps and create releases without a token in the build ([Vercel integration](https://docs.sentry.io/integrations/deployment/vercel/)).

**Alternatives rejected**

- **Vercel logs only** — searching text is not triage: no fingerprinting, no client-side stacks, no release regression view.
- **GlitchTip (self-hosted, Sentry-SDK compatible)** — cheapest at volume and the same SDK, but another host to run and patch, which a one-person operation should not add before volume exists.
- **PostHog / Highlight** — product-analytics overlap that ADR-029 deliberately rejected, and a heavier client bundle.
- **Logtail/Better Stack** — strong logs, weaker error grouping and release tracking; logs are already solved by `lib/log.ts`.

**Consequences.** 5,000 errors/month is ample **because** expected control-flow errors are not reported (§3.4); if the feed is noisy enough to approach the cap, the fix is the denylist, not an upgrade. The free plan is one user: a second maintainer needs Team ($26/mo). Uploading maps removes them from build output, which is also the correct answer for source leakage.

**Evidence that would reverse this decision**

1. The monthly error quota is exhausted before the 25th in two consecutive months after the denylist is tuned. → Team plan, then evaluate GlitchTip.
2. `beforeSend` cannot satisfy §3.3 without dropping the fields that make an error actionable. → Re-evaluate; the redaction requirement outranks the vendor.
3. A second maintainer needs access and the paid step is unacceptable, or a DPA/region requirement fails. → GlitchTip self-hosted.
4. Sentry's Next.js SDK does not report `onRequestError` correctly on the Bun runtime — a Phase 1 spike failure, not a preference.

---

### ADR-033 — Launch locale is `en`, with routes unprefixed

**Status:** Accepted (recommended default for `D-10`)

**Context.** `D-10` bundled two questions: which language, and when to build i18n. The launch curriculum (`OQ-01`) and the market (`D-07`) are still undecided, so the honest choice is the one that is cheapest to change and does not pre-empt them. Editorial capacity, not code, is the binding constraint.

**Decision.** The MVP ships **`en`** — interface and content — with `<html lang="en">`, no locale negotiation, no route prefix, no `language` column on `learning_resources`/`assessments`, and all copy in `lib/copy` so a second locale is a data change. The first expansion target is **`id-ID`**, via a path prefix, following the migration in `INTERNATIONALIZATION.md` §5–§6. **Decision gate:** this must be re-affirmed before Phase 6 indexes content. After indexing, changing locale means re-embedding every point (the payload gains `language`) and redirecting every URL.

**Alternatives rejected**

- **`id-ID` at launch** — plausibly the better market fit, but there is no Indonesian editorial or review pipeline today; shipping a machine-translated corpus is worse than shipping one honest language (`INTERNATIONALIZATION.md` §1). Flips if content ops confirms a complete Indonesian subject before indexing.
- **Both at launch** — doubles the editorial burden and the thin-page risk, and needs a translation review path that does not exist.
- **`en-GB`** — implies a regional precision the content does not have.
- **Browser-language negotiation** — an English shell around English content gains nothing and adds a cache-variant dimension.

**Consequences.** Organic reach in Indonesian is limited to what English pages can rank for; the multilingual embedding model keeps semantic search bilingual anyway (`ADR-026`), which is exactly why the search investment survives the decision. The cost of being wrong is a redirect map plus a re-embed, bounded and documented.

**Evidence that would reverse this decision**

1. `OQ-01` lands on an Indonesian exam board (SNBT/UTBK or national curriculum) as the launch curriculum — English content would not serve it.
2. Beta or search data shows Indonesian sessions materially worse on engagement or task completion than English ones (state the threshold before measuring; e.g. > 20 % relative gap over 500 sessions).
3. Content operations confirms at least one subject fully authored and teacher-reviewed in Indonesian before Phase 6.

---

### ADR-034 — Minimum age 16, self-attested, no date of birth stored

**Status:** Accepted (recommended default for `D-11`; legal review still required before launch)

**Context.** `D-11` was framed as "no age gate, because no feature is designed for children" — true, but the audience includes 15–17-year-olds, so the claim needs an actual gate behind it. The gate must be cheap, must not collect more personal data than necessary, and must survive the launch-market decision (`D-07`).

**Decision.** Minimum age **16**, self-attested by an unticked checkbox at sign-up ("I am 16 or older and accept the Terms and Privacy Notice"). No date of birth is requested, verified or stored. The `user` row records `age_attested_at` and `age_gate_version` so the attestation can be demonstrated (the PDP Law and GDPR both put the burden of proving consent on the controller). No parental-consent flow in the MVP. A reported under-16 account is suspended and deleted through the normal deletion path.

**Why 16 and not 13 or 18.** 16 is GDPR Article 8's default ceiling, so a single gate is defensible without member-state tuning; it covers university students and the upper years of secondary school, which is who the seeded curriculum targets. 13 would extend children's-data obligations to a large share of the audience for no product gain. 18 would exclude the core secondary audience. Attestation rather than verification is proportionate: age verification would mean ID checks, which this product will not build.

**Launch-market caveat — read this before enabling sign-ups in Indonesia.** Indonesia's PDP Law (UU 27/2022) treats a child's personal data as specific personal data (Art. 4(2)(e)) and requires **parental or guardian consent** to process it (Art. 25(2)); the article itself does not state an age, and its implementing regulation was still pending when this was checked (2026-11-21, [UU 27/2022](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022), [ABNR overview](https://www.abnrlaw.com/files/document/Data_Protection_in_Indonesia_Overview1.pdf)). If counsel confirms the applicable age is 18, a 16+ attestation does **not** cover 16–17-year-olds and the Indonesian deployment must either gate at 18 or ship a parental-consent flow before sign-ups open. This is a launch blocker, not a later improvement.

**Alternatives rejected**

- **No gate** — indefensible once the audience is stated as secondary-school students; the notice would contradict the product.
- **Date of birth with computed age** — more precise, but it collects an identifier we do not otherwise need and still does not verify anything.
- **ID or payment verification** — disproportionate, expensive, and a privacy hazard.
- **13+ (COPPA-shaped)** — imports children's-data obligations for a marginal audience gain.

**Consequences.** The gate is an attestation, so determined minors can pass it; the mitigation is the notice, the deletion path, and not designing features that target children. `age_gate_version` makes a future change to the wording auditable. The sign-up flow gains one checkbox and one Zod field, no new endpoint.

**Evidence that would reverse this decision**

1. Counsel confirms a consent age above 16 for the launch market (very likely for Indonesia) → raise the gate to that age, or build the parental-consent flow before sign-ups open.
2. A school or institutional partnership requires supervised minors → supervised accounts, not a lower gate.
3. More than a trivial share of support requests are from under-16s trying to sign up → revisit the notice and the gate wording, not silently lower it.

---

### ADR-035 — Sendust as the mail transport over an SMTP relay

**Status:** Accepted, amended by [ADR-036](#adr-036--brevo-smtp-as-the-mail-relay) and [ADR-037](#adr-037--google-smtp-as-the-mail-relay). Supersedes the send path in [ADR-031](#adr-031--resend-as-the-first-emailprovider-implementation). Supersedes nothing else.

**Amendment (2026-11-21).** Resend is out of the stack: the team does not want that vendor. Clauses 2 and 3 below are replaced — [ADR-036](#adr-036--brevo-smtp-as-the-mail-relay) briefly set **Brevo** as the relay, [ADR-037](#adr-037--google-smtp-as-the-mail-relay) replaced it with **Google SMTP** the same day, and there is **no relay-side idempotency header**, so the `job_runs` key is the only duplicate guarantee. Clauses 1 and 4–6 (transport, result mapping, lifecycle, pinning) stand unchanged. The Resend text stays below as the record of what was decided first, not as current configuration.

**Context.** ADR-030 fixed the adapter, the queue and the suppression list; ADR-031 picked an HTTP provider API. The team's mail standard is now **`@sendust/ts`** — a standalone SMTP transport engine, a narrow TypeScript facade over a Node-API addon. That is a different kind of dependency from ADR-031's: it is a library with no account, no API key and no webhook endpoint, so it settles *how* we speak SMTP and settles nothing about who relays the mail. Two consequences drive this ADR: the deployment gains a native binary, and the transport's result vocabulary (`accepted` / `rejected` / `unknown`) is coarser than an HTTP status, which changes retry policy rather than just its plumbing.

**Decision.**

1. **`@sendust/ts` is the only mail transport.** `EMAIL_PROVIDER=sendust` in deployed environments, `stub` in tests and local development. `@sendust/ts` is imported in exactly one module (`lib/email/provider.ts`); nothing else in the application imports it.
2. **Resend SMTP is the relay.** *(Superseded by [ADR-036](#adr-036--brevo-smtp-as-the-mail-relay) — the relay is Brevo.)* `smtp.resend.com`, port `465` (implicit TLS; `587` for STARTTLS), username `resend`, password = the Resend API key. The sending subdomain stays `mail.<domain>`, and the account-level Svix webhook and `EMAIL_WEBHOOK_SECRET` stay as ADR-031 described.
3. **Idempotency moves to an email header.** *(Superseded by [ADR-036](#adr-036--brevo-smtp-as-the-mail-relay) — no relay-side idempotency; the `job_runs` key stands alone.)* The `job_runs` key is sent as `Resend-Idempotency-Key` (≤ 256 characters, 24 h dedupe window). The database key remains authoritative; the header is defence in depth, and whether the relay honours it over SMTP is a spike gate, not a fact.
4. **Result mapping is explicit** (`EMAIL_AND_NOTIFICATIONS.md` §4.1): `accepted` → `done`; `rejected` → `failed`, no retry, suppress on a 5xx recipient rejection; `unknown` → `uncertain`, **never retried automatically**; a thrown `SendustError` before `DATA` → retry within the QStash budget.
5. **One transport per server instance**, created at module scope, with `close()` reserved for shutdown — it drains for up to 125 s and must never run inside a request.
6. **Pin and trace the binary.** Exact version (no `^`), platform package `@sendust/ts-linux-x64-gnu` on Vercel, and `serverExternalPackages: ['@sendust/ts']` in `next.config.ts` so the `.node` file reaches the function bundle.

**Facts relied on** (read 2026-11-21 from the published package `1.0.0` — the tarball's `README.md`, `dist/types.d.ts`, `dist/transport.d.ts` and `dist/errors.d.ts`; the package publishes no documentation site and no repository field, so the type definitions *are* the contract):

| Fact | Value | Source |
|---|---|---|
| Version / licence | `1.0.0`, MIT OR Apache-2.0 | [npm registry](https://registry.npmjs.org/@sendust/ts) |
| Runtime floor | Node ≥ 22.23.5; native Node-API addon shipped as per-platform optional dependencies (`linux-x64-gnu`, `linux-arm64-gnu`, `macos-x64`, `macos-arm64`, `windows-x64`) | `package.json` in the tarball |
| API | `createTransport({ host, port, secure: 'tls' \| 'starttls', auth, ehloName, timeouts, limits, delivery, tlsRootCertificate, attachments })`, `transport.send(message)`, `transport.close()`, `transport.state`, `transport.stats` | `dist/transport.d.ts` |
| Result vocabulary | `accepted` = the relay took responsibility for the message; `rejected` = explicit refusal, nothing retried; `unknown` = disposition unprovable after `DATA` may have reached the relay, never retried | `dist/types.d.ts` |
| TLS | Certificate and hostname verification always on; no plaintext mode and no option to disable verification | tarball `README.md` |
| Retries inside the transport | Only transient failures — a `4xx` final reply, or a connect/operation timeout/reset **before** `DATA`; `maxAttempts` defaults to 3 | `README.md`, `dist/transport.d.ts` |
| Limits | 100 recipients, 10 MiB per attachment, 20 MiB aggregate, 30 MiB wire; queue 10,000 messages / 64 MiB (beyond it `send()` throws `LIMIT_QUEUE_FULL`); defaults are maxima and may only be lowered | `dist/types.d.ts`, `dist/limits.d.ts` |
| Errors | `SendustError` with a stable `code`, a `category` (`validation` \| `configuration` \| `limit` \| `tls` \| `authentication` \| `protocol` \| `timeout` \| `closed` \| `busy` \| `internal`) and whitelisted `details`; credentials and bodies never appear | `dist/errors.d.ts` |
| Relay *(superseded by ADR-036)* | `smtp.resend.com`, ports `25`/`465`/`587`/`2465`/`2587`, username `resend`, password = API key, `Resend-Idempotency-Key` header supported over SMTP | [Resend: send with SMTP](https://resend.com/docs/send-with-smtp), [idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys) |

**Alternatives rejected**

- **A provider HTTP API with its SDK (ADR-031's shape)** — typed errors, `429` semantics and native idempotency, and still the fallback shape if the addon fails in the deployed runtime (pointed at the current relay, not at Resend — ADR-036); rejected as the primary because it puts a provider SDK on the send path and leaves no transport that works with a different relay.
- **Nodemailer** — mature, pure JavaScript, no native binary, so no bundling or ABI risk. Rejected because it is a second transport with its own retry and pooling semantics for one capability, and the team standard is Sendust.
- **A provider-specific HTTP client per relay (Postmark, SES)** — two integrations to keep in step for one five-template workload.
- **Running our own relay** — already rejected in ADR-030, and unchanged here: Sendust replaces the SMTP *client*, not the relay, so IP reputation, bounce classification and DMARC stay the relay's job.
- **SMTP without a relay (direct-to-MX)** — reputation, port 25 blocking on serverless hosts, and no bounce feedback; not viable.

**Consequences**

- Positive: one transport for any relay, so a relay swap is an environment-variable block; no provider SDK in domain code; TLS cannot be weakened by configuration; `accepted`/`rejected`/`unknown` makes the duplicate-on-uncertain case explicit instead of hiding it behind a retry.
- Negative: a native addon in the function bundle — the platform package must be traced, the version pinned, and the runtime floor (≥ 22.23.5) checked in the spike. This ADR-025 note matters: the floor is a *dependency's* `engines` field, while ADR-025 still says our own `package.json` declares no `engines.node`.
- Negative: no per-message provider id on the send path. SMTP gives a final reply and nothing addressable, so correlation relies on `job_runs` and on a header the relay may not echo (`OQ-E6`), and delivery truth arrives only through the webhook.
- Negative: `unknown` after `DATA` can mean the relay accepted the message. Automatic retry would double-send; the runbook treats it as a manual reconciliation (`R10`). This is stricter than ADR-031's "retry after 500" and is the main behavioural cost of the change.
- Negative: a transport pool inside a serverless instance holds sockets between requests. Defaults are safe, but `maxConnections`/`sessionIdleMs` are now tunables an operator can get wrong.
- Cost: no licence fee (MIT/Apache-2.0); relay cost is set by [ADR-037](#adr-037--google-smtp-as-the-mail-relay).

**Spike gates** (Phase 1, `MVP_ROADMAP.md` §4.6 — each is pass/fail, not a preference):

1. **Runtime:** the addon loads and sends from the deployed runtime. Under Bun on Vercel (ADR-025) this is unproven; the first fallback is `runtime = 'nodejs'` on the mail route, the second is ADR-031's HTTP adapter.
2. **Deliverability:** one message each to Gmail and Outlook on port 465, with SPF, DKIM and DMARC passing in the received headers.
3. **Idempotency:** a repeated send with the same `Resend-Idempotency-Key` produces one message. *(Retired with the relay; ADR-036 replaces it with a database-key-only gate.)*
4. **Webhooks:** an SMTP-submitted message produces `email.bounced` and `email.delivered` events. This is **not documented by the relay** and is the single assumption the suppression list rests on (`OQ-E6`). *(Retired with the relay; ADR-037 carries the equivalent gates for Google SMTP.)*
5. **Quota reply:** the exact SMTP reply at the 100/day cap is captured, so `quota_exhausted` is detected by fact rather than guess. *(Retired with the relay; ADR-037 gates Google's refusal at the cap.)*

**Evidence that would reverse this decision**

1. The addon cannot load in the deployed runtime after the Node-runtime fallback → return to ADR-031's HTTP adapter behind the same `EmailProvider`; the queue, templates and suppression list are unaffected.
2. SMTP-submitted mail emits no bounce/complaint webhooks → the suppression list has no source; either send through the HTTP API or change relay.
3. `unknown` dispositions exceed 1 in 1,000 sends → the result vocabulary is too coarse for the workload.
4. ~~`Resend-Idempotency-Key` is ignored over SMTP → accept database-key-only dedupe.~~ *(Retired: ADR-036 removed the header entirely; database-key dedupe is already the rule.)*
5. A required relay offers SMTP without STARTTLS or without `AUTH PLAIN`/`LOGIN` → Sendust cannot connect by design; pick a different relay rather than weakening TLS.

---

### ADR-036 — Brevo SMTP as the mail relay

**Status:** Accepted, superseded by [ADR-037](#adr-037--google-smtp-as-the-mail-relay). Supersedes the relay and idempotency clauses of [ADR-035](#adr-035--sendust-as-the-mail-transport-over-an-smtp-relay); ADR-035's transport, result mapping, lifecycle and pinning decisions stand.

**Amendment (2026-11-21).** Brevo is out too: the team sends mail only through Google SMTP. [ADR-037](#adr-037--google-smtp-as-the-mail-relay) replaces clauses 1–5 below. Only the no-relay-idempotency conclusion survives the change. The text is kept as the record of a decision made and reversed on the same day, not as configuration.

**Context.** [ADR-035](#adr-035--sendust-as-the-mail-transport-over-an-smtp-relay) settled the transport but pointed it at Resend's SMTP endpoint. The team has ruled Resend out of the stack. Sendust is a client only — it has no account, no IP reputation and no delivery events — so the relay still has to be chosen on its own merits: SMTP with TLS and AUTH, a free tier that covers auth mail, webhooks for bounce and complaint, and a sender-domain flow we can complete without a sales conversation. Brevo's SMTP relay is the replacement.

**Decision.** *(Clauses 1–5 are superseded by [ADR-037](#adr-037--google-smtp-as-the-mail-relay); the no-relay-idempotency conclusion carries over.)*

1. **Brevo SMTP is the relay.** `EMAIL_SMTP_HOST=smtp-relay.brevo.com`, `EMAIL_SMTP_PORT=465`, `EMAIL_SMTP_SECURE=tls`. The username is the **SMTP login** shown on Brevo's SMTP settings page (the account email, or an auto-generated `[ID]@smtp-brevo.com` address on newer accounts) and the password is a **Brevo SMTP key** — neither is the account password and neither is the API key.
2. **The sending subdomain stays `mail.<domain>`**, authenticated in Brevo's sender-domain flow (SPF + DKIM, DMARC record managed by us). `EMAIL_FROM` is unchanged.
3. **There is no relay-side idempotency.** Brevo documents no SMTP idempotency header. `job_runs` is the only duplicate guarantee, full stop; the adapter sends no idempotency header and §4.2 of `EMAIL_AND_NOTIFICATIONS.md` no longer claims one.
4. **Webhook authentication is a shared bearer token we set at creation.** Brevo does not sign payloads. The webhook is created with its `auth` object carrying a bearer token, and the endpoint compares that header against `EMAIL_WEBHOOK_SECRET` in constant time and rejects anything else with `401`. `EMAIL_WEBHOOK_SECRET` therefore becomes an opaque token we generate, not a vendor signing secret.
5. **Quota behaviour is a queue, not a refusal.** At 300 sends/day the free plan holds up to **1,000 additional transactional messages** in a retry queue; beyond that queue they are not delivered. So `accepted` past the cap means "queued", not "sent", and the quota signal is a rising `deferred` rate plus the daily counter — not a rejected send. The worker must not mark `quota_exhausted` from an SMTP reply, because no such reply arrives.

**Facts relied on** (read 2026-11-21):

| Fact | Value | Source |
|---|---|---|
| Relay endpoint | `smtp-relay.brevo.com`; port `465` with SSL/TLS, or `587`/`2525` for STARTTLS | [Brevo: SMTP relay integration](https://developers.brevo.com/docs/smtp-integration) |
| Credentials | SMTP **login** (account email or `[ID]@smtp-brevo.com`) + SMTP **key**; API keys and account passwords do not work on the relay | [Brevo: send with SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP) |
| Free tier | 300 emails/day, no time limit; transactional mail past the cap is queued (up to 1,000), not refused; free-plan mail carries a "Sent with Brevo" sticker | [Brevo: Free plan limits](https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan) |
| Transactional events | `sent`/`request`, `delivered`, `hardBounce`, `softBounce`, `blocked`, `spam`, `invalid`, `deferred`, `error` (plus open/click, which we do not use) | [Brevo: transactional webhooks](https://developers.brevo.com/docs/transactional-webhooks) |
| Webhook payload | JSON with `event`, `email`, `message-id`, `tag`, `ts`, `subject`, `sending_ip` | [Brevo: send a transactional email](https://developers.brevo.com/docs/send-a-transactional-email) |
| Webhook auth | No payload signature. Basic auth, a bearer token, or custom headers are configured on the webhook itself (`auth` object) | [Brevo: create a webhook](https://developers.brevo.com/reference/create-webhook) |

**Alternatives rejected**

- **Resend SMTP (ADR-035's relay)** — technically the better-documented fit, but the team has excluded the vendor; keeping it would mean maintaining a decision nobody intends to configure.
- **Postmark** — SMTP and deliverability are strong, but the entry plan is paid and there is no free tier to build on; kept as the fallback relay if Brevo's deliverability or DPA fails.
- **Amazon SES SMTP** — cheapest at volume, but the sandbox (verified recipients only, production-access request) plus SNS topic/subscription management for bounces adds two integrations and an approval before the first real login email.
- **Mailgun SMTP** — viable, and the closest second option on webhooks; rejected because its free allowance is smaller than Brevo's and its sender-domain setup is more steps for the same result.
- **Self-hosted MTA (Postfix/Postal)** and **direct-to-MX** — rejected in ADR-030 and unchanged: IP reputation, port 25 blocking and bounce classification are exactly what we are buying.
- **Brevo's HTTP API instead of SMTP** — would work, but it defeats ADR-035: the whole point of Sendust is that the transport is independent of the relay.

**Consequences**

- Positive: still one transport for any relay, so leaving Brevo later is an environment-variable block; a documented free tier that covers verification and reset mail at MVP volume; webhooks exist for the four events the suppression list needs.
- Positive: the daily cap degrades gracefully. Past 300/day, auth mail is queued rather than refused, so a small launch spike delays verification emails instead of failing sign-ups.
- Negative: 300/day is the lowest ceiling we have considered, and the brand sticker is visible on free-plan mail. Both are removed by the entry paid plan; the upgrade trigger is a sustained 200/day or any visible branding complaint.
- Negative: no payload signature. A bearer token in a header is weaker than Svix-style signing — it proves the caller knows the token, not that Brevo sent the body — so the endpoint also enforces idempotent inserts and never trusts a payload to change anything but suppression state.
- Negative: no per-message idempotency and, over SMTP, no proven per-message correlation. Webhook events match on the recipient address; whether a `Message-ID` or custom header we set survives into the payload is unproven, so delivery SLO per message is unavailable until the spike says otherwise.
- Negative: one more processor to put under DPA and in the public notice.

**Spike gates** (Phase 1, `MVP_ROADMAP.md` §4.6 — pass/fail). *Retired with the relay; ADR-037 carries the Google gates:*

1. **Runtime:** the addon connects and authenticates to `smtp-relay.brevo.com:465` from the deployed runtime.
2. **Deliverability:** one message each to Gmail and Outlook with SPF, DKIM and DMARC passing in the received headers, and the sender domain showing as authenticated in Brevo.
3. **Webhooks:** an SMTP-submitted message produces `delivered` and `hard_bounce` events at our endpoint, and the bearer-token check rejects a request without it.
4. **Correlation:** a `Message-ID` (or custom header) we set is echoed in the webhook payload. If not, accept address-level correlation and drop any per-message delivery claim from the SLO.
5. **Cap behaviour:** sending past 300/day produces a `deferred` event rather than a rejected send, and the exact event at the 1,000-message queue ceiling is captured.

**Evidence that would reverse this decision** *(retained as record — the decision was reversed by ADR-037 before any of these were observed)*

1. Hard-bounce + complaint above 1 % over 1,000 production sends, or repeated DMARC alignment failures at Gmail/Outlook → move to Postmark (configuration only).
2. The daily cap or the brand sticker becomes user-visible during a launch spike → upgrade the plan; this does not reverse the relay choice.
3. No acceptable DPA or data-region commitment for Brevo → change relay; the transport and adapter are unaffected.
4. An outage longer than 30 minutes during Phase 2 acceptance, or a webhook outage that leaves the suppression list stale for a day → re-evaluate with the second option on this list.
5. Brevo withdraws SMTP relay access or requires STARTTLS-only on a port Sendust cannot use securely → pick the next relay rather than weakening TLS.

---

### ADR-037 — Google SMTP as the mail relay

**Status:** Accepted. **Closes `D-08`** — the relay is a decided choice, not a recommended default. Supersedes the relay clauses of [ADR-035](#adr-035--sendust-as-the-mail-transport-over-an-smtp-relay) and [ADR-036](#adr-036--brevo-smtp-as-the-mail-relay). ADR-035's transport, result mapping, lifecycle and pinning decisions stand, and so does ADR-036's conclusion that there is no relay-side idempotency. The spike gates below are Phase 1 implementation checks; failing one reverses the decision, but none of them leaves it open.

**Context.** The team's mail account is Google, and no other email vendor will be added: not Resend (ADR-035), not Brevo (ADR-036), not a new ESP. So the relay is `smtp.gmail.com`, authenticated as a Google account with an app password. That is a materially different relay from the two rejected ones: it has no delivery webhook, no per-message API, no queue at the daily cap, and a sender identity tied to the Google account. Those four properties, not the endpoint, decide what this ADR has to change in the email design.

**Decision.**

1. **Google SMTP is the only relay.** `EMAIL_SMTP_HOST=smtp.gmail.com`, `EMAIL_SMTP_PORT=465`, `EMAIL_SMTP_SECURE=tls`, `EMAIL_SMTP_USER` = the full Google address, `EMAIL_SMTP_PASS` = a 16-character Google **app password**. Port `587` with `starttls` is the documented alternative and stays supported by configuration.
2. **The sending identity is that Google account.** `EMAIL_FROM` is either the account address or a verified "Send mail as" alias on it. A `mail.<domain>` sender therefore requires Google Workspace with the domain and the alias verified; on a personal Gmail account the product sends from `@gmail.com`, and that is a product decision, not a technical detail.
3. **There are no delivery events.** Google documents no webhook or delivery-event API for `smtp.gmail.com`. Suppression therefore has two sources: a **synchronous 5xx at `RCPT TO`/`DATA`**, which the send path already sees and records automatically, and **asynchronous bounce mail**, which arrives in the account's inbox and is reconciled by an operator (`OPERATIONS_RUNBOOK.md` `R10`). **This resolves `OQ-E6` in favour of manual reconciliation, with no IMAP parsing job in MVP** — the rationale and the measured switch trigger are in `EMAIL_AND_NOTIFICATIONS.md` §5. `/api/v1/internal/hooks/email` and `EMAIL_WEBHOOK_SECRET` are removed from MVP scope; they exist only if a relay with webhooks is adopted.
4. **The cap refuses, it does not queue.** At 2,000 messages per rolling day on paid Workspace (500 on personal Gmail or a Workspace trial), Gmail rejects further mail. The worker records `quota_exhausted`, schedules no retry before the window rolls, and alerts. Nothing here may assume a vendor queue holding the message for us.
5. **The app password is a Google-account credential, treated as such.** 2-Step Verification is a prerequisite on the sending account; a dedicated account is used, never the founder's primary mailbox. Leaking it is an account compromise, so it is rotated like `BETTER_AUTH_SECRET`, never logged, and never placed in a client bundle.
6. **No relay-side idempotency, unchanged from ADR-036.** `job_runs` remains the only duplicate guarantee.

**Facts relied on** (read 2026-11-21):

| Fact | Value | Source |
|---|---|---|
| Endpoint and ports | `smtp.gmail.com` — port `465` implicit SSL/TLS, port `587` STARTTLS | [Gmail IMAP, POP and SMTP](https://developers.google.com/workspace/gmail/imap/imap-smtp) |
| Credentials | Username is the full Gmail or Workspace address; password is a 16-character app password, which requires 2-Step Verification and is unavailable on security-key-only 2SV, Advanced Protection accounts, or where a Workspace admin disables it | [Sign in with app passwords](https://support.google.com/mail/answer/185833) |
| Daily limit | 2,000 messages/day per user on paid Workspace, 500 on personal Gmail or a Workspace trial; rolling 24-hour window; shared across every client using the account | [Gmail sending limits](https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace), [IMAP/SMTP limits](https://developers.google.com/workspace/gmail/imap/imap-smtp) |
| Recipients per message | 100 recipients per message sent over SMTP by a POP/IMAP client | [Gmail IMAP, POP and SMTP](https://developers.google.com/workspace/gmail/imap/imap-smtp) |
| SMTP relay service | `smtp-relay.gmail.com` exists for apps, but authenticates by IP allowlist or SMTP AUTH and is aimed at fixed egress ranges | [Send email from a printer, scanner, or app](https://knowledge.workspace.google.com/admin/gmail/send-email-from-a-printer-scanner-or-app) |
| Delivery events | None documented for `smtp.gmail.com`: no webhook, no delivery API. The synchronous SMTP reply is the only machine-readable signal; later bounces arrive as mail | Absence of any such endpoint in Google's SMTP documentation; the question this raises is `OQ-E6`, resolved in `EMAIL_AND_NOTIFICATIONS.md` §5 |

**Alternatives rejected**

- **Any third-party ESP (Resend, Brevo, Postmark, SES, Mailgun)** — each was considered and each is now excluded by the same constraint: the team sends only through Google. Re-adding one is a new ADR, not a configuration change.
- **`smtp-relay.gmail.com`** — the Google-native way to send app mail at higher volume, but it authenticates by IP allowlist, and Vercel functions do not have stable egress addresses. It becomes viable only with static egress (a proxy or a fixed-IP host), which is more infrastructure than this workload justifies.
- **Gmail API with OAuth 2.0** — avoids the app password and gives a message id, but it replaces Sendust with a Google SDK on the send path, contradicts ADR-035, and Sendust's documented auth is username/password.
- **Self-hosted MTA / direct-to-MX** — rejected in ADR-030; reputation and port 25 blocking are unchanged.
- **Sending from a personal `@gmail.com` address in production** — works at 500/day and is acceptable for the spike and preview, but it puts the product's auth mail on a consumer identity. Rejected for launch; Workspace with the domain is the launch configuration.

**Consequences**

- Positive: no new vendor and no new subprocessor beyond Google; no webhook endpoint to secure, no signing secret to manage; the SMTP conversation still gives per-recipient refusal at send time, which is the bounce case that matters most (unknown mailbox).
- Negative: **asynchronous bounces and complaints are invisible to the application.** A message accepted by Google and later bounced produces no event we can consume; the suppression list is only as current as the operator's reconciliation of the account's bounce mail. This is the real cost of the decision and is stated as such in `EMAIL_AND_NOTIFICATIONS.md` §5.
- Negative: the delivery SLO cannot be measured from provider events. `accepted` means Google took the message; whether it arrived is unobservable except through user reports and the bounce inbox.
- Negative: quota is a hard ceiling with no queue, tied to one human account, and shared with anything else that account sends. A launch spike fails sign-ups rather than delaying mail.
- Negative: the app password is a long-lived credential on a Google account with 2SV; compromise is broader than mail. Google can also suspend the account, which stops all auth mail at once.
- Negative: sender identity is constrained. `mail.<domain>` requires Workspace plus a verified alias, and Gmail may rewrite or cloak a `From` it does not recognise — a gate, not an assumption.

**Spike gates** (Phase 1, `MVP_ROADMAP.md` §4.6 — pass/fail):

1. **Runtime:** Sendust connects and authenticates to `smtp.gmail.com:465` from the deployed Vercel runtime, with the app password supplied as an environment variable. If egress is blocked, that is a launch blocker, not a tuning problem.
2. **Sender identity:** a message sent with `EMAIL_FROM=Exampify <no-reply@mail.<domain>>` arrives with that exact `From`, no rewrite and no "on behalf of", which proves the alias is verified.
3. **Deliverability:** one message each to Gmail and Outlook with SPF, DKIM and DMARC passing, and the Workspace DKIM key published for the sending domain.
4. **Quota reply:** the exact SMTP reply at the daily cap is captured once, so `quota_exhausted` is detected by fact rather than guess.
5. **Bounce reality:** a message to a non-existent address is refused synchronously (recorded as `rejected`), and one that bounces later is confirmed to appear as bounce mail in the account inbox — the only path by which we learn about it.

**Evidence that would reverse this decision**

1. Auth mail volume approaches 2,000 messages/day, or a single launch spike exhausts the daily cap and blocks sign-ups → a relay with a queue or a higher ceiling becomes necessary, which means a new ADR and an exception to the Google-only rule.
2. Deliverability degrades (Gmail/Outlook filtering, SPF/DKIM/DMARC failures) and Google's shared reputation is the cause → dedicated sending infrastructure or an ESP.
3. The `From` alias cannot be verified for `mail.<domain>`, so mail ships from a consumer address → the branding/deliverability cost is reassessed before launch, not after.
4. Google blocks or rate-limits SMTP from the deployed runtime, or the account is suspended → mail is down until the relay changes; the adapter is ready, the decision is not.
5. Async bounces turn out to be frequent enough that manual reconciliation misses suppressions, or one of the switch triggers in `EMAIL_AND_NOTIFICATIONS.md` §5 fires (an address re-sent after a bounce, a sweep over 30 minutes for two weeks, more than 25 `source='ops'` suppressions a week for three weeks) → a relay with webhooks, or an IMAP bounce-parsing job, becomes justified.

---

## 5. Decisions still open

| # | Decision | Blocks | Tracked as |
|---|---|---|---|
| D-01 | Sign-off on ADR-016 (Turso + Vercel as the committed platform) | Phase 1 infrastructure | ADR-016 |
| D-02 | Sign-off on ADR-026 (embedding model and paid inference budget) | Phase 2 search | ADR-026, `OQ-S5` |
| D-03 | Launch curriculum and subject list | Content seeding | `OQ-01` |
| D-04 | Monetisation | ADR-012 revisit | `OQ-03` |
| D-05 | Account deletion vs anonymisation | Privacy + cascade policy | `OQ-06` |
| D-06 | Bun 1.4 adoption timing | Runtime upgrade | `OQ-D1` |
| D-07 | Region (Indonesia vs global) | Latency and data residency | `OQ-D3` |

### 5.1 Provider defaults: one decided, three awaiting sign-off

These four were open provider/legal choices. **`D-08` is now decided** (ADR-037) and stays in the table so the trail is visible; the other three still have only a recommended default and a named ADR. Implementation is unblocked for all four; what remains for `D-09`–`D-11` is sign-off, and for `D-11` legal review. Each states the evidence that would reverse it — a decision without a reversal condition is a preference.

| # | Choice | Status | ADR | Reverse if |
|---|---|---|---|---|
| D-08 | `@sendust/ts` over Google SMTP (`smtp.gmail.com`), app-password auth, sending as a verified alias on the Google account | **Decided 2026-11-21**; the Phase 1 spike gates remain implementation checks, not an open question | [ADR-035](#adr-035--sendust-as-the-mail-transport-over-an-smtp-relay), [ADR-037](#adr-037--google-smtp-as-the-mail-relay) | addon fails to load, Vercel egress cannot reach 465/587, the alias cannot be verified, the 2,000/day cap is reached, or async bounces outpace manual suppression |
| D-09 | Sentry (free Developer plan) with source maps | Recommended; Phase 1 can instrument | [ADR-032](#adr-032--sentry-for-error-tracking-and-source-maps) | error quota exhausted before the 25th twice, or redaction cannot pass §3.3 |
| D-10 | Launch locale `en`, routes unprefixed, `id-ID` first expansion | Recommended; re-affirm before Phase 6 indexing | [ADR-033](#adr-033--launch-locale-is-en-with-routes-unprefixed) | `OQ-01` selects an Indonesian exam board, or content ops confirms an Indonesian subject before indexing |
| D-11 | Minimum age 16, self-attested, no DOB stored | Recommended; **legal review required**, and Indonesia likely raises it to 18 or needs parental consent | [ADR-034](#adr-034--minimum-age-16-self-attested-no-date-of-birth-stored) | counsel confirms a higher consent age in the launch market |

---

## 6. Consistency rules

1. Every ADR states what was rejected and why — an ADR without alternatives is a note, not a decision.
2. Superseding keeps the old text, marks it, and links forward.
3. Changing a decision updates every document that references it in the same change set.
4. A decision that only lives in code does not exist.
5. A superseded ADR's *criteria* remain binding on its replacement unless explicitly retired.

---

## 7. Acceptance criteria

1. Every structural choice in `/docs` traces to an ADR.
2. Every ADR has context, decision, rejected alternatives, consequences and a revisit trigger.
3. Every superseded ADR names its replacement with a working link.
4. No ADR contradicts `DATABASE_SCHEMA.md`, `API_CONTRACTS.md`, `SEARCH_ARCHITECTURE.md`, `BACKGROUND_JOBS.md` or `MVP_ROADMAP.md`.
5. ADR-016 and ADR-026 are signed off before Phase 1 starts (ADR-017's sign-off is already resolved, §2).
6. Claims about third-party capabilities are traceable to provider documentation, and unverified claims are marked as spike items rather than stated as facts.

---

## 8. Open-question index

Every open question in the set, in one index sorted by the phase it blocks. **Each source row is the source of truth** — this index is derived from it, quotes its `**Open — needs:**` text, and must be updated by changing the source row, never by editing this table alone. `docs/check.py` fails when the two disagree; the fix is to edit the source row and rerun `python3 docs/gen_index.py`, which rewrites §8 and §8.1 in place. Resolved rows are excluded; their closures are in place in their own documents.

**130 open** across 24 documents, plus the open decisions in §5 (`D-01`–`D-07`, `D-09`–`D-11`) and the sign-off gates in §7 (criterion 5). Open per phase: Phase 1 **27**, Phase 2 **26**, Phase 3 **4**, Phase 4 **11**, Phase 5 **6**, Phase 6 **14**, Phase 7 **38**, post-MVP **3**, not phase-tagged **1**. §8.1 lists the clusters where several rows are one question — answer the controlling row, not each copy.

### Phase 1 — foundations (27 open questions)

| ID | Question | What is needed | Cluster | Source |
|---|---|---|---|---|
| `OQ-01` | Launch curriculum and subject list? (`A-02` is a placeholder) | decide the launch curriculum and subject list with content ops | `market` (control) | [PRODUCT_REQUIREMENTS §12](./PRODUCT_REQUIREMENTS.md#12-open-questions) |
| `OQ-02` | Is "Exampify" the brand, and what domain? | decide brand and domain; URLs, metadata and mail all depend on it | — | [PRODUCT_REQUIREMENTS §12](./PRODUCT_REQUIREMENTS.md#12-open-questions) |
| `OQ-04` | Is Indonesian content at launch, or English only? | decide whether Indonesian content is in the launch corpus | `bahasa` (control) | [PRODUCT_REQUIREMENTS §12](./PRODUCT_REQUIREMENTS.md#12-open-questions) |
| `OQ-PA2` | Is a second region needed for Indonesian users? | decide whether a second region is needed for Indonesian users (`D-07`) | `residency` | [PRODUCT_ARCHITECTURE §16](./PRODUCT_ARCHITECTURE.md#16-open-questions) |
| `OQ-IA1` | Does the launch curriculum need level sub-labels ("AS" vs "A Level" separate)? | decide level sub-labels from the launch curriculum | — | [INFORMATION_ARCHITECTURE §13](./INFORMATION_ARCHITECTURE.md#13-open-questions) |
| `OQ-IA2` | Subject groups global or per-curriculum? | decide global vs per-curriculum subject groups (one FK or a join table) | — | [INFORMATION_ARCHITECTURE §13](./INFORMATION_ARCHITECTURE.md#13-open-questions) |
| `OQ-IA7` | Is `/chapters/` worth the extra segment? | decide whether `/chapters/` earns its extra segment before URLs freeze | — | [INFORMATION_ARCHITECTURE §13](./INFORMATION_ARCHITECTURE.md#13-open-questions) |
| `OQ-DB8` | Store block payloads as JSON text or as one `body` document per resource? | settle the block storage shape before the first migration | — | [DATABASE_SCHEMA §18](./DATABASE_SCHEMA.md#18-open-questions) |
| `OQ-SEO1` | What is the launch market/locale (`OQ-01`)? | decide the launch market/locale (`OQ-01`) | `market` | [SEO_AND_CONTENT_STRATEGY §10](./SEO_AND_CONTENT_STRATEGY.md#10-open-questions) |
| `OQ-UX1` | Which English variant is canonical for UI copy (UK vs US)? | spelling variant follows `OQ-01`'s launch market | `market` | [UI_UX_GUIDELINES §14](./UI_UX_GUIDELINES.md#14-open-questions) |
| `OQ-DS2` | Do we license Bricolage Grotesque / Instrument Serif, or substitute open alternates (e.g. Archivo, Fraunces)? | confirm font licences or choose open alternates | — | [DESIGN_SYSTEM §15](./DESIGN_SYSTEM.md#15-open-questions) |
| `OQ-DS3` | Is a custom illustration set commissioned, or do we start with two-colour generated line art? | decide commissioned vs generated illustration set | — | [DESIGN_SYSTEM §15](./DESIGN_SYSTEM.md#15-open-questions) |
| `OQ-DS5` | Is a marketing-specific hero treatment (larger type, more illustration) needed beyond the content design system? | decide whether the homepage needs a marketing hero beyond the design system | — | [DESIGN_SYSTEM §15](./DESIGN_SYSTEM.md#15-open-questions) |
| `OQ-R1` | Is the launch date fixed against the content plan? | fix the launch date against the content plan | — | [MVP_ROADMAP §17](./MVP_ROADMAP.md#17-open-questions) |
| `OQ-R2` | One or two engineers, and is a designer available for Phase 1? | confirm team size and designer availability | — | [MVP_ROADMAP §17](./MVP_ROADMAP.md#17-open-questions) |
| `OQ-TS1` | Adopt `class-variance-authority` for variants, or keep a local map? | decide CVA vs a local variant map | — | [TECHNICAL_STANDARDS §21](./TECHNICAL_STANDARDS.md#21-open-questions) |
| `OQ-TS2` | Add `eslint-plugin-boundaries` to enforce the module graph automatically? | decide whether `eslint-plugin-boundaries` is adopted | — | [TECHNICAL_STANDARDS §21](./TECHNICAL_STANDARDS.md#21-open-questions) |
| `OQ-TS3` | Do DTO mappers live in `lib/services/mappers` or beside each service? | decide where DTO mappers live | — | [TECHNICAL_STANDARDS §21](./TECHNICAL_STANDARDS.md#21-open-questions) |
| `OQ-TS4` | Is the strict flag set workable with Better Auth's generated types? | verify strict mode against Better Auth's generated types in the spike | — | [TECHNICAL_STANDARDS §21](./TECHNICAL_STANDARDS.md#21-open-questions) |
| `OQ-TS5` | Conventional-commit automation for release notes, or format enforcement only? | decide conventional-commit automation vs format-only enforcement | — | [TECHNICAL_STANDARDS §21](./TECHNICAL_STANDARDS.md#21-open-questions) |
| `OQ-TS6` | Does the Kysely `DB` interface get generated from `PRAGMA table_info`, or hand-maintained? | decide generated vs hand-maintained Kysely `DB` types | — | [TECHNICAL_STANDARDS §21](./TECHNICAL_STANDARDS.md#21-open-questions) |
| `OQ-T4` | Should integration tests use one shared schema with rollbacks, or a fresh database per file? | decide shared-schema rollbacks vs a fresh database per test file | — | [TESTING_STRATEGY §13](./TESTING_STRATEGY.md#13-open-questions) |
| `OQ-D3` | Which region for Vercel + Turso + Qdrant? | decide the region from the launch audience (`OQ-01`) | `residency` | [DEPLOYMENT_AND_ENVIRONMENTS §12](./DEPLOYMENT_AND_ENVIRONMENTS.md#12-open-questions) |
| `OQ-D4` | Turso branching on the chosen plan, or a single staging database? | decide Turso branching vs a single staging database on the chosen plan | — | [DEPLOYMENT_AND_ENVIRONMENTS §12](./DEPLOYMENT_AND_ENVIRONMENTS.md#12-open-questions) |
| `OQ-PR4` | Data residency requirement for Indonesian users (`D-07`) | decide the data-residency requirement (`D-07`) | `residency` | [PRIVACY_AND_DATA_PROTECTION §13](./PRIVACY_AND_DATA_PROTECTION.md#13-open-questions) |
| `OQ-ED1` | Which spelling variant (`OQ-01`)? | spelling variant follows `OQ-01`'s launch market | `market` | [EDITORIAL_GUIDE §14](./EDITORIAL_GUIDE.md#14-open-questions) |
| `OQ-I18N2` | Is Indonesian content required at launch for the local market? | decide whether Indonesian content is in the launch corpus (`OQ-04`) | `bahasa` | [INTERNATIONALIZATION §10](./INTERNATIONALIZATION.md#10-open-questions) |

### Phase 2 — content and accounts (26 open questions)

| ID | Question | What is needed | Cluster | Source |
|---|---|---|---|---|
| `OQ-06` | Account export/deletion at launch (jurisdiction)? | decide export/deletion scope with counsel (ties `D-05`) | `deletion` | [PRODUCT_REQUIREMENTS §12](./PRODUCT_REQUIREMENTS.md#12-open-questions) |
| `OQ-11` | Do downloads require an account? | decide whether downloads require an account | `downloads` (control) | [PRODUCT_REQUIREMENTS §12](./PRODUCT_REQUIREMENTS.md#12-open-questions) |
| `OQ-IA4` | Should topics support a subtopic level in year one? | decide whether topics need a subtopic level in year one | — | [INFORMATION_ARCHITECTURE §13](./INFORMATION_ARCHITECTURE.md#13-open-questions) |
| `OQ-IA6` | Should a lesson's practice live at an anchor on the lesson page or only at its own URL? | decide anchor vs own URL for a lesson's practice section | `practice-url` (control) | [INFORMATION_ARCHITECTURE §13](./INFORMATION_ARCHITECTURE.md#13-open-questions) |
| `OQ-UF4` | Does the studio need a distinct reviewer queue screen? | decide whether the studio needs a reviewer queue screen | — | [USER_FLOWS §18](./USER_FLOWS.md#18-open-questions) |
| `OQ-UF6` | Should a lesson's practice section be linkable as its own page? | decide whether lesson practice is linkable as its own page (ties `OQ-IA6`) | `practice-url` | [USER_FLOWS §18](./USER_FLOWS.md#18-open-questions) |
| `OQ-DB4` | Retain deleted users' attempts anonymously? | decide whether anonymised attempts survive account deletion (ties `D-05`) | `deletion` | [DATABASE_SCHEMA §18](./DATABASE_SCHEMA.md#18-open-questions) |
| `OQ-DB7` | Should `content_blocks` be copied on resource duplication, or shared? | decide copy vs shared blocks when duplicating a resource | — | [DATABASE_SCHEMA §18](./DATABASE_SCHEMA.md#18-open-questions) |
| `OQ-CM1` | Should a resource ever appear under two topics (shared, not copied)? | decide whether a resource may be shared across topics (changes canonical URLs) | — | [CONTENT_MODEL §14](./CONTENT_MODEL.md#14-open-questions) |
| `OQ-CM2` | Do `download` blocks require an email gate or login? | decide whether downloads are gated by login or email | `downloads` | [CONTENT_MODEL §14](./CONTENT_MODEL.md#14-open-questions) |
| `OQ-CM6` | Should `related_material` be authored or generated? | decide authored vs generated related material | — | [CONTENT_MODEL §14](./CONTENT_MODEL.md#14-open-questions) |
| `OQ-API1` | Do public read endpoints exist in MVP, or only internal server calls + search? | decide whether public reads ship as an HTTP API or stay server-only plus search | — | [API_CONTRACTS §17](./API_CONTRACTS.md#17-open-questions) |
| `OQ-API4` | Does the product need `includeCount` on public lists? | decide whether any public list needs `includeCount` | — | [API_CONTRACTS §17](./API_CONTRACTS.md#17-open-questions) |
| `OQ-J3` | Should media processing (thumbnails, PDF previews) run in a job? | decide whether thumbnails and PDF previews are generated server-side | — | [BACKGROUND_JOBS §14](./BACKGROUND_JOBS.md#14-open-questions) |
| `OQ-SEO4` | Should subject pages show a syllabus/specification reference (and is that licensed)? | decide whether to cite syllabi and whether that needs a licence | — | [SEO_AND_CONTENT_STRATEGY §10](./SEO_AND_CONTENT_STRATEGY.md#10-open-questions) |
| `OQ-UX2` | Is the two-column Read/Practise topic hub the right emphasis, or should practice be a single full-width band? | decide the topic-hub layout emphasis | — | [UI_UX_GUIDELINES §14](./UI_UX_GUIDELINES.md#14-open-questions) |
| `OQ-UX5` | Is a mobile bottom navigation bar expected for the student area? | decide whether the student area gets mobile bottom navigation | — | [UI_UX_GUIDELINES §14](./UI_UX_GUIDELINES.md#14-open-questions) |
| `OQ-DS4` | Should subject colour assignment be editorial or automatic round-robin? | decide editorial vs automatic subject colours; this also settles the `color_token` uniqueness conflict | — | [DESIGN_SYSTEM §15](./DESIGN_SYSTEM.md#15-open-questions) |
| `OQ-SEC1` | Is account deletion expected at launch, and what happens to attempts (`OQ-06`)? | decide whether account deletion is expected at launch (ties `OQ-06`/`D-05`) | `deletion` | [SECURITY_AND_PERMISSIONS §17](./SECURITY_AND_PERMISSIONS.md#17-open-questions) |
| `OQ-SEC2` | Do we require MFA for `admin`/`reviewer` accounts? | decide whether admin/reviewer accounts require MFA | — | [SECURITY_AND_PERMISSIONS §17](./SECURITY_AND_PERMISSIONS.md#17-open-questions) |
| `OQ-T1` | Is a test mailbox service acceptable, or do we use a DB-token shortcut in E2E? | decide test mailbox vs a DB-token shortcut in E2E | — | [TESTING_STRATEGY §13](./TESTING_STRATEGY.md#13-open-questions) |
| `OQ-T5` | Do we require 80 % coverage on `lib/services` as a blocking gate from Phase 2? | decide whether 80% service coverage blocks from Phase 2 | — | [TESTING_STRATEGY §13](./TESTING_STRATEGY.md#13-open-questions) |
| `OQ-OBS4` | Should `user_signed_in` be recorded at all (retention analysis vs privacy minimalism)? | decide whether `user_signed_in` is recorded at all (privacy minimalism) | — | [OBSERVABILITY_AND_ANALYTICS §13](./OBSERVABILITY_AND_ANALYTICS.md#13-open-questions) |
| `OQ-E3` | Do we require email verification before *any* practice, or only before submitting? | decide the verification gate | — | [EMAIL_AND_NOTIFICATIONS §12](./EMAIL_AND_NOTIFICATIONS.md#12-open-questions) |
| `OQ-PR2` | Is `ex_anon` acceptable as a non-consented analytics cookie in the launch market? | decide whether `ex_anon` is lawful as a non-consented cookie in the launch market | — | [PRIVACY_AND_DATA_PROTECTION §13](./PRIVACY_AND_DATA_PROTECTION.md#13-open-questions) |
| `OQ-ED2` | Do we require a subject-level glossary resource? | decide whether a per-subject glossary resource is required | — | [EDITORIAL_GUIDE §14](./EDITORIAL_GUIDE.md#14-open-questions) |

### Phase 3 — question bank (4 open questions)

| ID | Question | What is needed | Cluster | Source |
|---|---|---|---|---|
| `OQ-CM4` | Do assessments need a passing threshold shown to students? | decide whether assessments display a pass threshold | — | [CONTENT_MODEL §14](./CONTENT_MODEL.md#14-open-questions) |
| `OQ-CM5` | Are computer-marked formulas (numeric answers with tolerance) in scope? | decide whether numeric answers with tolerance are in scope (new type plus grader branch) | — | [CONTENT_MODEL §14](./CONTENT_MODEL.md#14-open-questions) |
| `OQ-ED3` | Minimum review depth for a `very_hard` question (two reviewers?) | decide whether `very_hard` questions need two reviewers | — | [EDITORIAL_GUIDE §14](./EDITORIAL_GUIDE.md#14-open-questions) |
| `OQ-ED4` | Are worked-solution videos in scope for MVP? | decide whether worked-solution videos are in MVP | — | [EDITORIAL_GUIDE §14](./EDITORIAL_GUIDE.md#14-open-questions) |

### Phase 4 — practice engine (11 open questions)

| ID | Question | What is needed | Cluster | Source |
|---|---|---|---|---|
| `OQ-10` | Anonymous (guest) practice? | decide whether guest practice is allowed | — | [PRODUCT_REQUIREMENTS §12](./PRODUCT_REQUIREMENTS.md#12-open-questions) |
| `OQ-UF3` | Should attempts be pausable indefinitely rather than 24 h? | decide whether attempts pause indefinitely vs the 24-hour expiry | — | [USER_FLOWS §18](./USER_FLOWS.md#18-open-questions) |
| `OQ-UF5` | Is a two-step submit confirmation too heavy for 5 questions? | decide whether two-step submit confirmation is too heavy | — | [USER_FLOWS §18](./USER_FLOWS.md#18-open-questions) |
| `OQ-QE1` | Should grading use the question version at selection time instead of current? | decide grading against the current key or the selection snapshot, before grading tests are written | — | [QUESTION_ENGINE §17](./QUESTION_ENGINE.md#17-open-questions) |
| `OQ-QE2` | Do we need a negative-marking policy for mock exams? | decide whether mock exams use negative marking | — | [QUESTION_ENGINE §17](./QUESTION_ENGINE.md#17-open-questions) |
| `OQ-QE3` | Should late submits for timed modes be rejected? | decide whether late submits for timed modes are rejected | — | [QUESTION_ENGINE §17](./QUESTION_ENGINE.md#17-open-questions) |
| `OQ-QE4` | Is partial credit shown per option in review, or only the total? | decide whether review shows per-option partial credit | — | [QUESTION_ENGINE §17](./QUESTION_ENGINE.md#17-open-questions) |
| `OQ-QE6` | Do short answers need fuzzy matching (typo tolerance) rather than exact normalisation? | decide whether short answers need fuzzy matching | — | [QUESTION_ENGINE §17](./QUESTION_ENGINE.md#17-open-questions) |
| `OQ-API6` | Should `reveal` also be allowed in `practice` mode for a re-saved unchanged answer? | decide whether a re-saved unchanged practice answer may reveal | — | [API_CONTRACTS §17](./API_CONTRACTS.md#17-open-questions) |
| `OQ-UX3` | Do students need a "flag question" control at launch? | decide whether a flag-question control ships at launch | — | [UI_UX_GUIDELINES §14](./UI_UX_GUIDELINES.md#14-open-questions) |
| `OQ-UX4` | Should the runner show a countdown in `test`/`mock` mode (duration is already enforced server-side)? | decide whether test/mock shows a countdown | — | [UI_UX_GUIDELINES §14](./UI_UX_GUIDELINES.md#14-open-questions) |

### Phase 5 — progress and retention (6 open questions)

| ID | Question | What is needed | Cluster | Source |
|---|---|---|---|---|
| `OQ-UF1` | Track reading progress (resources viewed) in MVP? | decide whether reading progress is tracked (adds a table and UI) | — | [USER_FLOWS §18](./USER_FLOWS.md#18-open-questions) |
| `OQ-UF2` | Is a homepage Continue card required at launch? | decide whether the homepage shows a Continue card | — | [USER_FLOWS §18](./USER_FLOWS.md#18-open-questions) |
| `OQ-DB3` | Is `user_topic_stats` needed at launch? | measure live aggregates before adding the cache table | — | [DATABASE_SCHEMA §18](./DATABASE_SCHEMA.md#18-open-questions) |
| `OQ-QE5` | Should cross-listed questions count in every topic's accuracy? | decide whether cross-listed questions count in every topic's accuracy (a deliberate irregularity today) | — | [QUESTION_ENGINE §17](./QUESTION_ENGINE.md#17-open-questions) |
| `OQ-OBS3` | Do we need per-topic reading completion (scroll to end) as a signal? | decide whether reading completion (scroll-to-end) is tracked | — | [OBSERVABILITY_AND_ANALYTICS §13](./OBSERVABILITY_AND_ANALYTICS.md#13-open-questions) |
| `OQ-E4` | Do we send an attempt-result digest (retention feature)? | decide whether the digest ships, which pulls in consent and unsubscribe | — | [EMAIL_AND_NOTIFICATIONS §12](./EMAIL_AND_NOTIFICATIONS.md#12-open-questions) |

### Phase 6 — search and indexing (14 open questions)

| ID | Question | What is needed | Cluster | Source |
|---|---|---|---|---|
| `OQ-12` | Is search expected to answer questions, or only retrieve pages? | decide whether search answers questions or only retrieves pages | — | [PRODUCT_REQUIREMENTS §12](./PRODUCT_REQUIREMENTS.md#12-open-questions) |
| `OQ-PA4` | Is `s-maxage=60` on search acceptable, or should it be 10 s for freshness? | decide search `s-maxage` (60 s vs 10 s) | — | [PRODUCT_ARCHITECTURE §16](./PRODUCT_ARCHITECTURE.md#16-open-questions) |
| `OQ-PA5` | Do we keep the FTS5 table once Qdrant has BM25? | decide whether FTS5 stays once Qdrant's BM25 list is evaluated | `bm25` (control) | [PRODUCT_ARCHITECTURE §16](./PRODUCT_ARCHITECTURE.md#16-open-questions) |
| `OQ-IA3` | Do we need indexable filtered paths (`/subjects/science`) or is query-string filtering enough? | decide whether filtered paths are indexable pages | `paths` (control) | [INFORMATION_ARCHITECTURE §13](./INFORMATION_ARCHITECTURE.md#13-open-questions) |
| `OQ-S1` | Is Indonesian content authored from launch, or is the multilingual model insurance? | decide whether Indonesian is authored from launch (`OQ-04`) | `bahasa` | [SEARCH_ARCHITECTURE §16](./SEARCH_ARCHITECTURE.md#16-open-questions) |
| `OQ-S2` | Does Qdrant Cloud free cluster meet the latency and size budget at launch? | measure the free Qdrant cluster against the launch latency/size budget | `qdrant-tier` | [SEARCH_ARCHITECTURE §16](./SEARCH_ARCHITECTURE.md#16-open-questions) |
| `OQ-S3` | Is SQLean Fuzzy present in the deployed libSQL build? | verify SQLean Fuzzy exists in the deployed libSQL build | — | [SEARCH_ARCHITECTURE §16](./SEARCH_ARCHITECTURE.md#16-open-questions) |
| `OQ-S4` | Do we need BM25 *inside* Qdrant as a third list, or is FTS5 enough? | decide whether Qdrant BM25 becomes a third result list | `bm25` | [SEARCH_ARCHITECTURE §16](./SEARCH_ARCHITECTURE.md#16-open-questions) |
| `OQ-S5` | Which model if `e5-small` underperforms: `mxbai-embed-large` (paid) or an external provider via Qdrant? | decide the fallback model if `e5-small` misses Recall@5 (`D-02`) | `embedding` | [SEARCH_ARCHITECTURE §16](./SEARCH_ARCHITECTURE.md#16-open-questions) |
| `OQ-S7` | Is a query log with user hashes acceptable under the privacy policy? | decide whether a hashed query log is acceptable under the privacy policy | — | [SEARCH_ARCHITECTURE §16](./SEARCH_ARCHITECTURE.md#16-open-questions) |
| `OQ-J1` | Is QStash's free 1,000 messages/day enough for a full reindex during development? | measure a full development reindex against the 1,000 messages/day allowance | — | [BACKGROUND_JOBS §14](./BACKGROUND_JOBS.md#14-open-questions) |
| `OQ-SEO6` | Is a separate `/subjects/{group}` path needed for category queries (`OQ-IA3`)? | decide whether `/subjects/{group}` is indexable (ties `OQ-IA3`) | `paths` | [SEO_AND_CONTENT_STRATEGY §10](./SEO_AND_CONTENT_STRATEGY.md#10-open-questions) |
| `OQ-R5` | Budget for a paid Qdrant cluster at launch? | decide whether Qdrant is paid at launch (quality/stability) | `qdrant-tier` (control) | [MVP_ROADMAP §17](./MVP_ROADMAP.md#17-open-questions) |
| `OQ-R6` | Is Indonesian content part of the launch corpus? | decide whether Indonesian content is in the launch corpus | `bahasa` | [MVP_ROADMAP §17](./MVP_ROADMAP.md#17-open-questions) |

### Phase 7 — launch readiness (38 open questions)

| ID | Question | What is needed | Cluster | Source |
|---|---|---|---|---|
| `OQ-09` | Monthly infrastructure budget? | set the monthly infrastructure budget, which also settles the Vercel tier (`OQ-D2`) | `vercel-tier` | [PRODUCT_REQUIREMENTS §12](./PRODUCT_REQUIREMENTS.md#12-open-questions) |
| `OQ-PA3` | Do we need an analytics pipeline separate from operational data? | decide whether analytics needs a pipeline separate from operational data | — | [PRODUCT_ARCHITECTURE §16](./PRODUCT_ARCHITECTURE.md#16-open-questions) |
| `OQ-DB2` | Keep libSQL or migrate to Turso Database before launch? | decide libSQL vs Turso Database before launch; the vendor hedge is already recorded | — | [DATABASE_SCHEMA §18](./DATABASE_SCHEMA.md#18-open-questions) |
| `OQ-DB6` | Do questions need a stable external id for import/export? | decide whether import/export needs a stable external id | — | [DATABASE_SCHEMA §18](./DATABASE_SCHEMA.md#18-open-questions) |
| `OQ-CM3` | Is `video` self-hosted in future, or provider-embedded only? | decide whether any video is self-hosted (storage cost vs privacy) | — | [CONTENT_MODEL §14](./CONTENT_MODEL.md#14-open-questions) |
| `OQ-QE7` | Is an essay/manual-review queue in year one? | decide whether essay/manual review is in year one | — | [QUESTION_ENGINE §17](./QUESTION_ENGINE.md#17-open-questions) |
| `OQ-API2` | Publish the generated `openapi.json` publicly (third-party clients), or serve it in non-production only? | decide whether the generated document is served publicly; generation itself is already a Phase 1 gate | — | [API_CONTRACTS §17](./API_CONTRACTS.md#17-open-questions) |
| `OQ-API5` | Should studio endpoints live under a separate host? | decide whether the studio moves to a separate host before the security review | — | [API_CONTRACTS §17](./API_CONTRACTS.md#17-open-questions) |
| `OQ-API7` | Do we expose a public "recently published" feed? | decide whether a recently-published feed is worth the crawler load | — | [API_CONTRACTS §17](./API_CONTRACTS.md#17-open-questions) |
| `OQ-S6` | Should search results include a generated answer/summary? | decide whether results include a generated answer (not MVP) | — | [SEARCH_ARCHITECTURE §16](./SEARCH_ARCHITECTURE.md#16-open-questions) |
| `OQ-J2` | Do we add Upstash Workflow for bulk content import with approval steps? | decide whether bulk import needs approval steps (Upstash Workflow); import is not in MVP | — | [BACKGROUND_JOBS §14](./BACKGROUND_JOBS.md#14-open-questions) |
| `OQ-SEO2` | Do we invest in keyword research tooling before launch? | decide whether keyword research tooling is bought before launch | — | [SEO_AND_CONTENT_STRATEGY §10](./SEO_AND_CONTENT_STRATEGY.md#10-open-questions) |
| `OQ-SEO3` | Is a blog/learning-hub content type in scope within 6 months? | decide whether a blog/learning hub ships within 6 months | — | [SEO_AND_CONTENT_STRATEGY §10](./SEO_AND_CONTENT_STRATEGY.md#10-open-questions) |
| `OQ-SEO5` | Do we need author bio pages for E-E-A-T signals? | decide whether public author bio pages are needed | — | [SEO_AND_CONTENT_STRATEGY §10](./SEO_AND_CONTENT_STRATEGY.md#10-open-questions) |
| `OQ-DS1` | Is dark mode required within 12 months? | decide whether dark mode ships within 12 months | — | [DESIGN_SYSTEM §15](./DESIGN_SYSTEM.md#15-open-questions) |
| `OQ-R4` | Beta cohort before public launch? | decide whether a beta cohort precedes public launch | — | [MVP_ROADMAP §17](./MVP_ROADMAP.md#17-open-questions) |
| `OQ-SEC3` | Should the studio be network-restricted (VPN/IP allow-list) in addition to roles? | decide whether the studio is additionally network-restricted | — | [SECURITY_AND_PERMISSIONS §17](./SECURITY_AND_PERMISSIONS.md#17-open-questions) |
| `OQ-SEC4` | Is a third-party WAF/CDN bot-protection subscription acceptable? | decide whether a WAF/CDN bot-protection subscription is bought | — | [SECURITY_AND_PERMISSIONS §17](./SECURITY_AND_PERMISSIONS.md#17-open-questions) |
| `OQ-SEC5` | What is the hosting provider's built-in DDoS posture for the chosen tier? | record the hosting tier's built-in DDoS posture as a risk acceptance | — | [SECURITY_AND_PERMISSIONS §17](./SECURITY_AND_PERMISSIONS.md#17-open-questions) |
| `OQ-SEC6` | Do we need a documented data-retention schedule for audit logs beyond 400 days (regulatory)? | decide whether audit retention must exceed 400 days | — | [SECURITY_AND_PERMISSIONS §17](./SECURITY_AND_PERMISSIONS.md#17-open-questions) |
| `OQ-T2` | Do we add visual regression (Playwright screenshots) after Phase 1? | decide whether visual regression is added after Phase 1 | — | [TESTING_STRATEGY §13](./TESTING_STRATEGY.md#13-open-questions) |
| `OQ-T3` | Is a k6 smoke run required before launch? | decide whether a k6 smoke run gates launch | — | [TESTING_STRATEGY §13](./TESTING_STRATEGY.md#13-open-questions) |
| `OQ-D1` | Adopt Bun 1.4 (`bunVersion: "1.4.x"`) at launch or stay on `1.x`? | decide Bun 1.4 timing after the 1.x spike | `bun` | [DEPLOYMENT_AND_ENVIRONMENTS §12](./DEPLOYMENT_AND_ENVIRONMENTS.md#12-open-questions) |
| `OQ-D2` | Vercel plan tier (Hobby vs Pro) at launch? | state whether the launch is commercial (and therefore whether Pro's terms apply) | `vercel-tier` (control) | [DEPLOYMENT_AND_ENVIRONMENTS §12](./DEPLOYMENT_AND_ENVIRONMENTS.md#12-open-questions) |
| `OQ-D7` | Backup retention beyond 30 days? | decide whether backups must outlive 30 days (cost vs compliance) | — | [DEPLOYMENT_AND_ENVIRONMENTS §12](./DEPLOYMENT_AND_ENVIRONMENTS.md#12-open-questions) |
| `OQ-OBS2` | Is 90-day raw event retention enough before the first cohort analysis? | decide whether 90-day raw retention covers the first cohort analysis | — | [OBSERVABILITY_AND_ANALYTICS §13](./OBSERVABILITY_AND_ANALYTICS.md#13-open-questions) |
| `OQ-OBS5` | Is a public status page required at launch? | decide whether a public status page is required at launch | `status-page` (control) | [OBSERVABILITY_AND_ANALYTICS §13](./OBSERVABILITY_AND_ANALYTICS.md#13-open-questions) |
| `OQ-PR1` | ~~Minimum age?~~ Recommended 16, self-attested ([ADR-034](./ARCHITECTURE_DECISIONS.md#adr-034--minimum-age-16-self-attested-no-date-of-birth-stored)); the recommendation is decided, the jurisdiction's consent age is not | counsel's confirmation of the consent age, which may force 18+ or a parental-consent flow | `age` | [PRIVACY_AND_DATA_PROTECTION §13](./PRIVACY_AND_DATA_PROTECTION.md#13-open-questions) |
| `OQ-PR5` | Who is the named data controller and what is the contact address? | name the data controller and the contact address | — | [PRIVACY_AND_DATA_PROTECTION §13](./PRIVACY_AND_DATA_PROTECTION.md#13-open-questions) |
| `OQ-OPS1` | Is a paid uptime monitor (external, 1-minute) required at launch? | decide whether a paid 1-minute uptime monitor is required | — | [OPERATIONS_RUNBOOK §6](./OPERATIONS_RUNBOOK.md#6-open-questions) |
| `OQ-OPS2` | Do we publish a status page, or only an in-app banner? | decide status page vs in-app banner | `status-page` | [OPERATIONS_RUNBOOK §6](./OPERATIONS_RUNBOOK.md#6-open-questions) |
| `OQ-OPS3` | Who is the second person with production access? | name a second person with production access | — | [OPERATIONS_RUNBOOK §6](./OPERATIONS_RUNBOOK.md#6-open-questions) |
| `OQ-OPS4` | Should the nightly dump be encrypted with a separate key? | decide whether nightly dumps use a separate encryption key | — | [OPERATIONS_RUNBOOK §6](./OPERATIONS_RUNBOOK.md#6-open-questions) |
| `OQ-OPS5` | Is quarterly restore-drill frequency realistic for a solo team? | decide whether quarterly restore drills are realistic | — | [OPERATIONS_RUNBOOK §6](./OPERATIONS_RUNBOOK.md#6-open-questions) |
| `OQ-ED5` | Do we display provenance/licence per resource? | decide whether provenance/licence is displayed per resource | — | [EDITORIAL_GUIDE §14](./EDITORIAL_GUIDE.md#14-open-questions) |
| `OQ-I18N3` | Buy/build the translation review workflow (teacher reviewers)? | decide buy vs build the translation review workflow | — | [INTERNATIONALIZATION §10](./INTERNATIONALIZATION.md#10-open-questions) |
| `OQ-I18N4` | Accept machine-translated drafts with human review? | decide whether machine-translated drafts with human review are allowed | — | [INTERNATIONALIZATION §10](./INTERNATIONALIZATION.md#10-open-questions) |
| `OQ-I18N5` | Does the second locale also need a second curriculum taxonomy (national curriculum vs Cambridge)? | decide whether the second locale also needs its own curriculum taxonomy | — | [INTERNATIONALIZATION §10](./INTERNATIONALIZATION.md#10-open-questions) |

### post-MVP (3 open questions)

| ID | Question | What is needed | Cluster | Source |
|---|---|---|---|---|
| `OQ-03` | Free forever, or a paywall within 12 months? | decide free-forever vs a paywall (ADR-012 revisit) | `monetisation` | [PRODUCT_REQUIREMENTS §12](./PRODUCT_REQUIREMENTS.md#12-open-questions) |
| `OQ-07` | Single reviewer or two-person review for publish? | decide one- vs two-person publish review | — | [PRODUCT_REQUIREMENTS §12](./PRODUCT_REQUIREMENTS.md#12-open-questions) |
| `OQ-J5` | Do we need per-tenant job isolation later? | decide only if multi-tenancy is ever planned | — | [BACKGROUND_JOBS §14](./BACKGROUND_JOBS.md#14-open-questions) |

### Not phase-tagged in the source row (1 open question)

These rows carry no phase; the `Blocks` cell in the source row says why nothing in the plan waits on it.

| ID | Question | What is needed | Cluster | Source |
|---|---|---|---|---|
| `OQ-08` | Right-to-left or non-Latin script support in 12 months? | decide whether RTL or non-Latin scripts are needed within 12 months | — | [PRODUCT_REQUIREMENTS §12](./PRODUCT_REQUIREMENTS.md#12-open-questions) — blocks: *Nothing in MVP — **no blocking phase:** layouts already use logical CSS properties and `IA-12` transliterates non-Latin titles, so no phase waits on this; it only sizes a later typography effort* |

### 8.1 Question clusters

15 clusters cover 32 of the 130 open rows; the rest stand alone. They are listed together so an answer lands once and propagates; the duplicate rows keep their own wording because each records a different consequence, and none of them is deleted.

| Cluster | Rows | Answer lands in | Note |
|---|---|---|---|
| `deletion` | `D-05`, `OQ-06`, `OQ-DB4`, `OQ-SEC1` | §5 `D-05` | One policy call — whether deletion anonymises or erases attempts — seen from legal, schema and permission sides. `OQ-PR3` already fixed the *implementation* (anonymise, with a hard-delete branch specified in `PRIVACY_AND_DATA_PROTECTION.md` §5.2); do not reopen it. |
| `bahasa` | `OQ-04`, `OQ-I18N2`, `OQ-R6`, `OQ-S1` | `OQ-04` | Four documents ask whether Indonesian is in the launch corpus. `OQ-04` is the product call; the others restate only the consequence for their area. |
| `market` | `OQ-01`, `OQ-SEO1`, `OQ-ED1`, `OQ-UX1` | `OQ-01` | Spelling, `lang`, hreflang and UI copy all follow the launch market. `D-03` tracks the same row for curriculum seeding. |
| `paths` | `OQ-IA3`, `OQ-SEO6` | `OQ-IA3` | Indexable filtered paths and `/subjects/{group}` are the same page-type decision; `SEO_AND_CONTENT_STRATEGY.md` says so inline. |
| `practice-url` | `OQ-IA6`, `OQ-UF6` | `OQ-IA6` | Anchor versus own URL for a lesson's practice section is one URL decision, currently specified both ways. |
| `downloads` | `OQ-11`, `OQ-CM2` | `OQ-11` | Whether a `download` block is gated by account or email. `OQ-11` is the product call; `CONTENT_MODEL.md` carries the content-model consequence. |
| `residency` | `D-07`, `OQ-D3`, `OQ-PR4`, `OQ-PA2` | §5 `D-07` | Region, data residency and a second read region are one answer about the launch audience and its legal requirements; the three rows are deployment, privacy and architecture views. |
| `status-page` | `OQ-OBS5`, `OQ-OPS2` | `OQ-OBS5` | A public status page versus an in-app banner is one operational surface, asked once for launch scope and once for on-call load. |
| `qdrant-tier` | `OQ-R5`, `OQ-S2` | `OQ-R5` | Whether Qdrant is paid at launch, asked as a budget question and as a latency/size measurement. The measurement decides the budget. |
| `bm25` | `OQ-PA5`, `OQ-S4` | `OQ-PA5` | Qdrant BM25 as a third result list versus keeping FTS5 as the lexical store — the same architecture choice from the caching and the search sides. |
| `vercel-tier` | `OQ-D2`, `OQ-09` | `OQ-D2` | The plan tier and the monthly budget are one number. `OQ-D2` is the provider-terms question (commercial use requires Pro); `OQ-09` is the amount. |
| `bun` | `D-06`, `OQ-D1` | §5 `D-06` | Bun 1.4 timing is tracked as a decision and restated as a deployment question. |
| `embedding` | `D-02`, `OQ-S5` | §5 `D-02` | Sign-off on ADR-026 and the fallback model if `e5-small` misses Recall@5 are the same budget decision. |
| `monetisation` | `D-04`, `OQ-03` | §5 `D-04` | Free forever versus a paywall is the same policy call, tracked from the product side. |
| `age` | `D-11`, `OQ-PR1` | §5 `D-11` | The 16+ recommendation is decided; the jurisdiction's consent age is not. `OQ-PR1` and `D-11` are the same open legal input. |
