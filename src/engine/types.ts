// ─────────────────────────────────────────────────────────────────────────────
// VoltRung PLC Engine — core data model
// Framework-agnostic. Runs identically in the Web Worker and in unit tests.
// ─────────────────────────────────────────────────────────────────────────────

export type TagType = "BOOL" | "DINT" | "REAL" | "TIMER" | "COUNTER";

/** TON/TOF/RTO timer control structure (RSLogix-style member bits). */
export interface TimerVal {
  pre: number; // preset, milliseconds
  acc: number; // accumulated, milliseconds
  en: boolean; // .EN  enable  (rung-in)
  tt: boolean; // .TT  timing
  dn: boolean; // .DN  done
  /** TOF only: has the timer ever been energised? A never-energised off-delay
   *  timer must sit idle (DN=0) rather than counting down on cold start. */
  armed?: boolean;
}

/** CTU/CTD/CTUD counter control structure. */
export interface CounterVal {
  pre: number; // preset
  acc: number; // accumulated
  cu: boolean; // .CU count-up enable (edge memory)
  cd: boolean; // .CD count-down enable (edge memory)
  dn: boolean; // .DN  done (acc >= pre)
  ov: boolean; // .OV  overflow
  un: boolean; // .UN  underflow
}

export type TagValue = boolean | number | TimerVal | CounterVal;

export interface Tag {
  name: string;
  type: TagType;
  value: TagValue;
  /** Optional engineering comment shown in the watch table. */
  comment?: string;
}

export type TagStore = Record<string, Tag>;

// ─── Instruction model ───────────────────────────────────────────────────────

/** Bit + control instructions that gate or drive rung continuity. */
export type InstrKind =
  // input / contact (gate power)
  | "XIC" // examine if closed  (NO contact)
  | "XIO" // examine if open    (NC contact)
  | "ONS" // one-shot rising
  // compares (gate power)
  | "EQU"
  | "NEQ"
  | "LES"
  | "LEQ"
  | "GRT"
  | "GEQ"
  | "LIM"
  // output / coil (pass power through, perform action)
  | "OTE" // output energise
  | "OTL" // output latch (set)
  | "OTU" // output unlatch (reset)
  | "TON" // timer on-delay
  | "TOF" // timer off-delay
  | "RTO" // retentive timer on
  | "RES" // reset timer/counter
  | "CTU" // count up
  | "CTD" // count down
  // math (pass power through, perform action)
  | "ADD"
  | "SUB"
  | "MUL"
  | "DIV"
  | "MOD" // modulo (a % b → dest)
  | "SQR" // square root (√a → dest)
  | "ABS" // absolute value (|a| → dest)
  | "NEG" // negate (−a → dest)
  | "MOV"
  | "CLR"
  // BCD conversion (thumbwheel input ↔ 7-segment display)
  | "TOD" // to BCD   (decimal source → BCD-coded dest)
  | "FRD" // from BCD (BCD-coded source → decimal dest)
  // analog scaling
  | "SCP" // scale with parameters (raw → engineering units)
  | "SCL" // legacy scale (rate/offset)
  // application
  | "PID"; // PID controller (SP, PV → CV with Kp/Ki/Kd gains)

export interface Instruction {
  id: string;
  kind: InstrKind;
  /** Primary operand — usually a tag name (the bit/timer/counter addressed). */
  tag?: string;
  /** Secondary operands for math / compare / scale instructions. */
  a?: string; // source A / test value / SCP input (tag or literal)
  b?: string; // source B / compare value / SCP inMin
  c?: string; // third operand (LIM high, ADD dest, SCP inMax)
  d?: string; // SCP outMin / SCL rate
  e?: string; // SCP outMax / SCL offset
  /** Per-instruction one-shot edge memory (for ONS and counter edges). */
  _edge?: boolean;
  /** PID controller running state (persisted across scans). */
  _integral?: number;
  _prevErr?: number;
}

/**
 * A rung is a tree of series (AND) and parallel (OR) nodes with instruction
 * leaves. This is enough to express every Beginner/early-Intermediate program
 * (AND, OR, seal-in latches, stop-button series, timer/counter rungs).
 */
export type RungNode =
  | { kind: "instr"; instr: Instruction }
  | { kind: "series"; children: RungNode[] }
  | { kind: "parallel"; children: RungNode[] };

export interface Rung {
  id: string;
  /** Root is always a series of elements drawn left→right on the rail. */
  root: RungNode;
  comment?: string;
  /** Set by the engine each scan: did power reach the right rail? */
  energised?: boolean;
}

/**
 * Optional first-order "plant" model run after the rungs each scan, so the
 * simulated process evolves over time (e.g. a tank level rises while the inlet
 * valve output is energised). Config is serialisable so it crosses to the
 * worker and is replayed identically by the grader.
 */
export interface PlantConfig {
  model: "tank" | "motor" | "oven" | "garage" | "conveyor";
  params: Record<string, string | number>;
}

export interface Program {
  rungs: Rung[];
  plant?: PlantConfig;
}

/** Full controller state passed between worker and main thread. */
export interface PLCState {
  tags: TagStore;
  scanCount: number;
  scanTimeMs: number; // wall time of last scan execution
  faultRegister: number;
}

// ─── Auto-grading test spec (scenario format) ────────────────────────────────

export interface TestStep {
  /** Force these input/bit tags before evaluating. */
  set?: Record<string, boolean | number>;
  /** Advance simulated time by N ms (runs scans across the interval). */
  holdMs?: number;
  /** Assert these tag values after settling. */
  expect?: Record<string, boolean | number>;
  label: string;
}

export interface TestSpec {
  tests: TestStep[];
}
