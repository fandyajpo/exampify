# API Contracts — Exampify

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Status | Proposed — endpoint shapes freeze at Phase 2 exit |
| Supersedes | Version 0.1 (materials/tutorials, practice sessions, multipart media) |
| Depends on | [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [QUESTION_ENGINE.md](./QUESTION_ENGINE.md), [SEARCH_ARCHITECTURE.md](./SEARCH_ARCHITECTURE.md), [SECURITY_AND_PERMISSIONS.md](./SECURITY_AND_PERMISSIONS.md) |
| Referenced by | [MVP_ROADMAP.md](./MVP_ROADMAP.md), [TESTING_STRATEGY.md](./TESTING_STRATEGY.md), [TECHNICAL_STANDARDS.md](./TECHNICAL_STANDARDS.md) |

---

## 1. Purpose and scope

The complete HTTP contract for the MVP: every endpoint, method, auth requirement, request/response schema, validation, pagination, filtering, sorting and error. An implementation agent should be able to write route handlers, Zod schemas and TanStack Query hooks from this alone.

**In scope:** `/api/v1/**`, conventions, error taxonomy, per-resource endpoints, auth surface, studio, media, jobs.

**Out of scope:** page routes ([INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md)), schema internals ([DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)), scoring math ([QUESTION_ENGINE.md](./QUESTION_ENGINE.md)), index mechanics ([SEARCH_ARCHITECTURE.md](./SEARCH_ARCHITECTURE.md)).

**Design rule:** public pages do **not** call these endpoints during server render — server components call services. The API exists for client interactivity (search, attempts, studio, dashboard) and as the future contract for other clients.

---

## 2. Conventions

| Topic | Rule |
|---|---|
| Base path | `/api/v1` |
| Format | JSON (`application/json; charset=utf-8`). No multipart: uploads use presigned URLs |
| Field naming | `camelCase` in JSON, `snake_case` in the database; mapping in the DTO layer |
| Single resource | `{ "data": { … } }` |
| Collection | `{ "data": [ … ], "pagination": { "limit": 20, "hasMore": true, "nextCursor": "…" } }` |
| Errors | `{ "error": { "code", "message", "details"?, "requestId" } }` |
| Validation failure | `422` with `details: [{ path, code, message }]`; malformed JSON → `400` |
| IDs | UUID v7 strings |
| Timestamps | ISO-8601 UTC with milliseconds (stored as epoch ms) |
| Absent vs null | Optional fields are omitted; explicitly nullable fields may be `null` |
| Unknown request fields | Rejected (`422 UNKNOWN_FIELD`) via Zod `.strict()` |
| Auth | Session cookie (`HttpOnly`). No bearer tokens in MVP |
| CSRF | Every mutating request must be same-origin (`Origin`/`Sec-Fetch-Site`) |
| Idempotency | `Idempotency-Key` honoured on attempt create/submit, media confirm, publish |
| Concurrency | Studio writes send `expectedUpdatedAt`; mismatch → `409 CONTENT_CONFLICT` |
| Rate limits | Per route group (§10) |
| Caching | Authenticated → `private, no-store`; public reads → `public, s-maxage=60, stale-while-revalidate=300` |
| Tracing | `x-request-id` echoed in the response and error body |
| Versioning | Path version. Additive within `v1`; breaking change → `v2` with 6-month overlap |

### 2.1 Error codes

| HTTP | `code` | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON, unparseable query |
| 401 | `UNAUTHENTICATED` | No/expired session |
| 401 | `EMAIL_NOT_VERIFIED` | Session valid, verification required |
| 403 | `FORBIDDEN` | Role lacks capability |
| 403 | `CROSS_ORIGIN_BLOCKED` | Mutation from a foreign origin |
| 404 | `NOT_FOUND` | Unknown id/slug, or not visible to this actor |
| 409 | `CONTENT_CONFLICT` | `expectedUpdatedAt` mismatch |
| 409 | `ATTEMPT_EXPIRED` | Attempt past expiry |
| 409 | `INVALID_TRANSITION` | Status transition not allowed |
| 409 | `SLUG_TAKEN` | Author-requested slug collision |
| 409 | `MEDIA_IN_USE` | Deleting a referenced asset |
| 409 | `LAST_ADMIN` | Demoting the only admin |
| 413 | `PAYLOAD_TOO_LARGE` | Body over limit |
| 422 | `VALIDATION_ERROR` | Generic Zod failure |
| 422 | `UNKNOWN_FIELD` | Unexpected request key |
| 422 | `INVALID_CURSOR` | Corrupt/expired cursor |
| 422 | `NO_QUESTIONS_MATCH` | Selection returned zero |
| 422 | `ANSWER_TYPE_MISMATCH` / `ANSWER_TOO_LONG` / `INVALID_OPTION` | Attempt answer problems |
| 422 | `PUBLISH_GATE_FAILED` | Publish validation failed |
| 422 | `ASSESSMENT_SCOPE_MISMATCH` | Assessment/resource topic mismatch |
| 422 | `QUESTION_NOT_IN_SCOPE` | Item outside the assessment scope |
| 422 | `INVALID_BLOCK` | Block payload invalid |
| 422 | `INVALID_FILE_TYPE` / `MEDIA_NOT_READY` | Upload verification failed |
| 429 | `RATE_LIMITED` | Limit exceeded; `Retry-After` set |
| 500 | `INTERNAL_ERROR` | Unhandled; generic message |
| 503 | `SERVICE_UNAVAILABLE` | Dependency down (DB, storage) |

Every error body includes `requestId`. Clients switch on `code`, never on message text.

---

## 3. Authentication endpoints

Better Auth owns the auth mechanics ([ADR-017](./ARCHITECTURE_DECISIONS.md#adr-017--better-auth-on-turso-via-kysely--libsqldialect)). These `/api/v1/auth/*` paths are the **application's** public surface so the UI is not coupled to the library's internal routes; each handler delegates to the Better Auth server API.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/sign-up` | none | `{ email, password, name }` | `201 { data: { user, requiresEmailVerification: true } }` + session cookie |
| `POST` | `/api/v1/auth/sign-in` | none | `{ email, password }` | `200 { data: { user } }` + cookie |
| `POST` | `/api/v1/auth/sign-out` | session | — | `204` |
| `GET` | `/api/v1/auth/session` | optional | — | `200 { data: { user \| null } }` |
| `POST` | `/api/v1/auth/verify-email` | none | `{ token }` | `200 { data: { verified: true } }` |
| `POST` | `/api/v1/auth/request-password-reset` | none | `{ email }` | `202 { data: { sent: true } }` (always 202) |
| `POST` | `/api/v1/auth/reset-password` | none | `{ token, password }` | `200 { data: { ok: true } }` |
| `GET` | `/api/v1/auth/oauth/google/start` | none | — | `302` to provider |
| `GET` | `/api/v1/auth/oauth/google/callback` | none | — | `302` + cookie |
| `DELETE` | `/api/v1/auth/sessions` | session | — | `204` (revoke all other sessions) |
| `GET` | `/api/v1/account/export` | session | — | `200` JSON data export (`Content-Disposition: attachment`, `no-store`, rate-limited 1/hour) |
| `DELETE` | `/api/v1/account` | session + re-auth (< 10 min) | `{ confirmEmail }` | `202 { data: { deleted: true, mode: 'anonymised' \| 'hard' } }` — procedure in `PRIVACY_AND_DATA_PROTECTION.md` §5.2 |
| `GET` | `/api/v1/account/sessions` | session | — | `200 { data: { sessions: [...] } }` (device, created, last seen; no token) |
| `DELETE` | `/api/v1/account/sessions/[id]` | session | — | `204` (revoke one session; `404` for another user's id) |

**Validation**

- `email`: practical RFC 5322 subset, ≤ 254, lowercased.
- `password`: 10–128, not in a common-password blocklist, no composition rules, not equal to the email local part.
- `name`: 2–80, trimmed, no URLs.
- Sign-in failures always return `401` with a generic message and constant-time comparison.
- Sign-up for an existing email returns `201` with the same shape and sends a "you already have an account" email (enumeration resistance) — a documented deviation from `409`.

**Better Auth integration note:** the library's own routes (`/api/auth/*`) remain mounted for OAuth callbacks and its client SDK; the table above is a thin, stable wrapper for the flows the product controls. Two surfaces must not diverge — the wrapper is the only one the UI calls, and a contract test asserts both agree on session validity.

---

## 4. Public content endpoints

Read-only, anonymous, cacheable, `status='published'` only, resolved through the full parent chain.

| Method | Path | Request | Response `data` |
|---|---|---|---|
| `GET` | `/api/v1/curricula` | — | `CurriculumSummary[]` |
| `GET` | `/api/v1/curricula/{curriculumId}/levels` | — | `LevelSummary[]` |
| `GET` | `/api/v1/subjects` | `?curriculumId=&levelId=&groupId=&format=&q=&limit=&cursor=` | `SubjectCard[]` |
| `GET` | `/api/v1/subjects/{subjectId}` | — | `SubjectDetail` |
| `GET` | `/api/v1/subjects/{subjectId}/chapters` | — | `ChapterSummary[]` |
| `GET` | `/api/v1/chapters/{chapterId}` | — | `ChapterDetail` |
| `GET` | `/api/v1/topics/{topicId}` | — | `TopicHub` |
| `GET` | `/api/v1/topics/{topicId}/resources` | — | `ResourceSummary[]` |
| `GET` | `/api/v1/resources/{resourceId}` | — | `ResourceDetail` (`blocks[]` rendered) |
| `GET` | `/api/v1/topics/{topicId}/assessments` | — | `AssessmentSummary[]` |
| `GET` | `/api/v1/assessments/{assessmentId}` | — | `AssessmentDetail` (scope, count, duration; no questions) |
| `GET` | `/api/v1/subjects/{subjectId}/assessments` | `?mode=` | `AssessmentSummary[]` |
| `GET` | `/api/v1/search` | `?q=&type=&format=&curriculumId=&levelId=&subjectId=&limit=&cursor=` | `SearchResultGroup[]` |
| `GET` | `/api/v1/search/suggest` | `?q=&subjectId=&limit=` | `Suggestion[]` |
| `GET` | `/api/v1/subjects/{subjectId}/practice-availability` | — | `{ questionCount, byDifficulty, types }` |

### 4.1 Response shapes

```ts
type DerivedFormat = 'study_material' | 'lesson_with_practice' | 'practice_test';

type ResourceSummary = {
  id: string; slug: string; title: string; subtitle: string | null;
  summary: string | null; readingMinutes: number; difficulty: Difficulty;
  format: 'study_material' | 'lesson_with_practice';
  assessmentCount: number; href: string;
};

type AssessmentSummary = {
  id: string; slug: string; title: string; description: string | null;
  mode: 'practice' | 'test' | 'mock'; questionCount: number;
  durationSeconds: number | null; difficulty: Difficulty;
  format: 'practice_test'; href: string;
};

type TopicHub = {
  id: string; slug: string; title: string; summary: string | null;
  learningObjectives: string[];
  estimatedMinutes: number | null;
  breadcrumbs: { label: string; href: string }[];
  resources: ResourceSummary[];
  assessments: AssessmentSummary[];
  practiceAvailability: { questionCount: number; byDifficulty: Record<Difficulty, number>; types: QuestionType[] };
  navigation: { prev: NavLink | null; next: NavLink | null };
  studentAccuracy: number | null;        // signed-in only, otherwise null
};

type ResourceDetail = {
  id: string; slug: string; title: string; subtitle: string | null;
  summary: string | null; readingMinutes: number; difficulty: Difficulty;
  format: 'study_material' | 'lesson_with_practice';
  blocks: RenderedBlock[];                // discriminated union, HTML pre-rendered server-side
  assessments: { id: string; slug: string; title: string; placement: 'inline'|'end'|'optional';
                 questionCount: number; durationSeconds: number | null; href: string }[];
  breadcrumbs: { label: string; href: string }[];
  navigation: { prevResource: NavLink | null; nextResource: NavLink | null; backToTopic: NavLink };
  updatedAt: string;
};

type RenderedBlock =
  | { kind: 'rich_text'; html: string }
  | { kind: 'heading'; level: 2 | 3; text: string; anchor: string }
  | { kind: 'image'; url: string; alt: string; caption: string | null; width: number; height: number }
  | { kind: 'formula'; html: string; latex: string; displayMode: boolean }
  | { kind: 'table'; html: string; caption: string | null }
  | { kind: 'callout'; tone: 'tip'|'warning'|'example'|'examtip'|'definition'; html: string }
  | { kind: 'video'; provider: 'youtube'|'vimeo'; embedUrl: string; title: string; durationSeconds: number | null }
  | { kind: 'download'; url: string; label: string; byteSize: number; mimeType: string }
  | { kind: 'question_section'; assessment: AssessmentSummary }
  | { kind: 'related_material'; heading: string | null; items: { id: string; title: string; href: string; format: DerivedFormat }[] };

type SearchResultGroup = {
  type: 'topic' | 'resource' | 'assessment' | 'chapter' | 'subject';
  label: string;
  items: { id: string; title: string; snippet: string | null; href: string;
           breadcrumb: string; format?: DerivedFormat; matchedSection?: string }[];
};

type Suggestion = {
  kind: 'topic' | 'subject' | 'resource' | 'assessment' | 'query';
  display: string; entityId: string | null; href: string | null;
  subjectName: string | null; highlight: [number, number] | null;
  correctedFrom?: string;
};
```

**Search response extras:** `{ data, pagination, meta: { degraded: boolean, correctedQuery: string | null, tookMs: number } }`.

### 4.2 Query validation

- `q`: 1–120 chars trimmed; under 2 chars returns `{ data: [] }` plus a hint (no error) for `/search`; suggest accepts 1 char.
- `limit`: default 20, max 50 (max 8 for suggest).
- Unknown `type`/`format` → `422 VALIDATION_ERROR` listing accepted values.
- Sorting is fixed (relevance for search, `position` elsewhere). A `sort` param is **not accepted** on public endpoints; silently accepting it would imply a contract we do not honour.

### 4.3 Caching

`GET` public endpoints return `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` and an `ETag` from the max `updated_at`. `If-None-Match` → `304`. Search results are cached per normalised query + filters; suggest for 60 s.

---

## 5. Attempt endpoints

All require an authenticated, email-verified session. Every response recomputes availability so the UI cannot offer a dead action.

### 5.1 Create an attempt

`POST /api/v1/attempts`

```ts
type CreateAttemptRequest =
  | { source: 'assessment'; assessmentId: string }
  | { source: 'topic' | 'chapter' | 'subject'; topicId?: string; chapterId?: string; subjectId?: string;
      questionCount: 5 | 10 | 20 | 40;
      difficulty: 'any' | 'easy' | 'medium' | 'hard' | 'very_hard';
      questionTypes: QuestionType[]; order?: 'random' | 'fixed' }
  | { source: 'resource'; resourceId: string; assessmentId: string };  // inline practice
```

`201 Created`:

```ts
type CreateAttemptResponse = {
  attempt: { id: string; status: 'in_progress'; startedAt: string; expiresAt: string;
             mode: 'practice' | 'test' | 'mock'; questionCount: number; requestedCount: number;
             durationSeconds: number | null; config: AttemptConfig };
  questions: StudentQuestion[];
};

type StudentQuestion = {
  id: string; position: number; type: QuestionType; difficulty: Difficulty;
  stemHtml: string; media: { url: string; alt: string; width: number; height: number } | null;
  options: { label: OptionLabel; html: string }[];   // empty for short_answer
  pointsMax: number; answer: StudentAnswer | null;   // resumed only
};
```

**Rules**

- Exactly the scope ids implied by `source` (extra ids ⇒ `422`).
- `email_verified` required ⇒ `401 EMAIL_NOT_VERIFIED`.
- Empty pool ⇒ `422 NO_QUESTIONS_MATCH` with `{ appliedFilters }`.
- Smaller pool than requested ⇒ `201` with `questionCount < requestedCount`; never an error.
- `Idempotency-Key` replayed within 10 min ⇒ the original attempt, `200`.
- `test`/`mock` requires `durationSeconds`; `expiresAt` = min(24 h inactivity, duration).
- **Never** includes `answer_key`, explanation, per-option feedback, or the topic href.

### 5.2 Read (resume)

`GET /api/v1/attempts/{attemptId}` → `CreateAttemptResponse` plus `savedAnswers` and `status`. Owner only; another user's id ⇒ `404` (not `403`, to avoid existence leaks).

Expired ⇒ `200` with `status: 'expired'`, `canResume: false`, and no answer keys.

### 5.3 Save answers

`PATCH /api/v1/attempts/{attemptId}/answers`

```ts
type SaveAnswersRequest = {
  answers: { questionId: string; answer: StudentAnswer | null; responseMs?: number }[];
};
```

`200 { data: { saved, answeredCount, expiresAt, reveal?: { questionId, isCorrect, correctAnswer, explanationHtml } } }`

- Batch up to 4 answers.
- `answer: null` clears.
- **`reveal` is present only when `mode = 'practice'`** and the question was just answered; it is the immediate-feedback path (`FR-PRAC-12`). It is absent for `test`/`mock` and absent on re-save of the same answer.
- Rejected if `status !== 'in_progress'` ⇒ `409 ATTEMPT_EXPIRED` or `422 ATTEMPT_NOT_EDITABLE`.
- Items not in the attempt ⇒ `422 QUESTION_NOT_IN_ATTEMPT`.
- Refreshes `last_activity_at`/`expires_at`.

### 5.4 Submit

`POST /api/v1/attempts/{attemptId}/submit` — no body. `200`:

```ts
type SubmitResponse = {
  attempt: { id: string; status: 'submitted'; startedAt: string; submittedAt: string;
             durationSeconds: number; answeredCount: number; correctCount: number;
             scorePoints: number; maxPoints: number; scorePercent: number | null };
  results: ReviewItem[];
};

type ReviewItem = {
  questionId: string; position: number; type: QuestionType; difficulty: Difficulty;
  stemHtml: string; media: … | null; pointsMax: number; pointsAwarded: number;
  isCorrect: boolean | null; studentAnswer: StudentAnswer | null;
  correctAnswer: CorrectAnswerView; explanationHtml: string;
  optionFeedback: { label: OptionLabel; feedbackHtml: string | null }[];
  contentUpdated: boolean; topic: { id: string; title: string; href: string };
};
```

- Idempotent: repeated calls return the identical payload with `200`.
- Grades server-side in one transaction (`QUESTION_ENGINE.md` §6).
- Duration exceeded for a timed attempt ⇒ accepted, graded, `attempt.overTimeSeconds` reported (no silent invalidation).
- Expired ⇒ `409 ATTEMPT_EXPIRED`; abandoned ⇒ `409 INVALID_TRANSITION`.

### 5.5 Abandon, list, review, retry

| Method | Path | Request | Response |
|---|---|---|---|
| `POST` | `/api/v1/attempts/{id}/abandon` | — | `200 { data: { status: 'abandoned' } }` |
| `GET` | `/api/v1/attempts` | `?status=&subjectId=&topicId=&from=&to=&limit=&cursor=` | `AttemptSummary[]` + pagination |
| `GET` | `/api/v1/attempts/{id}/review` | — | `SubmitResponse` (submitted only, `409` otherwise) |
| `POST` | `/api/v1/attempts/{id}/retry` | — | `201` new attempt with the same config, fresh selection |

`AttemptSummary = { id, status, source, mode, subject: {id,name}, topic: {id,title}|null, assessment: {id,title}|null, questionCount, answeredCount, correctCount, scorePercent, startedAt, submittedAt, durationSeconds }`

---

## 6. Progress endpoints

| Method | Path | Request | Response `data` |
|---|---|---|---|
| `GET` | `/api/v1/progress/summary` | `?days=7\|30\|90` | `ProgressSummary` |
| `GET` | `/api/v1/progress/topics` | `?subjectId=&sort=accuracy\|lastPracticed&dir=&limit=&cursor=` | `TopicPerformance[]` |
| `GET` | `/api/v1/progress/topics/{topicId}` | — | `TopicPerformanceDetail` |
| `GET` | `/api/v1/progress/study` | `?subjectId=` | `StudyProgress[]` (resources read vs practised) |

```ts
type ProgressSummary = {
  totals: { attempts: number; answered: number; correct: number; accuracy: number | null;
            studyMinutes: number; resourcesRead: number };
  window: { days: number; attempts: number; answered: number; accuracy: number | null };
  focusTopics: TopicPerformance[];        // ≤ 5, weakest first
  activity: { date: string; answered: number }[];
};
```

Rules: computed from `submitted` attempts only; `accuracy = correct/answered` over graded items, `null` (not `0`) when nothing is answered; `days` outside the enum ⇒ `422`.

---

## 7. Studio endpoints

All require `author`+ and `Cache-Control: no-store`. Every mutation writes an audit entry and is `.strict()`.

### 7.1 Taxonomy

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/api/v1/studio/curricula` | author | Includes drafts |
| `POST` | `/api/v1/studio/curricula` | admin | |
| `PATCH` | `/api/v1/studio/curricula/{id}` | admin | `expectedUpdatedAt` |
| `POST` | `/api/v1/studio/curricula/{id}/levels` | admin | |
| `PATCH` | `/api/v1/studio/levels/{id}` | admin | |
| `GET` | `/api/v1/studio/subjects` | author | `?levelId=&status=&q=&sort=&cursor=` |
| `POST` | `/api/v1/studio/subjects` | admin | |
| `PATCH` | `/api/v1/studio/subjects/{id}` | admin | |
| `GET` | `/api/v1/studio/chapters` | author | `?subjectId=` |
| `POST` | `/api/v1/studio/chapters` | author | |
| `PATCH` | `/api/v1/studio/chapters/{id}` | author | |
| `GET` | `/api/v1/studio/topics` | author | `?chapterId=&status=&q=` |
| `POST` | `/api/v1/studio/topics` | author | |
| `PATCH` | `/api/v1/studio/topics/{id}` | author | |
| `DELETE` | `/api/v1/studio/{entity}/{id}` | admin | `entity ∈ {curricula,levels,subjects,chapters,topics}`; archive, blocked if children are published |
| `POST` | `/api/v1/studio/{entity}/reorder` | author | `{ parentId, orderedIds: string[] }` |

### 7.2 Resources and blocks

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/studio/topics/{topicId}/resources` | ordered, includes drafts + `format` |
| `POST` | `/api/v1/studio/topics/{topicId}/resources` | `{ title, slug?, subtitle?, summary?, difficulty?, position? }` |
| `GET` | `/api/v1/studio/resources/{id}` | full resource with blocks (payload, not HTML) |
| `PATCH` | `/api/v1/studio/resources/{id}` | metadata; `expectedUpdatedAt` |
| `POST` | `/api/v1/studio/resources/{id}/duplicate` | deep copy as draft (fresh block ids, same assessment links) |
| `GET` | `/api/v1/studio/resources/{id}/blocks` | ordered blocks |
| `POST` | `/api/v1/studio/resources/{id}/blocks` | `{ kind, payload, position? }` → created block |
| `PATCH` | `/api/v1/studio/blocks/{blockId}` | `{ payload }` (whole payload replaced, validated) |
| `DELETE` | `/api/v1/studio/blocks/{blockId}` | renumbers positions |
| `POST` | `/api/v1/studio/resources/{id}/blocks/reorder` | `{ orderedIds: string[] }` |
| `POST` | `/api/v1/studio/resources/{id}/blocks/validate` | dry-run all block + publish gates: `{ passing, blocking[], warnings[] }` |
| `POST` | `/api/v1/studio/resources/{id}/assessments` | `{ assessmentId, placement, position? }` |
| `DELETE` | `/api/v1/studio/resources/{id}/assessments/{assessmentId}` | unlink (reverts `format` if last) |
| `GET` | `/api/v1/studio/resources/{id}/preview` | rendered blocks + `noindex` for staff preview |

**Autosave contract:** `PATCH` metadata or block payload every 4 s of idle time with `expectedUpdatedAt`; the response returns the new `updatedAt` used by the next save. A `409` opens the conflict dialog (§12). Block payloads are replaced wholesale — there is no partial payload patch, because a half-valid block cannot be rendered.

### 7.3 Assessments

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/studio/assessments` | `?topicId=&subjectId=&mode=&status=&q=&sort=&cursor=` |
| `POST` | `/api/v1/studio/assessments` | `{ topicId?, subjectId, title, slug?, descriptionMd?, mode, durationSeconds?, items: [{ questionId, pointsOverride? }] }` |
| `GET` | `/api/v1/studio/assessments/{id}` | includes items + full questions |
| `PATCH` | `/api/v1/studio/assessments/{id}` | items replaced wholesale; `expectedUpdatedAt` |
| `POST` | `/api/v1/studio/assessments/{id}/duplicate` | draft copy (items by reference) |
| `POST` | `/api/v1/studio/assessments/{id}/validate` | dry-run gates |
| `GET` | `/api/v1/studio/assessments/{id}/availability` | live counts for the composer |

`items` rules: 1–60, no duplicates, each question published or draft-in-progress but in scope; `mode='test'|'mock'` requires `durationSeconds` 60–10800; `mode='practice'` forbids it.

### 7.4 Questions

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/studio/questions` | `?topicId=&subjectId=&type=&difficulty=&status=&q=&authorId=&sort=updatedAt\|createdAt&dir=&limit=&cursor=` (TanStack Table) |
| `POST` | `/api/v1/studio/questions` | create draft |
| `GET` | `/api/v1/studio/questions/{id}` | full, **including** `answerKey` |
| `PATCH` | `/api/v1/studio/questions/{id}` | partial; `expectedUpdatedAt` |
| `POST` | `/api/v1/studio/questions/{id}/duplicate` | draft copy incl. options and cross-listings |
| `DELETE` | `/api/v1/studio/questions/{id}` | archive only; `409` if used by a published assessment |
| `POST` | `/api/v1/studio/questions/validate` | dry-run publish gate |

```ts
type CreateQuestionRequest = {
  topicId: string; secondaryTopicIds?: string[];
  type: QuestionType; stemMd: string; difficulty: Difficulty;
  explanationMd: string; points?: number; mediaId?: string | null;
  options?: { label: OptionLabel; contentMd: string; feedbackMd?: string | null }[];
  answerKey:
    | { type: 'multiple_choice'; correct: OptionLabel }
    | { type: 'multiple_select'; correct: OptionLabel[]; scoring: 'all_or_nothing' | 'partial' }
    | { type: 'true_false'; correct: boolean }
    | { type: 'short_answer'; accepted: string[]; keywords?: { all: string[] } };
};
```

Cross-field validation (`422` with per-field `details`): 2–8 options for choice types; `correct` present among options; exactly one for `multiple_choice`; ≥ 2 for `multiple_select`; `true_false` options exactly `A=True, B=False` (generated if omitted); `short_answer` has no options and ≥ 1 accepted answer; `secondaryTopicIds` exist and exclude `topicId`.

### 7.5 Status transitions

`POST /api/v1/studio/{entity}/{id}/transition` → `{ to, reason? }`

- `entity ∈ {curricula, levels, subjects, chapters, topics, resources, assessments, questions}`.
- Gates run before the write; failure ⇒ `422 PUBLISH_GATE_FAILED` with `details: [{ path, code, message }]`.
- Response includes the entity, `{ cacheInvalidated: boolean, searchEnqueued: boolean }`.
- `author` may `draft ⇄ in_review` and `→ archived`; `reviewer`/`admin` may publish.
- Rate limit 60/hour/user.

### 7.6 Media (presigned)

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/v1/studio/media/upload-url` | `{ filename, mimeType, byteSize, purpose: 'image'\|'document' }` → `{ mediaId, uploadUrl, method: 'PUT', headers, expiresAt }` |
| `POST` | `/api/v1/studio/media/{mediaId}/confirm` | no body; server HEADs the object, verifies size/type magic bytes, sanitises SVG, → `MediaAsset` |
| `GET` | `/api/v1/studio/media` | `?q=&purpose=&status=&limit=&cursor=` |
| `PATCH` | `/api/v1/studio/media/{id}` | `{ altText }` |
| `DELETE` | `/api/v1/studio/media/{id}` | soft delete; `409 MEDIA_IN_USE` if referenced by published content |
| `GET` | `/api/v1/studio/media/{id}/download-url` | presigned GET for private assets (≤ 10 min) |

`MediaAsset = { id, url | null, mimeType, byteSize, width, height, altText, visibility, status, createdAt }`

**Upload rules:** presigned PUT expires in 5 min and is signed for the exact `Content-Type` and `Content-Length`; `purpose` fixes the MIME allow-list and size cap (`CONTENT_MODEL.md` §4.9); a `pending` row older than 24 h is swept; confirm is idempotent (`job_runs` key `media:<id>`).

### 7.7 Users, audit, overview

| Method | Path | Role | Notes |
|---|---|---|---|
| `GET` | `/api/v1/studio/users` | admin | Never returns password/token fields |
| `PATCH` | `/api/v1/studio/users/{id}/role` | admin | `{ role }`; cannot demote the last admin (`409 LAST_ADMIN`) |
| `GET` | `/api/v1/studio/audit` | admin | `?entityType=&entityId=&actorId=&from=&to=&cursor=` |
| `GET` | `/api/v1/studio/overview` | author | counts, recent edits, content gaps, **unindexed entities** |
| `GET` | `/api/v1/studio/search` | author | lexical search across drafts; no `answer_key` |

---

## 8. Internal endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/internal/jobs/index-content` | QStash signature | Upsert/delete one search event |
| `POST` | `/api/v1/internal/jobs/send-email` | QStash signature | Send one templated email (idempotent) |
| `POST` | `/api/v1/internal/jobs/reindex` | admin session | Fan out reindex events (`?entityType=&since=`) |
| `POST` | `/api/v1/internal/cron/expire-attempts` | `Bearer $CRON_SECRET` | Idempotent expiry sweep |
| `POST` | `/api/v1/internal/cron/prune` | same | Tokens, sessions, events, audit retention |
| `POST` | `/api/v1/internal/cron/reconcile-stats` | same | Recompute `user_topic_stats` |
| `POST` | `/api/v1/internal/cron/reconcile-search` | same | Drift repair events |
| `POST` | `/api/v1/internal/cron/purge-media` | same | Delete orphaned blobs |
| `POST` | `/api/v1/internal/cron/sweep-jobs` | same | Re-enqueue rows a failed publish or a crashed worker left `pending`/`started` (`BACKGROUND_JOBS.md` §8) |
| `GET` | `/api/v1/health` | none | `{ status, db, qdrant, indexLagSeconds, version }` |

Internal endpoints return `{ data: { processed, skipped, failed } }`, never row contents, and are excluded from user rate-limit budgets. Signature rules: `BACKGROUND_JOBS.md` §5.

---

## 9. Rate limits

| Route group | Limit | Window | Key |
|---|---|---|---|
| Sign-in | 10 | 15 min | IP + email hash |
| Sign-up | 5 | 1 h | IP |
| Password reset | 3 | 1 h | email |
| Search | 60 | 1 min | IP |
| Suggest | 240 | 1 min | IP |
| Attempt create | 30 | 10 min | user |
| Answer save | 120 | 10 min | user |
| Submit | 20 | 10 min | user |
| Studio mutations | 300 | 1 h | user |
| Media upload URL | 30 | 1 h | user |

`429` includes `Retry-After`. Counters live in Upstash Redis; if Redis is unavailable, limits fail open and the event is logged (`ADR-027`).

---

## 10. Pagination, filtering, sorting

- **Cursor** everywhere: opaque base64 of `(sortValue, id)`; `limit` default 20, max 50; `pagination.nextCursor = null` on the last page.
- No total counts on large lists; `?includeCount=true` allowed only on filtered studio sets.
- Filters are allow-listed per endpoint; unknown params ⇒ `422`.
- Sorting: allow-listed `sort` + `dir`; never a raw column name.
- **Search input** is tokenised and passed as a bound `MATCH` parameter (`SEARCH_ARCHITECTURE.md` §6). It is never concatenated into SQL.

---

## 11. Example: study → practice flow

```http
GET /api/v1/resources/018f3c1e-...
→ 200
{ "data": { "id": "018f…", "title": "Why mitochondria are the powerhouse",
            "format": "lesson_with_practice", "readingMinutes": 6,
            "blocks": [ { "kind": "rich_text", "html": "<p>…</p>" },
                        { "kind": "formula", "latex": "C_6H_{12}O_6 + 6O_2 …", "html": "…", "displayMode": true } ],
            "assessments": [ { "id": "018f…", "title": "Mitochondria knowledge check",
                               "placement": "end", "questionCount": 10, "href": "…" } ] } }
```

```http
POST /api/v1/attempts
Content-Type: application/json
Idempotency-Key: 8f1c…

{ "source": "assessment", "assessmentId": "018f…" }

→ 201
{ "data": { "attempt": { "id": "018f…", "status": "in_progress", "mode": "practice",
                          "startedAt": "2026-11-20T09:00:00.000Z",
                          "expiresAt": "2026-11-21T09:00:00.000Z",
                          "questionCount": 10, "durationSeconds": null },
            "questions": [ { "id": "018f…", "position": 0, "type": "multiple_choice",
                             "stemHtml": "<p>…</p>", "options": [ { "label": "A", "html": "…" } ],
                             "pointsMax": 1, "answer": null, "media": null } ] } }
```

```http
PATCH /api/v1/attempts/018f…/answers
{ "answers": [ { "questionId": "018f…", "answer": { "v": 1, "type": "multiple_choice", "option": "B" } } ] }

→ 200
{ "data": { "saved": 1, "answeredCount": 1,
            "reveal": { "questionId": "018f…", "isCorrect": true, "correctAnswer": { "labels": ["B"] },
                        "explanationHtml": "<p>…</p>" } } }
```

```http
POST /api/v1/attempts/018f…/submit
→ 200 { "data": { "attempt": { "status": "submitted", "scorePoints": 5, "maxPoints": 10, "scorePercent": 50 },
                  "results": [ { "questionId": "018f…", "isCorrect": true, "pointsAwarded": 1,
                                 "correctAnswer": { "labels": ["B"] }, "explanationHtml": "<p>…</p>",
                                 "contentUpdated": false, "topic": { … } } ] } }
```

---

## 12. Conflict handling (studio)

1. Every editable response includes `updatedAt`.
2. Every `PATCH` includes `expectedUpdatedAt`.
3. Mismatch ⇒ `409 CONTENT_CONFLICT` with `{ currentUpdatedAt, currentUpdatedBy, changedFields }`.
4. The client offers "Reload theirs" (discard local) or "Overwrite" (retry with the new value the user has seen).
5. Autosave never silently overwrites.

---

## 13. Dependencies

| Consumer | Needed from this document |
|---|---|
| Frontend | Types, error codes, pagination, conflict contract, `reveal` semantics |
| Backend | Route list, validation, status codes, idempotency |
| Tests | Contract assertions, leak checks (§5.1), permission matrix |
| SEO | `href` fields are server-authored; the client never builds URLs |
| Jobs | Internal endpoint shapes and auth |

---

## 14. Edge cases

| # | Case | Contract |
|---|---|---|
| API-01 | `questionCount: 12` | `422` (closed set) |
| API-02 | Unknown body field | `422 UNKNOWN_FIELD` naming it |
| API-03 | Attempt belongs to another user | `404` |
| API-04 | Submit repeated | `200`, identical payload |
| API-05 | Save after submit | `422 ATTEMPT_NOT_EDITABLE` |
| API-06 | Studio PATCH without `expectedUpdatedAt` | `422 VALIDATION_ERROR` |
| API-07 | Publish with a short explanation | `422 PUBLISH_GATE_FAILED` + `details[]` |
| API-08 | Explicit slug already used by a sibling | `409 SLUG_TAKEN` (auto-suffix only for generated slugs) |
| API-09 | Corrupt cursor | `422 INVALID_CURSOR` |
| API-10 | `limit=1000` | Clamped to 50, `pagination.limit: 50` (no error) |
| API-11 | Cross-origin `POST` | `403` before any DB read |
| API-12 | PNG name, PDF bytes | `422 INVALID_FILE_TYPE` at confirm |
| API-13 | Demote last admin | `409 LAST_ADMIN` |
| API-14 | `published → in_review` | `409 INVALID_TRANSITION` (must pass through `draft`) |
| API-15 | Public endpoint asked for a draft id | `404` |
| API-16 | Body > 1 MB | `413 PAYLOAD_TOO_LARGE` |
| API-17 | Presigned upload never confirmed | Row stays `pending`, swept after 24 h; referencing it blocks publish (`MEDIA_NOT_READY`) |
| API-18 | `reveal` requested on a `test` attempt | Field absent, no error; the client must not expect it |
| API-19 | Block payload with an unknown `kind` | `422 INVALID_BLOCK` with the offending path |
| API-20 | Assessment linked to a resource in another topic | `422 ASSESSMENT_SCOPE_MISMATCH` |
| API-21 | Qdrant down during search | `200` with `meta.degraded: true` |
| API-22 | QStash signature invalid | `401`, no work performed |

---

## 15. Acceptance criteria

1. Every documented endpoint exists with the documented method, auth and status codes (generated contract test).
2. No pre-submit response contains an answer key, explanation or correctness, **except** `reveal` in `practice` mode after answering that question.
3. `reveal` never appears for `test`/`mock` (leak test across both modes).
4. Validation errors always include `details[]` with a `path` matching the request body.
5. Pagination is stable under concurrent inserts (no duplicates/skips).
6. Studio writes without `expectedUpdatedAt` are rejected; a stale value yields `409` with `changedFields`.
7. Rate limits return `429` with `Retry-After`.
8. Authenticated responses carry `private, no-store`.
9. Cross-origin mutations are rejected before touching the database.
10. `/health` leaks no configuration.
11. Double submit returns byte-identical `data` (excluding timestamps).
12. A media upload cannot exceed its purpose's MIME/size policy even if the client lies.
13. `/api/v1/events` accepts only the client-safe event names, drops silently with `204`, and never surfaces an analytics failure to a student.
14. `openapi.json` is generated from the shared Zod schemas and fails CI when it differs from the committed copy.

---

## 16. Analytics ingestion and the machine-readable contract

### 16.1 `POST /api/v1/events`

| Field | Value |
|---|---|
| Auth | Optional — `user_id` taken from the session when present |
| Body | `{ events: [{ name, occurredAt, props }] }`, 1–20 events, ≤ 16 KB |
| Allowed names | Client-safe subset only: `suggestion_selected`, `search_result_clicked` (plus future names added explicitly) |
| Response | `204` always, including when events are dropped as invalid or rate-limited |
| Rate limit | 60 requests/min per user or `anonymous_id` |
| Rules | Server timestamps are authoritative; server-side events (`resource_viewed`, `attempt_*`) are **not** accepted from clients |

Rationale and taxonomy: [OBSERVABILITY_AND_ANALYTICS.md](./OBSERVABILITY_AND_ANALYTICS.md) §6.

### 16.2 Generated OpenAPI document

The Markdown tables in §3–§8 are the human contract; the machine contract is generated, not hand-maintained.

1. **Source of truth:** the Zod schemas — request bodies in `lib/validation/**` (imported by both the handler and the registry), response envelopes in `lib/openapi/schemas.ts`. A route cannot document a shape it does not validate.
2. **Generation:** a build script emits `openapi.json` (OpenAPI 3.1) from a registry that maps each route to its schemas. The output is committed, and CI regenerates it and fails on any diff — the same rule as a lockfile.
3. **Serving:** `GET /api/v1/openapi.json` in non-production only; production serves nothing unless a decision says otherwise (`OQ-API2`).
4. **Validation in tests:** every documented example is parsed by its schema; a shape drift fails the suite. `openapi.json` is also validated against the OpenAPI schema itself.
5. **Scope of the generated document:** only operations that exist in the route tree. The §3–§8 tables are the full contract and run ahead of the code; `openapi.json` never documents a route without a handler, and `bun run openapi:check` fails if the two disagree in either direction.
6. **What is not generated:** prose rules ("`reveal` only in practice mode"), rate-limit numbers and auth semantics. Those stay here and are covered by tests, not by the document.

**Why not hand-write the spec:** two sources of truth drift within a sprint, and the drift is invisible until a client breaks. The generator makes the contract a by-product of the code that enforces it.

---

## 17. Open questions

| # | Question | Impact |
|---|---|---|
| OQ-API1 | Do public read endpoints exist in MVP, or only internal server calls + search? | Surface area, rate-limit budget — **Open — needs:** decide whether public reads ship as an HTTP API or stay server-only plus search; **blocks Phase 2**. |
| OQ-API2 | Publish the generated `openapi.json` publicly (third-party clients), or serve it in non-production only? | Surface area vs ecosystem; generation itself is required (§16.2) **Open — needs:** decide whether the generated document is served publicly; generation itself is already a Phase 1 gate; **blocks Phase 7**. |
| OQ-API3 | ~~Is a client-generated `Idempotency-Key` header acceptable, or a body field?~~ **Resolved: header** — §2 already specifies the header on attempt create/submit, media confirm and publish | Nothing; the fetch wrapper sets it and no endpoint takes an idempotency body field |
| OQ-API4 | Does the product need `includeCount` on public lists? | An extra count query per page — **Open — needs:** decide whether any public list needs `includeCount`; **blocks Phase 2**. |
| OQ-API5 | Should studio endpoints live under a separate host? | Security surface (currently same origin + role guard) **Open — needs:** decide whether the studio moves to a separate host before the security review; **blocks Phase 7**. |
| OQ-API6 | Should `reveal` also be allowed in `practice` mode for a re-saved unchanged answer? | UX vs leak surface — **Open — needs:** decide whether a re-saved unchanged practice answer may reveal; **blocks Phase 4**. |
| OQ-API7 | Do we expose a public "recently published" feed? | Caching and crawler load — **Open — needs:** decide whether a recently-published feed is worth the crawler load; **blocks Phase 7**. |
