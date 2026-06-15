// XP awarded for completing a scenario, by difficulty tier. The tier is derived
// from the scenario id prefix (analog/process scenarios are harder than the
// beginner discrete-logic set). The server clamps this to a sane band.
import type { Scenario } from "../scenarios/types";

export function xpForScenario(s: Scenario): number {
  if (s.id.startsWith("proc-")) return 175; // process/sequencing
  if (s.id.startsWith("an-")) return 150; // analog / closed-loop
  if (s.id.startsWith("eg-")) return 150; // BCD / encoder special modules
  if (s.id.startsWith("int-")) return 125; // intermediate logic
  return 100; // beginner discrete logic
}
