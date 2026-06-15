import { describe, expect, it } from "vitest";
import { makeInstr } from "../edit";
import { makeTag, newTimer, runScanCycle } from "../scan";
import type { PLCState, Program, RungNode, TagStore, TimerVal } from "../types";

const instr = (kind: Parameters<typeof makeInstr>[0], extra: Record<string, string> = {}): RungNode => ({
  kind: "instr",
  instr: { ...makeInstr(kind), ...extra },
});
const prog = (...children: RungNode[]): Program => ({ rungs: [{ id: "r1", root: { kind: "series", children } }] });

function runScans(program: Program, tags: TagStore, set: Record<string, boolean | number>, scans: number, dt: number) {
  for (const [k, v] of Object.entries(set)) tags[k].value = v;
  const state: PLCState = { tags, scanCount: 0, scanTimeMs: 0, faultRegister: 0 };
  for (let i = 0; i < scans; i++) runScanCycle(program, state, dt);
  return tags;
}

describe("electrical fidelity", () => {
  it("TOF does not time out on cold start (never energised)", () => {
    const tags: TagStore = { A: makeTag("A", "BOOL", false), T1: makeTag("T1", "TIMER", newTimer(100)) };
    const p = prog(instr("XIC", { tag: "A" }), instr("TOF", { tag: "T1" }));

    // rung false from power-up: timer must stay idle (not count, DN low)
    runScans(p, tags, { A: false }, 6, 50); // 300ms elapsed, > preset
    let t = tags.T1.value as TimerVal;
    expect(t.acc).toBe(0);
    expect(t.dn).toBe(false);
    expect(t.tt).toBe(false);

    // energise → output (DN) on immediately, accumulator reset
    runScans(p, tags, { A: true }, 1, 50);
    t = tags.T1.value as TimerVal;
    expect(t.dn).toBe(true);
    expect(t.acc).toBe(0);

    // de-energise → off-delay runs; DN holds until ACC reaches PRE
    runScans(p, tags, { A: false }, 1, 50); // acc 50/100
    expect((tags.T1.value as TimerVal).dn).toBe(true);
    runScans(p, tags, { A: false }, 1, 50); // acc 100/100 → times out
    expect((tags.T1.value as TimerVal).dn).toBe(false);
  });

  it("DIV by zero leaves the destination unchanged (math fault, not 0)", () => {
    const tags: TagStore = { N0: makeTag("N0", "DINT", 42) };
    const byZero = prog(instr("DIV", { a: "10", b: "0", c: "N0" }));
    runScans(byZero, tags, {}, 1, 10);
    expect(tags.N0.value).toBe(42); // untouched

    const ok = prog(instr("DIV", { a: "10", b: "2", c: "N0" }));
    runScans(ok, tags, {}, 1, 10);
    expect(tags.N0.value).toBe(5);
  });
});
