// ─────────────────────────────────────────────────────────────────────────────
// Immutable ladder-edit operations.
//
// The editor constrains rungs to a practical shape that covers the whole early
// curriculum: a root SERIES of elements, where each element is either a single
// instruction or a PARALLEL group of contacts (an OR branch). This is far easier
// to edit than an arbitrary tree while still expressing AND / OR / seal-in.
// ─────────────────────────────────────────────────────────────────────────────

import type { Instruction, InstrKind, Program, Rung, RungNode } from "./types";

let _eid = 1000;
const newInstrId = () => `e${++_eid}`;
let _erid = 1000;
const newRungId = () => `er${++_erid}`;

export function makeInstr(kind: InstrKind, tag = ""): Instruction {
  return { id: newInstrId(), kind, tag };
}

function clone(program: Program): Program {
  return structuredClone(program);
}

/** Root series children of a rung (normalising a bare instruction/parallel). */
function elements(rung: Rung): RungNode[] {
  if (rung.root.kind === "series") return rung.root.children;
  return [rung.root];
}

function withElements(rung: Rung, els: RungNode[]): Rung {
  return { ...rung, root: { kind: "series", children: els } };
}

export function addRung(program: Program): Program {
  const p = clone(program);
  p.rungs.push({
    id: newRungId(),
    root: { kind: "series", children: [] },
    comment: "",
  });
  return p;
}

export function deleteRung(program: Program, rungId: string): Program {
  const p = clone(program);
  p.rungs = p.rungs.filter((r) => r.id !== rungId);
  return p;
}

/** Append an instruction as a new element at the end of the rung. */
export function appendInstr(program: Program, rungId: string, kind: InstrKind): Program {
  return insertInstr(program, rungId, kind, Number.MAX_SAFE_INTEGER);
}

/**
 * Insert a new instruction element into a rung at `index` (clamped). Returns a
 * new program; the freshly created instruction id is available via the second
 * tuple element so callers can auto-select it.
 */
export function insertInstr(
  program: Program,
  rungId: string,
  kind: InstrKind,
  index: number,
): Program {
  const p = clone(program);
  const r = p.rungs.find((x) => x.id === rungId);
  if (!r) return p;
  const els = elements(r);
  const at = Math.max(0, Math.min(els.length, index));
  els.splice(at, 0, { kind: "instr", instr: makeInstr(kind) });
  Object.assign(r, withElements(r, els));
  return p;
}

/** Remove an instruction anywhere in the program by its id (collapsing branches). */
export function removeInstrById(program: Program, instrId: string): Program {
  const p = clone(program);
  for (const r of p.rungs) {
    const els = elements(r);
    for (let ei = 0; ei < els.length; ei++) {
      const el = els[ei];
      if (el.kind === "instr" && el.instr.id === instrId) {
        els.splice(ei, 1);
        Object.assign(r, withElements(r, els));
        return p;
      }
      if (el.kind === "parallel") {
        const bi = el.children.findIndex((c) => c.kind === "instr" && c.instr.id === instrId);
        if (bi !== -1) {
          el.children.splice(bi, 1);
          if (el.children.length === 1) els[ei] = el.children[0];
          Object.assign(r, withElements(r, els));
          return p;
        }
      }
    }
  }
  return p;
}

/** Move an instruction (by id) to the end of another rung, preserving operands. */
export function moveInstrToRung(program: Program, instrId: string, destRungId: string): Program {
  let found: Instruction | null = null;
  const visit = (n: RungNode) => {
    if (n.kind === "instr") {
      if (n.instr.id === instrId) found = n.instr;
    } else n.children.forEach(visit);
  };
  program.rungs.forEach((r) => visit(r.root));
  if (!found) return program;

  const copy: Instruction = { ...(found as Instruction), id: newInstrId() };
  const p = clone(removeInstrById(program, instrId));
  const dest = p.rungs.find((x) => x.id === destRungId);
  if (!dest) return program;
  const els = elements(dest);
  els.push({ kind: "instr", instr: copy });
  Object.assign(dest, withElements(dest, els));
  return p;
}

/** Add a parallel (OR) contact alongside the element at `elementIndex`. */
export function addParallel(
  program: Program,
  rungId: string,
  elementIndex: number,
  kind: InstrKind,
): Program {
  const p = clone(program);
  const r = p.rungs.find((x) => x.id === rungId);
  if (!r) return p;
  const els = elements(r);
  const el = els[elementIndex];
  if (!el) return p;
  const added: RungNode = { kind: "instr", instr: makeInstr(kind) };
  if (el.kind === "parallel") {
    el.children.push(added);
  } else {
    els[elementIndex] = { kind: "parallel", children: [el, added] };
  }
  Object.assign(r, withElements(r, els));
  return p;
}

/** Remove an element (or a branch within a parallel group). */
export function removeElement(
  program: Program,
  rungId: string,
  elementIndex: number,
  branchIndex?: number,
): Program {
  const p = clone(program);
  const r = p.rungs.find((x) => x.id === rungId);
  if (!r) return p;
  const els = elements(r);
  const el = els[elementIndex];
  if (!el) return p;
  if (el.kind === "parallel" && branchIndex !== undefined) {
    el.children.splice(branchIndex, 1);
    if (el.children.length === 1) els[elementIndex] = el.children[0]; // collapse
  } else {
    els.splice(elementIndex, 1);
  }
  Object.assign(r, withElements(r, els));
  return p;
}

/** Update operands of a single instruction by id, anywhere in the program. */
export function editInstr(
  program: Program,
  instrId: string,
  patch: Partial<Instruction>,
): Program {
  const p = clone(program);
  const visit = (n: RungNode): void => {
    if (n.kind === "instr") {
      if (n.instr.id === instrId) Object.assign(n.instr, patch);
    } else {
      n.children.forEach(visit);
    }
  };
  p.rungs.forEach((r) => visit(r.root));
  return p;
}

/** Flatten a rung into [elementIndex, branchIndex?] addressable leaves for the UI. */
export interface LeafRef {
  instr: Instruction;
  elementIndex: number;
  branchIndex?: number;
}

export function rungLeaves(rung: Rung): LeafRef[][] {
  // Returns columns: each element is a column; parallel groups stack vertically.
  return elements(rung).map((el, elementIndex) => {
    if (el.kind === "instr") return [{ instr: el.instr, elementIndex }];
    if (el.kind === "parallel")
      return el.children
        .filter((c): c is { kind: "instr"; instr: Instruction } => c.kind === "instr")
        .map((c, branchIndex) => ({ instr: c.instr, elementIndex, branchIndex }));
    return [];
  });
}
