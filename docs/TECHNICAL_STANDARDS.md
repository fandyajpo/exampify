# Technical Standards — Exampify

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Normative for all code |
| Depends on | [PRODUCT_ARCHITECTURE.md](./PRODUCT_ARCHITECTURE.md), [API_CONTRACTS.md](./API_CONTRACTS.md), [DEPLOYMENT_AND_ENVIRONMENTS.md](./DEPLOYMENT_AND_ENVIRONMENTS.md) |
| Referenced by | Every implementation task |

---

## 1. Purpose and scope

How code is written, typed, organised and reviewed. These are enforceable rules, not preferences: a pull request that violates a **MUST** is not merged.

**In scope:** language and compiler settings, typing, naming, structure, server/client boundaries, data access, validation, forms, errors, logging, styling, imports, runtime rules, git workflow, review checklist, performance.

**Out of scope:** test levels ([TESTING_STRATEGY.md](./TESTING_STRATEGY.md)), endpoints ([API_CONTRACTS.md](./API_CONTRACTS.md)), visual tokens ([DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)).

---

## 2. Stack (fixed)

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| UI runtime | React |
| Language | TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Styling | Tailwind CSS + design tokens |
| Animation | Motion (`motion/react`) |
| Client/server state | TanStack Query |
| Tables | TanStack Table |
| Forms | React Hook Form + `zodResolver` |
| Validation | Zod |
| Utilities | **Remeda** (`remeda`) |
| Database | Turso (libSQL) |
| Query builder | **Kysely** |
| DB driver | `@libsql/kysely-libsql` over `@libsql/client/web` |
| Auth | Better Auth |
| Media | Tigris (S3-compatible) |
| Jobs | Upstash QStash + Redis (rate limits, locks) |
| Search | Qdrant Cloud (dense) + Turso FTS5 (lexical) |
| Deployment | Vercel |
| Runtime | Bun (`bunVersion: "1.x"`, Node fallback) |

Adding a dependency requires: a documented reason, a check for an existing internal solution, confirmation that it works under Bun, and an entry in the PR description. Libraries that duplicate an existing one are rejected (a second form library, a second utility library, a second query builder, a second date library, a chart library in MVP).

---

## 3. TypeScript rules

### 3.1 Compiler settings (normative)

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "jsx": "preserve",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are non-negotiable: they eliminate two classes of runtime bug that matter here — array indexing in scoring and optional fields in API bodies.

### 3.2 `any` is forbidden

| Instead of | Use |
|---|---|
| `any` for an unknown payload | `unknown` + Zod parse |
| `as SomeType` on unvalidated data | `Schema.parse(data)` |
| `Record<string, any>` | `Record<string, unknown>` or a typed map |
| `@ts-ignore` | `@ts-expect-error` with a comment (rare, reviewed) |
| `Function` | an explicit signature |

`as const` and `satisfies` are encouraged. A type assertion is allowed only immediately after a runtime check that justifies it.

```ts
// BAD
const body = (await req.json()) as CreateAssessmentRequest;

// GOOD
const parsed = CreateAssessmentSchema.safeParse(await req.json());
if (!parsed.success) return validationError(parsed.error);
const body = parsed.data;
```

### 3.3 Types over interfaces

Use `type` for data shapes and unions. Reserve `interface` for declaration merging, which we do not use. Prefer discriminated unions over optional-field bags.

### 3.4 Explicit return types

- **Required** for every exported service, domain, adapter and route-handler function (`Promise<TopicHubDTO>`, not inferred).
- **Required** for exported pure algorithms (`gradeItem`, `selectQuestions`, `fuse`).
- Optional for components and small local callbacks, where inference is clearer than noise.

```ts
export async function getTopicHub(slugPath: SlugPath, actor: Actor | null): Promise<TopicHubDTO> { … }
export function gradeItem(question: GradableQuestion, answer: StudentAnswer): ItemResult { … }
```

The reason is review, not ceremony: a service's contract should be readable without opening its body, and an accidental `Promise<any>` must fail the build.

### 3.5 Exhaustiveness

Every `switch` over a union ends with a guard. A new enum value must fail the build, not silently fall through to "incorrect" or "no blocks rendered".

```ts
default: {
  const _exhaustive: never = block;
  throw new Error(`Unhandled block kind: ${JSON.stringify(_exhaustive)}`);
}
```

### 3.6 Derived types

- **Database row types** come from the hand-written Kysely `DB` interface (`Selectable<QuestionsTable>`), never from a spread of a query result.
- **API DTOs are declared explicitly**, never inferred from rows, so a column rename cannot silently change the public contract. One mapper per DTO.
- **Zod schemas own external input**; `.infer` is the only way to obtain a request type.

---

## 4. Naming and structure

### 4.1 Files

| Kind | Convention | Example |
|---|---|---|
| React component | `kebab-case.tsx`, named export | `question-card.tsx` → `QuestionCard` |
| Hook | `use-kebab-case.ts` | `use-attempt-runner.ts` |
| Service | `<domain>.service.ts` | `content.service.ts` |
| Repository/query module | `<domain>.queries.ts` | `content.queries.ts` |
| Zod schema | `<domain>.schema.ts` | `block.schema.ts` |
| Type-only | `<domain>.types.ts` | `search.types.ts` |
| Pure algorithm | descriptive noun | `scoring.ts`, `fusion.ts` |
| Route handler | `route.ts` (Next.js convention) | `app/api/v1/search/route.ts` |
| Migration | `NNNN_snake_case.ts` | `0007_add_search_tables.ts` |
| Test | `<subject>.test.ts` / `.test.tsx` | `scoring.test.ts` |

### 4.2 Identifiers

| Element | Style |
|---|---|
| Variable / function | `camelCase` |
| Type / component | `PascalCase` |
| Module-level immutable constant | `SCREAMING_SNAKE_CASE` |
| Boolean | `is*`, `has*`, `can*`, `should*` |
| Async function | verb phrase — `getTopic`, `submitAttempt` (no `Async` suffix) |
| Event handler prop | `onX`; implementation `handleX` |
| Zod schema | `XSchema`; inferred type `X` |
| Query-key factory | `xKeys` |

### 4.3 Directory rules

```
src/app         routing + composition only (no business logic)
src/features    feature UI + hooks (may import lib)
src/components  UI primitives + composed patterns (no data fetching)
src/lib         db, auth, rbac, validation, services, search, jobs, storage, seo, markdown
```

**Forbidden imports (review-blocking):**

- `lib/**` importing from `app/**` or `features/**`.
- `components/**` importing a service, a query module or the DB client.
- `features/a/**` importing `features/b/**` internals.
- Client components importing `lib/db`, `lib/services`, `lib/auth`, `lib/storage`, `lib/jobs`, or anything with `server-only`.

`import 'server-only'` marks every server module so the bundler enforces the boundary that review would otherwise police.

### 4.4 Remeda conventions

- Use `pipe` with data-last helpers for multi-step transforms.
- Use data-first form for a single call (`uniqueBy(items, fn)`).
- Do not wrap Remeda functions in local helpers that add nothing; do write a named helper when the composition encodes a domain rule.
- `es-toolkit` is not a dependency and must not be reintroduced.

---

## 5. Server/client boundaries

### 5.1 Default to server

- A component is a server component unless it needs state, effects, event handlers, browser APIs, or a client-only library.
- `'use client'` goes at the **leaf**, not at the top of a page. A page must not become a client component because one button is interactive.
- Only serialisable props cross the boundary (no functions, no `Date`, no class instances).
- Initial-render data belongs to the server component; TanStack Query is for **subsequent client-side state**, not for data already in the RSC payload.

### 5.2 Client data rules

- One query-key factory per domain, colocated with its hooks.
- `staleTime` is explicit on every query: content 5 min, dashboard 30 s, attempt 0, studio lists 0.
- Mutations invalidate the specific keys they affect; no blanket `invalidateQueries()`.
- No `useEffect` that fetches. If you need data, use a query.
- No global state store. Lift state or use the query cache; prefer `useState` in a parent unless prop drilling exceeds two levels.

### 5.3 Interaction feedback

Every mutation renders three states: pending (disabled + spinner), error (inline message with retry), success (optimistic update or invalidation). A mutation with no error state is incomplete.

---

## 6. Validation

- Zod is the single source of truth. A type describing external input **must** come from a schema.
- Schemas live in `lib/validation` and are imported by the route handler, the form and the test. A duplicated schema is a defect.
- All request schemas use `.strict()`; unknown keys are errors.
- Query parameters are parsed from `URLSearchParams` through a schema with coercion (`z.coerce.number()`), never read ad hoc.
- **Persisted JSON is validated on read and write**: `answer_key`, block payloads, `config`, `selected_answer`, `feedback`, `learning_objectives`.
- Form and server schemas are the same object where payloads match; where they differ, compose with `.pick`/`.extend`.
- Error messages are written for humans and attached to field paths.

```ts
export const CreateChapterSchema = z.object({
  subjectId: z.string().uuid(),
  title: z.string().trim().min(1, 'Give the chapter a title').max(100, 'Keep it under 100 characters'),
  slug: SlugSchema.optional(),
  summary: z.string().trim().max(240).nullish(),
  position: z.number().int().min(0).max(999).optional(),
}).strict();
export type CreateChapterRequest = z.infer<typeof CreateChapterSchema>;
```

### 6.1 Database value conventions

The database stores what SQLite can index and compare; the API speaks JSON. Conversion happens in exactly one mapper per entity.

| Concept | In DB | In API | Rule |
|---|---|---|---|
| Timestamps | `INTEGER` epoch ms | ISO-8601 string | `fromEpochMs`/`toEpochMs` only in mappers |
| Booleans | `INTEGER` 0/1 | `boolean` | Never rely on SQLite truthiness; compare to 1 |
| IDs | `TEXT` UUID v7 | string | Generated by `lib/ids.ts`, never by the DB |
| Points/scores | `INTEGER` hundredths | `number` (points) / `number` (percent) | Never a float in DB or in scoring |
| Enums | `TEXT` + `CHECK` | union | One canonical union per enum in `lib/db/enums.ts` |
| JSON | `TEXT` | object | Parse → Zod → domain type |

**Money-like arithmetic:** all scoring uses integers. `points_x100` of 100 = 1 point; partial credit `(hits − misses) / |correct|` is computed as `Math.round(100 * (hits - misses) / correct.length)` once, at the leaf, then summed. No `toFixed` in the domain; formatting is a presentation concern.

---

## 7. Forms

- React Hook Form + `zodResolver` with the shared schema.
- `defaultValues` always provided (never `undefined` inputs → controlled/uncontrolled warnings).
- `mode: 'onBlur'` for text, `onChange` only for live counters.
- Server field errors applied with `setError(path, { message })` from `details[]`; unknown errors go to a form-level banner.
- Submit handler: validate → mutate → on success invalidate + toast/redirect; on error map fields.
- Never disable submit for validation reasons on first render; disable only while pending.
- The block editor and the question editor share the same schemas as the API — a form that accepts what the server rejects is a defect.

---

## 8. Error handling

### 8.1 Layers

| Layer | Responsibility |
|---|---|
| Route handler | Parse, authorise, call service, map errors to the documented status/code |
| Service | Throw typed `AppError` for expected failures (`NotFoundError`, `ConflictError`, `PublishGateError`) |
| UI | Render inline/banner per error class; never swallow |
| Global | `error.tsx` per segment + `global-error.tsx`; report with `requestId` |

### 8.2 Rules

- No empty `catch`. If an error is intentionally ignored, log it and say why.
- Never expose database or library messages to clients. `AppError` carries a public `code` and a safe `message`.
- Narrow `unknown` with `instanceof` or a schema before use.
- Boundary errors include a retry action; `reset()` for transient failures.
- Expected domain failures are values at the UI boundary: `NO_QUESTIONS_MATCH` renders guidance, not a crash.
- **SQLite/driver errors are never surfaced.** A `SQLITE_CONSTRAINT` is mapped to the domain conflict it represents (`SLUG_TAKEN`, `INVALID_TRANSITION`).

```ts
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
    readonly details?: FieldError[],
  ) { super(message); this.name = 'AppError'; }
}
```

---

## 9. Data access rules (Kysely + libSQL)

- All database access goes through `lib/db` and `lib/services`. No SQL in components or route handlers.
- One `Kysely<DB>` instance per process, created from a `@libsql/client/web` client; never construct a client per request.
- **Parameterised queries only.** `sql` template literals take bound parameters (`sql\`x = ${value}\``); string interpolation into SQL is forbidden.
- **Explicit column projections.** `selectAll()` on `questions` is a defect — it fetches `answer_key`. Student-facing reads select named columns.
- `PRAGMA foreign_keys = ON` is asserted at startup (throws if off) and after every new connection in scripts.
- Transactions: `db.transaction().execute(async (trx) => …)` for multi-write operations; no external HTTP call inside a transaction.
- Write contention: keep transactions short, set `busy_timeout`, and prefer a conditional `UPDATE … WHERE status = 'in_progress'` over read-then-write.
- **No `OFFSET` pagination** on unbounded lists; keyset cursors only.
- No N+1: a list of N items loads its children with one join or one `WHERE IN`, never a loop.
- No Postgres-isms: no `RETURNING` reliance, no `ILIKE`, no `::casts`, no `now()`, no array operators, no `ON CONFLICT … DO UPDATE` with excluded-column semantics beyond the documented subset (verify per statement).
- Every new query that filters or sorts must have its index reviewed with `EXPLAIN QUERY PLAN` in the PR.

```ts
// GOOD — explicit projection, bound parameter, keyset pagination
const rows = await db.selectFrom('learning_resources')
  .select(['id', 'slug', 'title', 'reading_minutes', 'difficulty'])
  .where('topic_id', '=', topicId)
  .where('status', '=', 'published')
  .where('position', '>', cursor ?? -1)
  .orderBy('position').orderBy('id')
  .limit(limit + 1)
  .execute();
```

---

## 10. Runtime rules (Bun / Vercel)

- No `engines.node` in `package.json`; `bunVersion` controls the runtime.
- `bun run --bun next build|dev` — the `--bun` flag is mandatory for ISR parity.
- No Edge runtime in MVP. A route that needs Node APIs declares `export const runtime = 'nodejs'`.
- No Node-only module (`fs`, `path` for runtime work, `crypto` from `node:`) in a request path; use Web APIs (`crypto.randomUUID`, `fetch`, `Request`/`Response`).
- Import `@libsql/client/web`, never the native entry, in anything deployed.
- Never hold state in module scope across requests except immutable configuration and a bounded LRU (documented with its size).
- Long work goes to a job (`BACKGROUND_JOBS.md`), never to a request that a user is waiting on.
- Every external call has an `AbortSignal` timeout: Turso 3 s, Qdrant 1.5 s, Tigris 5 s, email 10 s.

---

## 11. Storage and media rules

- All media access through `lib/storage`; no `@aws-sdk/client-s3` import outside it.
- Never accept a client-supplied storage key or URL; the server generates keys.
- Presigned PUT: 5 minutes, exact `Content-Type` and `Content-Length` in the signature.
- Presigned GET (private): ≤ 10 minutes, generated per request, never persisted in a DTO.
- Validate type by magic bytes **after** upload (`HEAD` + first bytes), not only by the client-declared MIME.
- SVG is sanitised server-side before it is considered `ready`.
- Deleting is soft and reference-checked; only the purge job touches blob deletion.
- Public assets render through `next/image` with explicit dimensions; private assets use `<img>` and are never sent to the image optimiser.

---

## 12. Logging and observability

- Structured JSON only; no `console.log` in application code (lint error). Use the shared `logger` with `level`, `event` and context.
- Log at boundaries: request start/end (route, status, duration), external calls, job runs.
- Never log secrets, tokens, cookies, `answer_key`, passwords, full request bodies, or raw email addresses.
- Include `requestId` on every line in a request scope; jobs log `eventId`.
- Client errors are reported through the error boundary with the release version.
- A slow query (> 100 ms) logs its shape (table, operation, duration) without parameter values.

---

## 13. Styling

- Tailwind utilities + design tokens only. No raw hex, no arbitrary colours (`bg-[#fff]` is a defect; `bg-paper` is correct).
- `cn()` (clsx + tailwind-merge) for conditional classes; no string concatenation.
- Component variants via a small local variant map or `class-variance-authority` if adopted deliberately; no six-branch `if` chains producing class strings.
- Mobile-first (`base`, then `md:`/`lg:`); no `max-*` overrides unless unavoidable.
- No inline `style` except dynamic values (`--subject-ink`, progress width), each with a comment.
- No dark mode in MVP; do not add `dark:` variants.
- Three content-type badges (`study_material`, `lesson_with_practice`, `practice_test`) use the token set in `DESIGN_SYSTEM.md` §6.4 — never ad-hoc colours.

---

## 14. Imports and formatting

- Order: node builtins → external → internal (`@/lib`, `@/components`, `@/features`) → relative → styles.
- Type-only imports use `import type`.
- No barrel files across features; `components/ui/index.ts` is the only allowed barrel.
- Prettier: 100 cols, single quotes, trailing commas, 2-space indent.
- ESLint: `next/core-web-vitals`, type-checked `@typescript-eslint`, `import/no-cycle`, `jsx-a11y`, plus a custom rule banning `selectAll()` outside `lib/db` internals.
- `bun run check` runs typecheck + lint + unit tests; CI runs the same.

---

## 15. Performance rules (code level)

| Rule | Rationale |
|---|---|
| No client component wrapping a whole page | Hydration cost on mobile |
| `next/image` with explicit dimensions | Prevents CLS |
| Fonts via `next/font`, `display: swap` | No FOIT, no external request |
| Motion imports only used features (`motion/react`) | Bundle size |
| No layout animation on lists > 20 items | Jank |
| `loading.tsx` per streamed route; skeleton matches layout | Perceived speed |
| Cache tags on every public read path | Correct invalidation instead of blanket `no-store` |
| Server components await in parallel (`Promise.all`) | Avoids waterfalls |
| No `useEffect` fetching | Prevents double fetches and races |
| ≤ 6 SQL statements per page render | Query-budget test |
| No embedding call on a keystroke | Autocomplete is prefix-only |

---

## 16. Git and review workflow

### 16.1 Commits

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`.
- Scope by area: `feat(attempts): add retry`.
- One logical change per commit; schema + service + test ship together when they must.

### 16.2 Branches and PRs

- Branch from `main`: `feat/attempt-runner`, `fix/slug-redirect`.
- PRs are small (target < 400 changed lines) and state: what changed, why, how verified, doc updates, and any migration's row-count assumption.
- A migration gets its own PR when it is large, destructive, or contains a table rebuild.
- A PR that changes an entity, endpoint, token or flow updates the relevant `/docs` file in the same PR.

### 16.3 Review checklist

- [ ] Types: no `any`, no unjustified `as`, exhaustiveness guards intact, explicit return types on services.
- [ ] Boundaries: server/client split respected; `server-only` not leaking.
- [ ] Validation: input parsed with a shared schema; unknown keys rejected; persisted JSON validated on read.
- [ ] Authorisation: capability **and** ownership checked in the service, not only in the route.
- [ ] Answer-key protection: no new path selects or serialises `answer_key` for a student.
- [ ] Data access: explicit columns, no `selectAll()` on questions, no N+1, no `OFFSET`, index reviewed.
- [ ] Transactions: short, no external calls inside, conditional updates for state transitions.
- [ ] Runtime: no Node-only API, no native libSQL import, timeouts on external calls.
- [ ] Storage: no client-supplied keys, presign expiry within policy.
- [ ] Errors: typed, mapped to documented codes, no driver text leaked.
- [ ] Accessibility: labels, focus, keyboard path, contrast pair documented.
- [ ] Mobile: verified at 360 px.
- [ ] Tests: logic has a unit test; a bug fix has a regression test.
- [ ] Docs: updated if a contract changed.

---

## 17. Anti-patterns (rejected in review)

| Anti-pattern | Why |
|---|---|
| `data: any` from `fetch` | Unvalidated external data |
| Business logic in a page component | Untestable, duplicable |
| `useEffect` + `fetch` | Races, no caching, duplicate requests |
| Client component for a static section | Wasted JS |
| `selectAll()` on `questions` | Leaks `answer_key` |
| String-interpolated SQL | Injection |
| `ORDER BY RANDOM()` | Full sort per request |
| `OFFSET` pagination on a growing table | Slow and unstable |
| Ad-hoc `if (status === 'published')` everywhere | One `visible()` helper instead |
| Global store for one screen | Unnecessary indirection |
| Duplicated Zod schemas | Contract drift |
| `catch (e) {}` | Silent failures |
| Raw hex colours | Breaks the design system |
| Postgres SQL copied into a migration | Fails on libSQL |
| Redis as a content cache | Second source of truth |
| Publishing to a queue inside a DB transaction | Indexes rolled-back content |
| `toFixed` on a score before storage | Float drift |

---

## 18. Dependencies on other modules

- Code standards depend on ADR-016 (platform), ADR-020 (Kysely), ADR-025 (Bun) and ADR-009 (REST contract).
- Boundary rules depend on the module map in `PRODUCT_ARCHITECTURE.md` §6.
- Error codes are shared with `API_CONTRACTS.md` §2.1 — a new code is added there first.
- Runtime rules depend on `DEPLOYMENT_AND_ENVIRONMENTS.md` §2.

---

## 19. Edge cases

| # | Case | Rule |
|---|---|---|
| TS-01 | A third-party type is missing | Write a minimal local declaration; do not `any` it |
| TS-02 | Server returns an unexpected shape | Parse with the response schema; on failure throw a typed error rather than rendering partial data |
| TS-03 | An enum value added to the DB but not the union | The union is the source; `CHECK` and union are updated in the same migration, and exhaustiveness catches the rest |
| TS-04 | A client component needs a server action | Route handler + mutation hook (ADR-009); do not mix patterns |
| TS-05 | A shared component needs data | Pass it in; never fetch inside a `components/ui` primitive |
| TS-06 | A query is needed for the initial paint | Move the fetch to the server and pass `initialData` |
| TS-07 | A DB error must be shown | Map to a documented `code`; never surface raw text |
| TS-08 | A new optional field in a response | Additive is allowed in v1; consumers tolerate absence |
| TS-09 | Kysely type and DB drift | `bun run db:types:check` compares the `DB` interface to `PRAGMA table_info` in CI |
| TS-10 | A `Remeda` helper returns a widened type | Add the generic explicitly; do not cast the result |
| TS-11 | A Bun incompatibility appears in one dependency | Pin that route to `nodejs` runtime, open an ADR note; do not fork the app |
| TS-12 | An integer score looks wrong by 1 | Check rounding at the leaf, not at the sum |

---

## 20. Acceptance criteria

1. `tsc --noEmit` passes with §3.1 flags.
2. Zero occurrences of `any`, `@ts-ignore`, and non-null assertions on external data in `src/`.
3. Every exported service/domain function has an explicit return type.
4. Every route handler validates with a shared Zod schema and maps errors to `API_CONTRACTS.md` codes.
5. Every switch over a union has an exhaustiveness guard.
6. `import 'server-only'` is present in `lib/db`, `lib/services`, `lib/auth`, `lib/storage`, `lib/jobs`.
7. No raw hex colours and no inline styles except documented dynamic tokens.
8. No `console.log`; the logger is used.
9. No `selectAll()` on `questions` outside the grader's explicit projection module (lint-enforced).
10. Every mutation renders pending, error and success states.
11. No SQL string interpolation; no `OFFSET`; no native `@libsql/client` import.
12. `bun run check` passes locally and in CI before merge.

---

## 21. Open questions

| # | Question | Impact |
|---|---|---|
| OQ-TS1 | Adopt `class-variance-authority` for variants, or keep a local map? | Component API consistency — **Open — needs:** decide CVA vs a local variant map; **blocks Phase 1**. |
| OQ-TS2 | Add `eslint-plugin-boundaries` to enforce the module graph automatically? | Tooling effort vs review burden — **Open — needs:** decide whether `eslint-plugin-boundaries` is adopted; **blocks Phase 1**. |
| OQ-TS3 | Do DTO mappers live in `lib/services/mappers` or beside each service? | File organisation — **Open — needs:** decide where DTO mappers live; **blocks Phase 1**. |
| OQ-TS4 | Is the strict flag set workable with Better Auth's generated types? | May require thin local wrappers — **Open — needs:** verify strict mode against Better Auth's generated types in the spike; **blocks Phase 1**. |
| OQ-TS5 | Conventional-commit automation for release notes, or format enforcement only? | CI tooling — **Open — needs:** decide conventional-commit automation vs format-only enforcement; **blocks Phase 1**. |
| OQ-TS6 | Does the Kysely `DB` interface get generated from `PRAGMA table_info`, or hand-maintained? | Drift risk vs build complexity — **Open — needs:** decide generated vs hand-maintained Kysely `DB` types; **blocks Phase 1**. |
