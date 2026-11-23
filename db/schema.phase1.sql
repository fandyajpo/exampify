-- Exampify — Phase 1 schema (Turso / libSQL, SQLite dialect)
--
-- Transcribed from docs/DATABASE_SCHEMA.md. Phase 1 = the foundation migration
-- listed in MVP_ROADMAP.md §4.2 (taxonomy, resources, blocks, assessments,
-- question bank, attempts, media, search tables, auth tables) plus the Phase 1
-- operational baseline of §4.6 (job_runs, usage_events, email_suppressions).
--
-- Deliberately excluded (not Phase 1): user_topic_stats (§9.3, Phase 5),
-- entitlements (§9.4, inert), redirects (§10.5, studio/slug changes),
-- audit_logs (§10.6, studio mutations).
--
-- Conventions enforced here (docs/DATABASE_SCHEMA.md §2–§3):
--   * TEXT ids (UUID v7 generated in the application), never autoincrement.
--   * INTEGER epoch milliseconds written by the application, no DB defaults.
--   * No ENUM/numeric/boolean types; CHECK constraints instead.
--   * Application-owned timestamps, hence no DEFAULT CURRENT_TIMESTAMP.
--
-- Run with `PRAGMA foreign_keys = ON` on every connection.

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;

-- ---------------------------------------------------------------------------
-- Identity (Better Auth–owned)
-- The library owns these four singular tables and checks them: this DDL is the
-- output of `bun x auth@latest generate` for the configured schema, not a
-- hand-written mirror. Core columns keep the library's camelCase names — the
-- adapter writes those exact keys — while application fields added through
-- Better Auth's schema extension keep this project's snake_case names.
-- Regenerate and diff after a `better-auth` upgrade (ADR-017).
-- ---------------------------------------------------------------------------

CREATE TABLE user (
  id               TEXT NOT NULL PRIMARY KEY,
  name             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  emailVerified    INTEGER NOT NULL,
  image            TEXT,
  createdAt        DATE NOT NULL,
  updatedAt        DATE NOT NULL,
  role             TEXT,
  status           TEXT,
  age_attested_at  INTEGER,
  age_gate_version TEXT,
  last_seen_at     INTEGER,
  deleted_at       INTEGER
);

CREATE TABLE session (
  id        TEXT NOT NULL PRIMARY KEY,
  expiresAt DATE NOT NULL,
  token     TEXT NOT NULL UNIQUE,
  createdAt DATE NOT NULL,
  updatedAt DATE NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId    TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE
);

CREATE INDEX session_userId_idx ON session (userId);

CREATE TABLE account (
  id                    TEXT NOT NULL PRIMARY KEY,
  accountId             TEXT NOT NULL,
  providerId            TEXT NOT NULL,
  userId                TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  accessToken           TEXT,
  refreshToken          TEXT,
  idToken               TEXT,
  accessTokenExpiresAt  DATE,
  refreshTokenExpiresAt DATE,
  scope                 TEXT,
  password              TEXT,
  createdAt             DATE NOT NULL,
  updatedAt             DATE NOT NULL
);

CREATE INDEX account_userId_idx ON account (userId);

CREATE TABLE verification (
  id         TEXT NOT NULL PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  DATE NOT NULL,
  createdAt  DATE NOT NULL,
  updatedAt  DATE NOT NULL
);

CREATE INDEX verification_identifier_idx ON verification (identifier);

-- ---------------------------------------------------------------------------
-- Media (metadata only; bytes live in Tigris)
-- ---------------------------------------------------------------------------

CREATE TABLE media_assets (
  id              TEXT PRIMARY KEY,
  provider        TEXT NOT NULL DEFAULT 'tigris',
  storage_key     TEXT NOT NULL UNIQUE,
  public_url      TEXT,
  mime_type       TEXT NOT NULL,
  byte_size       INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 26214400),
  width           INTEGER,
  height          INTEGER,
  alt_text        TEXT NOT NULL DEFAULT '',
  checksum_sha256 TEXT,
  visibility      TEXT NOT NULL DEFAULT 'public'
                  CHECK (visibility IN ('public', 'private')),
  -- NOTE: §7.6 documents pending -> ready -> deleted in prose only; the CHECK
  -- below encodes that prose because an unconstrained lifecycle column is worse.
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'ready', 'deleted')),
  uploaded_by     TEXT REFERENCES user (id) ON DELETE SET NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  deleted_at      INTEGER
);

CREATE INDEX idx_media_checksum ON media_assets (checksum_sha256);
CREATE INDEX idx_media_status ON media_assets (status, created_at);
CREATE INDEX idx_media_uploader ON media_assets (uploaded_by, created_at DESC);

-- ---------------------------------------------------------------------------
-- Taxonomy: curricula -> education_levels -> subjects -> chapters -> topics
-- ---------------------------------------------------------------------------

CREATE TABLE curricula (
  id             TEXT PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE
                 CHECK (slug GLOB '[a-z0-9]*' AND slug NOT GLOB '*[^a-z0-9-]*'),
  name           TEXT NOT NULL,
  short_name     TEXT NOT NULL,
  description_md TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  position       INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE education_levels (
  id            TEXT PRIMARY KEY,
  curriculum_id TEXT NOT NULL REFERENCES curricula (id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,
  description_md TEXT,
  position      INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  UNIQUE (curriculum_id, slug)
);

CREATE INDEX idx_education_levels_curriculum
  ON education_levels (curriculum_id, position);

CREATE TABLE subject_groups (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  icon_key    TEXT NOT NULL DEFAULT 'book',
  color_token TEXT NOT NULL DEFAULT 'cobalt',
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE subjects (
  id                 TEXT PRIMARY KEY,
  education_level_id TEXT NOT NULL REFERENCES education_levels (id) ON DELETE RESTRICT,
  subject_group_id   TEXT NOT NULL REFERENCES subject_groups (id) ON DELETE RESTRICT,
  slug               TEXT NOT NULL,
  name               TEXT NOT NULL,
  summary            TEXT,
  color_token        TEXT NOT NULL DEFAULT 'cobalt',
  icon_key           TEXT NOT NULL DEFAULT 'atom',
  hero_media_id      TEXT REFERENCES media_assets (id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  published_at       INTEGER,
  position           INTEGER NOT NULL DEFAULT 0,
  seo_title          TEXT,
  seo_description    TEXT,
  created_by         TEXT REFERENCES user (id) ON DELETE SET NULL,
  updated_by         TEXT REFERENCES user (id) ON DELETE SET NULL,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  UNIQUE (education_level_id, slug),
  CHECK (status <> 'published' OR published_at IS NOT NULL),
  -- NOTE: §6.4 says color_token is "unique within a level", which cannot be
  -- reconciled with its DEFAULT 'cobalt' (two subjects would collide). The
  -- uniqueness rule is therefore not encoded; see flagged ambiguity.
  CHECK (summary IS NULL OR status <> 'published'
         OR (length(summary) BETWEEN 40 AND 320))
);

CREATE INDEX idx_subjects_level ON subjects (education_level_id, position);
CREATE INDEX idx_subjects_group ON subjects (subject_group_id);
CREATE INDEX idx_subjects_published
  ON subjects (education_level_id, position) WHERE status = 'published';

CREATE TABLE chapters (
  id           TEXT PRIMARY KEY,
  subject_id   TEXT NOT NULL REFERENCES subjects (id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,
  title        TEXT NOT NULL,
  summary      TEXT,
  position     INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  published_at INTEGER,
  created_by   TEXT REFERENCES user (id),
  updated_by   TEXT REFERENCES user (id),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  UNIQUE (subject_id, slug),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX idx_chapters_subject ON chapters (subject_id, position);
CREATE INDEX idx_chapters_published
  ON chapters (subject_id, position) WHERE status = 'published';

CREATE TABLE topics (
  id                  TEXT PRIMARY KEY,
  chapter_id          TEXT NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
  slug                TEXT NOT NULL,
  title               TEXT NOT NULL,
  summary             TEXT,
  learning_objectives TEXT NOT NULL DEFAULT '[]'
                      CHECK (json_valid(learning_objectives)),
  estimated_minutes   INTEGER,
  position            INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  published_at        INTEGER,
  created_by          TEXT REFERENCES user (id),
  updated_by          TEXT REFERENCES user (id),
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  UNIQUE (chapter_id, slug),
  CHECK (status <> 'published' OR published_at IS NOT NULL),
  CHECK (estimated_minutes IS NULL
         OR estimated_minutes BETWEEN 5 AND 240),
  CHECK (json_type(learning_objectives) = 'array'
         AND json_array_length(learning_objectives) BETWEEN 1 AND 12)
);

CREATE INDEX idx_topics_chapter ON topics (chapter_id, position);
CREATE INDEX idx_topics_published
  ON topics (chapter_id, position) WHERE status = 'published';

-- ---------------------------------------------------------------------------
-- Learning content
-- ---------------------------------------------------------------------------

CREATE TABLE learning_resources (
  id              TEXT PRIMARY KEY,
  topic_id        TEXT NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  summary         TEXT,
  reading_minutes INTEGER NOT NULL DEFAULT 0,
  difficulty      TEXT NOT NULL DEFAULT 'medium'
                  CHECK (difficulty IN ('easy', 'medium', 'hard', 'very_hard')),
  position        INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  published_at    INTEGER,
  version         INTEGER NOT NULL DEFAULT 1,
  created_by      TEXT REFERENCES user (id),
  updated_by      TEXT REFERENCES user (id),
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE (topic_id, slug),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX idx_resources_topic ON learning_resources (topic_id, position, status);
CREATE INDEX idx_resources_published
  ON learning_resources (topic_id, position) WHERE status = 'published';
CREATE INDEX idx_resources_updated ON learning_resources (updated_at DESC);

CREATE TABLE content_blocks (
  id          TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL REFERENCES learning_resources (id) ON DELETE CASCADE,
  kind        TEXT NOT NULL
              CHECK (kind IN ('rich_text', 'heading', 'image', 'formula', 'table',
                              'callout', 'video', 'download', 'question_section',
                              'related_material')),
  position    INTEGER NOT NULL,
  payload     TEXT NOT NULL CHECK (json_valid(payload)),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (resource_id, position)
);

-- ---------------------------------------------------------------------------
-- Question bank
-- ---------------------------------------------------------------------------

CREATE TABLE questions (
  id             TEXT PRIMARY KEY,
  topic_id       TEXT NOT NULL REFERENCES topics (id) ON DELETE RESTRICT,
  question_type  TEXT NOT NULL
                 CHECK (question_type IN ('multiple_choice', 'multiple_select',
                                          'true_false', 'short_answer')),
  stem_md        TEXT NOT NULL,
  media_id       TEXT REFERENCES media_assets (id) ON DELETE SET NULL,
  difficulty     TEXT NOT NULL DEFAULT 'medium'
                 CHECK (difficulty IN ('easy', 'medium', 'hard', 'very_hard')),
  explanation_md TEXT NOT NULL DEFAULT '',
  answer_key     TEXT NOT NULL CHECK (json_valid(answer_key)),
  points_x100    INTEGER NOT NULL DEFAULT 100
                 CHECK (points_x100 BETWEEN 100 AND 1000),
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  published_at   INTEGER,
  version        INTEGER NOT NULL DEFAULT 1,
  created_by     TEXT REFERENCES user (id),
  updated_by     TEXT REFERENCES user (id),
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  CHECK (status <> 'published'
         OR (published_at IS NOT NULL
             AND length(trim(explanation_md)) >= 60))
);

CREATE INDEX idx_questions_topic_status ON questions (topic_id, status);
CREATE INDEX idx_questions_topic_difficulty ON questions (topic_id, difficulty, status);
CREATE INDEX idx_questions_published ON questions (status, published_at DESC);
CREATE INDEX idx_questions_author ON questions (created_by, updated_at DESC);

CREATE TABLE question_options (
  id          TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  label       TEXT NOT NULL
              CHECK (label IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H')),
  content_md  TEXT NOT NULL,
  feedback_md TEXT,
  position    INTEGER NOT NULL,
  UNIQUE (question_id, label),
  UNIQUE (question_id, position)
);

CREATE TABLE question_topics (
  question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  topic_id    TEXT NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  is_primary  INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  PRIMARY KEY (question_id, topic_id)
);

CREATE UNIQUE INDEX uq_question_topics_primary
  ON question_topics (question_id) WHERE is_primary = 1;
CREATE INDEX idx_question_topics_topic ON question_topics (topic_id);

-- ---------------------------------------------------------------------------
-- Assessments
-- ---------------------------------------------------------------------------

CREATE TABLE assessments (
  id               TEXT PRIMARY KEY,
  topic_id         TEXT REFERENCES topics (id) ON DELETE RESTRICT,
  subject_id       TEXT NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
  -- NOTE: §7.3 introduces scope_key as the slug scope and also states
  -- UNIQUE (topic_id, slug); those two cannot both hold. scope_key wins here,
  -- because SQLite treats NULLs as distinct and a course-wide slug would
  -- otherwise be duplicable.
  scope_key        TEXT NOT NULL,
  slug             TEXT NOT NULL,
  title            TEXT NOT NULL,
  description_md   TEXT,
  mode             TEXT NOT NULL DEFAULT 'practice'
                   CHECK (mode IN ('practice', 'test', 'mock')),
  difficulty       TEXT NOT NULL DEFAULT 'medium'
                   CHECK (difficulty IN ('easy', 'medium', 'hard', 'very_hard')),
  duration_seconds INTEGER,
  question_count   INTEGER NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  published_at     INTEGER,
  version          INTEGER NOT NULL DEFAULT 1,
  created_by       TEXT REFERENCES user (id),
  updated_by       TEXT REFERENCES user (id),
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  UNIQUE (scope_key, slug),
  CHECK (status <> 'published' OR published_at IS NOT NULL),
  -- §7.3 via API_CONTRACTS.md §7.3: timed modes need 60–10800 s; practice forbids
  -- a duration. The range appears only in the API document, not in this one.
  CHECK (mode = 'practice' OR duration_seconds IS NOT NULL),
  CHECK (mode <> 'practice' OR duration_seconds IS NULL),
  CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 60 AND 10800)
);

CREATE INDEX idx_assessments_topic ON assessments (topic_id, status);
CREATE INDEX idx_assessments_subject ON assessments (subject_id, mode, status);
CREATE INDEX idx_assessments_published
  ON assessments (published_at DESC) WHERE status = 'published';

CREATE TABLE assessment_items (
  id                    TEXT PRIMARY KEY,
  assessment_id         TEXT NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  question_id           TEXT NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
  position              INTEGER NOT NULL,
  points_x100_override  INTEGER CHECK (points_x100_override BETWEEN 100 AND 1000),
  UNIQUE (assessment_id, position),
  UNIQUE (assessment_id, question_id)
);

CREATE INDEX idx_assessment_items_question ON assessment_items (question_id);

CREATE TABLE resource_assessments (
  resource_id   TEXT NOT NULL REFERENCES learning_resources (id) ON DELETE CASCADE,
  assessment_id TEXT NOT NULL REFERENCES assessments (id) ON DELETE CASCADE,
  placement     TEXT NOT NULL DEFAULT 'end'
                CHECK (placement IN ('inline', 'end', 'optional')),
  position      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (resource_id, assessment_id)
);

CREATE INDEX idx_resource_assessments_assessment
  ON resource_assessments (assessment_id);

-- ---------------------------------------------------------------------------
-- Attempts
-- (Named in the §4.2 foundation migration even though attempts are a Phase 4
-- feature; see flagged ambiguity.)
-- ---------------------------------------------------------------------------

CREATE TABLE assessment_attempts (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  source              TEXT NOT NULL
                      CHECK (source IN ('topic', 'chapter', 'subject',
                                        'assessment', 'resource')),
  assessment_id       TEXT REFERENCES assessments (id) ON DELETE SET NULL,
  resource_id         TEXT REFERENCES learning_resources (id) ON DELETE SET NULL,
  subject_id          TEXT NOT NULL REFERENCES subjects (id) ON DELETE RESTRICT,
  chapter_id          TEXT REFERENCES chapters (id) ON DELETE RESTRICT,
  topic_id            TEXT REFERENCES topics (id) ON DELETE RESTRICT,
  config              TEXT NOT NULL CHECK (json_valid(config)),
  question_count      INTEGER NOT NULL CHECK (question_count BETWEEN 1 AND 100),
  status              TEXT NOT NULL DEFAULT 'in_progress'
                      CHECK (status IN ('in_progress', 'submitted',
                                        'abandoned', 'expired')),
  started_at          INTEGER NOT NULL,
  last_activity_at    INTEGER NOT NULL,
  expires_at          INTEGER NOT NULL,
  submitted_at        INTEGER,
  answered_count      INTEGER NOT NULL DEFAULT 0,
  correct_count       INTEGER NOT NULL DEFAULT 0,
  score_x100          INTEGER NOT NULL DEFAULT 0,
  max_score_x100      INTEGER NOT NULL DEFAULT 0,
  score_percent_x100  INTEGER,
  duration_seconds    INTEGER,
  idempotency_key     TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  CHECK (status <> 'submitted' OR submitted_at IS NOT NULL),
  CHECK (source <> 'topic' OR topic_id IS NOT NULL),
  CHECK (source <> 'assessment' OR assessment_id IS NOT NULL),
  CHECK (correct_count <= answered_count AND answered_count <= question_count),
  CHECK (score_x100 >= 0 AND score_x100 <= max_score_x100),
  CHECK (score_percent_x100 IS NULL
         OR score_percent_x100 BETWEEN 0 AND 10000)
);

CREATE INDEX idx_attempts_user_started
  ON assessment_attempts (user_id, started_at DESC);
CREATE INDEX idx_attempts_user_topic
  ON assessment_attempts (user_id, topic_id, started_at DESC);
CREATE INDEX idx_attempts_user_subject
  ON assessment_attempts (user_id, subject_id, started_at DESC);
CREATE INDEX idx_attempts_open
  ON assessment_attempts (status, expires_at) WHERE status = 'in_progress';
CREATE UNIQUE INDEX uq_attempts_user_idempotency
  ON assessment_attempts (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE attempt_items (
  id                 TEXT PRIMARY KEY,
  attempt_id         TEXT NOT NULL REFERENCES assessment_attempts (id) ON DELETE CASCADE,
  question_id        TEXT NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
  question_version   INTEGER NOT NULL,
  position           INTEGER NOT NULL,
  points_x100_max    INTEGER NOT NULL,
  selected_answer    TEXT CHECK (selected_answer IS NULL
                                 OR json_valid(selected_answer)),
  is_correct         INTEGER CHECK (is_correct IS NULL OR is_correct IN (0, 1)),
  points_x100_awarded INTEGER,
  feedback           TEXT CHECK (feedback IS NULL OR json_valid(feedback)),
  response_ms        INTEGER,
  answered_at        INTEGER,
  UNIQUE (attempt_id, position),
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX idx_attempt_items_attempt ON attempt_items (attempt_id, position);

-- ---------------------------------------------------------------------------
-- Search, jobs and operations
-- ---------------------------------------------------------------------------

CREATE TABLE search_events (
  id           TEXT PRIMARY KEY,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  op           TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_error   TEXT,
  available_at INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  processed_at INTEGER
);

CREATE INDEX idx_search_events_due ON search_events (status, available_at);
CREATE INDEX idx_search_events_entity ON search_events (entity_type, entity_id);

CREATE TABLE job_runs (
  idempotency_key TEXT PRIMARY KEY,
  job             TEXT NOT NULL,
  status          TEXT NOT NULL
                  CHECK (status IN ('pending', 'started', 'succeeded', 'failed', 'uncertain', 'skipped')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  payload         TEXT CHECK (payload IS NULL OR json_valid(payload)),
  created_at      INTEGER NOT NULL,
  started_at      INTEGER,
  finished_at     INTEGER,
  error           TEXT,
  error_code      TEXT
);

CREATE INDEX idx_job_runs_status ON job_runs (status, created_at);

CREATE TABLE search_terms (
  term       TEXT PRIMARY KEY,
  display    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  entity_id  TEXT,
  weight     INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_search_terms_prefix ON search_terms (term);
CREATE INDEX idx_search_terms_weight ON search_terms (weight DESC);

-- FTS5. entity_id is UNINDEXED and not unique: the schema relies on the
-- indexer for one-row-per-entity, which SQLite cannot enforce here.
CREATE VIRTUAL TABLE search_documents USING fts5(
  entity_id UNINDEXED,
  entity_type UNINDEXED,
  title,
  summary,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE usage_events (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  occurred_at  INTEGER NOT NULL,
  received_at  INTEGER NOT NULL,
  user_id      TEXT REFERENCES user (id) ON DELETE SET NULL,
  anonymous_id TEXT,
  entity_type  TEXT,
  entity_id    TEXT,
  props_json   TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(props_json)),
  request_id   TEXT,
  app_version  TEXT
);

CREATE INDEX idx_usage_name_time ON usage_events (name, received_at);
CREATE INDEX idx_usage_user_time ON usage_events (user_id, received_at);
CREATE INDEX idx_usage_entity ON usage_events (entity_type, entity_id, received_at);

CREATE TABLE email_suppressions (
  email_hash TEXT PRIMARY KEY,
  -- NOTE: §10.8 lists the reason values in parentheses but specifies no CHECK;
  -- encoded from the prose, which is the only place they appear.
  reason     TEXT NOT NULL
             CHECK (reason IN ('hard_bounce', 'complaint', 'manual', 'invalid')),
  source     TEXT CHECK (source IS NULL OR source IN ('smtp', 'ops')),
  created_at INTEGER NOT NULL
);
