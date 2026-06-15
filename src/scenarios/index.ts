import { SCENARIOS as BEGINNER } from "./beginner";
import { INTERMEDIATE_SCENARIOS } from "./intermediate";
import { SECTION_EG_SCENARIOS } from "./sections";
import { ANALOG_SCENARIOS } from "./analog";
import { PROCESS_SCENARIOS } from "./process";
import type { Scenario } from "./types";

export const ALL_SCENARIOS: Scenario[] = [
  ...BEGINNER,
  ...INTERMEDIATE_SCENARIOS,
  ...SECTION_EG_SCENARIOS,
  ...ANALOG_SCENARIOS,
  ...PROCESS_SCENARIOS,
];

export const scenarioById = (id: string): Scenario | undefined =>
  ALL_SCENARIOS.find((s) => s.id === id);
