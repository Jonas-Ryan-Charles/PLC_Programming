// ─────────────────────────────────────────────────────────────────────────────
// VoltRung ladder structure — bounded nested-branch model + editor operations.
//
// A rung is a SERIES (the trunk) of ELEMENTS, drawn left→right. Each element is:
//   • a single instruction, OR
//   • a PARALLEL group (an OR branch) whose legs are each a SERIES of instructions.
//
//        ┌─[ XIC ]─[ XIC ]─┐        ← leg 0 : a series of two contacts
//   ─────┤                 ├───────  (a branch "around a group")
//        └─[ XIC ]─────────┘        ← leg 1
//
// This single level of branching (parallel-of-series) is what real ladder editors
// (RSLogix / Studio 5000) expose, and it covers everything the curriculum needs:
//   • branch around a group of instructions
//   • multi-instruction OR branches
//   • multiple output coils in parallel (separate output branches)
//
// The simulation engine (scan.ts → evalNode) already evaluates arbitrary
// series/parallel trees, so these operations never touch the verified core — they
// only build/maintain a well-formed tree. Per IEC 61131-3, a parallel group ORs
// its legs and that result is AND'd with the rung power flowing into the group.
// ─────────────────────────────────────────────────────────────────────────────

import { makeInstr } from "./edit";
import type { Instruction, InstrKind, Program, Rung, RungNode } from "./types";

function clone(program: Program): Program {
  return structuredClone(program);
}

function rootChildren(rung: Rung): RungNode[] {
  if (rung.root.kind === "series") return rung.root.children;
  // normalise a bare element into a trunk series
  rung.root = { kind: "series", children: [rung.root] };
  return rung.root.children;
}

const instrNode = (kind: InstrKind): RungNode => ({ kind: "instr", instr: makeInstr(kind) });
const seriesNode = (children: RungNode[]): RungNode => ({ kind: "series", children });

/** Instruction leaves of a leg (a parallel child may be a bare instr or a series). */
function legInstrs(legNode: RungNode): Instruction[] {
  if (legNode.kind === "instr") return [legNode.instr];
  if (legNode.kind === "series")
    return legNode.children.flatMap((c) => (c.kind === "instr" ? [c.instr] : []));
  return [];
}

/**
 * Normalise every parallel group so its legs are series nodes (wrapping legacy
 * parallels whose children were bare instructions). Engine-equivalent; lets the
 * edit ops assume `parallel → series legs`.
 */
export function normalizeProgram(program: Program): Program {
  const p = clone(program);
  for (const rung of p.rungs) {
    const els = rootChildren(rung);
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (el.kind === "parallel") {
        el.children = el.children.map((leg) => (leg.kind === "series" ? leg : seriesNode([leg])));
      }
    }
  }
  return p;
}

// ─── Render model ──────────────────────────────────────────────────────────────

export type Column =
  | { kind: "instr"; elementIndex: number; widthCells: 1; instr: Instruction }
  | {
      kind: "parallel";
      elementIndex: number;
      widthCells: number;
      legs: { legIndex: number; instrs: Instruction[] }[];
    };

/** Flatten a rung into drawable columns (handles legacy + new shapes). */
export function rungColumns(rung: Rung): Column[] {
  const els = rung.root.kind === "series" ? rung.root.children : [rung.root];
  return els.map((el, elementIndex): Column => {
    if (el.kind === "instr") return { kind: "instr", elementIndex, widthCells: 1, instr: el.instr };
    if (el.kind === "parallel") {
      const legs = el.children.map((leg, legIndex) => ({ legIndex, instrs: legInstrs(leg) }));
      const widthCells = Math.max(1, ...legs.map((l) => l.instrs.length));
      return { kind: "parallel", elementIndex, widthCells, legs };
    }
    // a bare series at top level (unusual) — render its first instr
    return { kind: "instr", elementIndex, widthCells: 1, instr: legInstrs(el)[0] ?? makeInstr("XIC") };
  });
}

/** Address of an instruction within a rung, for the inspector + span ops. */
export interface InstrAddr {
  rungId: string;
  elementIndex: number;
  legIndex?: number;
  posInLeg?: number;
  instr: Instruction;
}

export function findInstr(program: Program, instrId: string): InstrAddr | null {
  for (const rung of program.rungs) {
    const els = rung.root.kind === "series" ? rung.root.children : [rung.root];
    for (let elementIndex = 0; elementIndex < els.length; elementIndex++) {
      const el = els[elementIndex];
      if (el.kind === "instr" && el.instr.id === instrId) {
        return { rungId: rung.id, elementIndex, instr: el.instr };
      }
      if (el.kind === "parallel") {
        for (let legIndex = 0; legIndex < el.children.length; legIndex++) {
          const instrs = legInstrs(el.children[legIndex]);
          const posInLeg = instrs.findIndex((x) => x.id === instrId);
          if (posInLeg !== -1) {
            return { rungId: rung.id, elementIndex, legIndex, posInLeg, instr: instrs[posInLeg] };
          }
        }
      }
    }
  }
  return null;
}

// ─── Edit operations (immutable; return a new, normalised Program) ───────────────

function withRung(program: Program, rungId: string, fn: (rung: Rung, els: RungNode[]) => void): Program {
  const p = normalizeProgram(program);
  const rung = p.rungs.find((r) => r.id === rungId);
  if (!rung) return p;
  fn(rung, rootChildren(rung));
  return p;
}

/** Insert an instruction as a new trunk element at `index`. */
export function insertElement(program: Program, rungId: string, index: number, kind: InstrKind): Program {
  return withRung(program, rungId, (_r, els) => {
    const at = Math.max(0, Math.min(els.length, index));
    els.splice(at, 0, instrNode(kind));
  });
}

/** Insert an instruction inside a parallel leg at `posInLeg`. */
export function insertIntoLeg(
  program: Program,
  rungId: string,
  elementIndex: number,
  legIndex: number,
  posInLeg: number,
  kind: InstrKind,
): Program {
  return withRung(program, rungId, (_r, els) => {
    const el = els[elementIndex];
    if (el?.kind !== "parallel") return;
    const leg = el.children[legIndex];
    if (leg?.kind !== "series") return;
    const at = Math.max(0, Math.min(leg.children.length, posInLeg));
    leg.children.splice(at, 0, instrNode(kind));
  });
}

/**
 * Wrap the element at `elementIndex` in an OR branch. If it is already a parallel
 * group, append a fresh (seed) leg instead.
 */
export function branchElement(program: Program, rungId: string, elementIndex: number, seed: InstrKind = "XIC"): Program {
  return withRung(program, rungId, (_r, els) => {
    const el = els[elementIndex];
    if (!el) return;
    if (el.kind === "parallel") {
      el.children.push(seriesNode([instrNode(seed)]));
    } else {
      els[elementIndex] = { kind: "parallel", children: [seriesNode([el]), seriesNode([instrNode(seed)])] };
    }
  });
}

/**
 * Wrap a contiguous span of trunk elements [start..end] (inclusive) into a single
 * OR branch — i.e. "branch around a group". The span must contain only plain
 * instruction elements (no nested parallels); otherwise it is left unchanged.
 */
export function branchSpan(program: Program, rungId: string, start: number, end: number, seed: InstrKind = "XIC"): Program {
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  return withRung(program, rungId, (_r, els) => {
    if (lo < 0 || hi >= els.length) return;
    const span = els.slice(lo, hi + 1);
    if (!span.every((n) => n.kind === "instr")) return; // keep it one level deep
    const group = seriesNode(span);
    const branch: RungNode = { kind: "parallel", children: [group, seriesNode([instrNode(seed)])] };
    els.splice(lo, span.length, branch);
  });
}

/** Add another (seed) leg to the parallel group at `elementIndex`. */
export function addLeg(program: Program, rungId: string, elementIndex: number, seed: InstrKind = "XIC"): Program {
  return withRung(program, rungId, (_r, els) => {
    const el = els[elementIndex];
    if (el?.kind === "parallel") el.children.push(seriesNode([instrNode(seed)]));
  });
}

/** Remove an instruction anywhere in the program, collapsing emptied branches. */
export function removeInstr(program: Program, instrId: string): Program {
  const p = normalizeProgram(program);
  for (const rung of p.rungs) {
    const els = rootChildren(rung);
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (el.kind === "instr" && el.instr.id === instrId) {
        els.splice(i, 1);
        return p;
      }
      if (el.kind === "parallel") {
        let hit = false;
        for (const leg of el.children) {
          if (leg.kind !== "series") continue;
          const bi = leg.children.findIndex((c) => c.kind === "instr" && c.instr.id === instrId);
          if (bi !== -1) {
            leg.children.splice(bi, 1);
            hit = true;
            break;
          }
        }
        if (!hit) continue;
        // drop empty legs
        el.children = el.children.filter((leg) => leg.kind === "series" && leg.children.length > 0);
        if (el.children.length === 0) {
          els.splice(i, 1); // nothing left
        } else if (el.children.length === 1) {
          // collapse the lone leg back into the trunk
          const lone = el.children[0] as { kind: "series"; children: RungNode[] };
          els.splice(i, 1, ...lone.children);
        }
        return p;
      }
    }
  }
  return p;
}
