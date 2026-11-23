# Privacy and Data Protection — Exampify

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Proposed — legal review required before launch |
| Depends on | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [SECURITY_AND_PERMISSIONS.md](./SECURITY_AND_PERMISSIONS.md), [OBSERVABILITY_AND_ANALYTICS.md](./OBSERVABILITY_AND_ANALYTICS.md), [EMAIL_AND_NOTIFICATIONS.md](./EMAIL_AND_NOTIFICATIONS.md) |
| Referenced by | [MVP_ROADMAP.md](./MVP_ROADMAP.md), [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) |

> **This is an engineering document, not legal advice.** It specifies what the product does with data so that a privacy notice can be written from facts, and so that the implementation does not quietly contradict the notice. `OQ-06` and `D-05` (account deletion) need a decision before launch; the recommendation in §5 is the default.

---

## 1. Purpose and scope

**In scope:** what personal data exists, where it lives, why it is collected, how long it is kept, how a person gets it back or has it removed, which subprocessors receive it, what cookies exist, and which practices are forbidden.

**Out of scope:** the text of the public privacy notice (marketing/legal owns it, this document is its source of truth), employment/contractor data, payment data (no payments in MVP).

**Design stance:** minimise by default. If a field is not needed for a stated purpose in §2, it is not collected — regardless of how useful it might be later.

---

## 2. Data map

| Data | Table / location | Why | Classification | Retention |
|---|---|---|---|---|
| Email address | `user.email` | Sign-in, verification, password reset, account notices | Personal | Life of account |
| Display name | `user.name` | Greeting, account settings | Personal | Life of account |
| Avatar URL | `user.image` (optional) | Account menu | Personal | Life of account |
| Password hash | `account.password` | Sign-in | Secret | Life of account (Better Auth scrypt) |
| OAuth subject | `account.provider_account_id` | Google sign-in (`SHOULD`) | Personal, pseudonymous | Life of account |
| Sessions | `session` | Staying signed in | Secret (token hash) | 30 days after expiry |
| Verification / reset tokens | `verification` | Email flows | Secret | 30 days after expiry |
| Attempts and answers | `assessment_attempts`, `attempt_items` | The product's core value: history and review | Personal, learning record | Indefinite; removed or anonymised on deletion |
| Derived stats | `user_topic_stats` | Dashboard accuracy | Personal | Recomputed; deleted with user |
| Usage events | `usage_events` | Product decisions (§[OBS](./OBSERVABILITY_AND_ANALYTICS.md)) | Pseudonymous (id + optional user id) | 90 days |
| Anonymous visitor id | `usage_events.anonymous_id` (cookie `ex_anon`) | Counting signed-out reads | Pseudonymous | 180 days (cookie), 90 days (rows) |
| Media uploaded by staff | Tigris + `media_assets` | Content images | May contain personal data in user-submitted files — staff-only in MVP | Until deleted |
| Audit log | `audit_logs` | Who published/deleted what | Personal (actor) | 400 days |
| Email suppression | `email_suppressions` (hashed) | Stop mailing a bouncing address | Pseudonymous | Until removed |
| Backups | Turso PITR + nightly dump in Tigris | Recovery | Copy of all of the above | 30 days (dump), provider window (PITR) |
| Server logs | Vercel | Debugging, security | Pseudonymous (ids, no email) | Platform window (1–3 days) |
| Error reports | Error tracker | Debugging | Pseudonymous (user id, no email) | 30 days |
| Search index | Qdrant + FTS5 rows | Search | Content only — **no personal data** | Follows content |

**Not collected:** IP addresses (not stored; used transiently for rate limiting by the platform/provider), user agents, precise location, phone numbers, birth dates, payment details, biometric data, advertising identifiers, third-party analytics cookies.

**Search queries are not stored as text.** `search_performed` records length and outcome, not the string ([OBSERVABILITY_AND_ANALYTICS.md](./OBSERVABILITY_AND_ANALYTICS.md) §6.1). This deliberately gives up keyword reporting in exchange for a much smaller privacy surface; a per-query log would be a separate decision with its own notice.

---

## 3. Purposes and lawful basis (framing for the notice)

| Purpose | Data | Basis (to be confirmed by counsel) |
|---|---|---|
| Provide the learning service (accounts, history, review) | Account, attempts, stats | Contract |
| Secure accounts (verification, reset, rate limiting) | Email, tokens, counters | Contract + legitimate interest (abuse prevention) |
| Operate and debug the service | Logs, errors, health | Legitimate interest |
| Understand product usage in aggregate | `usage_events` | Legitimate interest, pseudonymous, no ads, no sale |
| Publish editorial content | Author identity in `audit_logs` | Legitimate interest / contract with staff |

**No sale of personal data. No advertising. No third-party analytics or pixels. No profiling that changes what a student is shown** (adaptive difficulty is explicitly post-MVP and would require a new entry here).

---

## 4. Cookies and local storage

| Name | Purpose | Type | Lifetime | Consent |
|---|---|---|---|---|
| `better-auth.session_token` (name owned by the library) | Authentication | Strictly necessary | Session/30 days | Not required |
| `ex_anon` | Random id for signed-out usage counting | Strictly necessary? **Treated as analytics** | 180 days | Documented; no banner because no cross-site tracking |
| `ex_curriculum` | Remembers the chosen curriculum/level | Functional | 1 year | Not required |
| `ex_theme` | Not used (light only) | — | — | — |

Rules: no cookie is set before it is needed; no third-party cookies; no fingerprinting fallback; `ex_anon` is a random UUID v4 with no link to an account, rotated on clear. If a jurisdiction requires opt-in for any analytics cookie, the switch is to drop `ex_anon` (metrics then count only signed-in users) rather than to add a consent wall.

---

## 5. Access, export and deletion

### 5.1 Export (right of access / portability)

`GET /api/v1/account/export` (authenticated, rate-limited to 1/hour) returns a JSON document containing: account fields (no password hash, no OAuth subject), attempts with items and answers, topic stats, and the count of usage events. Delivered as a download, generated on demand, `no-store`. This is a **SHOULD** for launch and a **MUST** before any paid plan.

### 5.2 Deletion (recommended default — pending `D-05`)

Two options were considered:

| Option | What happens to attempts | Verdict |
|---|---|---|
| Hard delete | Attempts and items deleted with the user | Simple to explain, destroys product history and the accuracy denominators |
| **Anonymise** | `user_id` set to NULL, `deleted_user_hash` kept for uniqueness; answers and scores retained with no link to a person | **Recommended.** The learning record is not personal data once unlinkable, and the product keeps honest aggregate statistics |

Recommended procedure, executed inside one transaction by `DELETE /api/v1/account` after re-authentication (password or fresh OAuth):

1. Confirm with the typed email address; require a recent sign-in (< 10 minutes).
2. Delete `session`, `verification`, `account` rows for the user.
3. Delete `usage_events` rows where `user_id = ?`; do not touch `anonymous_id` rows (they are not linked).
4. Anonymise `assessment_attempts`: `user_id = NULL`, keep `score_percent_x100`, `submitted_at`, items.
5. Anonymise `audit_logs.actor_id` to a stable pseudonym; keep the action record.
6. Delete `user` row (`email`, `name`, `image`, hash gone). Write the `account-deleted` email **before** step 6, using the address captured at the start.
7. Insert a `usage_events` row `account_deleted` with no user id, for operational counting only.
8. Return `204`; the UI signs out and explains that history is retained anonymously.

Backups: deletion propagates on the next restore only if a restore is performed; the privacy notice must say that residual copies persist for up to 30 days in backups. A restore that reintroduces a deleted account must re-run the deletion log (see runbook `R8`).

**If counsel requires hard deletion**, the change is localised: delete attempts/items/stats instead of anonymising steps 4–5. No schema change is needed because `user_id` is already nullable.

### 5.3 Correction

Name and avatar are editable in `/account`. Email changes require verification of the new address (§ [EMAIL_AND_NOTIFICATIONS.md](./EMAIL_AND_NOTIFICATIONS.md) §3). Attempts and answers are **not** user-editable — they are a record of what the student did; deleting an attempt is offered as "remove from history", which anonymises the row's `user_id` (same mechanism as §5.2 step 4).

### 5.4 Children

The product is aimed at upper-secondary and university students. **Minimum age: 16**, self-attested at sign-up by an unticked checkbox; no date of birth is requested or stored; `user.age_attested_at` and `user.age_gate_version` record the attestation ([ADR-034](./ARCHITECTURE_DECISIONS.md#adr-034--minimum-age-16-self-attested-no-date-of-birth-stored)). The notice states the age and what happens to an account that does not meet it.

**Indonesia caveat, and it is a launch blocker.** UU 27/2022 treats a child's personal data as specific personal data (Art. 4(2)(e)) and requires parental or guardian consent to process it (Art. 25(2)); the article does not state an age, and its implementing regulation was pending when checked (2026-11-21). If counsel confirms the applicable age is 18, the Indonesian deployment must either gate at 18 or ship a parental-consent flow before sign-ups open. Do not enable Indonesian sign-ups on the 16+ attestation alone.

A reported under-16 account is suspended, then deleted through §5.2 — the same path as any other deletion, with a neutral message that does not confirm the reporter's suspicion.

---

## 6. Data-subject request handling (operational)

| Request | Channel | Who | Target |
|---|---|---|---|
| Export | Self-service `/account` | Product | Immediate |
| Deletion | Self-service `/account` | Product | Immediate (with the caveat in §5.2) |
| Correction | Self-service | Product | Immediate |
| Anything else (legal, law enforcement, complaint) | `privacy@<domain>` | Founder/ops | Acknowledge ≤ 72 h, resolve ≤ 30 days |

Every request is logged in a `privacy_requests` note (outside the product, in the ops drive) with date, type, action taken. Verification of identity for email-based requests: reply from the account address, or a signed-in session — never from a third party.

---

## 7. Security linkage

Privacy promises are only as good as the enforcement. The relevant guarantees and where they are specified:

- Passwords hashed with scrypt by Better Auth; sessions are httpOnly, Secure, SameSite=Lax cookies (`SECURITY_AND_PERMISSIONS.md` §5).
- Answer keys are never sent before submit; practice-mode reveals are per-question and never expose the whole key (§6).
- Database tokens are table/action-scoped; the browser never receives a database credential (`SECURITY_AND_PERMISSIONS.md` §9).
- No secret in logs, events or error reports (redaction test).
- Access to production data is limited to the founder/admin role; studio is `noindex` and role-gated.

---

## 8. Subprocessors

| Processor | Data | Location | Notes |
|---|---|---|---|
| Vercel | Request logs, runtime | Region chosen (`D-07`) | Hosting |
| Turso | All application data | Primary region + replicas | Database |
| Qdrant Cloud | Content text (public content only) | Cluster region | **No personal data** is embedded; only published content |
| Upstash | Job payloads (ids only), rate-limit keys | Global | QStash messages carry an id, not content |
| Tigris | Media objects, nightly dumps | Global endpoint | Dumps contain personal data — treat as production data |
| Google (Gmail/Workspace SMTP) | Address, message content | Google's region | [ADR-037](./ARCHITECTURE_DECISIONS.md#adr-037--google-smtp-as-the-mail-relay); Workspace terms and DPA required before the first production send, and a personal Gmail account is not acceptable in production |
| Sentry (error tracking) | Error payloads (pseudonymous), release, route pattern | Provider region | [ADR-032](./ARCHITECTURE_DECISIONS.md#adr-032--sentry-for-error-tracking-and-source-maps); session replay disabled |

Rules: a new subprocessor requires an entry here **and** in the public notice before use; Qdrant must never receive an unpublished resource, a draft question or anything containing a user id — the indexer payload is content-only, enforced by the `buildSearchPayload` function and a test that asserts no `user` field is present.

`@sendust/ts` is **not** a subprocessor: it is a library running inside our own function, with no account, no endpoint and no data of its own. It transmits a message to the relay and nowhere else, so the only processor to name in the notice is the relay.

---

## 9. Breach response

1. **Contain** (revoke tokens, rotate secrets, unpublish) — see `OPERATIONS_RUNBOOK.md` `R9`.
2. **Assess** scope: which tables, how many people, what categories, is it still exposed.
3. **Notify** the authority within 72 hours where required, and affected users without undue delay if the risk is high (credentials, learning records).
4. **Record** the incident, decision, and notification text in the ops drive.
5. **Fix** the cause and add a test that would have caught it.

A leaked `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET` or `TIGRIS_SECRET_ACCESS_KEY` is a notifiable incident by default; a leaked public content cache is not.

---

## 10. Dependencies

| Needs | From |
|---|---|
| Table list, retention, nullable `user_id` | `DATABASE_SCHEMA.md` §8–§10, §15 |
| Redaction and logging rules | `SECURITY_AND_PERMISSIONS.md` §11–§12 |
| Event properties and no-query-text rule | `OBSERVABILITY_AND_ANALYTICS.md` §6 |
| Suppression hashing | `EMAIL_AND_NOTIFICATIONS.md` §6 |
| Backup retention and restore drill | `DEPLOYMENT_AND_ENVIRONMENTS.md` §7 |

---

## 11. Edge cases

| # | Case | Behaviour |
|---|---|---|
| PR-01 | Deletion while an attempt is in progress | Attempt is closed (`abandoned`) and anonymised; the open tab shows "this account was deleted" |
| PR-02 | Deletion request with an active subscription record | `entitlements` row retained with `user_id` nulled; requires the future billing decision |
| PR-03 | User asks which subprocessors hold their data | Answer from §8, not from memory |
| PR-04 | Data in a backup | Stated in the notice; restored copies are re-anonymised per the deletion log |
| PR-05 | Anonymous id later linked to an account | Never linked by design; a signed-in event writes `user_id` and no `anonymous_id` |
| PR-06 | Staff uploads an image containing a student's name | Treated as personal data; studio delete + purge; editorial guide forbids it |
| PR-07 | Law-enforcement request | Escalate to counsel; do not disclose from the product console |
| PR-08 | Search index contains an unpublished resource | Defect: cleanup job + incident note; the privacy impact is content exposure, not personal data |

---

## 12. Acceptance criteria

1. The data map in §2 matches the live schema (reviewed whenever a table is added).
2. `/account` offers export and deletion; deletion performs exactly the steps in §5.2 and is covered by an integration test asserting no row still references the email.
3. A deleted user's attempts remain with `user_id IS NULL` and are unreachable from any session.
4. No personal data appears in Qdrant payloads, `usage_events.props_json`, logs, error reports or `job_runs` (redaction tests).
5. Cookies set by the site are exactly the list in §4; a test enumerates `Set-Cookie` headers on the main flows.
6. Search queries are never persisted as text.
7. Every subprocessor in §8 has a signed DPA before launch; the list matches the privacy notice.
8. `privacy@` requests are acknowledged within 72 hours (manual check each quarter).

---

## 13. Open questions

| # | Question | Impact |
|---|---|---|
| OQ-PR1 | ~~Minimum age?~~ Recommended 16, self-attested ([ADR-034](./ARCHITECTURE_DECISIONS.md#adr-034--minimum-age-16-self-attested-no-date-of-birth-stored)); the recommendation is decided, the jurisdiction's consent age is not | Age gate, notice text, `D-11`; **Open — needs:** counsel's confirmation of the consent age, which may force 18+ or a parental-consent flow; **blocks Phase 7** (before Indonesian sign-ups open) |
| OQ-PR2 | Is `ex_anon` acceptable as a non-consented analytics cookie in the launch market? | If not, drop anonymous counting — **Open — needs:** decide whether `ex_anon` is lawful as a non-consented cookie in the launch market; **blocks Phase 2**. |
| OQ-PR3 | ~~Anonymise vs hard-delete attempts (`D-05`)~~ **Resolved as an implementation question: anonymise**, per §5.2 steps 4–5; hard delete stays a documented, localised branch if counsel requires it (§5.2) | The *policy* call is still open as `D-05`; either branch is specified, so Phase 2 deletion work is not blocked |
| OQ-PR4 | Data residency requirement for Indonesian users (`D-07`) | Turso/Tigris region choice — **Open — needs:** decide the data-residency requirement (`D-07`); **blocks Phase 1**. |
| OQ-PR5 | Who is the named data controller and what is the contact address? | Notice, DPA signatures — **Open — needs:** name the data controller and the contact address; **blocks Phase 7**. |
