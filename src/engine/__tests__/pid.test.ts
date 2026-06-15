import { describe, expect, it } from "vitest";
import { makeInstr } from "../edit";
import { makeTag, runScanCycle } from "../scan";
import type { PLCState, Program, RungNode, TagStore } from "../types";

const ins = (kind: Parameters<typeof makeInstr>[0], extra: Record<string, string> = {}): RungNode => ({
  kind: "instr",
  instr: { ...makeInstr(kind), ...extra },
});

function ovenProgram(kp: number, ki: number): Program {
  return {
    rungs: [{ id: "r1", root: { kind: "series", children: [ins("PID", { a: "PV", b: "200", c: String(kp), d: String(ki), e: "0", tag: "CV" })] } }],
    plant: { model: "oven", params: { pv: "PV", cv: "CV", ambient: 25, gain: 220, tau: 5 } },
  };
}

function runFor(program: Program, tags: TagStore, ms: number, dt = 10): TagStore {
  const state: PLCState = { tags, scanCount: 0, scanTimeMs: 0, faultRegister: 0 };
  for (let t = 0; t < ms; t += dt) runScanCycle(program, state, dt);
  return state.tags;
}

describe("PID closed-loop control of an oven", () => {
  it("drives PV from ambient to within ±5°C of the 200°C setpoint", () => {
    const tags: TagStore = { PV: makeTag("PV", "REAL", 25), CV: makeTag("CV", "REAL", 0) };
    const p = ovenProgram(2, 0.8);

    // cold start: CV should command full heat, PV still near ambient
    runFor(p, tags, 200);
    expect(tags.CV.value).toBeGreaterThan(50);
    expect(tags.PV.value as number).toBeLessThan(80);

    // warm up for two minutes → should settle within band, output not saturated
    runFor(p, tags, 120_000);
    const pv = tags.PV.value as number;
    const cv = tags.CV.value as number;
    expect(pv).toBeGreaterThan(195);
    expect(pv).toBeLessThan(205);
    expect(cv).toBeGreaterThan(0);
    expect(cv).toBeLessThan(100); // holding at steady state, not pinned
  });

  it("integral resets when the controller is de-energised", () => {
    const tags: TagStore = { PV: makeTag("PV", "REAL", 25), CV: makeTag("CV", "REAL", 0), En: makeTag("En", "BOOL", true) };
    const gated: Program = {
      rungs: [{ id: "r1", root: { kind: "series", children: [ins("XIC", { tag: "En" }), ins("PID", { a: "PV", b: "200", c: "2", d: "0.8", e: "0", tag: "CV" })] } }],
      plant: { model: "oven", params: { pv: "PV", cv: "CV", ambient: 25, gain: 220, tau: 5 } },
    };
    runFor(gated, tags, 10_000);
    expect(tags.CV.value as number).toBeGreaterThan(0);
    // disable → CV drops to 0
    tags.En.value = false;
    runFor(gated, tags, 100);
    expect(tags.CV.value).toBe(0);
  });
});
