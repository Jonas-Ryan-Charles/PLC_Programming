// ─────────────────────────────────────────────────────────────────────────────
// SQLite persistence layer (Node built-in `node:sqlite`).
//
// Two tables: `users` (accounts) and `programs` (per-user saved PLC files).
// A program's full ProjectFile JSON is stored verbatim in `programs.data` so the
// client model can evolve without server-side migrations. The schema is plain
// SQL and maps 1:1 onto Postgres if/when this moves to production.
// ─────────────────────────────────────────────────────────────────────────────

import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.VOLTRUNG_DB ?? join(__dirname, "data", "voltrung.db");

// Ensure the data directory exists.
import { mkdirSync } from "node:fs";
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    name          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS programs (
    id         TEXT    NOT NULL,
    user_id    INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    data       TEXT    NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS completions (
    user_id      INTEGER NOT NULL,
    scenario_id  TEXT    NOT NULL,
    xp           INTEGER NOT NULL,
    completed_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, scenario_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ─── User queries ────────────────────────────────────────────────────────────

export function createUser({ email, name, passwordHash }) {
  const stmt = db.prepare(
    `INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)`
  );
  const info = stmt.run(email, name, passwordHash, Date.now());
  return getUserById(Number(info.lastInsertRowid));
}

export function getUserByEmail(email) {
  return db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
}

export function getUserById(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

// ─── Program queries ───────────────────────────────────────────────────────────

/** Upsert a program file for a user. `file` is the full client ProjectFile. */
export function saveProgram(userId, file) {
  const updatedAt = Date.now();
  const data = JSON.stringify({ ...file, updatedAt });
  db.prepare(
    `INSERT INTO programs (id, user_id, name, data, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, id) DO UPDATE SET
       name = excluded.name,
       data = excluded.data,
       updated_at = excluded.updated_at`
  ).run(file.id, userId, file.name, data, updatedAt);
  return JSON.parse(data);
}

export function listPrograms(userId) {
  const rows = db
    .prepare(`SELECT data FROM programs WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(userId);
  return rows.map((r) => JSON.parse(r.data));
}

export function getProgram(userId, id) {
  const row = db
    .prepare(`SELECT data FROM programs WHERE user_id = ? AND id = ?`)
    .get(userId, id);
  return row ? JSON.parse(row.data) : null;
}

export function deleteProgram(userId, id) {
  const info = db
    .prepare(`DELETE FROM programs WHERE user_id = ? AND id = ?`)
    .run(userId, id);
  return info.changes > 0;
}

// ─── Progress / XP queries ───────────────────────────────────────────────────

/**
 * Record a scenario completion. Idempotent: the first completion awards XP;
 * re-completing the same scenario does not add XP again (INSERT OR IGNORE).
 * Returns true when this was a newly-recorded completion.
 */
export function recordCompletion(userId, scenarioId, xp) {
  const info = db
    .prepare(
      `INSERT OR IGNORE INTO completions (user_id, scenario_id, xp, completed_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, scenarioId, xp, Date.now());
  return info.changes > 0;
}

export function listCompletions(userId) {
  return db
    .prepare(
      `SELECT scenario_id, xp, completed_at FROM completions
       WHERE user_id = ? ORDER BY completed_at ASC`
    )
    .all(userId);
}
