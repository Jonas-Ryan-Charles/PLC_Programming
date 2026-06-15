// Tiny DSL for assembling rung trees and tag stores in scenario definitions.
import { newCounter, newTimer } from "../engine/scan";
import type {
  Instruction,
  InstrKind,
  PlantConfig,
  Program,
  Rung,
  RungNode,
  Tag,
  TagStore,
} from "../engine/types";

let _id = 0;
const nextId = () => `i${++_id}`;

function instr(kind: InstrKind, fields: Partial<Instruction> = {}): RungNode {
  return { kind: "instr", instr: { id: nextId(), kind, ...fields } };
}

// Contacts / gates
export const xic = (tag: string): RungNode => instr("XIC", { tag });
export const xio = (tag: string): RungNode => instr("XIO", { tag });
export const ons = (tag: string): RungNode => instr("ONS", { tag });
export const equ = (a: string, b: string): RungNode => instr("EQU", { a, b });
export const grt = (a: string, b: string): RungNode => instr("GRT", { a, b });
export const geq = (a: string, b: string): RungNode => instr("GEQ", { a, b });
export const les = (a: string, b: string): RungNode => instr("LES", { a, b });
/** LIM(low, test, high) — true when low ≤ test ≤ high */
export const lim = (low: string, test: string, high: string): RungNode => instr("LIM", { a: low, b: test, c: high });

// Coils / blocks
export const ote = (tag: string): RungNode => instr("OTE", { tag });
export const otl = (tag: string): RungNode => instr("OTL", { tag });
export const otu = (tag: string): RungNode => instr("OTU", { tag });
export const ton = (tag: string): RungNode => instr("TON", { tag });
export const tof = (tag: string): RungNode => instr("TOF", { tag });
export const rto = (tag: string): RungNode => instr("RTO", { tag });
export const ctu = (tag: string): RungNode => instr("CTU", { tag });
export const ctd = (tag: string): RungNode => instr("CTD", { tag });
export const res = (tag: string): RungNode => instr("RES", { tag });
export const mov = (src: string, dest: string): RungNode =>
  instr("MOV", { a: src, tag: dest });
export const clr = (tag: string): RungNode => instr("CLR", { tag });
// Math (a OP b → dest)
export const add = (a: string, b: string, dest: string): RungNode => instr("ADD", { a, b, c: dest });
export const sub = (a: string, b: string, dest: string): RungNode => instr("SUB", { a, b, c: dest });
export const mul = (a: string, b: string, dest: string): RungNode => instr("MUL", { a, b, c: dest });
export const div = (a: string, b: string, dest: string): RungNode => instr("DIV", { a, b, c: dest });
export const mod = (a: string, b: string, dest: string): RungNode => instr("MOD", { a, b, c: dest });
// BCD conversion
export const tod = (src: string, dest: string): RungNode => instr("TOD", { a: src, tag: dest });
export const frd = (src: string, dest: string): RungNode => instr("FRD", { a: src, tag: dest });
/** SCP(input, inMin, inMax, outMin, outMax) → dest */
export const scp = (
  input: string,
  inMin: string,
  inMax: string,
  outMin: string,
  outMax: string,
  dest: string,
): RungNode => instr("SCP", { a: input, b: inMin, c: inMax, d: outMin, e: outMax, tag: dest });
/** PID(PV, SP, Kp, Ki, Kd) → CV (0–100 %) */
export const pid = (
  pv: string,
  sp: string,
  kp: string,
  ki: string,
  kd: string,
  cv: string,
): RungNode => instr("PID", { a: pv, b: sp, c: kp, d: ki, e: kd, tag: cv });

// Topology
export const series = (...children: RungNode[]): RungNode => ({ kind: "series", children });
export const parallel = (...children: RungNode[]): RungNode => ({
  kind: "parallel",
  children,
});

let _rid = 0;
export function rung(root: RungNode, comment?: string): Rung {
  return { id: `r${++_rid}`, root, comment };
}

export function program(...rungs: Rung[]): Program {
  return { rungs };
}

export function withPlant(p: Program, plant: PlantConfig): Program {
  return { ...p, plant };
}

// Tag builders
export const boolTag = (name: string, comment?: string): Tag => ({
  name,
  type: "BOOL",
  value: false,
  comment,
});
export const dintTag = (name: string, value = 0, comment?: string): Tag => ({
  name,
  type: "DINT",
  value,
  comment,
});
export const realTag = (name: string, value = 0, comment?: string): Tag => ({
  name,
  type: "REAL",
  value,
  comment,
});
export const timerTag = (name: string, preMs: number, comment?: string): Tag => ({
  name,
  type: "TIMER",
  value: newTimer(preMs),
  comment,
});
export const counterTag = (name: string, pre: number, comment?: string): Tag => ({
  name,
  type: "COUNTER",
  value: newCounter(pre),
  comment,
});

export function tags(...list: Tag[]): TagStore {
  const store: TagStore = {};
  for (const t of list) store[t.name] = t;
  return store;
}
