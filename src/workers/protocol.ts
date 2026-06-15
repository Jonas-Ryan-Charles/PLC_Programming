// Message protocol between the UI thread and the PLC scan Web Worker.
import type { Program, TagStore } from "../engine/types";

export type ToWorker =
  | { type: "LOAD"; program: Program; tags: TagStore; scanMs: number }
  | { type: "SET_PROGRAM"; program: Program } // swap logic, preserve live I/O state
  | { type: "SET_PRESET"; name: string; pre: number } // update timer/counter preset in place
  | { type: "SET_INPUT"; name: string; value: boolean | number }
  | { type: "RUN" }
  | { type: "STOP" }
  | { type: "STEP" }
  | { type: "RESET"; tags: TagStore }
  | { type: "SET_SCAN_MS"; scanMs: number };

export interface RungStatus {
  id: string;
  energised: boolean;
}

export type FromWorker = {
  type: "STATE";
  tags: TagStore;
  scanCount: number;
  scanTimeMs: number;
  running: boolean;
  rungs: RungStatus[];
};
