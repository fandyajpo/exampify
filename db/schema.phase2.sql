-- Exampify — Phase 2 schema additions (Turso / libSQL, SQLite dialect)
--
-- Additive only (`DATABASE_SCHEMA.md` §15): existing tables are untouched, so this file can
-- be applied to a database that already ran `schema.phase1.sql`.
--
-- Phase 2 starts with the studio foundation: the audit trail every studio mutation writes
-- (`§10.6`). `redirects` (§10.5) arrives with the slug-change flow, and `user_topic_stats`
-- (§9.3) with progress in Phase 5.

-- ---------------------------------------------------------------------------
-- Audit trail (`DATABASE_SCHEMA.md` §10.6)
-- Append-only: the runtime token holds data_add only, so a correction is a new
-- row. `metadata` carries changed field names and transitions, never values.
-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id          TEXT NOT NULL PRIMARY KEY,
  actor_id    TEXT REFERENCES user (id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  metadata    TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at  INTEGER NOT NULL
);

CREATE INDEX idx_audit_entity ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs (actor_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_logs (created_at);
