// ─────────────────────────────────────────────────────────────────────────────
// Certificate definitions + eligibility.
//
// A certificate is earned when every scenario in its track has been completed.
// Tracks are matched by scenario-id prefix so they grow automatically as new
// scenarios are authored. Eligibility is computed from the user's completions
// (the same set the progress/XP system tracks).
// ─────────────────────────────────────────────────────────────────────────────

import { ALL_SCENARIOS } from "../scenarios";

export interface CertDef {
  id: string;
  code: string; // short code used in the verification id
  title: string; // the qualification awarded
  subtitle: string; // one-line track summary
  description: string; // the body sentence on the certificate
  accent: string; // seal / accent colour
  match: (scenarioId: string) => boolean;
}

export const CERTIFICATES: CertDef[] = [
  {
    id: "master",
    code: "CPP",
    title: "Certified PLC Programmer",
    subtitle: "Awarded for completing the entire VoltRung curriculum",
    description:
      "having successfully completed the entire VoltRung Academy curriculum — every graded exercise from relay-ladder fundamentals through timers, counters, interlocking and sequencing to analog scaling and PID closed-loop process control — demonstrating end-to-end command of industrial ladder-logic programming.",
    accent: "#D97706",
    match: () => true, // every scenario in the curriculum
  },
];

export function requiredIds(cert: CertDef): string[] {
  return ALL_SCENARIOS.filter((s) => cert.match(s.id)).map((s) => s.id);
}

export interface CertStatus {
  cert: CertDef;
  earned: boolean;
  done: number;
  total: number;
  /** Latest completion timestamp among the track's scenarios (when earned). */
  earnedAt: number | null;
}

export function certStatus(
  cert: CertDef,
  completions: { scenarioId: string; completedAt: number }[],
): CertStatus {
  const byId = new Map(completions.map((c) => [c.scenarioId, c.completedAt]));
  const req = requiredIds(cert);
  const doneTimes = req.map((id) => byId.get(id)).filter((t): t is number => t !== undefined);
  const earned = doneTimes.length === req.length && req.length > 0;
  return {
    cert,
    earned,
    done: doneTimes.length,
    total: req.length,
    earnedAt: earned ? Math.max(...doneTimes) : null,
  };
}

/** Deterministic verification id, e.g. "VR-FND-7K3Q1A". */
export function verifyId(cert: CertDef, userId: number | string): string {
  let h = 2166136261;
  const s = `${cert.id}|${userId}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const code = (h >>> 0).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
  return `VR-${cert.code}-${code}`;
}
