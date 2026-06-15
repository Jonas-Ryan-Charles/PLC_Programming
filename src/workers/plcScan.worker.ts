/// <reference lib="webworker" />
// VoltRung scan-cycle Web Worker. Owns authoritative PLC state and runs the
// scan loop off the UI thread (master-prompt Layer 1).
import { cloneTags, runScanCycle } from "../engine/scan";
import type { PLCState, Program } from "../engine/types";
import type { FromWorker, ToWorker } from "./protocol";

let program: Program = { rungs: [] };
let state: PLCState = { tags: {}, scanCount: 0, scanTimeMs: 0, faultRegister: 0 };
let scanMs = 50;
let running = false;
let timer: ReturnType<typeof setInterval> | null = null;
let lastScan = now();
let lastPost = 0;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function post(force = false): void {
  const t = now();
  if (!force && t - lastPost < 40) return; // throttle UI updates to ~25 fps
  lastPost = t;
  const msg: FromWorker = {
    type: "STATE",
    tags: state.tags,
    scanCount: state.scanCount,
    scanTimeMs: state.scanTimeMs,
    running,
    rungs: program.rungs.map((r) => ({ id: r.id, energised: Boolean(r.energised) })),
  };
  (self as DedicatedWorkerGlobalScope).postMessage(msg);
}

function scanOnce(dt: number): void {
  runScanCycle(program, state, dt);
}

function startLoop(): void {
  if (timer) clearInterval(timer);
  lastScan = now();
  timer = setInterval(() => {
    const t = now();
    const dt = t - lastScan;
    lastScan = t;
    scanOnce(dt);
    post();
  }, scanMs);
  running = true;
}

function stopLoop(): void {
  if (timer) clearInterval(timer);
  timer = null;
  running = false;
  post(true);
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  switch (msg.type) {
    case "LOAD":
      program = msg.program;
      state = { tags: cloneTags(msg.tags), scanCount: 0, scanTimeMs: 0, faultRegister: 0 };
      scanMs = msg.scanMs;
      stopLoop();
      scanOnce(0); // settle initial outputs
      post(true);
      break;
    case "SET_INPUT": {
      const tag = state.tags[msg.name];
      if (tag) {
        if (typeof msg.value === "boolean" && tag.type === "BOOL") tag.value = msg.value;
        else if (typeof msg.value === "number" && (tag.type === "DINT" || tag.type === "REAL"))
          tag.value = msg.value;
      }
      if (!running) {
        scanOnce(0); // reflect the input immediately when stopped
        post(true);
      }
      break;
    }
    case "RUN":
      if (!running) startLoop();
      break;
    case "STOP":
      stopLoop();
      break;
    case "STEP":
      scanOnce(scanMs);
      post(true);
      break;
    case "RESET":
      state = { tags: cloneTags(msg.tags), scanCount: 0, scanTimeMs: 0, faultRegister: 0 };
      stopLoop();
      scanOnce(0);
      post(true);
      break;
    case "SET_SCAN_MS":
      scanMs = msg.scanMs;
      if (running) startLoop();
      break;
  }
};
