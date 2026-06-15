// ─────────────────────────────────────────────────────────────────────────────
// VoltRung PLC Engine — scenario auto-grader
// Runs a JSON TestSpec against a program on an isolated tag store and reports
// pass/fail per step. Mirrors the master-prompt scenario test format.
// ─────────────────────────────────────────────────────────────────────────────

import { cloneTags, getBool, getNum, runScanCycle } from "./scan";
import type { PLCState, Program, TagStore, TestSpec } from "./types";

export interface StepResult {
  label: string;
  pass: boolean;
  /** Human-readable mismatch detail when failed. */
  detail?: string;
}

export interface GradeResult {
  passed: boolean;
  steps: StepResult[];
}

const SETTLE_SCANS = 5; // scans to propagate combinational logic per step
const TICK_MS = 10; // simulated scan period when advancing time

function forceTag(tags: TagStore, name: string, value: boolean | number): void {
  const tag = tags[name];
  if (!tag) return;
  if (typeof value === "boolean") {
    if (tag.type === "BOOL") tag.value = value;
  } else if (tag.type === "DINT") {
    tag.value = Math.trunc(value);
  } else if (tag.type === "REAL") {
    tag.value = value;
  }
}

function freshState(tags: TagStore): PLCState {
  return { tags: cloneTags(tags), scanCount: 0, scanTimeMs: 0, faultRegister: 0 };
}

/**
 * Grade a program against a test spec. The program's instruction edge-memory is
 * cloned so grading never disturbs the live simulator. `baseTags` should be the
 * scenario's initial tag definitions (presets, comments, all bits reset).
 */
export function gradeProgram(
  program: Program,
  baseTags: TagStore,
  spec: TestSpec,
): GradeResult {
  // Clone the program so one-shot / counter edge memory does not leak out.
  const prog: Program = structuredCloneSafe(program);
  const state = freshState(baseTags);
  const steps: StepResult[] = [];

  // Initial settle so default outputs are valid before the first assertion.
  for (let i = 0; i < SETTLE_SCANS; i++) runScanCycle(prog, state, 0);

  for (const step of spec.tests) {
    if (step.set) {
      for (const [name, value] of Object.entries(step.set)) {
        forceTag(state.tags, name, value);
      }
    }

    if (step.holdMs && step.holdMs > 0) {
      let remaining = step.holdMs;
      while (remaining > 0) {
        const dt = Math.min(TICK_MS, remaining);
        runScanCycle(prog, state, dt);
        remaining -= dt;
      }
    } else {
      for (let i = 0; i < SETTLE_SCANS; i++) runScanCycle(prog, state, 0);
    }

    let pass = true;
    let detail = "";
    if (step.expect) {
      for (const [name, want] of Object.entries(step.expect)) {
        const got =
          typeof want === "boolean" ? getBool(state.tags, name) : getNum(state.tags, name);
        if (got !== want) {
          pass = false;
          detail += `${name}: expected ${want}, got ${got}. `;
        }
      }
    }
    steps.push({ label: step.label, pass, detail: detail.trim() || undefined });
  }

  return { passed: steps.every((s) => s.pass), steps };
}

function structuredCloneSafe<T>(v: T): T {
  if (typeof structuredClone === "function") return structuredClone(v);
  return JSON.parse(JSON.stringify(v)) as T;
}
