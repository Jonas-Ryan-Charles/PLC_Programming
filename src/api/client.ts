// ─────────────────────────────────────────────────────────────────────────────
// Thin REST client for the VoltRung backend. Holds the JWT in localStorage and
// attaches it as a Bearer token. All calls go through `/api/*` which Vite proxies
// to the Express server in dev (see vite.config.ts).
// ─────────────────────────────────────────────────────────────────────────────

import type { ProjectFile } from "../sandbox/project";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

const TOKEN_KEY = "voltrung.token";

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null): void =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

/** Error thrown for any non-2xx response, carrying the server's message. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// API origin. Empty in dev → calls hit "/api" and Vite proxies them to the
// local backend (vite.config.ts). In production set VITE_API_BASE to the
// deployed backend origin, e.g. "https://voltrung-api.onrender.com".
const API_ROOT = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_ROOT}/api${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function register(email: string, name: string, password: string): Promise<AuthUser> {
  const { token, user } = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, name, password }),
  });
  setToken(token);
  return user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { token, user } = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(token);
  return user;
}

export async function fetchMe(): Promise<AuthUser> {
  const { user } = await request<{ user: AuthUser }>("/auth/me");
  return user;
}

// ─── Programs ────────────────────────────────────────────────────────────────

export const fetchPrograms = (): Promise<ProjectFile[]> => request<ProjectFile[]>("/programs");

export const saveProgram = (file: ProjectFile): Promise<ProjectFile> =>
  request<ProjectFile>("/programs", { method: "POST", body: JSON.stringify({ file }) });

export const deleteProgram = (id: string): Promise<{ ok: true }> =>
  request<{ ok: true }>(`/programs/${encodeURIComponent(id)}`, { method: "DELETE" });

// ─── Progress / XP ───────────────────────────────────────────────────────────

export interface Completion {
  scenarioId: string;
  xp: number;
  completedAt: number;
}

export interface Progress {
  completions: Completion[];
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
}

export interface CompleteResult extends Progress {
  newlyCompleted: boolean;
  awardedXp: number;
}

export const fetchProgress = (): Promise<Progress> => request<Progress>("/progress");

export const completeScenario = (scenarioId: string, xp: number): Promise<CompleteResult> =>
  request<CompleteResult>("/progress/complete", {
    method: "POST",
    body: JSON.stringify({ scenarioId, xp }),
  });

// ─── Volta AI tutor ──────────────────────────────────────────────────────────

export interface TutorContext {
  scenarioId: string;
  title: string;
  brief: string;
  rungs: string; // human-readable summary of the student's program
  grade?: { passed: boolean; failing: { label: string; detail?: string }[] };
  question?: string;
}

export interface TutorReply {
  hint: string;
  source: "volta" | "local";
  error?: string;
}

export const askTutor = (context: TutorContext): Promise<TutorReply> =>
  request<TutorReply>("/tutor", { method: "POST", body: JSON.stringify({ context }) });
