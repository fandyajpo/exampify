-- Redirects for changed public paths (`INFORMATION_ARCHITECTURE.md` §5.4,
-- `SEO_AND_CONTENT_STRATEGY.md` §6, `DATABASE_SCHEMA.md` §10.5).
--
-- Rows are written inside the transaction that renames a published slug, and read by the
-- public pages when a path no longer resolves. `source_path` doubles as a subtree prefix:
-- a renamed subject redirects everything beneath it with a single row.

CREATE TABLE IF NOT EXISTS redirects (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL UNIQUE CHECK (source_path LIKE '/%'),
  target_path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 308)),
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_redirects_target ON redirects (target_path);
