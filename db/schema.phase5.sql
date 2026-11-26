-- Phase 5 — progress (`DATABASE_SCHEMA.md` §9.5).
--
-- One row per student per resource they have opened, written by the reader's own visit.
-- Deliberately not `usage_events`: that table is analytics with a 90-day retention, and a
-- dashboard total that silently forgets a read is worse than no total at all. This table is
-- product data, kept until the student is deleted.
--
-- The public reader is cached per page, so the server cannot know who is reading; the
-- browser reports the visit to `POST /api/v1/resources/{id}/view` and the server records the
-- fact. A repeat visit updates `last_read_at` and `read_count` instead of adding a row, so
-- "resources read" is a count of rows and never needs a DISTINCT over analytics.

PRAGMA foreign_keys = ON;

CREATE TABLE resource_reads (
  user_id       TEXT NOT NULL REFERENCES user (id) ON DELETE CASCADE,
  resource_id   TEXT NOT NULL REFERENCES learning_resources (id) ON DELETE CASCADE,
  first_read_at INTEGER NOT NULL,
  last_read_at  INTEGER NOT NULL,
  read_count    INTEGER NOT NULL DEFAULT 1 CHECK (read_count >= 1),
  PRIMARY KEY (user_id, resource_id)
);

CREATE INDEX idx_resource_reads_user_time ON resource_reads (user_id, last_read_at DESC);
