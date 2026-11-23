# Observability and Analytics — Exampify

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Proposed |
| Depends on | [PRODUCT_ARCHITECTURE.md](./PRODUCT_ARCHITECTURE.md), [BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md), [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [PRIVACY_AND_DATA_PROTECTION.md](./PRIVACY_AND_DATA_PROTECTION.md) |
| Referenced by | [DEPLOYMENT_AND_ENVIRONMENTS.md](./DEPLOYMENT_AND_ENVIRONMENTS.md), [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md), [MVP_ROADMAP.md](./MVP_ROADMAP.md) |

---

## 1. Purpose and scope

How we find out that something is broken, and how we find out whether the product works. Two questions, deliberately separated:

- **Reliability signals** — errors, logs, traces, health, SLOs. Answer: *is the system serving correctly right now?*
- **Product signals** — a small, closed taxonomy of server-authoritative usage events. Answer: *do students actually read, practise and come back?*

**In scope:** error tracking, structured logging, request correlation, SLOs and alerts, the product-event taxonomy, ingestion, storage and retention, the handful of dashboards that matter, and how all of it is tested.

**Out of scope:** marketing attribution, third-party analytics, A/B testing infrastructure, session replay (explicitly rejected), log-based alerting on individual users.

**Governing rule:** the platform has **no third-party analytics script**. Every product metric is computed from our own database by a server route. That is a privacy decision ([PRIVACY_AND_DATA_PROTECTION.md](./PRIVACY_AND_DATA_PROTECTION.md)) and an accuracy decision — ad blockers cannot silently delete half the funnel.

---

## 2. Signal map

| Signal | Question it answers | Mechanism | Retention | Cost model |
|---|---|---|---|---|
| Errors | What is throwing, and for whom? | Error-tracking SDK (`ERROR_TRACKING_DSN`), `instrumentation.ts`, `error.tsx` | 30 days | Free tier sufficient at MVP volume |
| Logs | What happened in this specific request? | Structured JSON to Vercel logs, one line per request and per job | 1–3 days (platform) | Included |
| Traces | Where did the time go? | `requestId` correlation + slow-operation logs (> 100 ms DB, > 500 ms Qdrant) | Same as logs | Included |
| Health | Is the system up and is the index fresh? | `GET /api/v1/health` | Live | Included |
| Product events | Do students learn and practise? | `usage_events` in Turso, written server-side | 90 days | Turso row writes |
| Business counters | Content and attempt volume | SQL over existing tables (`learning_resources`, `assessment_attempts`) | Indefinite | Turso reads (cached) |

**Why product events live in Turso and not in a vendor:** the events are small, relational to our entities, and must join against content to be useful ("which topics have readers but no attempts?"). A separate analytics store would duplicate identity, break joins and add a subprocessor. At MVP volume a single indexed table is cheaper and more accurate.

---

## 3. Error tracking

**Vendor: Sentry** (`@sentry/nextjs`), [ADR-032](./ARCHITECTURE_DECISIONS.md#adr-032--sentry-for-error-tracking-and-source-maps). The free Developer plan (one user, 5,000 errors/month, 5 GB logs) is enough **because** §3.4 keeps expected control-flow errors out of the feed. Session replay is disabled. `ERROR_TRACKING_DSN` empty means disabled locally; production fails at boot if it is missing. Source maps upload during `next build` via `withSentryConfig` with `SENTRY_AUTH_TOKEN`, and are removed from build output afterwards.

**If this vendor is ever replaced**, the requirements in §3.1–§3.4 are the contract, not the SDK: any tracker must accept a fingerprint, a release, a route pattern, a `requestId` and a `beforeSend` redaction hook. Otherwise the replacement is a downgrade.

### 3.1 Where errors are captured

| Layer | Capture point | Notes |
|---|---|---|
| Server components / route handlers | `instrumentation.ts` (`onRequestError`) + a `withErrorBoundary` wrapper on `/api/v1` handlers | Framework-reported errors are forwarded, not re-caught |
| Client components | `error.tsx` per route segment, plus `global-error.tsx` | Reports once per error id, not per render |
| Background jobs | Job wrapper: any thrown error is reported **and** recorded in `job_runs` | The QStash retry is the recovery path |
| Build/runtime config | `lib/env.ts` throws at boot | A misconfigured deploy fails loudly instead of half-working |

### 3.2 What an error report contains

`requestId`, route pattern (not the raw URL with ids), release (`VERCEL_GIT_COMMIT_SHA`), runtime (`bun`/`node`), user id **only when signed in** and never the email, error name/message/stack, breadcrumbs limited to `{type, route, status}`.

### 3.3 What it must never contain

Email addresses, session tokens, presigned URLs, `answer_key`, `answer_json`, grading payloads, raw search queries, request bodies. A redaction list is applied in the SDK's `beforeSend` hook; the security review checks it (`SECURITY_AND_PERMISSIONS.md` §12).

### 3.4 Fingerprinting and noise control

- Fingerprint = `error.name + top stack frame in our code + route pattern`. Third-party frames are ignored so a provider outage groups into one issue, not thousands.
- Expected control-flow errors (`NotFoundError`, `ConflictError`, `RateLimitedError`, zod validation failures) are **not** reported as errors — they are counted as metrics. Otherwise the error feed becomes useless within a week.
- A deploy that increases the error rate by > 1 % for 10 minutes auto-creates one issue per fingerprint, not one per occurrence.

---

## 4. Structured logging

One JSON object per line. `console.log` is banned outside `lib/log.ts` (lint rule).

| Field | Type | Always | Notes |
|---|---|---|---|
| `level` | `debug` \| `info` \| `warn` \| `error` | yes | `debug` suppressed in production |
| `msg` | string | yes | Short, stable, no interpolation of user data |
| `requestId` | string | yes in requests | Also returned to the client in errors |
| `route` | string | in requests | Route pattern (`/api/v1/attempts/[id]`), not the URL |
| `method` | string | in requests | |
| `status` | number | in requests | |
| `durationMs` | number | in requests | |
| `userId` | string \| null | when known | Never email |
| `job` | string | in jobs | Job name |
| `eventId` | string | in index jobs | `search_events.id` |
| `attempts` | number | in retried jobs | |
| `error` | `{name, message, code}` | on failure | No stack in logs (the tracker has it) |

Rules:

- **One completion line per request**, emitted in a `finally`; early returns must still log.
- **Slow-operation lines** are separate: `db.slow` > 100 ms, `qdrant.slow` > 500 ms, `storage.slow` > 1 s, with the statement *name* (not the SQL) and row count.
- Sampling: `info` at 100 % in preview, 100 % in production until traffic forces sampling; when it does, errors and writes stay at 100 %, reads sample at 10 %.
- Log volume guard: a route that logs more than 5 lines per request fails review.

---

## 5. SLOs and alerts

| SLI | Definition | Target | Alert |
|---|---|---|---|
| Availability | Non-5xx responses on public pages + `/api/v1` | 99.5 % / 30 days | 5xx > 2 % for 5 min |
| Content latency | p95 TTFB on ISR content pages | < 500 ms | p95 > 1.5 s for 10 min |
| Attempt save | p95 `PATCH /api/v1/attempts/{id}/answers` | < 300 ms | p95 > 800 ms for 10 min |
| Search latency | p95 `/api/v1/search` | < 800 ms | p95 > 2 s for 10 min |
| Search availability | Search returns `degraded: false` | 99 % | degraded for 15 min |
| Index freshness | `indexLagSeconds` on `/health` | < 300 s | > 900 s for 10 min |
| Job health | DLQ depth | 0 | any DLQ message |
| Auth failure spike | Sign-in failures / attempts | — | > 40 % over 100 attempts in 10 min (credential stuffing signal) |
| Email delivery | Provider accepted / sent | > 99 % | two consecutive failures for the same template |

Alerts route to one channel with a link to the matching [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) entry. An alert without a runbook entry is not allowed — it will be ignored at 3 a.m.

**Error budget:** at 99.5 % availability the monthly budget is ~3.6 h. Spending more than half of it before launch blocks new feature work in favour of reliability fixes.

---

## 6. Product event taxonomy

### 6.1 Design rules

1. **Server-authoritative.** The browser never decides that an attempt was submitted or a resource was read; it reports *intent*, the server records the fact. Client events are used only for UI-level signals (impressions, clicks) that have no server equivalent.
2. **Closed vocabulary.** Event names come from a frozen list in `lib/analytics/events.ts`; the Zod schema is the contract and the database `CHECK`-free column relies on it. Adding an event is a documented change, not an ad-hoc `track('whatever')`.
3. **Snake-free, past tense, `object_action`.** `resource_viewed`, not `viewResource` or `resource_view`.
4. **No free text.** Property values are ids, enums, numbers or booleans. A search query is recorded as `queryLength` and `hadCorrection`, never as the text.
5. **No PII, ever.** No email, no name, no IP, no user agent string (a coarse `deviceClass` is allowed).
6. **Stable ids only.** `entityId` must be a UUID from our system; slugs appear only where a slug *is* the entity reference.

### 6.2 The list (MVP)

| Event | Emitted by | Properties | Used for |
|---|---|---|---|
| `resource_viewed` | Server (render of a published resource) | `resourceId`, `topicId`, `format` | Read-vs-practise ratio, depth |
| `attempt_started` | Server (create attempt) | `attemptId`, `assessmentId`, `mode`, `questionCount` | Practice funnel |
| `attempt_submitted` | Server (submit) | `attemptId`, `mode`, `scoreX100`, `durationSeconds`, `itemsCorrect`, `itemsTotal` | Score distribution, timing |
| `attempt_abandoned` | Server (explicit exit) | `attemptId`, `answeredCount` | Drop-off in the runner |
| `answer_revealed` | Server (practice mode only) | `attemptId`, `questionId` | Is instant feedback being used? |
| `search_performed` | Server (`/api/v1/search`) | `resultCount`, `latencyMs`, `degraded`, `queryLength`, `hadCorrection` | Search quality |
| `suggestion_selected` | Client | `position`, `queryLength`, `type` | Autocomplete usefulness |
| `search_result_clicked` | Client | `position`, `entityType`, `queryLength` | Ranking quality (CTR by position) |
| `user_signed_up` | Server (Better Auth hook) | `method` (`email` \| `google`) | Acquisition |
| `user_signed_in` | Server | `method` | Retention |
| `content_published` | Server (publish) | `entityType`, `entityId`, `format` | Editorial throughput |
| `media_uploaded` | Server (confirm) | `mimeType`, `bytes`, `kind` | Storage growth |
| `email_sent` / `email_failed` | Worker | `template`, `reason` (enum) | Deliverability |
| `job_failed` | Worker (DLQ path) | `job`, `attempts` | Reliability, correlates with DLQ |

**Not events:** page views of non-content pages, scroll depth, mouse movement, session replay, per-question timing (stored on `attempt_items` instead, where it belongs to the attempt).

### 6.3 Client-side reporting endpoint

`POST /api/v1/events` — the only client analytics path.

```jsonc
// request
{ "events": [
  { "name": "search_result_clicked", "occurredAt": 1732100000000,
    "props": { "position": 3, "entityType": "learning_resource", "queryLength": 11 } }
] }
```

| Rule | Value |
|---|---|
| Auth | Optional; `user_id` taken from the session when present |
| Batch | 1–20 events, ≤ 16 KB body |
| Allowed names | The client-safe subset only (three events today); anything else is `400` |
| Timestamp | Client value used only for ordering; `received_at` is server time and is the column of record |
| Frequency | Batched (max one request per 500 ms), flushed with `navigator.sendBeacon` on page hide |
| Response | `204`, always, even when events are dropped — analytics must never surface an error to a student |
| Rate limit | 60 requests/min per user or anonymous id; excess dropped, not queued |

Server-side events are written inline in the same service call that performs the action, in the same transaction where the action is a write (so an event cannot exist for an attempt that rolled back). They are *not* published to QStash: a missing analytics row is not worth a queue.

---

## 7. Storage and queries

`usage_events` (`DATABASE_SCHEMA.md` §10.7): `id`, `name`, `occurred_at`, `received_at`, `user_id?`, `anonymous_id?`, `entity_type?`, `entity_id?`, `props_json`, `request_id?`, `app_version`.

| Query | Shape | Index used |
|---|---|---|
| Daily actives | `COUNT(DISTINCT user_id)` by `date(occurred_at/1000,'unixepoch')` | `(name, occurred_at)` |
| Funnel by topic | Join `usage_events` → `learning_resources` on `entity_id`, filtered by `name` | `(entity_type, entity_id, occurred_at)` |
| Search quality | `AVG(resultCount)`, `AVG(hadCorrection)` over `search_performed` | `(name, occurred_at)` |
| Per-user history | `WHERE user_id = ? ORDER BY occurred_at DESC LIMIT 50` | `(user_id, occurred_at)` |

Rules:

- Every analytics query has a **bounded time window** (default 30 days) and a `LIMIT`. There is no unbounded `SELECT * FROM usage_events`.
- Dashboards read through `/api/v1/studio/analytics/*` (staff-only, `private, no-store`), never directly from the browser.
- Materialised counters are not built in MVP. If a dashboard exceeds 1 s p95, the fix is a scheduled rollup written by the existing `reconcile-stats` job pattern ([BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md)), not a cache.
- The 90-day retention is enforced by the existing `prune` cron; the table is never a permanent record.

---

## 8. The three dashboards that matter

| Dashboard | Panels | Decision it drives |
|---|---|---|
| **Learning funnel** | Home → subject → topic → resource views → attempt starts → submits, weekly | Where students stop. A topic with views and no attempts is either unclear or has no assessment |
| **Content health** | Published resources/assessments per subject, topics with reading but no practice, topics with practice but no reading, stale (> 90 days) content | Editorial backlog, generated from data instead of a spreadsheet |
| **Search quality** | Queries/day, zero-result rate, correction rate, CTR by position, p95 latency, degraded minutes | Whether the fusion weights and vocabulary need tuning ([SEARCH_ARCHITECTURE.md](./SEARCH_ARCHITECTURE.md) §12) |

Anything else (retention cohorts, per-question difficulty analytics, revenue) is post-MVP. A dashboard nobody opens is a maintenance cost.

---

## 9. Local development and testing

- `ERROR_TRACKING_DSN` absent ⇒ the tracker is a no-op logger, not a crash. Tests never reach the network.
- Integration tests assert events: submitting an attempt **must** insert exactly one `attempt_submitted` row, with `scoreX100` equal to the stored score. This is the cheapest guard against silent analytics drift.
- The client batch endpoint has a contract test for: rejected unknown name, oversized batch, unauthenticated rate limit, and `204` on a dropped event.
- A redaction test feeds a payload containing an email, a token and `answer_key` through `beforeSend` and asserts none survive.
- Preview deployments write to the preview Turso branch, so preview traffic never pollutes production metrics.

---

## 10. Dependencies

| This document needs | From |
|---|---|
| `usage_events`, retention, token grants | `DATABASE_SCHEMA.md` §10.7, §15 |
| `requestId` propagation, `instrumentation.ts` | `PRODUCT_ARCHITECTURE.md` §6, `TECHNICAL_STANDARDS.md` §7 |
| Job wrapper and DLQ semantics | `BACKGROUND_JOBS.md` §5 |
| Redaction list, PII classification | `SECURITY_AND_PERMISSIONS.md` §11 |
| Retention and subprocessors | `PRIVACY_AND_DATA_PROTECTION.md` |
| Alert responses | `OPERATIONS_RUNBOOK.md` |

---

## 11. Edge cases

| # | Case | Behaviour |
|---|---|---|
| OBS-01 | Tracker is down | Requests are unaffected; the SDK buffers and drops. Errors still reach Vercel logs |
| OBS-02 | A user blocks the events request | Product metrics under-count UI clicks only; server-side facts are unaffected |
| OBS-03 | Event insert fails inside a write transaction | The whole action fails — analytics is part of the write, not a side channel |
| OBS-04 | Clock skew on a client event | `received_at` (server) is the column of record; `occurred_at` is ordering-only |
| OBS-05 | A new event name ships without a schema update | Type error at build time; the runtime also rejects unknown names with `400` |
| OBS-06 | Analytics query takes > 1 s | Fix the query or add a rollup job; never raise the timeout |
| OBS-07 | Alert storm during a provider outage | Alerts are grouped by fingerprint/route; one incident, one page |
| OBS-08 | Data deletion request | `usage_events` rows for that user are deleted; `anonymous_id` rows expire with retention ([PRIVACY_AND_DATA_PROTECTION.md](./PRIVACY_AND_DATA_PROTECTION.md) §5) |
| OBS-09 | Preview deployment emits production-shaped events | Impossible: the database is branch-isolated |

---

## 12. Acceptance criteria

1. Every unhandled server error reaches the tracker with a `requestId`, a release and a route pattern, and contains no redacted field (tested).
2. `console.log` outside `lib/log.ts` fails lint.
3. Each `/api/v1` request emits exactly one completion log line with status and duration.
4. `/health` reports database, Qdrant and index lag, and is used by the post-deploy smoke test.
5. The nine alerts in §5 exist, each linked to a runbook entry.
6. The event vocabulary is a frozen, typed list; an unknown name is a compile error and a `400`.
7. Submitting an attempt produces exactly one `attempt_submitted` event whose score matches the attempt row (integration test).
8. No client-visible analytics endpoint accepts a name outside the client-safe subset.
9. `usage_events` is pruned at 90 days by the existing cron, verified by a test that inserts an expired row.
10. No analytics query in the codebase lacks a time window or a `LIMIT`.

---

## 13. Open questions

| # | Question | Impact |
|---|---|---|
| OQ-OBS1 | ~~Which error-tracking vendor?~~ Resolved: Sentry ([ADR-032](./ARCHITECTURE_DECISIONS.md#adr-032--sentry-for-error-tracking-and-source-maps)) | SDK choice, DSN, free-tier limits |
| OQ-OBS2 | Is 90-day raw event retention enough before the first cohort analysis? | Storage and privacy trade-off — **Open — needs:** decide whether 90-day raw retention covers the first cohort analysis; **blocks Phase 7**. |
| OQ-OBS3 | Do we need per-topic reading completion (scroll to end) as a signal? | Adds a client event; currently out of scope — **Open — needs:** decide whether reading completion (scroll-to-end) is tracked; **blocks Phase 5**. |
| OQ-OBS4 | Should `user_signed_in` be recorded at all (retention analysis vs privacy minimalism)? | Passive auth telemetry — **Open — needs:** decide whether `user_signed_in` is recorded at all (privacy minimalism); **blocks Phase 2**. |
| OQ-OBS5 | Is a public status page required at launch? | Ops overhead; likely deferred — **Open — needs:** decide whether a public status page is required at launch; **blocks Phase 7**. |
