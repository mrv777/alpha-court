import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let _db: Database.Database | null = null;

function getDbPath(): string {
  return process.env.DATABASE_PATH || "./data/court.db";
}

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = getDbPath();

  // Auto-create directory if missing
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(dbPath);

  // WAL mode for concurrent reads, performance pragmas
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 5000");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("foreign_keys = ON");

  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nansen_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT UNIQUE NOT NULL,
      command TEXT NOT NULL,
      params_json TEXT NOT NULL,
      response_json TEXT NOT NULL,
      chain TEXT NOT NULL,
      token_address TEXT,
      created_at INTEGER NOT NULL,
      ttl_seconds INTEGER NOT NULL DEFAULT 300
    );

    CREATE TABLE IF NOT EXISTS trials (
      id TEXT PRIMARY KEY,
      token_address TEXT NOT NULL,
      chain TEXT NOT NULL,
      token_name TEXT,
      token_symbol TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      verdict_score INTEGER,
      verdict_label TEXT,
      verdict_summary TEXT,
      bull_conviction INTEGER,
      bear_conviction INTEGER,
      safety_score TEXT,
      safety_details_json TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS debate_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trial_id TEXT NOT NULL REFERENCES trials(id),
      agent TEXT NOT NULL,
      phase TEXT NOT NULL,
      content TEXT NOT NULL,
      evidence_json TEXT,
      sequence INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_trials_token_chain ON trials(token_address, chain);
    CREATE INDEX IF NOT EXISTS idx_trials_created ON trials(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_debate_messages_trial ON debate_messages(trial_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_nansen_cache_key ON nansen_cache(cache_key);
  `);

  // Migrations for columns added after initial schema
  try {
    db.exec(`ALTER TABLE trials ADD COLUMN token_icon_url TEXT`);
  } catch {
    // Column already exists — ignore
  }
}

/** Close database connection (useful for tests) */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
