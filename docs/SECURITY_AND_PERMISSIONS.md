# Security and Permissions — Exampify

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Proposed — normative for implementation |
| Supersedes | Version 0.1 (Postgres roles, Argon2id, Postgres rate-limit counters) |
| Depends on | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [API_CONTRACTS.md](./API_CONTRACTS.md), [SEARCH_ARCHITECTURE.md](./SEARCH_ARCHITECTURE.md) |
| Referenced by | [TESTING_STRATEGY.md](./TESTING_STRATEGY.md), [TECHNICAL_STANDARDS.md](./TECHNICAL_STANDARDS.md) |

---

## 1. Purpose and scope

Defines who may do what, how that is enforced, and which threats the MVP must resist. The highest-value asset is the **question bank**: a leaked answer key destroys the product's core value, so protecting it is treated as a first-class requirement rather than a policy note.

**In scope:** roles and capability matrix, enforcement layers, authentication and session rules, the answer-key protection model, input/output safety, CSRF/CSP, rate limiting, uploads, secrets, PII and retention, logging, dependencies, incident response, security acceptance criteria.

**Out of scope:** infrastructure hardening by a hosting provider (DDoS, network ACLs), legal compliance beyond GDPR-shaped posture, pen-test findings (future).

---

## 2. Threat model (MVP)

| # | Threat | Impact | Mitigation |
|---|---|---|---|
| T-01 | Student obtains answers before submitting | Product value destroyed; leaderboard/accuracy meaningless | Answer keys never serialised to student DTOs; contract tests; server-side grading only |
| T-02 | Student reads another student's attempts | Privacy breach | Ownership checks in service layer; `404` for foreign ids |
| T-03 | Author publishes unreviewed content | Quality/legal risk | Role-gated transitions; audit log; reviewer gate |
| T-04 | Privilege escalation via mass assignment (`role`, `status`) | Full compromise | Explicit field allow-lists per endpoint; `.strict()` Zod; role in a separate admin-only endpoint |
| T-05 | Stored XSS via Markdown/HTML in author content | Session theft, defacement | Raw HTML stripped; sanitised renderer; strict CSP; SVG sanitisation |
| T-06 | CSRF on studio/practice mutations | Unauthorised writes | Same-origin verification + `SameSite=Lax` cookies |
| T-07 | Credential stuffing | Account takeover | Rate limits, blocklist, generic errors, optional OAuth |
| T-08 | Session hijack via XSS or leaked token | Account takeover | `HttpOnly`+`Secure` cookies, short TTL, rotation, revocation, hashed tokens at rest |
| T-09 | Content scraping / bulk question exfiltration | IP loss | Rate limits, `noindex` on attempt routes, no public question API, 5 concurrent attempt cap |
| T-10 | Malicious upload (SVG script, oversized file, wrong MIME) | XSS, storage abuse | Presigned PUT bound to MIME+size, magic-byte verification, SVG sanitisation, purpose-based caps, separate media host |
| T-11 | SQL injection | Data breach | Kysely with bound parameters only; search tokens quoted and passed as a `MATCH` parameter |
| T-12 | Enumeration of accounts | Privacy | Generic auth responses, constant-time comparisons |
| T-13 | Abuse of job/cron endpoints | Data tampering, index poisoning | QStash signature verification, `Bearer $CRON_SECRET`, idempotent, no data returned |
| T-14 | Dependency compromise | Supply chain | Lockfile, audit in CI, pinned major versions, no postinstall scripts from unvetted packages |
| T-15 | Draft content leaks through the search index | Unpublished content exposed | Search rows are **deleted** (not flagged) on unpublish; Qdrant queries always filter `status='published'`; reconciliation job |
| T-16 | Presigned URL shared beyond its scope | Unauthorised media access | ≤ 5 min uploads, ≤ 10 min private reads, one object per signature, no long-lived links |
| T-17 | Qdrant API key abused to read other tenants' data | Index disclosure | One collection per environment, key scoped to the cluster, index contains public text only |

---

## 3. Roles and the capability matrix

Four roles, strictly ordered: `student (0) < author (1) < reviewer (2) < admin (3)`. A role grants everything below it.

| Capability | student | author | reviewer | admin |
|---|:--:|:--:|:--:|:--:|
| Read published content | ✅ | ✅ | ✅ | ✅ |
| Practise, own sessions, own progress | ✅ | ✅ | ✅ | ✅ |
| Edit own profile, revoke sessions | ✅ | ✅ | ✅ | ✅ |
| Read studio, list drafts | ❌ | ✅ | ✅ | ✅ |
| Create/edit chapters, topics, learning resources, content blocks, assessments | ❌ | ✅ | ✅ | ✅ |
| Create/edit questions | ❌ | ✅ | ✅ | ✅ |
| Link/unlink assessments to resources | ❌ | ✅ | ✅ | ✅ |
| Submit content `draft → in_review` | ❌ | ✅ | ✅ | ✅ |
| Publish (`in_review → published`) | ❌ | ❌ | ✅ | ✅ |
| Send back to draft with reason | ❌ | ❌ | ✅ | ✅ |
| Unpublish published content | ❌ | ❌ (own only) | ✅ | ✅ |
| Archive content | ❌ | ✅ | ✅ | ✅ |
| Create/edit curricula, levels, subjects | ❌ | ❌ | ❌ | ✅ |
| Move topics/subjects across parents | ❌ | ❌ | ❌ | ✅ |
| Manage media library | ❌ | ✅ | ✅ | ✅ |
| Change user roles | ❌ | ❌ | ❌ | ✅ |
| Read audit log | ❌ | own actions | own actions | ✅ |
| Manage redirects | ❌ | create via slug change | ✅ | ✅ |
| Run internal cron endpoints | ❌ | ❌ | ❌ | ❌ (secret only) |

**Explicit denials worth stating** (because they are easy to get wrong):
- An `author` can never publish their own content, including via `PATCH status`.
- A `student` can never read `answerKey`, even for their own submitted session.
- A `reviewer` cannot manage users or taxonomy.
- No role can delete a user's account data on their behalf except `admin`, and only via a documented flow.

### 3.1 Implementation of the matrix

```ts
// lib/rbac/capabilities.ts
export const CAPABILITIES = {
  'content:read:studio':   ['author', 'reviewer', 'admin'],
  'content:write':         ['author', 'reviewer', 'admin'],
  'content:submit':        ['author', 'reviewer', 'admin'],
  'content:publish':       ['reviewer', 'admin'],
  'content:unpublish':     ['reviewer', 'admin'],
  'content:archive':       ['author', 'reviewer', 'admin'],
  'taxonomy:write':        ['admin'],
  'content:move':          ['admin'],
  'media:write':           ['author', 'reviewer', 'admin'],
  'users:manage':          ['admin'],
  'audit:read:all':        ['admin'],
  'audit:read:own':        ['author', 'reviewer'],
} as const satisfies Record<string, readonly Role[]>;
```

`can(actor, capability)` is the **only** authorization primitive in the codebase. Route handlers call it; services also assert ownership and scope. A missing capability must deny, never throw an unhandled error that surfaces internals.

**Three enforcement layers, all required:**

1. **Route/middleware** — fast rejection, no data loaded (`401`/`403`).
2. **Service** — authoritative check with the loaded row (ownership, parent published state, transition validity).
3. **Database token** — Turso table/action-scoped permissions: `app_rw` has every table except `audit_logs` (which gets `data_add` only), `app_read` is `data_read` on all tables, `migrator` is a separate CI-only credential. LibSQL has no row-level security, so this layer cannot express ownership — it only limits blast radius.

Client-side checks (hiding a button) are **cosmetic** and never counted as enforcement. Server components that render studio UI must not fetch data the actor cannot read — the guard runs before the query, not after.

---

## 4. Authentication

### 4.1 Mechanism

- Email + password and Google OAuth (`FR-AUTH-04`, SHOULD), implemented with **Better Auth** (`ADR-017`). Password hashing is Better Auth's default scrypt; the cost parameters are measured under Bun in the Phase 1 spike and lowered if sign-in p95 exceeds 300 ms. Do not add a second hashing scheme.
- Sessions are **database-backed opaque tokens** in an `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` cookie, managed by Better Auth's `session` table. The library stores a hashed/opaque token, never a raw password or raw session secret in logs.
- Session TTL: 30 days absolute, rotated on privilege change (role change, password change) — rotation means a new token and revocation of the old.
- Absolute + idle: revoke after 30 days absolute or 14 days idle.
- Sign-out revokes the current session; "sign out everywhere" revokes all.

### 4.2 Password policy

- 10–128 characters; no composition requirement; blocklist of the top 10k passwords plus the email local part; unicode allowed.
- Enforced inside the Better Auth instance (`src/lib/auth/server.ts` `hooks.before`), not only in the form actions: `/api/auth/*` is a public surface, so a direct `POST /api/auth/sign-up/email` without the 16+ attestation or with a policy-breaking password is rejected with `400`. The attestation timestamp and gate version are written by the server, never trusted from the client.
- Reset tokens: 32 bytes, 30-minute expiry, single use, invalidated on use or password change.
- Email verification tokens: 24-hour expiry, single use.
- Verification is required before creating a practice session (`FR-AUTH-02`), so a mistyped email cannot accumulate attempt data.

### 4.3 Auth-specific edge cases

| Case | Behaviour |
|---|---|
| Sign-up with an existing email | `201` + "you already have an account" email; no session |
| Sign-in before verification | Allowed, but practice creation returns `401 EMAIL_NOT_VERIFIED` |
| Password reset while signed in elsewhere | All other sessions revoked on success |
| OAuth account with the same email as an existing password account | Link only after verifying ownership (provider-verified email required); otherwise prompt to sign in and link |
| Role changed while session active | Session revoked; user must re-authenticate |
| Deleted/suspended user with a live cookie | Service rejects on every request (`status !== 'active'`) |

---

## 5. Answer-key protection (the central rule)

**Invariant:** `questions.answer_key` and `explanation_md` may only be read by:
1. studio endpoints for `author`+,
2. the grading function, server-side, after a valid submit,
3. the review payload, after submit.

Enforcement:

| Layer | Mechanism |
|---|---|
| Query | Separate projections: `gradableQuestionColumns` (includes key) vs `studentQuestionColumns` (excludes it). No `SELECT *` in app code |
| DTO | `toStudentQuestion()` and `toReviewItem()` are the only mappers for practice responses; both are typed to omit key fields |
| Type | `StudentQuestion` has no `answerKey`/`explanation` property — leaking requires a type error |
| Test | Every student endpoint's response is scanned recursively for forbidden keys and for the literal correct option text matched against the key |
| Client | Practice state never stores keys; review data is only fetched after submit |
| Timing | No endpoint reveals correctness before submit — not even "correct"/"incorrect" hints |

This is the single most important security property in the product; it is reviewed on every change to practice endpoints.

---

## 6. Authorization details per resource

| Resource | Rule |
|---|---|
| `assessment_attempts` / `attempt_items` | `attempt.user_id === actor.id`, otherwise `404` |
| `progress`, `user_topic_stats` | Always scoped to `actor.id`; no endpoint accepts a `userId` parameter |
| `learning_resources`, `content_blocks`, `assessments`, `topics`, `chapters`, `subjects`, `questions` | Read: published for everyone; any status for `author`+. Write: `author`+ |
| Studio lists | Always filtered by `can(actor, 'content:read:studio')` first, then by requested filters |
| `media_assets` | Upload `author`+; delete blocked while referenced by published content |
| `users` | Self-read returns a limited projection (no `passwordHash`, no `role` write path); admin list returns role + status but never hashes |
| `audit_logs` | `author`/`reviewer` see only `actor_id = self`; admin sees all. Filtering by another actor returns `403` |
| `redirects` | Read-only public effect; write via slug change or admin |

**No client-supplied identity:** `userId`/`actorId` in a body is always ignored (`422 UNKNOWN_FIELD` under `.strict()`). Identity comes only from the session.

---

## 7. Input and output safety

### 7.1 Input

- Every body/query parsed by Zod `.strict()`; unknown fields rejected.
- String limits enforced at the boundary (not only in the DB).
- IDs validated as UUID strings before any query (prevents malformed-input probing and index-unfriendly scans).
- Enum values validated against the closed sets in `DATABASE_SCHEMA.md` §4.
- JSON-in-TEXT payloads (`answer_key`, `selected_answer`, block `payload`, attempt `config`, `feedback`) are re-validated on read as well as write — persisted JSON is untrusted, and SQLite's `json_valid` is a shape check, not a schema.
- CSV/JSON import does not exist in MVP (avoids a large parsing attack surface).

### 7.2 Output

- Markdown → HTML rendering pipeline: parse (marked/remark) → sanitise (allow-list of tags/attributes) → render. Attributes allowed: `href`, `src`, `alt`, `title`, `class` (from a fixed set), `colspan`, `rowspan`, `scope`, `id` (anchors only).
- Allowed URL schemes: `https:`, `mailto:`, relative paths. `javascript:`, `data:` (except `data:image/*` for inline icons, which the renderer does not emit), `vbscript:` stripped.
- External links: `rel="noopener noreferrer"`, `target="_blank"`.
- Images: served from the controlled media path with `Content-Type` from the stored MIME, `X-Content-Type-Options: nosniff`.
- React escapes text by default; `dangerouslySetInnerHTML` is permitted **only** in the sanitised content renderer, with a lint exception comment naming the sanitiser.

### 7.3 Headers (all responses)

```
Content-Security-Policy: default-src 'self'; img-src 'self' data: https://<media-host>;
  script-src 'self' 'nonce-<per-request>'; style-src 'self' 'unsafe-inline';
  font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self';
  form-action 'self'; object-src 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Frame-Options: DENY
```

`unsafe-inline` for styles is required by the styling approach; scripts use per-request nonces. Any new third-party script is a security review item.

---

## 8. CSRF and origin rules

- Mutations (`POST`, `PATCH`, `PUT`, `DELETE`) require `Origin` to match the app origin **or** `Sec-Fetch-Site: same-origin`. Missing both ⇒ `403 CROSS_ORIGIN_BLOCKED`.
- Cookies are `SameSite=Lax`, which blocks cross-site `POST` in modern browsers; the origin check is defence in depth, not the only barrier.
- `GET` must never mutate. Any state change via `GET` is a review-blocking defect.
- OAuth callbacks validate `state` and the exact redirect URI allow-list.

---

## 9. Rate limiting and abuse

Limits from `API_CONTRACTS.md` §9, plus:

| Abuse vector | Control |
|---|---|
| Session creation spam | 30/10 min/user; concurrent `in_progress` sessions capped at 5, oldest auto-abandoned |
| Answer save flooding | 120/10 min/user |
| Search scraping | 60/min/IP; no pagination beyond 5 pages for anonymous search |
| Media upload flood | 30/h/user + 5 MB each |
| Auth brute force | 10/15 min per IP+email; exponential delay after 5 failures |
| Cron abuse | Secret, constant-time compare, no rate limit shared with users |

Counters live in **Upstash Redis** (atomic `INCR` + `EXPIRE` across function instances), not in Turso: a counter row per request would write to the single-writer database for every anonymous page view (`ADR-027`). Redis is used for nothing else on the request path. If Redis is unavailable, limits **fail open** on public reads and search (availability) but auth and mutation limits fall back to a coarse in-process counter (best effort, logged) — documented trade-off, reviewed at launch.

---

## 10. Secrets and configuration

| Secret | Where | Rotation |
|---|---|---|
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | Vercel env (server only) | 90 days / on incident |
| `BETTER_AUTH_SECRET` | Vercel env | 180 days; rotation invalidates sessions (acceptable) |
| `QDRANT_API_KEY` | Vercel env | 90 days |
| `TIGRIS_ACCESS_KEY_ID` + `TIGRIS_SECRET_ACCESS_KEY` | Vercel env, bucket-scoped | 90 days |
| `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | Vercel env | 90 days (signing keys rotate in pairs) |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel env | 90 days |
| `CRON_SECRET` | Vercel env | 90 days |
| OAuth client secret | Vercel env | Per provider policy |
| SMTP relay password (Google app password) | Google Account console + Vercel env | 90 days, and immediately on suspicion; regenerating revokes the old value |

Rules: no secret in the repo, in client bundles, in logs, in error reports, or in `NEXT_PUBLIC_*`. `.env*` files are git-ignored; a committed secret triggers immediate rotation. Preview and production use **different** credentials.

---

## 11. Data protection and privacy

| Data | Classification | Retention | Notes |
|---|---|---|---|
| Email, name | PII | Until account deletion | Never logged in plain text |
| Password hash | Secret | Until deletion/change | Better Auth default (scrypt) |
| Session token | Secret | 30 days after expiry | Library-managed; never logged |
| IP address | Pseudonymous | Not stored raw (`ip_hash` only) | Salted hash |
| Practice attempts | Behavioural | Until deletion | Core product value |
| Audit log | Operational | 400 days | Actor id retained (FK `SET NULL` on deletion) |
| Uploaded media | Content | Until unreferenced + 30 days | — |
| Search queries | Pseudonymous | 90 days | Normalised query + salted user hash; never raw IP |
| Search index (Qdrant) | Public content | Until unpublished | Contains only published public text; no PII |

- **Account deletion:** soft-delete user, scrub `email` (replace with `deleted+<id>@invalid`), clear `name`/`image_url`, revoke sessions, keep attempts under an opaque internal id **or** delete them (unresolved: `OQ-06`, `OQ-DB4`). The chosen behaviour must be stated in the privacy policy before launch.
- No third-party analytics in MVP beyond first-party product events. No ad tech. No session replay.
- Error reports strip query strings and request bodies; user ids are hashed in breadcrumbs.
- Privacy policy and cookie notice are required before public launch; they are content work, not engineering.

---

## 12. Logging and monitoring for security

Log: authentication successes/failures (hashed identifier), role changes, publish/unpublish, account deletion, rate-limit trips, `403`/`422` bursts, cron invocations.

Never log: passwords, tokens, cookies, `answer_key`, full request bodies, raw IPs.

Alert (Phase 6): spike in `401`/`403` (credential stuffing or scanning), spike in `429`, publish volume anomaly, repeated `CONTENT_CONFLICT` (possible editor bug), DB connection saturation.

---

## 13. Dependencies and supply chain

- Lockfile committed; CI runs `bun audit` (or the package manager's equivalent) and fails on high/critical.
- `bun install --frozen-lockfile` in CI so a lockfile drift cannot slip through.
- Dependencies added deliberately, one at a time, reviewed for maintenance, Bun compatibility and install scripts.
- No `postinstall` scripts from unvetted packages; no remote code loaded at runtime.
- Framework and auth library kept on supported versions; upgrade at least quarterly.
- CI runs typecheck, lint, unit tests and build on every PR; deploys only from the main branch.

---

## 14. Incident response (MVP-level)

1. **Contain:** revoke `AUTH_SECRET` (all sessions), rotate the compromised credential.
2. **Assess:** audit log + error tracking for affected entities and time window.
3. **Notify:** if PII or credentials were exposed, follow jurisdiction requirements (owner: legal, `OQ-06`).
4. **Remediate:** patch, add a regression test, document in `ARCHITECTURE_DECISIONS.md` if it changes a design.
5. **Review:** update this document's threat model.

A one-page runbook lives in the repo once deployment exists (Phase 6 deliverable).

---

## 15. Edge cases

| # | Case | Behaviour |
|---|---|---|
| SEC-01 | Author crafts a request to publish their own question | `403 FORBIDDEN`; also blocked by capability check inside the service |
| SEC-02 | Student guesses another user's session id | `404`, timing indistinguishable from a truly unknown id |
| SEC-03 | Studio page rendered for a `student` | Redirect to `/sign-in` or 404; no data fetched before the guard resolves |
| SEC-04 | Markdown with `<img onerror=...>` | Attribute stripped; image may render with only allow-listed attrs |
| SEC-05 | SVG containing `<script>` | Stripped before storage; asset rejected if it cannot be sanitised |
| SEC-06 | Role demoted mid-session | Session revoked; next request is `401` |
| SEC-07 | Two admins demote each other | Last-admin check prevents zero admins; second request gets `409 LAST_ADMIN` |
| SEC-08 | Replay of a password-reset token | `422` (single use, `consumed_at` set) |
| SEC-09 | Practice creation via a script at high volume | `429` after 30 in 10 min |
| SEC-10 | Answer key leaked in an error message | Sanitised error mapper never echoes DB values; key never included in a thrown error |
| SEC-11 | Uploaded file named `x.png` containing HTML | MIME sniffing on the server + `nosniff` + forced `Content-Type` |
| SEC-12 | Direct object reference on media delete | `403`/`404` unless `author`+ and owner of referencing content |
| SEC-13 | Job endpoint called without a valid QStash signature | `401`, body unread, no work performed |
| SEC-14 | Error stack trace shown in production | Generic message + `requestId` only |
| SEC-15 | Unpublished content still in Qdrant | Query filters `status='published'` **and** the worker deletes points; both are tested |
| SEC-16 | Presigned URL forwarded to a third party | Expires in ≤ 10 min; one object; scoped by signature |
| SEC-17 | Student finds `answer_key` in a practice-mode `reveal` for an unanswered question | `reveal` is emitted only for the question just answered, never pre-emptively |
| SEC-18 | Turso token leaked from a build log | Tokens are server-only env, never printed; CI secret scan blocks commits |

---

## 16. Acceptance criteria

1. The capability matrix is implemented as data and unit-tested for all 4 roles × all capabilities (deny by default asserted).
2. A student request to any studio endpoint returns `403` with no data loaded (verified by query-count/log assertions in tests).
3. No student-facing response before submit contains `answerKey`, `explanation`, `isCorrect` or correct option text (leak test).
4. All cookies are `HttpOnly`, `Secure`, `SameSite=Lax`; tokens are stored hashed.
5. Cross-origin `POST` returns `403` before any database access.
6. Markdown rendering strips `<script>`, event handlers and `javascript:` URLs (fixture-based test).
7. Security headers are present on every route (test over the route manifest).
8. Rate limits return `429` with `Retry-After` for auth, practice and studio groups.
9. `audit_logs` cannot be updated or deleted by the runtime Turso token (permission test against a branch).
9a. The runtime token cannot run DDL; only the migrator credential can.
10. A deleted user cannot sign in, and their session cookies are rejected immediately.
11. No secret is present in the built client bundle (bundle scan in CI).
12. SSR HTML for a `403` page contains no protected data (payload inspection test).

---

## 17. Open questions

| # | Question | Impact |
|---|---|---|
| OQ-SEC1 | Is account deletion expected at launch, and what happens to attempts (`OQ-06`)? | Cascade policy + privacy policy wording — **Open — needs:** decide whether account deletion is expected at launch (ties `OQ-06`/`D-05`); **blocks Phase 2**. |
| OQ-SEC2 | Do we require MFA for `admin`/`reviewer` accounts? | Adds TOTP flow; currently not included — **Open — needs:** decide whether admin/reviewer accounts require MFA; **blocks Phase 2**. |
| OQ-SEC3 | Should the studio be network-restricted (VPN/IP allow-list) in addition to roles? | Deployment configuration — **Open — needs:** decide whether the studio is additionally network-restricted; **blocks Phase 7**. |
| OQ-SEC4 | Is a third-party WAF/CDN bot-protection subscription acceptable? | Scraping posture, budget — **Open — needs:** decide whether a WAF/CDN bot-protection subscription is bought; **blocks Phase 7**. |
| OQ-SEC5 | What is the hosting provider's built-in DDoS posture for the chosen tier? | Risk acceptance — **Open — needs:** record the hosting tier's built-in DDoS posture as a risk acceptance; **blocks Phase 7**. |
| OQ-SEC6 | Do we need a documented data-retention schedule for audit logs beyond 400 days (regulatory)? | Retention cron config — **Open — needs:** decide whether audit retention must exceed 400 days; **blocks Phase 7**. |
