# Traceability Matrix — Exampify

| Field | Value |
|-------|-------|
| Version | 1.4 |
| Status | Current — derived from the requirement tables and checked by `docs/check.py` |
| Covers | `FR-DISC`, `FR-SEARCH`, `FR-AUTH`, `FR-CMS`, `FR-QB`, `FR-PRAC`, `FR-PROG`, `FR-OPS`, `NFR-01…19` — 113 IDs from `PRODUCT_REQUIREMENTS.md` §5 |
| Checked by | `python3 docs/check.py` (every requirement appears here exactly once) |

---

## 1. Purpose and how to read this

This document answers one question per requirement: **where is this actually specified?** It is a reading aid, not a new source of truth. A requirement's text, priority and acceptance live in [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md); a route's contract lives in [API_CONTRACTS.md](./API_CONTRACTS.md); a column's constraints live in [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md). Nothing here overrides those.

**How the cells were filled.** A section is listed only if it states how the requirement is met, not merely if it mentions the area. An endpoint is listed only if it serves or mutates the requirement's data. A table is listed only if it stores it. `—` means the search found no home; it is a finding, not a placeholder. Every row was traced by reading the documents, so the matrix shows what the set says today, not what it would be convenient to claim.

**Verification passes.** v1.1: the riskiest rows were re-read against their sources — `FR-CMS-11`, every `NFR` row, and every `covered` row with no endpoint. v1.2: a second pass over `covered` rows that had never been re-read, checking each cited section for the specific claim. Where a citation named a subsection that does not state the requirement, it was corrected (`SEC §7` → `CM §10` for auditing, `SEO §3` → `SEO §5` for Core Web Vitals, `TECH §5` → `SEC §4.1` for cookie flags). Where the cited sections do not contain the behaviour at all — not merely a weaker target — the row was downgraded (`FR-CMS-01`, `FR-CMS-13`). Citations that added nothing to a row were cut rather than kept as decoration. v1.3: the two structural findings were closed — the undefined `FR-CONTENT-02` citation was replaced by the requirements that carry the claim, and technical SEO became `FR-DISC-14` instead of an uncited surface. v1.4: the two source errors this matrix had only recorded were fixed in the sources — `SEO` §6 now cites `FR-CMS-12` for the slug 301, and `JOBS` §10 now describes the `/health` payload `API` §8 defines.

**Column meanings**

| Column | Meaning |
|---|---|
| ID | The requirement ID, in `PRODUCT_REQUIREMENTS.md` §5 order |
| Requirement | A short restatement; the source row is authoritative |
| Sections | Where the behaviour is specified, as `DOC §section` |
| Endpoints | Under `/api/v1`, the path that serves it (methods only where ambiguous) |
| Tables | Tables from `DATABASE_SCHEMA.md`; "—" when the behaviour is computed or presentational |
| Status | `covered` (spec'd end to end), `partial` (spec'd but with a known hole), `gap` (no implementation home), `deferred` (priority `LATER`, deliberately absent), `constraint` (a design rule, not a feature) |

**Document abbreviations used in the Sections column**

| Abbrev. | Document |
|---|---|
| PR | [PRODUCT_ARCHITECTURE.md](./PRODUCT_ARCHITECTURE.md) |
| IA | [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md) |
| UF | [USER_FLOWS.md](./USER_FLOWS.md) |
| DB | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) |
| CM | [CONTENT_MODEL.md](./CONTENT_MODEL.md) |
| QE | [QUESTION_ENGINE.md](./QUESTION_ENGINE.md) |
| API | [API_CONTRACTS.md](./API_CONTRACTS.md) |
| SRCH | [SEARCH_ARCHITECTURE.md](./SEARCH_ARCHITECTURE.md) |
| JOBS | [BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md) |
| SEO | [SEO_AND_CONTENT_STRATEGY.md](./SEO_AND_CONTENT_STRATEGY.md) |
| UI | [UI_UX_GUIDELINES.md](./UI_UX_GUIDELINES.md) |
| DS | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| ROAD | [MVP_ROADMAP.md](./MVP_ROADMAP.md) |
| TECH | [TECHNICAL_STANDARDS.md](./TECHNICAL_STANDARDS.md) |
| SEC | [SECURITY_AND_PERMISSIONS.md](./SECURITY_AND_PERMISSIONS.md) |
| TEST | [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) |
| DEP | [DEPLOYMENT_AND_ENVIRONMENTS.md](./DEPLOYMENT_AND_ENVIRONMENTS.md) |
| OBS | [OBSERVABILITY_AND_ANALYTICS.md](./OBSERVABILITY_AND_ANALYTICS.md) |
| EMAIL | [EMAIL_AND_NOTIFICATIONS.md](./EMAIL_AND_NOTIFICATIONS.md) |
| PRIV | [PRIVACY_AND_DATA_PROTECTION.md](./PRIVACY_AND_DATA_PROTECTION.md) |
| OPS | [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) |
| ED | [EDITORIAL_GUIDE.md](./EDITORIAL_GUIDE.md) |
| I18N | [INTERNATIONALIZATION.md](./INTERNATIONALIZATION.md) |

---

## 2. Discovery and public content (`FR-DISC`)

| ID | Requirement | Sections | Endpoints | Tables | Status |
|---|---|---|---|---|---|
| FR-DISC-01 | Homepage: value proposition, curriculum/level picker, popular subjects, search entry | IA §3, IA §4.1, UI §3, SEO §3 | GET /subjects, GET /search | subjects | covered |
| FR-DISC-02 | Subject directory grouped by subject group, filterable by curriculum and level | IA §4.1, UI §3 | GET /subjects | subjects, subject_groups | covered |
| FR-DISC-03 | Subject page lists chapters in order with topic counts and summaries | IA §4.1, UI §3 | GET /subjects/{subjectId}, GET /subjects/{subjectId}/chapters | chapters, topics | covered |
| FR-DISC-04 | Chapter page lists topics with study time and format badges | IA §4.1, UI §3 | GET /chapters/{chapterId} | topics, learning_resources, assessments | covered |
| FR-DISC-05 | Topic hub shows objectives and every published resource and assessment with its derived format | IA §4.1, CM §4, UI §3 | GET /topics/{topicId}, GET /topics/{topicId}/resources, GET /topics/{topicId}/assessments | topics, learning_resources, assessments, resource_assessments | covered |
| FR-DISC-06 | Study material renders every block type with previous/next navigation | CM §5, UI §3 | GET /resources/{resourceId} | content_blocks, media_assets | covered |
| FR-DISC-07 | Lesson renders its blocks and its linked assessment inline or at the end | CM §4, UF F1, UI §3 | GET /resources/{resourceId} | resource_assessments, assessments | covered |
| FR-DISC-08 | Practice test page states scope, question count and duration before starting | API §4, UI §3, UF F5 | GET /assessments/{assessmentId} | assessments, assessment_items | covered |
| FR-DISC-09 | Only `published` content reachable anonymously; drafts 404 | SEC §6, CM §6, API §4 | all public GETs | status columns on content tables | covered |
| FR-DISC-10 | Breadcrumbs reflect the hierarchy and are machine-readable (`BreadcrumbList`) | IA §6, SEO §3 | GET /topics/{topicId} (`breadcrumbs`) | curricula, education_levels, subjects, chapters, topics | covered |
| FR-DISC-11 | Empty states suggest adjacent content instead of a dead end | UI §10, UF F12 | — | — | covered |
| FR-DISC-12 | "Continue where you left off" for signed-in users with a resumable attempt (SHOULD) | — | — | — | gap |
| FR-DISC-13 | Topic shows related resources from the same subject (SHOULD) | CM §5 (`related_material`), UI §3 | GET /resources/{resourceId} | content_blocks | partial — `ROAD` §12 cut-list item 3 drops it first |
| FR-DISC-14 | Technical SEO: unique metadata, canonical URL, Open Graph, JSON-LD, sitemap index + segments and robots for exactly the published, indexable URLs | SEO §3.2, SEO §3.4, SEO §3.5, SEO §9, IA §9 | GET /sitemap.xml and its segment files, GET /robots.txt (document routes, not `/api/v1`) | — (computed from published rows) | covered |

---

## 3. Search (`FR-SEARCH`)

| ID | Requirement | Sections | Endpoints | Tables | Status |
|---|---|---|---|---|---|
| FR-SEARCH-01 | Return subjects, chapters, topics, resources and assessments, grouped by type | SRCH §3, SRCH §9, API §4.1 | GET /search | search_documents | covered |
| FR-SEARCH-02 | Understand natural-language queries that do not use the content's wording | SRCH §3, SRCH §5, SRCH §9 | GET /search | search_documents (plus the Qdrant collection, PR §4) | covered |
| FR-SEARCH-03 | Tolerate common misspellings and return the intended entity | SRCH §8 | GET /search | search_terms | covered |
| FR-SEARCH-04 | Autocomplete with prefix matches, subject awareness and keyboard navigation | SRCH §7 (incl. keyboard contract), UI §3.4 | GET /search/suggest | search_terms | covered |
| FR-SEARCH-05 | Filters for curriculum, level, subject and content type | SRCH §9, API §4.2 | GET /search | search_documents (payload filters) | covered |
| FR-SEARCH-06 | Exact title matches rank first for their entity type | SRCH §9 | GET /search | search_documents | covered |
| FR-SEARCH-07 | Never return drafts, archived content, questions or answer material | SRCH §12, SEC §5 | GET /search | search_documents (`status`) | covered |
| FR-SEARCH-08 | Degrade to keyword results when the semantic index is unavailable | SRCH §13 | GET /search | — | covered |
| FR-SEARCH-09 | Recent and popular searches (SHOULD) | — | — | — | partial — `ROAD` §12 cut-list item 4, no contract |
| FR-SEARCH-10 | Content becomes searchable within 60 s of publication (SHOULD) | SRCH §10, JOBS §3, JOBS §8 | POST /internal/jobs/index-content | search_events, search_documents | covered |
| FR-SEARCH-11 | Results show why they matched, not only the title (LATER) | IA §8, API §4.1 (`matchedSection`) | GET /search | search_documents | partial — response field exists; ranking rationale is LATER |

---

## 4. Authentication (`FR-AUTH`)

| ID | Requirement | Sections | Endpoints | Tables | Status |
|---|---|---|---|---|---|
| FR-AUTH-01 | Sign up and sign in with email + password | SEC §4, API §3 | POST /auth/sign-up, POST /auth/sign-in | user, account, session | covered |
| FR-AUTH-02 | Email verification required before the first attempt | SEC §4.1, SEC §4.3, EMAIL §3, API §5.1 | POST /auth/verify-email, POST /attempts (`401 EMAIL_NOT_VERIFIED`) | user (`email_verified`), verification | covered |
| FR-AUTH-03 | Password reset via emailed token | SEC §4, EMAIL §3, API §3 | POST /auth/request-password-reset, POST /auth/reset-password | verification, session | covered |
| FR-AUTH-04 | Google OAuth as an alternative (SHOULD) | SEC §4, API §3 | GET /auth/oauth/google/start, GET /auth/oauth/google/callback | account | covered |
| FR-AUTH-05 | Cookie sessions, `HttpOnly`/`Secure`/`SameSite=Lax`, revocable server-side | SEC §4.1, API §3, SEC §6 | GET /auth/session, GET /account/sessions | session | covered — `TECH` §5 is server/client boundaries and says nothing about cookies |
| FR-AUTH-06 | Sign out and revoke all other sessions | API §3 | POST /auth/sign-out, DELETE /auth/sessions | session | covered |
| FR-AUTH-07 | Account deletion removes personal data and anonymises attempts (SHOULD) | PRIV §5, SEC §6, API §3 | DELETE /account | user, assessment_attempts, audit_logs | partial — procedure depends on `D-05` |
| FR-AUTH-08 | Staff reach `/studio` with role gating and no RSC data leak | SEC §3, API §7, IA §4.3 | every /studio route | user (`role`) | covered |

---

## 5. Content management (`FR-CMS`)

| ID | Requirement | Sections | Endpoints | Tables | Status |
|---|---|---|---|---|---|
| FR-CMS-01 | Create/edit/reorder/archive curricula, levels, subject groups and subjects | API §7.1, CM §4, SEC §3, DB §6 | /studio/curricula, /studio/levels/{id}, /studio/subjects, /studio/{entity}/{id}, /studio/{entity}/reorder | curricula, education_levels, subject_groups, subjects | partial — no studio endpoint for `subject_groups` exists: `API` §7.1 covers curricula, levels, subjects, chapters and topics, and groups are read-only (seeded, filtered via `?groupId=`) |
| FR-CMS-02 | Create/edit/reorder/archive/publish chapters and topics | API §7.1, CM §4, IA §4.3 | /studio/chapters, /studio/topics, /studio/{entity}/transition | chapters, topics | covered |
| FR-CMS-03 | Compose a resource from ordered blocks of all ten kinds | CM §5, API §7.2, DS §9.10, UI §3.13 | /studio/resources/{id}/blocks | content_blocks | covered |
| FR-CMS-04 | Shared Zod validation per block; reorder without data loss | CM §5, API §7.2, TECH §6 | PATCH /studio/blocks/{blockId}, /studio/resources/{id}/blocks/reorder, /blocks/validate | content_blocks | covered |
| FR-CMS-05 | Assessments with ordered questions, mode, duration and a resource placement | CM §4, API §7.3 | /studio/assessments, /studio/resources/{id}/assessments | assessments, assessment_items, resource_assessments | covered |
| FR-CMS-06 | A resource needs no assessment, and an assessment needs no resource | CM §4, DB §7, API §7.2 | /studio/resources, /studio/assessments | nullable links in resource_assessments | covered |
| FR-CMS-07 | Studio shows the derived format and recomputes it on link changes | CM §4, API §7.2 | GET /studio/topics/{topicId}/resources, DELETE /studio/resources/{id}/assessments/{assessmentId} | computed from resource_assessments | covered |
| FR-CMS-08 | `draft → in_review → published → archived` with per-entity gates | CM §6, API §7.5 | POST /studio/{entity}/{id}/transition | status columns, published_at | covered |
| FR-CMS-09 | Publication blocked when required fields are missing | CM §4, CM §6, QE §10 | /studio/resources/{id}/blocks/validate, /studio/{entity}/validate, /studio/{entity}/{id}/transition | content_blocks, questions | covered |
| FR-CMS-10 | Staff-only, `noindex` draft preview at the real URL shape | API §7.2, SEC §6, IA §4.3 | GET /studio/resources/{id}/preview | — | covered |
| FR-CMS-11 | Every content mutation writes an audit entry with actor, entity, time and changed fields | CM §10 (item 10), API §7.1, SEC §6, DB §10.6 | GET /studio/audit (read-only; the write is part of each mutating studio call) | audit_logs | covered — `SEC` §7 governs input/output safety, not auditing; the acceptance test is `CM` §10 item 10 |
| FR-CMS-12 | Slugs generated, unique per parent, 301 on change | IA §5, SEO §6, CM §4, DB §10.5 | — (written by the slug-changing PATCH into `redirects`) | redirects, slug columns | covered |
| FR-CMS-13 | Studio lists: search, status filter, sort, cursor pagination | API §7.1, API §7.3, API §7.4, API §10, UI §3.13 | GET /studio/subjects, /topics, /assessments, /questions, /studio/search | — | partial — only subjects, topics, assessments and questions take `q`/`sort`/`cursor`; curricula, levels and chapters take none, and cross-entity draft search is the separate `GET /studio/search` |
| FR-CMS-14 | Presigned direct uploads, server-side type/size checks, alt text before publish | CM §8, TECH §11, API §7.6 | POST /studio/media/upload-url, POST /studio/media/{mediaId}/confirm, PATCH /studio/media/{id} | media_assets | covered |
| FR-CMS-15 | Protect unsaved changes; optimistic concurrency via `expectedUpdatedAt` | API §2, API §12, UI §4 (confirmation), UI §3.13 (unload guard) | every studio PATCH | updated_at / version columns | covered — `TECH` §6 is Zod validation and never mentions `expectedUpdatedAt` |
| FR-CMS-16 | Reviewer returns content to `draft` with a reason (SHOULD) | CM §6, API §7.5 | POST /studio/{entity}/{id}/transition | audit_logs | covered |
| FR-CMS-17 | Bulk actions (archive N, move N) (LATER) | — | — | — | deferred |
| FR-CMS-18 | Revision history with diff and rollback (LATER) | — | — | — | deferred |

---

## 6. Question bank (`FR-QB`)

| ID | Requirement | Sections | Endpoints | Tables | Status |
|---|---|---|---|---|---|
| FR-QB-01 | Author the four question types | QE §3, API §7.4 | /studio/questions | questions, question_options | covered |
| FR-QB-02 | Stem, topic, difficulty, answer key and non-empty explanation to publish | QE §3, QE §10, DB §8.1 | POST /studio/questions/validate | questions | covered |
| FR-QB-03 | 2–8 options; one correct for `multiple_choice`, two or more for `multiple_select`, fixed `true_false` | QE §3, DB §8.2 | /studio/questions | question_options, questions (answer_key) | covered |
| FR-QB-04 | Per-option feedback (SHOULD) | DB §8.2 (`feedback_md`), UI §3 | /studio/questions, GET /attempts/{id}/review | question_options | covered |
| FR-QB-05 | Short answer accepts a list of answers plus normalisation rules | QE §3, QE §5, DB §8.1 | /studio/questions | questions (answer_key) | covered |
| FR-QB-06 | One optional image with alt text per question | DB §8.1 (`media_id`), CM §8 | /studio/questions, /studio/media | questions (media_id), media_assets | covered |
| FR-QB-07 | Cross-list a question under multiple topics, one primary | QE §2, QE §11, DB §8.3 | /studio/questions | question_topics | covered |
| FR-QB-08 | Ordered, reusable assessment collections with per-item points override | QE §2, CM §4, API §7.3 | /studio/assessments | assessment_items (`points_x100`), resource_assessments | covered |
| FR-QB-09 | Question and assessment status transitions match `FR-CMS-08` | CM §6, QE §10 | POST /studio/{entity}/{id}/transition | status columns | covered |
| FR-QB-10 | Library filters by subject, topic, type, difficulty, status and author | API §7.4 | GET /studio/questions | questions | covered |
| FR-QB-11 | CSV import with row-level errors (LATER) | — | — | — | deferred |
| FR-QB-12 | Near-duplicate detection warns the author (LATER) | — | — | — | deferred |
| FR-QB-13 | New question types addable without changing the attempt schema | QE §13, DB §8.1, DB §9.2 | — | questions (answer_key), attempt_items | constraint |

---

## 7. Student practice (`FR-PRAC`)

| ID | Requirement | Sections | Endpoints | Tables | Status |
|---|---|---|---|---|---|
| FR-PRAC-01 | Start practice from topic, chapter, subject, inline section or published assessment | API §5.1, UF F5, IA §4.2 | POST /attempts | assessment_attempts | covered |
| FR-PRAC-02 | Server selects and snapshots questions; the client never chooses | QE §7, API §5.1, SEC §5 | POST /attempts | attempt_items | covered |
| FR-PRAC-03 | Runner shows one question at a time with position, navigation and palette | UI §3, UI §4, API §5.2 | GET /attempts/{id} | attempt_items | covered |
| FR-PRAC-04 | Answers save as the student navigates | API §5.3, UI §4 | PATCH /attempts/{id}/answers | attempt_items | covered |
| FR-PRAC-05 | Review and change answers before submit | API §5.3, UI §3 | PATCH /attempts/{id}/answers | attempt_items | covered |
| FR-PRAC-06 | Server-side grading; the answer key never reaches the client before submit | QE §6, QE §12, SEC §5, API §5.4 | POST /attempts/{id}/submit | questions (answer_key), attempt_items | covered |
| FR-PRAC-07 | Review shows answer, correct answer, points, explanation and option feedback | QE §6, API §5.5, UI §3 | GET /attempts/{id}/review | attempt_items, questions (explanation_md), question_options (feedback_md) | covered |
| FR-PRAC-08 | Abandon marks `abandoned`, keeps answers, excludes from accuracy | QE §8, QE §11, API §5.5 | POST /attempts/{id}/abandon | assessment_attempts | covered |
| FR-PRAC-09 | Attempts expire after 24 h of inactivity, unscored | QE §8, JOBS §8, API §8 | POST /internal/cron/expire-attempts | assessment_attempts (`expires_at`) | covered |
| FR-PRAC-10 | Runner is keyboard-complete and announces state to screen readers | UI §3.10 (keys: `1–8`, `←/→`, `Enter`, `Esc`), UI §8, DS §10 | — | — | covered |
| FR-PRAC-11 | Retry with a fresh selection and the same configuration | API §5.5, QE §7 | POST /attempts/{id}/retry | assessment_attempts | covered |
| FR-PRAC-12 | `practice` reveals per question; `test`/`mock` withhold until submit | QE §8, API §5.3 (`reveal`) | PATCH /attempts/{id}/answers | — | covered |
| FR-PRAC-13 | `test`/`mock` duration enforced server-side at submit | QE §8, API §5.4 | POST /attempts/{id}/submit | assessment_attempts (duration, `over_time_seconds`) | covered |
| FR-PRAC-14 | Hints and per-question flagging (LATER) | — | — | — | deferred |

---

## 8. Progress (`FR-PROG`)

| ID | Requirement | Sections | Endpoints | Tables | Status |
|---|---|---|---|---|---|
| FR-PROG-01 | Dashboard totals: attempts, answered, accuracy, 30-day activity | API §6, UI §3, UF F7 | GET /progress/summary | assessment_attempts | covered |
| FR-PROG-02 | Topic performance table with accuracy and last-practised, sortable/filterable | API §6, UI §3 | GET /progress/topics | user_topic_stats | covered |
| FR-PROG-03 | Up to five focus topics (≥ 5 answers, < 60 %), weakest first | API §6 (`focusTopics`), UI §3, UI §6 | GET /progress/summary | user_topic_stats | covered |
| FR-PROG-04 | Attempt history paginated, filterable, linking to read-only review | API §5.5, API §6, UF F7 | GET /attempts, GET /attempts/{id}/review | assessment_attempts | covered |
| FR-PROG-05 | Topic page shows the signed-in student's accuracy (SHOULD) | API §4.1 (`studentAccuracy`), UI §3 | GET /topics/{topicId} | user_topic_stats | covered |
| FR-PROG-06 | Progress recomputes from attempts and survives re-grading (SHOULD) | DB §9.3, JOBS §8 | POST /internal/cron/reconcile-stats | user_topic_stats, assessment_attempts | covered |
| FR-PROG-07 | Study progress (read vs practised) tracked separately (SHOULD) | API §6, OBS §6 | GET /progress/study | usage_events | covered |
| FR-PROG-08 | Recommendations and spaced repetition (LATER) | — | — | — | deferred |
| FR-PROG-09 | CSV / account data export (LATER) | API §3, PRIV §5 | GET /account/export | — | partial — the endpoint exists while `OQ-06` says "defer export" |

---

## 9. Platform and operations (`FR-OPS`)

| ID | Requirement | Sections | Endpoints | Tables | Status |
|---|---|---|---|---|---|
| FR-OPS-01 | Publishing enqueues indexing without blocking the response | JOBS §4, SRCH §10, CM §6 | publish path → POST /internal/jobs/index-content | search_events, job_runs | covered |
| FR-OPS-02 | Indexing converges after a failed delivery (outbox + sweeper) | JOBS §4, JOBS §7, JOBS §8 | POST /internal/jobs/index-content | search_events, job_runs | covered |
| FR-OPS-03 | Unpublished/deleted content leaves search within 60 s | SRCH §10, OBS §5 | POST /internal/jobs/index-content | search_events, search_documents | covered |
| FR-OPS-04 | Reconciliation job reports and repairs index drift | JOBS §3, JOBS §8, OBS §5 | POST /internal/cron/reconcile-search | search_documents, search_events | covered |
| FR-OPS-05 | Purge media blobs only once references are gone | DB §15, JOBS §8 | POST /internal/cron/purge-media | media_assets | covered |
| FR-OPS-06 | `/api/v1/health` reports dependencies without leaking configuration | API §8, DEP §7, OBS §5 | GET /health | — | covered |
| FR-OPS-07 | Prune expired attempts, tokens and audit rows on a schedule | DB §15, JOBS §8 | POST /internal/cron/prune | session, verification, audit_logs, usage_events | covered |

---

## 10. Non-functional requirements (`NFR`)

| ID | Requirement | Sections | Endpoints | Tables | Status |
|---|---|---|---|---|---|
| NFR-01 | LCP < 2.5 s p75 mobile, INP < 200 ms, CLS < 0.1 | SEO §5 (Core Web Vitals row), TEST §3.6, TECH §15 | — | — | covered — `SEO` §3 only says it depends on `NFR-01`; the numeric targets are in `SEO` §5 |
| NFR-02 | p95 < 300 ms reads, < 500 ms submit (10 questions) | OBS §5 | — | — | partial — the SLOs state content TTFB < 500 ms and answer-save < 300 ms, not these targets |
| NFR-03 | p95 < 600 ms full search, < 120 ms suggest | SRCH §11, OBS §5 | GET /search, GET /search/suggest | — | partial — `OBS` §5 sets search p95 < 800 ms |
| NFR-04 | 99.5 % monthly availability for public pages; search may degrade | OBS §5, DEP §7 | — | — | covered |
| NFR-05 | WCAG 2.2 AA, contrast ≥ 4.5:1, visible focus, keyboard paths | UI §8, DS §10, TEST §3.5 | — | — | partial — no document claims WCAG 2.2 AA conformance; `TEST` §3.5 is axe-core (zero critical/serious) plus one screen-reader smoke test, and 2.2 criteria such as focus-not-obscured are never named |
| NFR-06 | 360 px → 1920 px, no horizontal scroll, targets ≥ 44 px | UI §2.1, UI §9, DS §10, TEST §8 | — | — | partial — templates start at 360 px and the container stops at 1280 px (`UI` §2.1); QA checks 360/768 only (`TEST` §8); 1920 px is never stated or tested |
| NFR-07 | `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`, no `any` | TECH §3.1, TECH §3.2 | — | — | covered |
| NFR-08 | Nightly logical dump + PITR; RPO ≤ 24 h, RTO ≤ 4 h | DB §15, DEP §7, OPS §3, ROAD §10 | — | — | covered |
| NFR-09 | OWASP Top 10 mitigations; no answer-key leak before submit | SEC §2, SEC §7, SEC §8, SEC §9, TEST §3 | — | — | partial — "OWASP Top 10" appears only in the requirement; mitigations are spread across the threat model and §7–§9 with no category-by-category mapping to check against |
| NFR-10 | Structured logs, error tracking, request ids, slow-query log | OBS §2, OBS §3, OBS §4, TECH §12 | — | — | covered |
| NFR-11 | ≥ 80 % coverage on scoring, validation, permissions, index sync | TEST §5 | — | — | partial — 95/90/100 % for scoring, validation and permissions, but index sync has no named target and the 80 % services line is "reported, not blocking" (`OQ-T5` still open) |
| NFR-12 | 144k topics; page queries O(1) in depth | TECH §15, DB §6, DB §7, DB §12 | — | content tables | partial — the ≤ 6-statement query budget is stated and indexed; the 144k shape (and "O(1) in depth") is never exercised |
| NFR-13 | 500k questions; selection < 150 ms | QE §7, QE §16, TEST §3.6 | — | questions, question_topics | partial — the only stated measurement is 10 questions from a 10,000-question pool (`QE` §16); `ROAD` §6 accepted `FR-QB` only, so 500k is never exercised |
| NFR-14 | 100k search documents without re-architecture; 5 M vectors as the ceiling | SRCH §11, PR §3, ADR-018 | — | search_documents | partial — 100k is the stated revisit trigger, not a tested ceiling |
| NFR-15 | Last 2 versions of Chrome, Safari, Firefox, Edge; iOS Safari 16+ | — | — | — | gap — no document states a browser support matrix |
| NFR-16 | GDPR-ready posture: minimal PII, documented retention, deletion path | PRIV §2, PRIV §5, PRIV §12, DB §15 | — | user, session, audit_logs, assessment_attempts | covered — the requirement asks for a GDPR-ready posture, which is exactly what `README` promises ("GDPR-shaped posture only", not lawyer-reviewed) |
| NFR-17 | Swapping DB driver, object store or vector store touches one module each | TECH §9, TECH §11, PR §6, PR §3.4 | — | — | covered — `lib/db`, `lib/storage` and `lib/search` are the stated seams; only the driver swap names a concrete trigger (`PR` §3.4) |
| NFR-18 | Every auth email queued, idempotent, retried; no inline send; no marketing mail | EMAIL §4, EMAIL §5, JOBS §3 | POST /internal/jobs/send-email | job_runs, verification, email_suppressions | covered |
| NFR-19 | First-party, server-authoritative analytics, pseudonymous, 90-day retention | OBS §6, OBS §7, API §16.1 | POST /events | usage_events | covered |

---

## 11. Requirements with no implementation home

- **`FR-DISC-12` (SHOULD) — "Continue where you left off".** Exists only as a requirement and an acceptance line (`PR` §11). No page section, endpoint or query returns a resumable attempt for the homepage or dashboard; `GET /attempts?status=in_progress` is not specified as the mechanism. Either specify it (dashboard summary plus the attempts list) or drop it to LATER.
- **`NFR-15` — browser support.** No supported-browser matrix anywhere in the set. `TEST` §8 does not name browsers and `UI` §9 stops at viewport widths. This needs a decision and a home (UI §9 or TEST §8), not code.

**Near-misses worth knowing** (`partial` rows above): `FR-CMS-01` is missing only the `subject_groups` writer; `FR-CMS-13` is a real but partial feature (four lists, not all of them); `FR-AUTH-07` is blocked on `D-05` rather than unspecified; `FR-DISC-13`, `FR-SEARCH-09` and `FR-SEARCH-11` are SHOULD/LATER items with an explicit cut-list entry or a response field but no delivered behaviour; `FR-PROG-09` contradicts the deletion scope in `OQ-06` by shipping an export endpoint; `NFR-02`/`NFR-03` disagree with the SLOs; `NFR-05`/`NFR-06`/`NFR-09`/`NFR-11` have concrete sub-rules but no conformance statement or target for the requirement as written; `NFR-12`/`NFR-13`/`NFR-14` are targets with no test at their stated scale.

---

## 12. Surfaces with no requirement behind them

These are specified behaviours that no `FR-*`/`NFR-*` claims. They are not automatically wrong — but each is either a missing requirement or a removable surface, and the set should say which.

| Surface | Where specified | Nearest requirement | Verdict |
|---|---|---|---|
| Duplicate endpoints for resources, assessments and questions, and the duplicate-block rule | API §7.2–§7.4, CM §7 | none | **Missing requirement.** Deep copy is a product behaviour (`CM` §7) with fresh block ids and by-reference items, but nothing in the requirement table asks for it. |
| `GET /api/v1/subjects/{subjectId}/practice-availability` | API §4 | FR-PRAC-01 (entry points) | **Missing requirement.** Availability counts drive the practice configuration UI; no requirement states that the button must know how many questions exist. |
| `GET /api/v1/account/sessions` and `DELETE /api/v1/account/sessions/[id]` | API §3, IA §4.2 | FR-AUTH-06 covers revoke-all only | **Missing requirement.** Per-device listing and revocation is specified in the contract and `/account` route with no requirement behind it. |
| `GET /api/v1/openapi.json` plus the CI regeneration gate | API §16.2, ROAD §4.6 | none | **Deliberate process control**, not a product requirement. It belongs to `TECH`'s review rules, not to the requirement table. |
| `entitlements` table | DB §9.4, ADR-012 | none | **Deliberate.** Inert by decision; no MVP requirement may read it. Keep it uncited. |
| Motion rules (durations, easing, reduced motion) | DS §7 | NFR-05 covers reduced motion only | **Deliberate design guidance.** Fine to leave uncited; note that nothing requires motion at all. |
| Editorial quality bar (structure, tone, review checklist) | ED §2–§6, §8–§10 | FR-CMS-03 covers what is stored, not how it reads | **Deliberate.** Content quality is a guide, not a testable requirement; `ED` §13 acceptance is the closest thing to a contract. |

**Resolved in v1.3.** Technical SEO was the one orphan that gated launch. It is now `FR-DISC-14`, referenced from `SEO` §1. Phase 1 already builds it (`ROAD` §4.2) and already accepted the sitemap rule (`ROAD` §4.4), so the requirement closed a traceability hole rather than adding work.

---

## 13. Requirements no phase's acceptance criteria claims

`MVP_ROADMAP.md` acceptance lines list ranges, and the ranges have holes. These requirements are never named by a phase, so nothing verifies them before launch:

| Requirement | Phase that implements it | Gap |
|---|---|---|
| FR-DISC-10, FR-CMS-07, FR-AUTH-07 | 1, 2, 2 | Phase 1 lists `FR-DISC-01…09, 11, 14`; Phase 2 lists `FR-CMS-01…06, 08…16` and `FR-AUTH-01…06, 08`. Breadcrumbs, derived format and deletion are implemented but never accepted. |
| FR-OPS-05, FR-OPS-06, FR-OPS-07 | 6, 1, 1 | Phase 6 lists `FR-OPS-01…04` only; the media purge, health and prune tasks in Phase 1's operational baseline are unaccepted. |
| FR-PROG-06, FR-PROG-07 | 5 | Phase 5 lists `FR-PROG-01…05`. |
| NFR-01…19 (except NFR-01) | 1–7 | Only `NFR-01` is named by a phase (`SEO` §3); the rest are verified (or not) by `TEST` and `OBS`, which no phase acceptance criterion references. Phase 7's "all 16 acceptance criteria in `PRODUCT_REQUIREMENTS.md` §11" is the only backstop. |

---

## 14. Open questions

None. This document is derived from `PRODUCT_REQUIREMENTS.md` §5 and the sections it cites; questions about a requirement belong in that requirement's own document. The findings in §11–§13 are recorded gaps, not open questions.
