import { create } from "zustand";
import { gradeProgram, type GradeResult } from "../engine/grader";
import type { Instruction, InstrKind, Program, TagStore } from "../engine/types";
import { addRung, deleteRung, editInstr } from "../engine/edit";
import {
  addLeg as addLegOp,
  branchElement,
  branchSpan as branchSpanOp,
  insertElement,
  insertIntoLeg,
  removeInstr as removeInstrOp,
} from "../engine/ladder";
import type { SelAddr } from "../components/ladder/RungView";
import { ALL_SCENARIOS as SCENARIOS } from "../scenarios";
import type { Scenario } from "../scenarios/types";
import type { FromWorker, ToWorker } from "../workers/protocol";

// ─── Worker singleton (lives outside React state) ────────────────────────────
let worker: Worker | null = null;

function ensureWorker(onState: (s: FromWorker) => void): Worker {
  if (!worker) {
    worker = new Worker(new URL("../workers/plcScan.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (e: MessageEvent<FromWorker>) => onState(e.data);
  }
  return worker;
}

function send(msg: ToWorker): void {
  worker?.postMessage(msg);
}

// ─── Store shape ─────────────────────────────────────────────────────────────
interface SimState {
  scenario: Scenario;
  program: Program; // editable working copy
  tags: TagStore; // latest snapshot from the worker
  rungEnergised: Record<string, boolean>;
  running: boolean;
  scanCount: number;
  scanTimeMs: number;
  scanMs: number;
  grade: GradeResult | null;
  selectedId: string | null;
  selAddr: SelAddr | null;
  spanAnchorId: string | null;
  spanAnchorAddr: SelAddr | null;

  loadScenario: (id: string) => void;
  setInput: (name: string, value: boolean | number) => void;
  run: () => void;
  stop: () => void;
  step: () => void;
  reset: () => void;
  setScanMs: (ms: number) => void;
  runTests: () => void;

  // editor ops
  selectInstr: (addr: SelAddr | null, instrId: string | null, shift?: boolean) => void;
  insertActive: (kind: InstrKind) => void;
  insertTrunk: (rungId: string, index: number, kind: InstrKind) => void;
  insertLeg: (rungId: string, elementIndex: number, legIndex: number, posInLeg: number, kind: InstrKind) => void;
  branch: (rungId: string, elementIndex: number) => void;
  addLeg: (rungId: string, elementIndex: number) => void;
  wrapSpan: () => void;
  removeInstr: (id: string) => void;
  replaceInstr: (instrId: string, kind: InstrKind) => void;
  addRung: () => void;
  deleteRung: (rungId: string) => void;
  editInstr: (instrId: string, patch: Partial<Instruction>) => void;
}

function applyProgram(get: () => SimState, set: (p: Partial<SimState>) => void, program: Program) {
  set({ program, grade: null });
  // Reload the worker with the new logic and the scenario's base tags (sim resets).
  send({ type: "LOAD", program, tags: get().scenario.tags, scanMs: get().scanMs });
}

export const useSim = create<SimState>((set, get) => {
  const onWorkerState = (msg: FromWorker) => {
    if (msg.type !== "STATE") return;
    const rungEnergised: Record<string, boolean> = {};
    for (const r of msg.rungs) rungEnergised[r.id] = r.energised;
    set({
      tags: msg.tags,
      rungEnergised,
      running: msg.running,
      scanCount: msg.scanCount,
      scanTimeMs: msg.scanTimeMs,
    });
  };

  const boot = (scenario: Scenario) => {
    ensureWorker(onWorkerState);
    send({ type: "LOAD", program: scenario.program, tags: scenario.tags, scanMs: get().scanMs });
  };

  const first = SCENARIOS[0];
  // Kick off the worker after the store is created.
  queueMicrotask(() => boot(first));

  return {
    scenario: first,
    program: structuredClone(first.program),
    tags: structuredClone(first.tags),
    rungEnergised: {},
    running: false,
    scanCount: 0,
    scanTimeMs: 0,
    scanMs: 50,
    grade: null,
    selectedId: null,
    selAddr: null,
    spanAnchorId: null,
    spanAnchorAddr: null,

    loadScenario: (id) => {
      const s = SCENARIOS.find((x) => x.id === id);
      if (!s) return;
      set({
        scenario: s,
        program: structuredClone(s.program),
        tags: structuredClone(s.tags),
        grade: null,
        selectedId: null,
        selAddr: null,
        spanAnchorId: null,
        spanAnchorAddr: null,
      });
      send({ type: "LOAD", program: s.program, tags: s.tags, scanMs: get().scanMs });
    },

    setInput: (name, value) => send({ type: "SET_INPUT", name, value }),
    run: () => send({ type: "RUN" }),
    stop: () => send({ type: "STOP" }),
    step: () => send({ type: "STEP" }),
    reset: () => send({ type: "RESET", tags: get().scenario.tags }),
    setScanMs: (ms) => {
      set({ scanMs: ms });
      send({ type: "SET_SCAN_MS", scanMs: ms });
    },

    runTests: () => {
      const { program, scenario } = get();
      set({ grade: gradeProgram(program, scenario.tags, scenario.tests) });
    },

    selectInstr: (addr, instrId, shift) => {
      if (instrId === null) {
        set({ selectedId: null, selAddr: null, spanAnchorId: null, spanAnchorAddr: null });
        return;
      }
      const prevId = get().selectedId;
      const prevAddr = get().selAddr;
      const isTrunk = addr && addr.legIndex === undefined;
      const prevTrunk = prevAddr && prevAddr.legIndex === undefined;
      if (shift && prevId && prevId !== instrId && isTrunk && prevTrunk && prevAddr!.rungId === addr!.rungId) {
        set({ spanAnchorId: prevId, spanAnchorAddr: prevAddr, selectedId: instrId, selAddr: addr });
      } else {
        set({ selectedId: instrId, selAddr: addr, spanAnchorId: null, spanAnchorAddr: null });
      }
    },
    insertActive: (kind) => {
      const { selAddr, program } = get();
      const rungId = selAddr?.rungId ?? program.rungs[program.rungs.length - 1]?.id;
      if (!rungId) return;
      if (selAddr && selAddr.legIndex !== undefined) {
        applyProgram(get, set, insertIntoLeg(program, rungId, selAddr.elementIndex, selAddr.legIndex, (selAddr.posInLeg ?? 0) + 1, kind));
      } else {
        applyProgram(get, set, insertElement(program, rungId, Number.MAX_SAFE_INTEGER, kind));
      }
    },
    insertTrunk: (rungId, index, kind) => applyProgram(get, set, insertElement(get().program, rungId, index, kind)),
    insertLeg: (rungId, ei, li, pos, kind) => applyProgram(get, set, insertIntoLeg(get().program, rungId, ei, li, pos, kind)),
    branch: (rungId, ei) => applyProgram(get, set, branchElement(get().program, rungId, ei)),
    addLeg: (rungId, ei) => applyProgram(get, set, addLegOp(get().program, rungId, ei)),
    wrapSpan: () => {
      const a = get().spanAnchorAddr;
      const b = get().selAddr;
      if (!a || !b || a.rungId !== b.rungId) return;
      applyProgram(get, set, branchSpanOp(get().program, a.rungId, a.elementIndex, b.elementIndex));
      set({ spanAnchorId: null, spanAnchorAddr: null });
    },
    removeInstr: (id) => {
      applyProgram(get, set, removeInstrOp(get().program, id));
      set({ selectedId: null, selAddr: null, spanAnchorId: null, spanAnchorAddr: null });
    },
    replaceInstr: (instrId, kind) =>
      applyProgram(get, set, editInstr(get().program, instrId, { kind, a: undefined, b: undefined, c: undefined, d: undefined, e: undefined })),

    addRung: () => applyProgram(get, set, addRung(get().program)),
    deleteRung: (rungId) => applyProgram(get, set, deleteRung(get().program, rungId)),
    editInstr: (instrId, patch) => applyProgram(get, set, editInstr(get().program, instrId, patch)),
  };
});
