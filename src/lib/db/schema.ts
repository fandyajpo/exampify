/**
 * Kysely table types for the subset of the phase DDL (`db/schema.phase1.sql`,
 * `db/schema.phase2.sql`) that the app reads.
 *
 * Types are hand-written from the DDL, not generated, until the migration runner owns the
 * schema: every column here must match its `db/schema.phase*.sql` file exactly (snake_case,
 * nullable columns marked `| null`, closed sets as unions). Adding a table here is part of the
 * same change that adds it to a migration in `scripts/migrate.ts`.
 */

export type ContentStatus = "draft" | "in_review" | "published" | "archived";
export type Difficulty = "easy" | "medium" | "hard" | "very_hard";
export type QuestionType =
  | "multiple_choice"
  | "multiple_select"
  | "true_false"
  | "short_answer";
export type OptionLabel = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export interface CurriculaTable {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  description_md: string | null;
  status: ContentStatus;
  position: number;
  created_at: number;
  updated_at: number;
}

export interface EducationLevelsTable {
  id: string;
  curriculum_id: string;
  slug: string;
  name: string;
  description_md: string | null;
  position: number;
  status: ContentStatus;
  created_at: number;
  updated_at: number;
}

export interface SubjectGroupsTable {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_key: string;
  color_token: string;
  position: number;
}

export interface SubjectsTable {
  id: string;
  education_level_id: string;
  subject_group_id: string;
  slug: string;
  name: string;
  summary: string | null;
  color_token: string;
  icon_key: string;
  hero_media_id: string | null;
  status: ContentStatus;
  published_at: number | null;
  position: number;
  seo_title: string | null;
  seo_description: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface ChaptersTable {
  id: string;
  subject_id: string;
  slug: string;
  title: string;
  summary: string | null;
  position: number;
  status: ContentStatus;
  published_at: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface TopicsTable {
  id: string;
  chapter_id: string;
  slug: string;
  title: string;
  summary: string | null;
  learning_objectives: string;
  estimated_minutes: number | null;
  position: number;
  status: ContentStatus;
  published_at: number | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface LearningResourcesTable {
  id: string;
  topic_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  reading_minutes: number;
  difficulty: Difficulty;
  position: number;
  status: ContentStatus;
  published_at: number | null;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface AssessmentsTable {
  id: string;
  topic_id: string | null;
  subject_id: string;
  scope_key: string;
  slug: string;
  title: string;
  description_md: string | null;
  mode: "practice" | "test" | "mock";
  difficulty: Difficulty;
  duration_seconds: number | null;
  question_count: number;
  status: ContentStatus;
  published_at: number | null;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface QuestionsTable {
  id: string;
  topic_id: string;
  question_type: QuestionType;
  stem_md: string;
  media_id: string | null;
  difficulty: Difficulty;
  explanation_md: string;
  /** Versioned JSON; parsed with `AnswerKeySchema` on every read (`QUESTION_ENGINE.md` §3). */
  answer_key: string;
  points_x100: number;
  status: ContentStatus;
  published_at: number | null;
  version: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: number;
  updated_at: number;
}

/** Presentational only: correctness lives in `questions.answer_key` (ADR-004). */
export interface QuestionOptionsTable {
  id: string;
  question_id: string;
  label: OptionLabel;
  content_md: string;
  feedback_md: string | null;
  position: number;
}

/** Cross-listing (`ADR-003`): exactly one primary row, enforced by a partial unique index. */
export interface QuestionTopicsTable {
  question_id: string;
  topic_id: string;
  is_primary: number;
}

export interface AssessmentItemsTable {
  id: string;
  assessment_id: string;
  question_id: string;
  position: number;
  points_x100_override: number | null;
}

/**
 * The transactional outbox for semantic search (`ADR-021`). A publish or unpublish writes
 * one row here inside its own transaction; the worker drains `pending` rows by
 * `available_at` and the row is never written from the request path twice.
 */
export interface SearchEventsTable {
  id: string;
  entity_type: string;
  entity_id: string;
  op: "upsert" | "delete";
  status: "pending" | "processing" | "done" | "failed";
  attempts: number;
  last_error: string | null;
  available_at: number;
  created_at: number;
  updated_at: number;
  processed_at: number | null;
}

export interface MediaAssetsTable {
  id: string;
  provider: string;
  storage_key: string;
  public_url: string | null;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  alt_text: string;
  checksum_sha256: string | null;
  visibility: "public" | "private";
  status: "pending" | "ready" | "deleted";
  uploaded_by: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

export interface ContentBlocksTable {
  id: string;
  resource_id: string;
  kind:
    | "rich_text"
    | "heading"
    | "image"
    | "formula"
    | "table"
    | "callout"
    | "video"
    | "download"
    | "question_section"
    | "related_material";
  position: number;
  payload: string;
  created_at: number;
  updated_at: number;
}

export interface ResourceAssessmentsTable {
  resource_id: string;
  assessment_id: string;
  placement: "inline" | "end" | "optional";
  position: number;
}

export type AttemptSource = "topic" | "chapter" | "subject" | "assessment" | "resource";
export type AttemptStatus = "in_progress" | "submitted" | "abandoned" | "expired";

/**
 * One run through an assessment or a generated practice set (`DATABASE_SCHEMA.md` §9.1).
 * `config` is immutable JSON written at creation; the snapshot lives in `attempt_items`, so
 * a later edit to a question never changes what an attempt was scored against.
 */
export interface AssessmentAttemptsTable {
  id: string;
  user_id: string;
  source: AttemptSource;
  assessment_id: string | null;
  resource_id: string | null;
  subject_id: string;
  chapter_id: string | null;
  topic_id: string | null;
  config: string;
  question_count: number;
  status: AttemptStatus;
  started_at: number;
  last_activity_at: number;
  expires_at: number;
  submitted_at: number | null;
  answered_count: number;
  correct_count: number;
  score_x100: number;
  max_score_x100: number;
  score_percent_x100: number | null;
  duration_seconds: number | null;
  idempotency_key: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * The per-question snapshot (`DATABASE_SCHEMA.md` §9.2): which question at which version,
 * for how many points. The stem, options and key are never copied here (ADR-005), so review
 * reads current text and flags a version difference instead.
 */
export interface AttemptItemsTable {
  id: string;
  attempt_id: string;
  question_id: string;
  question_version: number;
  position: number;
  points_x100_max: number;
  selected_answer: string | null;
  is_correct: number | null;
  points_x100_awarded: number | null;
  feedback: string | null;
  response_ms: number | null;
  answered_at: number | null;
}

/** Changed public paths (`DATABASE_SCHEMA.md` §10.5); `source_path` may be a subtree prefix. */
export interface RedirectsTable {
  id: string;
  source_path: string;
  target_path: string;
  status_code: number;
  reason: "slug_change" | "topic_moved" | "manual" | null;
  created_at: number;
}

export interface UsageEventsTable {
  id: string;
  name: string;
  occurred_at: number;
  received_at: number;
  user_id: string | null;
  anonymous_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  props_json: string;
  request_id: string | null;
  app_version: string | null;
}

export interface EmailSuppressionsTable {
  email_hash: string;
  reason: "hard_bounce" | "complaint" | "manual" | "invalid";
  source: string | null;
  created_at: number;
}

export interface AuditLogsTable {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: string;
  created_at: number;
}

export interface JobRunsTable {
  idempotency_key: string;
  job: string;
  status: "pending" | "started" | "succeeded" | "failed" | "uncertain" | "skipped";
  attempts: number;
  /** The rendered message for `send-email`; a job that needs no payload leaves this null. */
  payload: string | null;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  error: string | null;
  error_code: string | null;
}

export interface Database {
  curricula: CurriculaTable;
  education_levels: EducationLevelsTable;
  subject_groups: SubjectGroupsTable;
  subjects: SubjectsTable;
  chapters: ChaptersTable;
  topics: TopicsTable;
  learning_resources: LearningResourcesTable;
  assessments: AssessmentsTable;
  assessment_items: AssessmentItemsTable;
  questions: QuestionsTable;
  question_options: QuestionOptionsTable;
  question_topics: QuestionTopicsTable;
  content_blocks: ContentBlocksTable;
  resource_assessments: ResourceAssessmentsTable;
  search_events: SearchEventsTable;
  media_assets: MediaAssetsTable;
  redirects: RedirectsTable;
  usage_events: UsageEventsTable;
  email_suppressions: EmailSuppressionsTable;
  audit_logs: AuditLogsTable;
  job_runs: JobRunsTable;
  assessment_attempts: AssessmentAttemptsTable;
  attempt_items: AttemptItemsTable;
}
