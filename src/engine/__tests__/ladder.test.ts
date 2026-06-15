import { describe, expect, it } from "vitest";
import { makeInstr } from "../edit";
import {
  addLeg,
  branchElement,
  branchSpan,
  insertIntoLeg,
  removeInstr,
  rungColumns,
} from "../ladder";
import { makeTag, runScanCycle } from "../scan";
import type { Instruction, PLCState, Program, RungNode, TagStore } from "../types";

// ─── tiny builders ───────────────────────────────────────────────────────────
const xic = (tag: string): RungNode => ({ kind: "instr", instr: { ...makeInstr("XIC"), tag } });
const ote = (tag: string): RungNode => ({ kind: "instr", instr: { ...makeInstr("OTE"), tag } });
const series = (...c: RungNode[]): Program["rungs"][0]["root"] => ({ kind: "series", children: c });

function prog(root: Program["rungs"][0]["root"]): Program {
  return { rungs: [{ id: "r1", root }] };
}

function tags(names: string[]): TagStore {
  const t: TagStore = {};
  for (const n of names) t[n] = makeTag(n, "BOOL", false);
  return t;
}

/** Force inputs, run one scan, return the resulting tag store. */
function evalOnce(program: Program, store: TagStore, set: Record<string, boolean>): TagStore {
  const s = structuredClone(store);
  for (const [k, v] of Object.entries(set)) s[k].value = v;
  const state: PLCState = { tags: s, scanCount: 0, scanTimeMs: 0, faultRegister: 0 };
  runScanCycle(program, state, 10);
  return state.tags;
}

const idsOf = (program: Program): Instruction[] => {
  const out: Instruction[] = [];
  const walk = (n: RungNode) => (n.kind === "instr" ? out.push(n.instr) : n.children.forEach(walk));
  program.rungs.forEach((r) => walk(r.root));
  return out;
};

/** Set the tag of the freshly-added seed contact (the one with no tag yet). */
function setSeedTag(program: Program, tag: string): Program {
  const seed = idsOf(program).find((i) => !i.tag);
  if (seed) seed.tag = tag;
  return program;
}

describe("ladder branch editing — produces correctly-evaluating trees", () => {
  it("branchElement turns A→Out into (A OR B)→Out", () => {
    const store = tags(["A", "B", "Out"]);
    let p = prog(series(xic("A"), ote("Out")));

    // baseline: only A drives Out
    expect(evalOnce(p, store, { A: true })["Out"].value).toBe(true);
    expect(evalOnce(p, store, { A: false })["Out"].value).toBe(false);

    // add an OR branch beside the A contact, wire it to B
    p = branchElement(p, "r1", 0);
    p = setSeedTag(p, "B");

    expect(evalOnce(p, store, { A: false, B: true })["Out"].value).toBe(true); // OR via branch
    expect(evalOnce(p, store, { A: true, B: false })["Out"].value).toBe(true);
    expect(evalOnce(p, store, { A: false, B: false })["Out"].value).toBe(false);
  });

  it("branchSpan wraps a group: (A AND B)→Out becomes ((A AND B) OR C)→Out", () => {
    const store = tags(["A", "B", "C", "Out"]);
    let p = prog(series(xic("A"), xic("B"), ote("Out")));

    expect(evalOnce(p, store, { A: true, B: true })["Out"].value).toBe(true);
    expect(evalOnce(p, store, { A: true, B: false })["Out"].value).toBe(false);

    // wrap the A,B group in a branch, seed leg wired to C
    p = branchSpan(p, "r1", 0, 1);
    p = setSeedTag(p, "C");

    // group false but C true → energised (branch around the group)
    expect(evalOnce(p, store, { A: false, B: false, C: true })["Out"].value).toBe(true);
    // group true, C false → still energised
    expect(evalOnce(p, store, { A: true, B: true, C: false })["Out"].value).toBe(true);
    // everything false → off
    expect(evalOnce(p, store, { A: false, B: false, C: false })["Out"].value).toBe(false);
  });

  it("supports multiple parallel output coils (separate output branches)", () => {
    const store = tags(["A", "O1", "O2"]);
    // A → [ OTE O1 ‖ OTE O2 ]
    const p = prog(series(xic("A"), { kind: "parallel", children: [series(ote("O1")), series(ote("O2"))] }));

    const on = evalOnce(p, store, { A: true });
    expect(on["O1"].value).toBe(true);
    expect(on["O2"].value).toBe(true);

    const off = evalOnce(p, store, { A: false });
    expect(off["O1"].value).toBe(false);
    expect(off["O2"].value).toBe(false);
  });

  it("insertIntoLeg builds a multi-instruction branch (series inside a leg)", () => {
    const store = tags(["A", "B", "C", "Out"]);
    // start: (A OR B) → Out, then make leg1 require B AND C
    let p = prog(series(xic("A"), ote("Out")));
    p = branchElement(p, "r1", 0); // element 0 becomes parallel[ [A], [seed] ]
    p = setSeedTag(p, "B"); // leg 1 = [B]
    p = insertIntoLeg(p, "r1", 0, 1, 1, "XIC"); // leg 1 = [B, seed]
    p = setSeedTag(p, "C"); // leg 1 = [B, C]

    // now Out = A OR (B AND C)
    expect(evalOnce(p, store, { A: false, B: true, C: false })["Out"].value).toBe(false);
    expect(evalOnce(p, store, { A: false, B: true, C: true })["Out"].value).toBe(true);
    expect(evalOnce(p, store, { A: true, B: false, C: false })["Out"].value).toBe(true);
  });

  it("removeInstr collapses a parallel back to the trunk when one leg remains", () => {
    const store = tags(["A", "B", "Out"]);
    let p = prog(series(xic("A"), ote("Out")));
    p = branchElement(p, "r1", 0);
    p = setSeedTag(p, "B");

    // remove the B branch → back to plain A → Out
    const bInstr = idsOf(p).find((i) => i.tag === "B")!;
    p = removeInstr(p, bInstr.id);

    const cols = rungColumns(p.rungs[0]);
    expect(cols[0].kind).toBe("instr"); // collapsed
    expect(evalOnce(p, store, { A: false, B: true })["Out"].value).toBe(false); // B no longer matters
    expect(evalOnce(p, store, { A: true })["Out"].value).toBe(true);
  });

  it("addLeg adds a third OR path", () => {
    const store = tags(["A", "B", "C", "Out"]);
    let p = prog(series(xic("A"), ote("Out")));
    p = branchElement(p, "r1", 0);
    p = setSeedTag(p, "B");
    p = addLeg(p, "r1", 0);
    p = setSeedTag(p, "C");

    expect(evalOnce(p, store, { A: false, B: false, C: true })["Out"].value).toBe(true);
  });
});
