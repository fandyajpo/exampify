# Operations Runbook — Exampify

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Proposed |
| Depends on | [DEPLOYMENT_AND_ENVIRONMENTS.md](./DEPLOYMENT_AND_ENVIRONMENTS.md), [BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md), [OBSERVABILITY_AND_ANALYTICS.md](./OBSERVABILITY_AND_ANALYTICS.md) |
| Referenced by | [SECURITY_AND_PERMISSIONS.md](./SECURITY_AND_PERMISSIONS.md), [PRIVACY_AND_DATA_PROTECTION.md](./PRIVACY_AND_DATA_PROTECTION.md) |

---

## 1. How to use this document

Each entry has the same shape: **symptom → detect → act → verify → after**. Read the entry, do the steps in order, then write one line in the incident log. Do not improvise a new procedure during an incident; if the runbook is wrong, fix it afterwards.

The team is small. "On-call" means the founder, with a documented response expectation of **best effort within 1 hour during waking hours** for SEV-1. That is an honest constraint, not an SLA; do not promise uptime to users that the staffing cannot support.

### 1.1 Severity

| Severity | Definition | Examples | Response |
|---|---|---|---|
| **SEV-1** | Students cannot use the product, or private data is exposed | Site 5xx, sign-in broken, answer key leaked, data loss | Drop everything; page the founder |
| **SEV-2** | A core flow is degraded but a workaround exists | Search degraded, emails delayed, images failing | Same day |
| **SEV-3** | Cosmetic, single-user, or internal-only | One studio form broken, a stale sitemap | Next working day |

### 1.2 First five minutes (any SEV-1)

1. Confirm it is real: `curl -s https://<site>/api/v1/health` and load a topic page signed out.
2. Check the last deploy time. If it changed in the last 30 minutes, assume the deploy first (R6).
3. Check `/health` fields: `db`, `qdrant`, `indexLagSeconds`.
4. Check the alert channel for the matching entry in this document.
5. Announce in the incident log: what is broken, since when, what you are trying.

**Never** debug by changing production data. Read-only queries, then decide.

---

## 2. Runbooks

### R1 — Site down or returning 5xx

**Symptom:** homepage or content pages return 500, or Vercel reports a failed deployment.
**Detect:** availability alert (5xx > 2 % for 5 min) or a user report.

1. `GET /api/v1/health`. If it returns JSON, the app is up and the failure is route-specific → go to R2/R3.
2. If health is also 500: open the Vercel deployment logs and find the first error line of the newest deployment.
3. If the error is a boot error from `lib/env.ts`, a required variable is missing → fix the variable (R10 covers quota, this covers config), redeploy.
4. If the error started with a deploy and is not config: **roll back** (R6).
5. If the error predates the deploy and is a provider error (`ECONNREFUSED`, 401 from Turso/Qdrant), go to the provider entry (R2/R3/R5).

**Verify:** homepage 200, one topic page 200, one `/api/v1/search?q=cell` 200.
**After:** confirm the smoke script passed; add the failing route to the post-deploy smoke list if it was missing.

### R2 — Database unavailable, or sign-in is broken for everyone

**Symptom:** every dynamic route 500s; `/health` reports `db: "down"`; `SQLITE_BUSY` or auth errors in logs.
**Detect:** availability alert + health check.

1. Distinguish **connectivity** from **credential** from **lock**:
   - `401/403` from Turso → token expired or rotated (R10/R9).
   - Timeouts / connection refused → provider incident; check the Turso status page.
   - `SQLITE_BUSY` under load → a long write transaction is holding the write lock.
2. For a lock: find the slow statement in `db.slow` logs. A `BEGIN IMMEDIATE` that spans an external call is the usual cause — that is a bug, not an operational condition; kill the request (redeploy) and fix the code path.
3. For a provider incident: serve the maintenance response (`/maintenance`, a static page returned with `503` + `Retry-After: 300` via middleware; `noindex`), post the status note, wait. It must not touch the database.
4. For an expired token: mint a new database token with the same grants, update `TURSO_AUTH_TOKEN`, redeploy.

**Verify:** `SELECT 1` through the app, sign-in, one attempt save.
**After:** if `SQLITE_BUSY` recurred, add the offending statement to `db.slow` review; confirm no transaction wraps a network call (`TECHNICAL_STANDARDS.md` §9).

### R3 — Qdrant unavailable or search returns nothing

**Symptom:** `/api/v1/search` returns `degraded: true` or 500; search page shows the degraded note.
**Detect:** search availability alert; `degraded` minutes on the search dashboard.

1. Confirm the app is behaving as designed: search must fall back to FTS5 lexical + fuzzy, with `degraded: true` ([SEARCH_ARCHITECTURE.md](./SEARCH_ARCHITECTURE.md) §9). If it returns 500 instead, that is a defect — hotfix the fallback path.
2. Check `/health`'s Qdrant probe and the Qdrant Cloud console (cluster paused/suspended is common on free tiers).
3. If suspended by quota: resume/resize, then re-run `reconcile-search` (R12) because writes during the outage may have been skipped.
4. If the API key was rotated: update `QDRANT_API_KEY`, redeploy.

**Verify:** a known query returns semantic hits with `degraded: false`; `indexLagSeconds` back under 300.
**After:** record the outage window; zero-result rate on the dashboard should recover within a day.

### R4 — QStash backlog, retries exhausting, or DLQ non-empty

**Symptom:** DLQ alert; `search_events` stuck `pending`; publishing succeeds but content is not searchable.
**Detect:** DLQ alert, `pending search_events > 100`, `indexLagSeconds` climbing.

1. Inspect the oldest pending rows: `SELECT * FROM search_events WHERE status='pending' ORDER BY available_at LIMIT 20`.
2. If `attempts >= 3`, read `job_runs.last_error` for the same key to get the cause.
3. Classify:
   - **Bad payload / unknown entity** → mark `failed`, fix the producer, do not retry blindly.
   - **Qdrant/embedding error** → fix the provider (R3), then replay.
   - **Signature mismatch 401** → `QSTASH_*` signing keys rotated; update both keys, replay.
4. Replay: `POST /api/v1/internal/jobs/reindex?since=<timestamp>` after the cause is fixed. Replay is safe: upserts are idempotent and deletes of absent points succeed.
5. Drain the DLQ from the Upstash console **after** the cause is fixed, not before.

**Verify:** `pending` returns to ~0; a published resource is findable within 5 minutes; DLQ empty.
**After:** if the same payload type fails twice, add a validation test for it.

### R5 — Tigris unavailable or images failing

**Symptom:** images 404/403, uploads fail, `next/image` shows broken tiles.
**Detect:** 4xx/5xx spike on image domains; user report.

1. Direct-fetch one known public object URL. If it fails, it is the provider or the bucket policy.
2. Check whether a presigned URL expired (`X-Amz-Date` + expiry). The app issues 5-minute upload and 10-minute private-read URLs by design; an expired link in a cached HTML page is a caching bug, not an outage — content pages must store object **keys**, not presigned URLs (`TECHNICAL_STANDARDS.md` §11).
3. If credentials were rotated: update `TIGRIS_ACCESS_KEY_ID` / `TIGRIS_SECRET_ACCESS_KEY`, redeploy, then test one upload.
4. If uploads fail but reads work: check the CORS policy on the bucket — presigned PUT from the browser needs the site origin allowed.

**Verify:** one public image loads, one presigned upload completes and `confirm` marks `ready`.
**After:** confirm no presigned URL was written into content JSON.

### R6 — Bad deploy

**Symptom:** errors began within minutes of a deploy; the previous version was healthy.

1. Vercel → Deployments → the last known-good deployment → **Promote/Rollback**.
2. Do **not** revert migrations. Migrations are additive-first precisely so the previous build runs against the newer schema (`DEPLOYMENT_AND_ENVIRONMENTS.md` §5). If the migration was destructive, that rule was violated — treat it as an incident and see R7.
3. Confirm the rollback is live (`/health` `version` matches the promoted commit).
4. Fix forward on a branch; never "quick-fix in production".

**Verify:** smoke script: `/health`, a topic page, a search query, an attempt save, sign-in.
**After:** write down which check would have caught it and add it to CI.

### R7 — Migration failed or left a half-applied schema

libSQL has transactional DDL for most statements but some operations require a table rebuild; a rebuild interrupted mid-way is the dangerous case.

1. Stop traffic to the affected feature if it is not already failing (deploy rollback is safe; the schema may be newer, not older).
2. Inspect the Kysely migration ledger (`kysely_migration`, `kysely_migration_lock`) and compare with `sqlite_master` for the affected table.
3. If a rebuild left a temporary table (`*_new`, `*_old`): verify row counts against the original before doing anything else.
4. Restore the affected table from the most recent backup (R8) into a scratch database, reconcile, then copy back — do not run a "fix" migration on top of a partially rebuilt table.
5. Re-run the migration from a clean branch database in CI to prove the file itself is correct before retrying production.

**Verify:** row counts match expectations; the app's read path for the table works; `PRAGMA foreign_key_check` is empty.
**After:** any migration that rebuilds a table must ship with a count assertion and be tested from the previous tag, not only from empty.

### R8 — Restore from backup

Data loss or corruption. **RPO ≤ 24 h** (nightly dump) or **≤ 1 h** (Turso point-in-time), **RTO ≤ 4 h**.

1. Declare SEV-1. Stop writes if corruption is ongoing (maintenance page).
2. Choose the target: point-in-time (preferred) or the nightly dump in Tigris (`backups/yyyy/mm/dd.sql.gz`).
3. Restore into a **scratch** database first, never over production.
4. Validate the scratch copy: `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, row counts for `user`, `learning_resources`, `assessment_attempts`, and that the newest published resource exists.
5. **Replay the deletion log.** Accounts deleted after the backup was taken must be deleted again in the restored copy, or the restore becomes a privacy incident ([PRIVACY_AND_DATA_PROTECTION.md](./PRIVACY_AND_DATA_PROTECTION.md) §5.2).
6. Point `TURSO_DATABASE_URL`/token at the restored database, redeploy, run the smoke script.
7. Rebuild derived state: `reconcile-search` (R12), `reconcile-stats`, then verify `indexLagSeconds` settles.

**Verify:** sign-in, one attempt from history, one content page, search for a known resource.
**After:** record the actual RPO/RTO achieved; run a drill quarterly and update the numbers here.

### R9 — Secret leak

Examples: a key pasted into a ticket, a token in a screenshot, a `NEXT_PUBLIC_` variable that should not be public.

1. **Rotate first, investigate second.** Assume the secret is public the moment it left the environment.
2. Rotation table:

| Secret | Rotate where | Effect |
|---|---|---|
| `BETTER_AUTH_SECRET` | Env var + redeploy | All sessions invalidated (users must sign in again) |
| `TURSO_AUTH_TOKEN` | Turso dashboard (revoke + mint) | Brief DB auth failure during redeploy |
| `QDRANT_API_KEY` | Qdrant console | Index writes fail until updated |
| `TIGRIS_*` | Tigris console | Uploads/reads fail until updated |
| `QSTASH_TOKEN` / signing keys | Upstash console | Jobs rejected until both keys updated |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console | Rate limits fail open briefly — acceptable, logged |
| `EMAIL_SMTP_PASS` (Google app password) | Google Account → Security → App passwords (revoke the old one first) | Emails fail with an authentication error until updated; 2-Step Verification must stay on |
| `CRON_SECRET` | Env var + redeploy | Cron 401s until updated |

3. Search the repo and the Vercel env for the leaked value; remove any `NEXT_PUBLIC_` prefix misuse.
4. If personal data may have been exposed, follow the breach process ([PRIVACY_AND_DATA_PROTECTION.md](./PRIVACY_AND_DATA_PROTECTION.md) §9).
5. Add a lint/test that would have caught it (e.g. a secret-scanning pre-commit hook).

**Verify:** old credential rejected by the provider; the app works with the new one; no occurrence of the old value in the repo or env.
**After:** document the leak vector; if it was a code path logging a secret, add it to the redaction test.

### R10 — Quota exhausted (Turso rows, Upstash commands, Qdrant cluster paused, Vercel limits, email relay daily cap)

**Symptom:** sudden 429/403 from a provider, writes failing, or the site degrading on a busy day. For email the symptom is different: sends keep returning `accepted` while verification mail arrives hours late.

1. Identify which provider and which meter (the provider consoles show usage vs plan).
2. Immediate relief, in this order of preference: enable CDN caching for content (ISR already does), disable the most expensive non-essential path (suggest endpoint), then upgrade the plan.
3. Turso row reads are the usual suspect under crawler traffic — check `robots.txt` and sitemap hygiene before upgrading.
4. Upstash daily command limits: rate limiting fails open by design; do not disable limits entirely, raise the window instead.
5. Email daily cap (2,000 messages/day on paid Workspace, 500 on a personal account or trial; rolling 24 h and shared with everything else that account sends): Google **refuses** past the cap, so sends come back `rejected` and `job_runs` records `quota_exhausted` with no retry before the window rolls. Do not clear the flag to force a retry into the same refusal. Confirm the counter in the Google account's sending limits, then wait out the window or move the account up a Workspace tier. Rows in `uncertain` are reconciled against the sent mailbox before anything is re-sent (`EMAIL_AND_NOTIFICATIONS.md` §4.1).
6. **Bounce inbox check (weekly, or after any campaign-like spike).** There are no delivery events (ADR-037). Open the sending account's inbox for bounce reports and spam complaints and add each address to `email_suppressions` with `reason='hard_bounce'` or `'complaint'`, `source='ops'`. A dead address that keeps receiving resets is this check being skipped, not a transport bug. Manual is the decided MVP method (`OQ-E6`); the escalation to a parser or a relay with events is triggered by the thresholds in `EMAIL_AND_NOTIFICATIONS.md` §5, not by a bad week.
7. Record the monthly cost change; update the cost envelope in `DEPLOYMENT_AND_ENVIRONMENTS.md` §8.

**Verify:** the failing meter stops climbing abnormally; the alert clears.
**After:** add the meter to a weekly check if it can hit a limit again.

### R11 — Attempts stuck or scores look wrong

**Symptom:** users see attempts that never submit, items ungraded, or scores that do not match the review.

1. This is a **correctness incident**, not an ops one: grading is deterministic and pure ([QUESTION_ENGINE.md](./QUESTION_ENGINE.md) §6). Never patch a score by hand.
2. Query the attempt: `status`, `submitted_at`, `score_percent_x100`, item count, sum of item points.
3. If `status='in_progress'` past `expires_at`, the sweep is failing → run `expire-attempts` manually, check R4.
4. If submitted but items ungraded, the submit transaction partially failed — the submit path is one transaction, so this indicates a code defect; capture the `requestId`, do not "repair" the row.
5. If a score is wrong for many users, suspect a deploy that changed scoring: roll back (R6), then compare against the truth table in tests.

**Verify:** a fresh attempt grades correctly in production; affected attempts are listed for a support response.
**After:** add a regression test with the failing answer set.

### R12 — Search drift (index out of sync with content)

**Symptom:** unpublished content still appears; a published resource cannot be found; `indexLagSeconds` high but jobs are healthy.

1. Compare truth to index for one entity: does `search_documents` have a row, and does Qdrant have the point with the current `content_hash`?
2. Run the repair fan-out: `POST /api/v1/internal/jobs/reindex?entityType=learning_resource&since=<date>` (repeat for `assessment`).
3. Full rebuild (model change or collection corruption): create a **new** collection (`content_v2`), reindex into it, verify counts and a query set, then switch `QDRANT_COLLECTION` and drop the old one after 24 hours. Never delete the live collection first.
4. Confirm deleted/unpublished entities are absent by querying for them explicitly.

**Verify:** a spot-check set of 10 queries returns expected results; unpublished content returns nothing; zero-result rate returns to baseline.
**After:** if drift came from a missed event, check the producer writes the outbox in the same transaction.

---

## 3. Standard procedures

### 3.1 Deploy

1. Merge to `main` (CI green, migrations reviewed).
2. Migrations run before the new deployment serves traffic.
3. Run the post-deploy smoke script: `/health`, topic page, search query, sign-in, attempt save.
4. Watch errors and the `db.slow` log for 15 minutes.

### 3.2 Rollback

Promote the previous deployment. No migration reversal. If the previous build cannot run against the new schema, the migration violated additive-first — treat as R7.

### 3.3 Rotate a secret without downtime

Set the new value in Vercel, keep the old one valid at the provider if it supports overlap, deploy, verify, then revoke the old one. For `BETTER_AUTH_SECRET` there is no overlap: all sessions die, so do it at a low-traffic hour and say so on the status note.

### 3.4 Publish a content emergency fix

Studio edit → publish (invalidates tags + enqueues index) → verify the public page and the search result within 5 minutes. If the page is cached, check the tag invalidation fired (`revalidateTag` log line).

---

## 4. Access and credentials

| Access | Who | Notes |
|---|---|---|
| Vercel, Turso, Qdrant, Upstash, Tigris, email provider | Founder/admin | MFA mandatory; recovery codes offline |
| Production database console | Founder/admin | Read-only by default; writes only via the app |
| Studio admin role | Founder + named editors | Reviewed quarterly |
| Secrets | Vercel env only | Never in the repo, never in chat, never in a doc |

A person leaving loses access the same day; rotate any shared secret they held.

---

## 5. Dependencies

| Needs | From |
|---|---|
| Alert definitions and SLOs | `OBSERVABILITY_AND_ANALYTICS.md` §5 |
| Job names, retry and DLQ semantics | `BACKGROUND_JOBS.md` §3, §6 |
| Backup/dump location and env vars | `DEPLOYMENT_AND_ENVIRONMENTS.md` §4, §7 |
| Breach and retention rules | `PRIVACY_AND_DATA_PROTECTION.md` §5, §9 |
| Secret redaction rules | `SECURITY_AND_PERMISSIONS.md` §12 |

---

## 6. Open questions

| # | Question | Impact |
|---|---|---|
| OQ-OPS1 | Is a paid uptime monitor (external, 1-minute) required at launch? | Detection latency; ~$10/mo — **Open — needs:** decide whether a paid 1-minute uptime monitor is required; **blocks Phase 7**. |
| OQ-OPS2 | Do we publish a status page, or only an in-app banner? | User trust vs maintenance — **Open — needs:** decide status page vs in-app banner; **blocks Phase 7**. |
| OQ-OPS3 | Who is the second person with production access? | Bus factor — **Open — needs:** name a second person with production access; **blocks Phase 7**. |
| OQ-OPS4 | Should the nightly dump be encrypted with a separate key? | Tigris key compromise blast radius — **Open — needs:** decide whether nightly dumps use a separate encryption key; **blocks Phase 7**. |
| OQ-OPS5 | Is quarterly restore-drill frequency realistic for a solo team? | Drill cost vs readiness — **Open — needs:** decide whether quarterly restore drills are realistic; **blocks Phase 7**. |
