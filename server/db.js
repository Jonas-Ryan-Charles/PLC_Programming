// ─────────────────────────────────────────────────────────────────────────────
// Persistence layer — libSQL / Turso (SQLite-compatible).
//
// In production set TURSO_DATABASE_URL (libsql://...) + TURSO_AUTH_TOKEN and the
// data lives in Turso's cloud (persists across restarts/redeploys). With neither
// set, it falls back to a local SQLite file so `npm run server` works offline in
// dev. The SQL is plain SQLite and maps 1:1 onto Postgres if this ever moves.
//
// All query fns are async (libSQL is network-backed in prod).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@libsql/client";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Prod → Turso; dev → local file (VOLTRUNG_DB overrides the local path).
const remoteUrl = process.env.TURSO_DATABASE_URL;
const localPath = process.env.VOLTRUNG_DB ?? join(__dirname, "data", "voltrung.db");

let clientConfig;
if (remoteUrl) {
  clientConfig = { url: remoteUrl, authToken: process.env.TURSO_AUTH_TOKEN };
} else {
  mkdirSync(dirname(localPath), { recursive: true });
  clientConfig = { url: `file:${localPath.replace(/\\/g, "/")}` };
}

export const db = createClient(clientConfig);

// Schema init (top-level await → importers wait until tables exist).
await db.executeMultiple(`
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

console.log(`DB ready: ${remoteUrl ? "Turso (" + remoteUrl.replace(/\?.*$/, "") + ")" : "local file " + localPath}`);

// ─── User queries ────────────────────────────────────────────────────────────

export async function createUser({ email, name, passwordHash }) {
  const info = await db.execute({
    sql: `INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)`,
    args: [email, name, passwordHash, Date.now()],
  });
  return getUserById(Number(info.lastInsertRowid));
}

export async function getUserByEmail(email) {
  const rs = await db.execute({ sql: `SELECT * FROM users WHERE email = ?`, args: [email] });
  return rs.rows[0];
}

export async function getUserById(id) {
  const rs = await db.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [id] });
  return rs.rows[0];
}

// ─── Program queries ───────────────────────────────────────────────────────────

/** Upsert a program file for a user. `file` is the full client ProjectFile. */
export async function saveProgram(userId, file) {
  const updatedAt = Date.now();
  const data = JSON.stringify({ ...file, updatedAt });
  await db.execute({
    sql: `INSERT INTO programs (id, user_id, name, data, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, id) DO UPDATE SET
            name = excluded.name,
            data = excluded.data,
            updated_at = excluded.updated_at`,
    args: [file.id, userId, file.name, data, updatedAt],
  });
  return JSON.parse(data);
}

export async function listPrograms(userId) {
  const rs = await db.execute({
    sql: `SELECT data FROM programs WHERE user_id = ? ORDER BY updated_at DESC`,
    args: [userId],
  });
  return rs.rows.map((r) => JSON.parse(r.data));
}

export async function getProgram(userId, id) {
  const rs = await db.execute({
    sql: `SELECT data FROM programs WHERE user_id = ? AND id = ?`,
    args: [userId, id],
  });
  return rs.rows[0] ? JSON.parse(rs.rows[0].data) : null;
}

export async function deleteProgram(userId, id) {
  const rs = await db.execute({
    sql: `DELETE FROM programs WHERE user_id = ? AND id = ?`,
    args: [userId, id],
  });
  return rs.rowsAffected > 0;
}

// ─── Progress / XP queries ───────────────────────────────────────────────────

/**
 * Record a scenario completion. Idempotent: the first completion awards XP;
 * re-completing the same scenario does not add XP again (INSERT OR IGNORE).
 * Returns true when this was a newly-recorded completion.
 */
export async function recordCompletion(userId, scenarioId, xp) {
  const rs = await db.execute({
    sql: `INSERT OR IGNORE INTO completions (user_id, scenario_id, xp, completed_at)
          VALUES (?, ?, ?, ?)`,
    args: [userId, scenarioId, xp, Date.now()],
  });
  return rs.rowsAffected > 0;
}

export async function listCompletions(userId) {
  const rs = await db.execute({
    sql: `SELECT scenario_id, xp, completed_at FROM completions
          WHERE user_id = ? ORDER BY completed_at ASC`,
    args: [userId],
  });
  return rs.rows;
}
