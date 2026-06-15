import { describe, expect, it } from "vitest";
import { makeInstr } from "../edit";
import { makeTag, runScanCycle } from "../scan";
import type { PLCState, Program, RungNode, TagStore } from "../types";

const ins = (kind: Parameters<typeof makeInstr>[0], extra: Record<string, string> = {}): RungNode => ({
  kind: "instr",
  instr: { ...makeInstr(kind), ...extra },
});
const prog = (...children: RungNode[]): Program => ({ rungs: [{ id: "r1", root: { kind: "series", children } }] });

function run(program: Program, tags: TagStore): TagStore {
  const state: PLCState = { tags, scanCount: 0, scanTimeMs: 0, faultRegister: 0 };
  runScanCycle(program, state, 10);
  return state.tags;
}

describe("new math instructions", () => {
  it("MOD computes a % b into dest", () => {
    const tags: TagStore = { N0: makeTag("N0", "DINT", 0) };
    run(prog(ins("MOD", { a: "17", b: "5", c: "N0" })), tags);
    expect(tags.N0.value).toBe(2);
  });

  it("MOD by zero leaves dest unchanged", () => {
    const tags: TagStore = { N0: makeTag("N0", "DINT", 99) };
    run(prog(ins("MOD", { a: "17", b: "0", c: "N0" })), tags);
    expect(tags.N0.value).toBe(99);
  });

  it("SQR writes the square root; negative input is a fault (dest untouched)", () => {
    const ok: TagStore = { F0: makeTag("F0", "REAL", 0) };
    run(prog(ins("SQR", { a: "144", tag: "F0" })), ok);
    expect(ok.F0.value).toBe(12);

    const neg: TagStore = { F0: makeTag("F0", "REAL", 7) };
    run(prog(ins("SQR", { a: "-4", tag: "F0" })), neg);
    expect(neg.F0.value).toBe(7);
  });

  it("ABS and NEG", () => {
    const tags: TagStore = { N0: makeTag("N0", "DINT", 0), N1: makeTag("N1", "DINT", 0) };
    run(prog(ins("ABS", { a: "-13", tag: "N0" }), ins("NEG", { a: "8", tag: "N1" })), tags);
    expect(tags.N0.value).toBe(13);
    expect(tags.N1.value).toBe(-8);
  });
});
