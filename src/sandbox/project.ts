// ─────────────────────────────────────────────────────────────────────────────
// Open-ended sandbox project model.
//
// A project is a free PLC program over a fixed I/O image — every address exists
// and works out of the box (no scenario binding required). Projects persist to
// localStorage and can be exported / imported as JSON.
// ─────────────────────────────────────────────────────────────────────────────

import { makeTag, newCounter, newTimer } from "../engine/scan";
import type { CounterVal, Program, Tag, TagStore, TimerVal } from "../engine/types";

export type InputDeviceKind =
  | "NO_TOGGLE" // NO selector switch, latching
  | "NC_TOGGLE" // NC selector switch, latching (HIGH at rest)
  | "NO_PB" // NO momentary pushbutton
  | "NC_PB" // NC momentary pushbutton
  | "NO_LS" // NO limit switch (latching)
  | "NC_LS" // NC limit switch (latching)
  | "SELECTOR" // 2-position selector switch (maintained, NO)
  | "KEY_SWITCH" // key switch (maintained, NO)
  | "PROX_PNP" // proximity sensor, PNP sourcing, NO (maintained)
  | "PROX_NPN" // proximity sensor, NPN sinking, NC (maintained)
  | "FLOAT" // float/level switch (maintained, NO)
  | "PRESSURE" // pressure switch (maintained, NO)
  | "THERMOSTAT" // thermostat contact (maintained, NC)
  | "FOOT_PEDAL" // foot pedal (momentary, NO)
  | "ESTOP"; // maintained mushroom E-stop (NC — HIGH until pressed)

export interface InputDeviceSpec {
  label: string;
  /** Returns to rest state on release (pushbutton-style) vs. latching. */
  momentary: boolean;
  /** Normally-closed: HIGH at rest, opens when actuated. */
  nc: boolean;
  glyph: string;
}

/** Behaviour + presentation of every selectable discrete-input device. */
export const INPUT_DEVICE_SPECS: Record<InputDeviceKind, InputDeviceSpec> = {
  NO_TOGGLE: { label: "NO Switch", momentary: false, nc: false, glyph: "o‾o" },
  NC_TOGGLE: { label: "NC Switch", momentary: false, nc: true, glyph: "o_o" },
  NO_PB: { label: "NO Pushbutton", momentary: true, nc: false, glyph: "⊙" },
  NC_PB: { label: "NC Pushbutton", momentary: true, nc: true, glyph: "⊘" },
  NO_LS: { label: "NO Limit Sw", momentary: false, nc: false, glyph: "⌐" },
  NC_LS: { label: "NC Limit Sw", momentary: false, nc: true, glyph: "⌐̸" },
  SELECTOR: { label: "Selector (2-pos)", momentary: false, nc: false, glyph: "⟳" },
  KEY_SWITCH: { label: "Key Switch", momentary: false, nc: false, glyph: "⚷" },
  PROX_PNP: { label: "Prox PNP (NO)", momentary: false, nc: false, glyph: "◧" },
  PROX_NPN: { label: "Prox NPN (NC)", momentary: false, nc: true, glyph: "◨" },
  FLOAT: { label: "Float Switch", momentary: false, nc: false, glyph: "◯" },
  PRESSURE: { label: "Pressure Sw", momentary: false, nc: false, glyph: "⌂" },
  THERMOSTAT: { label: "Thermostat", momentary: false, nc: true, glyph: "♨" },
  FOOT_PEDAL: { label: "Foot Pedal", momentary: true, nc: false, glyph: "𝐅" },
  ESTOP: { label: "E-Stop (NC)", momentary: false, nc: true, glyph: "⏻" },
};

export type OutputDeviceKind =
  | "LED_GREEN"
  | "LED_RED"
  | "LED_AMBER"
  | "LAMP"
  | "BULB"
  | "MOTOR"
  | "SOLENOID_NC"
  | "SOLENOID_NO"
  | "RELAY"
  | "CONTACTOR"
  | "BUZZER"
  | "SSR"
  | "TOWER_R"
  | "TOWER_A"
  | "TOWER_G";

export type OutputViz = "led" | "bulb" | "motor" | "solenoid" | "coil" | "buzzer" | "ssr";

export interface OutputDeviceSpec {
  label: string;
  color: string;
  viz: OutputViz;
  /** SOLENOID_NO is open at rest (energise → shut); NC is shut at rest. */
  normallyOpen?: boolean;
}

export const OUTPUT_DEVICE_SPECS: Record<OutputDeviceKind, OutputDeviceSpec> = {
  LED_GREEN: { label: "Green LED", color: "#22C55E", viz: "led" },
  LED_RED: { label: "Red LED", color: "#EF4444", viz: "led" },
  LED_AMBER: { label: "Amber LED", color: "#F59E0B", viz: "led" },
  LAMP: { label: "Pilot Lamp", color: "#FBBF24", viz: "led" },
  BULB: { label: "Incand. Bulb", color: "#FCD34D", viz: "bulb" },
  MOTOR: { label: "Motor", color: "#22C55E", viz: "motor" },
  SOLENOID_NC: { label: "Solenoid (NC)", color: "#38BDF8", viz: "solenoid" },
  SOLENOID_NO: { label: "Solenoid (NO)", color: "#38BDF8", viz: "solenoid", normallyOpen: true },
  RELAY: { label: "Relay Coil (CR)", color: "#A78BFA", viz: "coil" },
  CONTACTOR: { label: "Contactor (KM)", color: "#A78BFA", viz: "coil" },
  BUZZER: { label: "Buzzer / Horn", color: "#F59E0B", viz: "buzzer" },
  SSR: { label: "SSR", color: "#F97316", viz: "ssr" },
  TOWER_R: { label: "Tower — Red", color: "#EF4444", viz: "led" },
  TOWER_A: { label: "Tower — Amber", color: "#F59E0B", viz: "led" },
  TOWER_G: { label: "Tower — Green", color: "#22C55E", viz: "led" },
};

export interface SandboxProject {
  id: string;
  name: string;
  tags: TagStore;
  program: Program;
  inputDevices: Record<string, InputDeviceKind>;
  outputDevices: Record<string, OutputDeviceKind>;
  updatedAt: number;
}

/** Slimmed, serialisable form stored in localStorage / exported. */
export interface ProjectFile {
  id: string;
  name: string;
  program: Program;
  inputDevices: Record<string, InputDeviceKind>;
  outputDevices: Record<string, OutputDeviceKind>;
  presets: Record<string, number>; // timer/counter presets by address
  comments: Record<string, string>;
  updatedAt: number;
}

// ─── Address maps ────────────────────────────────────────────────────────────

export const INPUT_ADDRS = Array.from({ length: 16 }, (_, i) => `I:0/${i}`);
export const OUTPUT_ADDRS = Array.from({ length: 16 }, (_, i) => `O:0/${i}`);
export const BIT_ADDRS = Array.from({ length: 16 }, (_, i) => `B3:${i}`);
export const TIMER_ADDRS = Array.from({ length: 8 }, (_, i) => `T4:${i}`);
export const COUNTER_ADDRS = Array.from({ length: 8 }, (_, i) => `C5:${i}`);
export const INT_ADDRS = Array.from({ length: 16 }, (_, i) => `N7:${i}`);
export const FLOAT_ADDRS = Array.from({ length: 8 }, (_, i) => `F8:${i}`);
export const AIN_ADDRS = Array.from({ length: 4 }, (_, i) => `AI:${i}`);
export const AOUT_ADDRS = Array.from({ length: 4 }, (_, i) => `AO:${i}`);
// Sections E–G special registers (one bank each)
export const TW_ADDR = "TW:0"; // BCD thumbwheel input register (BCD-coded)
export const SS_ADDR = "SS:0"; // 7-segment display output register (decimal)
export const HSC_ADDR = "HSC:0"; // high-speed counter accumulated position

/** Build the full I/O tag image. Every address exists and works. */
export function makeIOImage(): TagStore {
  const list: Tag[] = [];
  INPUT_ADDRS.forEach((a) => list.push(makeTag(a, "BOOL", false, "Discrete input")));
  OUTPUT_ADDRS.forEach((a) => list.push(makeTag(a, "BOOL", false, "Discrete output")));
  BIT_ADDRS.forEach((a) => list.push(makeTag(a, "BOOL", false, "Internal bit")));
  TIMER_ADDRS.forEach((a) => list.push(makeTag(a, "TIMER", newTimer(0), "Timer")));
  COUNTER_ADDRS.forEach((a) => list.push(makeTag(a, "COUNTER", newCounter(0), "Counter")));
  INT_ADDRS.forEach((a) => list.push(makeTag(a, "DINT", 0, "Integer")));
  FLOAT_ADDRS.forEach((a) => list.push(makeTag(a, "REAL", 0, "Float")));
  AIN_ADDRS.forEach((a) => list.push(makeTag(a, "DINT", 0, "Analog input (raw 0–4095)")));
  AOUT_ADDRS.forEach((a) => list.push(makeTag(a, "DINT", 0, "Analog output (raw 0–4095)")));
  list.push(makeTag(TW_ADDR, "DINT", 0, "BCD thumbwheel (BCD-coded)"));
  list.push(makeTag(SS_ADDR, "DINT", 0, "7-segment display (decimal)"));
  list.push(makeTag(HSC_ADDR, "DINT", 0, "High-speed counter position"));
  const store: TagStore = {};
  for (const t of list) store[t.name] = t;
  return store;
}

export const ALL_ADDRS = (): string[] => [
  ...INPUT_ADDRS,
  ...OUTPUT_ADDRS,
  ...BIT_ADDRS,
  ...TIMER_ADDRS,
  ...COUNTER_ADDRS,
  ...INT_ADDRS,
  ...FLOAT_ADDRS,
  ...AIN_ADDRS,
  ...AOUT_ADDRS,
  TW_ADDR,
  SS_ADDR,
  HSC_ADDR,
];

let _pid = 0;
const uid = () => `proj-${Date.now().toString(36)}-${(_pid++).toString(36)}`;

export function newProject(name: string): SandboxProject {
  const inputDevices: Record<string, InputDeviceKind> = {};
  INPUT_ADDRS.forEach((a) => (inputDevices[a] = "NO_TOGGLE"));
  const outputDevices: Record<string, OutputDeviceKind> = {};
  OUTPUT_ADDRS.forEach((a) => (outputDevices[a] = "LED_GREEN"));

  return {
    id: uid(),
    name,
    tags: makeIOImage(),
    program: {
      rungs: [
        { id: "rung-1", root: { kind: "series", children: [] }, comment: "" },
        { id: "rung-2", root: { kind: "series", children: [] }, comment: "" },
        { id: "rung-3", root: { kind: "series", children: [] }, comment: "" },
      ],
    },
    inputDevices,
    outputDevices,
    updatedAt: Date.now(),
  };
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export function toFile(p: SandboxProject): ProjectFile {
  const presets: Record<string, number> = {};
  const comments: Record<string, string> = {};
  for (const [name, tag] of Object.entries(p.tags)) {
    if (tag.type === "TIMER") presets[name] = (tag.value as TimerVal).pre;
    if (tag.type === "COUNTER") presets[name] = (tag.value as CounterVal).pre;
    if (tag.comment) comments[name] = tag.comment;
  }
  return {
    id: p.id,
    name: p.name,
    program: p.program,
    inputDevices: p.inputDevices,
    outputDevices: p.outputDevices,
    presets,
    comments,
    updatedAt: p.updatedAt,
  };
}

export function fromFile(f: ProjectFile): SandboxProject {
  const tags = makeIOImage();
  for (const [name, pre] of Object.entries(f.presets ?? {})) {
    const tag = tags[name];
    if (tag?.type === "TIMER") (tag.value as TimerVal).pre = pre;
    if (tag?.type === "COUNTER") (tag.value as CounterVal).pre = pre;
  }
  for (const [name, c] of Object.entries(f.comments ?? {})) {
    if (tags[name]) tags[name].comment = c;
  }
  return {
    id: f.id,
    name: f.name,
    tags,
    program: f.program,
    inputDevices: f.inputDevices ?? {},
    outputDevices: f.outputDevices ?? {},
    updatedAt: f.updatedAt,
  };
}
