import { create } from "zustand";
import { addRung, deleteRung, editInstr } from "../engine/edit";
import {
  addLeg as addLegOp,
  branchElement,
  branchSpan as branchSpanOp,
  insertElement,
  insertIntoLeg,
  removeInstr as removeInstrOp,
} from "../engine/ladder";
import type { CounterVal, Instruction, InstrKind, TimerVal } from "../engine/types";
import type { SelAddr } from "../components/ladder/RungView";
import {
  fromFile,
  newProject,
  toFile,
  type InputDeviceKind,
  type OutputDeviceKind,
  type ProjectFile,
  type SandboxProject,
} from "../sandbox/project";
import * as api from "../api/client";
import type { AuthUser, Progress } from "../api/client";
import type { FromWorker, ToWorker } from "../workers/protocol";

// ─── Worker singleton ────────────────────────────────────────────────────────
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
const send = (msg: ToWorker) => worker?.postMessage(msg);

/** Which top-level area of the app is showing once signed in. */
export type Section = "hub" | "studio" | "academy" | "wiring" | "certificates";

interface ProjectState {
  // session
  user: AuthUser | null;
  sessionChecked: boolean; // false until init() resolves (avoids auth-screen flash)
  section: Section;
  authPending: boolean;
  authError: string | null;
  projects: ProjectFile[];
  project: SandboxProject | null;
  fileError: string | null;

  // progress / XP (academy)
  progress: Progress | null;
  lastAward: { scenarioId: string; xp: number } | null;

  // live sim
  tags: SandboxProject["tags"];
  rungEnergised: Record<string, boolean>;
  running: boolean;
  scanCount: number;
  scanTimeMs: number;
  scanMs: number;
  dirty: boolean;
  saving: boolean;
  selectedInstrId: string | null;
  selAddr: SelAddr | null;
  spanAnchorId: string | null;
  spanAnchorAddr: SelAddr | null;
  activeRungId: string | null;

  // session actions
  init: () => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  clearAuthError: () => void;
  setSection: (section: Section) => void;
  refreshProjects: () => Promise<void>;
  loadProgress: () => Promise<void>;
  recordCompletion: (scenarioId: string, xp: number) => Promise<void>;
  clearLastAward: () => void;
  createFile: (name: string) => Promise<void>;
  openFile: (id: string) => void;
  removeFile: (id: string) => Promise<void>;
  closeFile: () => void;
  saveFile: () => Promise<void>;
  renameFile: (name: string) => void;
  exportFile: () => void;
  importFile: (file: ProjectFile) => Promise<void>;

  // run control
  run: () => void;
  stop: () => void;
  step: () => void;
  reset: () => void;
  setScanMs: (ms: number) => void;
  setInput: (name: string, value: boolean | number) => void;

  // chassis
  setInputDevice: (addr: string, kind: InputDeviceKind) => void;
  setOutputDevice: (addr: string, kind: OutputDeviceKind) => void;

  // editor
  selectInstr: (addr: SelAddr | null, instrId: string | null, shift?: boolean) => void;
  setActiveRung: (id: string | null) => void;
  insertActive: (kind: InstrKind) => void;
  insertTrunk: (rungId: string, index: number, kind: InstrKind) => void;
  insertLeg: (rungId: string, elementIndex: number, legIndex: number, posInLeg: number, kind: InstrKind) => void;
  branch: (rungId: string, elementIndex: number) => void;
  wrapSpan: () => void;
  addLeg: (rungId: string, elementIndex: number) => void;
  deleteSelected: () => void;
  removeInstr: (id: string) => void;
  replaceInstr: (instrId: string, kind: InstrKind) => void;
  editInstr: (instrId: string, patch: Partial<Instruction>) => void;
  setPreset: (tagAddr: string, pre: number) => void;
  setComment: (tagAddr: string, comment: string) => void;
  addRung: () => void;
  deleteRung: (rungId: string) => void;
}

export const useProject = create<ProjectState>((set, get) => {
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

  /** Load a project's program + authored tag image into the worker. */
  const loadIntoWorker = (p: SandboxProject) => {
    ensureWorker(onWorkerState);
    send({ type: "LOAD", program: p.program, tags: p.tags, scanMs: get().scanMs });
    set({ tags: p.tags, rungEnergised: {} });
  };

  /** Re-push the current program to the worker after an edit (resets the scan). */
  const reload = () => {
    const p = get().project;
    if (p) loadIntoWorker(p);
  };

  const mutate = (fn: (p: SandboxProject) => void) => {
    const p = get().project;
    if (!p) return;
    fn(p);
    set({ project: { ...p }, dirty: true });
    reload();
  };

  return {
    user: null,
    sessionChecked: false,
    section: "hub",
    authPending: false,
    authError: null,
    projects: [],
    project: null,
    fileError: null,
    progress: null,
    lastAward: null,
    tags: {},
    rungEnergised: {},
    running: false,
    scanCount: 0,
    scanTimeMs: 0,
    scanMs: 50,
    dirty: false,
    saving: false,
    selectedInstrId: null,
    selAddr: null,
    spanAnchorId: null,
    spanAnchorAddr: null,
    activeRungId: null,

    // ── Session ────────────────────────────────────────────────────────────────
    init: async () => {
      if (!api.getToken()) {
        set({ sessionChecked: true });
        return;
      }
      try {
        const user = await api.fetchMe();
        set({ user });
        await get().refreshProjects();
        await get().loadProgress();
      } catch (e) {
        // Only drop the session on a real auth failure (401). A network error
        // (backend down / offline) is transient — keep the token so the session
        // restores on the next load instead of silently signing the user out.
        if (e instanceof api.ApiError && e.status === 401) {
          api.setToken(null);
        }
        set({ user: null });
      } finally {
        set({ sessionChecked: true });
      }
    },

    register: async (email, name, password) => {
      set({ authPending: true, authError: null });
      try {
        const user = await api.register(email, name, password);
        set({ user });
        await get().refreshProjects();
        await get().loadProgress();
      } catch (e) {
        set({ authError: (e as Error).message });
      } finally {
        set({ authPending: false });
      }
    },

    login: async (email, password) => {
      set({ authPending: true, authError: null });
      try {
        const user = await api.login(email, password);
        set({ user });
        await get().refreshProjects();
        await get().loadProgress();
      } catch (e) {
        set({ authError: (e as Error).message });
      } finally {
        set({ authPending: false });
      }
    },

    signOut: () => {
      api.setToken(null);
      send({ type: "STOP" });
      set({ user: null, project: null, projects: [], progress: null, lastAward: null, running: false, authError: null, section: "hub" });
    },

    clearAuthError: () => set({ authError: null }),
    setSection: (section) => set({ section }),

    refreshProjects: async () => {
      try {
        set({ projects: await api.fetchPrograms() });
      } catch (e) {
        set({ fileError: (e as Error).message });
      }
    },

    loadProgress: async () => {
      try {
        set({ progress: await api.fetchProgress() });
      } catch {
        // progress is non-critical; leave it null if the call fails
      }
    },

    recordCompletion: async (scenarioId, xp) => {
      // Skip the round-trip if this scenario is already completed.
      const done = get().progress?.completions.some((c) => c.scenarioId === scenarioId);
      if (done) return;
      try {
        const result = await api.completeScenario(scenarioId, xp);
        set({
          progress: result,
          lastAward: result.newlyCompleted ? { scenarioId, xp: result.awardedXp } : null,
        });
      } catch {
        // ignore — a failed completion can be re-recorded next time tests pass
      }
    },

    clearLastAward: () => set({ lastAward: null }),

    createFile: async (name) => {
      const p = newProject(name.trim() || "Untitled");
      set({ project: p, selectedInstrId: null, dirty: false, fileError: null });
      loadIntoWorker(p);
      try {
        await api.saveProgram(toFile(p));
        await get().refreshProjects();
      } catch (e) {
        set({ fileError: (e as Error).message, dirty: true });
      }
    },

    openFile: (id) => {
      const file = get().projects.find((f) => f.id === id);
      if (!file) return;
      const p = fromFile(file);
      set({ project: p, selectedInstrId: null, dirty: false, fileError: null });
      loadIntoWorker(p);
    },

    removeFile: async (id) => {
      try {
        await api.deleteProgram(id);
        if (get().project?.id === id) set({ project: null });
        await get().refreshProjects();
      } catch (e) {
        set({ fileError: (e as Error).message });
      }
    },

    closeFile: () => {
      send({ type: "STOP" });
      set({ project: null, running: false });
      get().refreshProjects();
    },

    saveFile: async () => {
      const p = get().project;
      if (!p) return;
      set({ saving: true, fileError: null });
      try {
        await api.saveProgram(toFile(p));
        set({ dirty: false });
        await get().refreshProjects();
      } catch (e) {
        set({ fileError: (e as Error).message });
      } finally {
        set({ saving: false });
      }
    },

    renameFile: (name) => mutate((p) => (p.name = name)),

    exportFile: () => {
      const p = get().project;
      if (!p) return;
      const blob = new Blob([JSON.stringify(toFile(p), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${p.name.replace(/\s+/g, "_")}.plc.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    importFile: async (file) => {
      // Give the imported file a fresh id so it never clobbers an existing one.
      const copy: ProjectFile = { ...file, id: `proj-${Date.now().toString(36)}`, updatedAt: Date.now() };
      try {
        await api.saveProgram(copy);
        await get().refreshProjects();
      } catch (e) {
        set({ fileError: (e as Error).message });
      }
    },

    // ── Run control ──────────────────────────────────────────────────────────────
    run: () => send({ type: "RUN" }),
    stop: () => send({ type: "STOP" }),
    step: () => send({ type: "STEP" }),
    reset: () => {
      const p = get().project;
      if (p) send({ type: "RESET", tags: p.tags });
    },
    setScanMs: (ms) => {
      set({ scanMs: ms });
      send({ type: "SET_SCAN_MS", scanMs: ms });
    },
    setInput: (name, value) => send({ type: "SET_INPUT", name, value }),

    setInputDevice: (addr, kind) => mutate((p) => (p.inputDevices[addr] = kind)),
    setOutputDevice: (addr, kind) => mutate((p) => (p.outputDevices[addr] = kind)),

    // ── Editor ─────────────────────────────────────────────────────────────────
    selectInstr: (addr, instrId, shift) => {
      if (instrId === null) {
        set({ selectedInstrId: null, selAddr: null, spanAnchorId: null, spanAnchorAddr: null });
        return;
      }
      const prevId = get().selectedInstrId;
      const prevAddr = get().selAddr;
      // Shift-click a second trunk element in the same rung → set a span anchor.
      const isTrunk = addr && addr.legIndex === undefined;
      const prevTrunk = prevAddr && prevAddr.legIndex === undefined;
      if (shift && prevId && prevId !== instrId && isTrunk && prevTrunk && prevAddr!.rungId === addr!.rungId) {
        set({ spanAnchorId: prevId, spanAnchorAddr: prevAddr, selectedInstrId: instrId, selAddr: addr });
      } else {
        set({ selectedInstrId: instrId, selAddr: addr, spanAnchorId: null, spanAnchorAddr: null });
      }
      if (addr) set({ activeRungId: addr.rungId });
    },
    setActiveRung: (id) => set({ activeRungId: id }),

    insertActive: (kind) => {
      const { selAddr, activeRungId, project } = get();
      const rungs = project?.program.rungs ?? [];
      const rungId = selAddr?.rungId ?? activeRungId ?? rungs[rungs.length - 1]?.id;
      if (!rungId) return;
      if (selAddr && selAddr.legIndex !== undefined) {
        // append into the currently-selected leg
        mutate((p) => {
          p.program = insertIntoLeg(p.program, rungId, selAddr.elementIndex, selAddr.legIndex!, (selAddr.posInLeg ?? 0) + 1, kind);
        });
      } else {
        mutate((p) => (p.program = insertElement(p.program, rungId, Number.MAX_SAFE_INTEGER, kind)));
      }
    },
    insertTrunk: (rungId, index, kind) =>
      mutate((p) => (p.program = insertElement(p.program, rungId, index, kind))),
    insertLeg: (rungId, ei, li, pos, kind) =>
      mutate((p) => (p.program = insertIntoLeg(p.program, rungId, ei, li, pos, kind))),
    branch: (rungId, ei) => mutate((p) => (p.program = branchElement(p.program, rungId, ei))),
    addLeg: (rungId, ei) => mutate((p) => (p.program = addLegOp(p.program, rungId, ei))),
    wrapSpan: () => {
      const a = get().spanAnchorAddr;
      const b = get().selAddr;
      if (!a || !b || a.rungId !== b.rungId) return;
      mutate((p) => (p.program = branchSpanOp(p.program, a.rungId, a.elementIndex, b.elementIndex)));
      set({ spanAnchorId: null, spanAnchorAddr: null });
    },
    deleteSelected: () => {
      const id = get().selectedInstrId;
      if (id) get().removeInstr(id);
    },
    removeInstr: (id) =>
      mutate((p) => {
        p.program = removeInstrOp(p.program, id);
        set({ selectedInstrId: null, selAddr: null, spanAnchorId: null, spanAnchorAddr: null });
      }),
    replaceInstr: (instrId, kind) =>
      mutate((p) => {
        // Swap the instruction kind in place; keep the primary tag, clear A–E operands.
        p.program = editInstr(p.program, instrId, { kind, a: undefined, b: undefined, c: undefined, d: undefined, e: undefined });
      }),
    editInstr: (instrId, patch) =>
      mutate((p) => (p.program = editInstr(p.program, instrId, patch))),
    setPreset: (tagAddr, pre) =>
      mutate((p) => {
        const t = p.tags[tagAddr];
        if (t?.type === "TIMER") (t.value as TimerVal).pre = pre;
        else if (t?.type === "COUNTER") (t.value as CounterVal).pre = pre;
      }),
    setComment: (tagAddr, comment) =>
      mutate((p) => {
        if (p.tags[tagAddr]) p.tags[tagAddr].comment = comment;
      }),
    addRung: () => mutate((p) => (p.program = addRung(p.program))),
    deleteRung: (rungId) => mutate((p) => (p.program = deleteRung(p.program, rungId))),
  };
});
