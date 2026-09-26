-- Main rounds storage
CREATE TABLE IF NOT EXISTS rounds (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Main courses catalog
CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Key-Value metadata store
CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    val TEXT
);

-- Indices to optimize sync queries
CREATE INDEX IF NOT EXISTS idx_rounds_updated_at ON rounds(updated_at);
CREATE INDEX IF NOT EXISTS idx_courses_updated_at ON courses(updated_at);

-- Trigger to automatically update updated_at timestamp on round edit
CREATE TRIGGER IF NOT EXISTS rounds_update_timestamp AFTER UPDATE ON rounds
BEGIN
    UPDATE rounds SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = new.id;
END;

-- Trigger to automatically update updated_at timestamp on course edit
CREATE TRIGGER IF NOT EXISTS courses_update_timestamp AFTER UPDATE ON courses
BEGIN
    UPDATE courses SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = new.id;
END;

-- Tombstone tables to track deletions for delta sync
CREATE TABLE IF NOT EXISTS deleted_rounds (
    id TEXT PRIMARY KEY,
    deleted_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_deleted_rounds_deleted_at ON deleted_rounds(deleted_at);

CREATE TABLE IF NOT EXISTS deleted_courses (
    id TEXT PRIMARY KEY,
    deleted_at DATETIME DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_deleted_courses_deleted_at ON deleted_courses(deleted_at);

-- Triggers for deletion tracking
CREATE TRIGGER IF NOT EXISTS rounds_track_deletions AFTER DELETE ON rounds
BEGIN
    INSERT OR REPLACE INTO deleted_rounds (id, deleted_at) VALUES (old.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER IF NOT EXISTS rounds_untrack_deletions AFTER INSERT ON rounds
BEGIN
    DELETE FROM deleted_rounds WHERE id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS courses_track_deletions AFTER DELETE ON courses
BEGIN
    INSERT OR REPLACE INTO deleted_courses (id, deleted_at) VALUES (old.id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

CREATE TRIGGER IF NOT EXISTS courses_untrack_deletions AFTER INSERT ON courses
BEGIN
    DELETE FROM deleted_courses WHERE id = new.id;
END;
