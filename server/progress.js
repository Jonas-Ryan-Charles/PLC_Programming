// ─────────────────────────────────────────────────────────────────────────────
// XP → level model, shared shape with the client (src/api/progress.ts).
// Each level costs a flat XP_PER_LEVEL; this keeps progression legible for a
// learning app (one or two scenarios per level early on).
// ─────────────────────────────────────────────────────────────────────────────

import { listCompletions } from "./db.js";

export const XP_PER_LEVEL = 500;
export const XP_MIN = 50; // clamp the client-proposed award to a sane band
export const XP_MAX = 300;

export function levelForXp(totalXp) {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

/** Build the full progress payload for a user from their recorded completions. */
export function progressSummary(userId) {
  const rows = listCompletions(userId);
  const completions = rows.map((r) => ({
    scenarioId: r.scenario_id,
    xp: r.xp,
    completedAt: r.completed_at,
  }));
  const totalXp = completions.reduce((sum, c) => sum + c.xp, 0);
  const level = levelForXp(totalXp);
  return {
    completions,
    totalXp,
    level,
    xpIntoLevel: totalXp - (level - 1) * XP_PER_LEVEL,
    xpPerLevel: XP_PER_LEVEL,
  };
}
