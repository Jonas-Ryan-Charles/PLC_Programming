import { describe, expect, it } from "vitest";
import { makeInstr } from "../edit";
import { bcdToDec, decToBcd, makeTag, runScanCycle } from "../scan";
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

describe("BCD helpers", () => {
  it("decToBcd packs one decimal digit per nibble", () => {
    expect(decToBcd(1234)).toBe(0x1234); // 4660
    expect(decToBcd(0)).toBe(0);
    expect(decToBcd(9999)).toBe(0x9999);
  });

  it("bcdToDec is the inverse and rejects invalid nibbles", () => {
    expect(bcdToDec(0x1234)).toBe(1234);
    expect(bcdToDec(0x9999)).toBe(9999);
    expect(bcdToDec(0x00ff)).toBeNull(); // 0xF is not a valid BCD digit
  });
});

describe("TOD / FRD instructions", () => {
  it("TOD encodes a decimal source into a BCD register", () => {
    const tags: TagStore = { TW: makeTag("TW", "DINT", 0) };
    run(prog(ins("TOD", { a: "1234", tag: "TW" })), tags);
    expect(tags.TW.value).toBe(0x1234);
  });

  it("FRD decodes a BCD source into a decimal register", () => {
    const tags: TagStore = { N0: makeTag("N0", "DINT", 0) };
    run(prog(ins("FRD", { a: String(0x1234), tag: "N0" })), tags);
    expect(tags.N0.value).toBe(1234);
  });

  it("TOD out of 0–9999 range leaves dest unchanged (conversion fault)", () => {
    const tags: TagStore = { TW: makeTag("TW", "DINT", 42) };
    run(prog(ins("TOD", { a: "12345", tag: "TW" })), tags);
    expect(tags.TW.value).toBe(42);
  });

  it("FRD of an invalid BCD code leaves dest unchanged", () => {
    const tags: TagStore = { N0: makeTag("N0", "DINT", 7) };
    run(prog(ins("FRD", { a: String(0x00ff), tag: "N0" })), tags);
    expect(tags.N0.value).toBe(7);
  });
});
