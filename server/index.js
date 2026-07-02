// ─────────────────────────────────────────────────────────────────────────────
// VoltRung Academy backend — REST API for accounts + saved PLC programs.
//
//   POST   /api/auth/register   { email, name, password }      → { token, user }
//   POST   /api/auth/login      { email, password }            → { token, user }
//   GET    /api/auth/me                                        → { user }
//   GET    /api/programs                                       → ProjectFile[]
//   GET    /api/programs/:id                                   → ProjectFile
//   POST   /api/programs        { file: ProjectFile }          → ProjectFile (upsert)
//   DELETE /api/programs/:id                                   → { ok: true }
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import {
  createUser,
  getUserByEmail,
  saveProgram,
  listPrograms,
  getProgram,
  deleteProgram,
  recordCompletion,
} from "./db.js";
import { issueToken, publicUser, requireAuth } from "./auth.js";
import { progressSummary, XP_MAX, XP_MIN } from "./progress.js";
import { askVolta, tutorConfigured } from "./tutor.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" })); // programs are small JSON blobs

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Auth ──────────────────────────────────────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  const { email, name, password } = req.body ?? {};
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (!password || password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });

  if (await getUserByEmail(email.toLowerCase())) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({
    email: email.toLowerCase(),
    name: (name ?? "").trim() || email.split("@")[0],
    passwordHash,
  });
  res.json({ token: issueToken(user), user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = email ? await getUserByEmail(email.toLowerCase()) : null;
  const ok = user && (await bcrypt.compare(password ?? "", user.password_hash));
  if (!ok) return res.status(401).json({ error: "Incorrect email or password." });
  res.json({ token: issueToken(user), user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ─── Programs ────────────────────────────────────────────────────────────────

app.get("/api/programs", requireAuth, async (req, res) => {
  res.json(await listPrograms(req.user.id));
});

app.get("/api/programs/:id", requireAuth, async (req, res) => {
  const file = await getProgram(req.user.id, req.params.id);
  if (!file) return res.status(404).json({ error: "Program not found" });
  res.json(file);
});

app.post("/api/programs", requireAuth, async (req, res) => {
  const file = req.body?.file;
  if (!file || typeof file.id !== "string" || typeof file.name !== "string" || !file.program) {
    return res.status(400).json({ error: "Malformed program file." });
  }
  res.json(await saveProgram(req.user.id, file));
});

app.delete("/api/programs/:id", requireAuth, async (req, res) => {
  const removed = await deleteProgram(req.user.id, req.params.id);
  if (!removed) return res.status(404).json({ error: "Program not found" });
  res.json({ ok: true });
});

// ─── Progress / XP ───────────────────────────────────────────────────────────

app.get("/api/progress", requireAuth, async (req, res) => {
  res.json(await progressSummary(req.user.id));
});

app.post("/api/progress/complete", requireAuth, async (req, res) => {
  const { scenarioId } = req.body ?? {};
  if (!scenarioId || typeof scenarioId !== "string") {
    return res.status(400).json({ error: "scenarioId is required." });
  }
  // Clamp the client-proposed award to a sane band, then record idempotently.
  const proposed = Number(req.body?.xp) || XP_MIN;
  const xp = Math.max(XP_MIN, Math.min(XP_MAX, Math.round(proposed)));
  const awarded = await recordCompletion(req.user.id, scenarioId, xp);
  res.json({ ...(await progressSummary(req.user.id)), newlyCompleted: awarded, awardedXp: awarded ? xp : 0 });
});

// ─── Volta AI tutor ──────────────────────────────────────────────────────────

app.post("/api/tutor", requireAuth, async (req, res) => {
  const ctx = req.body?.context ?? req.body ?? {};
  try {
    const result = await askVolta(ctx);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "Tutor unavailable", detail: String(e?.message ?? e) });
  }
});

app.get("/api/tutor/status", requireAuth, (_req, res) => {
  res.json({ configured: tutorConfigured() });
});

// ─── Boot ──────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`VoltRung API listening on http://localhost:${PORT}`));
