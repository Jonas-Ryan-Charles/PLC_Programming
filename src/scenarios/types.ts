import type { Program, TagStore, TestSpec } from "../engine/types";

/** Physical input device kinds available on the chassis (Section A subset). */
export type InputDevice =
  | "NO_PB" // NO momentary pushbutton — HIGH only while held
  | "NC_PB" // NC momentary pushbutton — LOW only while held (HIGH at rest)
  | "TOGGLE" // SPST latching switch
  | "NO_LS" // NO limit switch — toggle on click
  | "PROX"; // proximity sensor — toggle on click

/** Physical output device kinds (Section B subset). */
export type OutputDevice =
  | "PILOT_RED"
  | "PILOT_GREEN"
  | "PILOT_AMBER"
  | "BUZZER"
  | "MOTOR"
  | "SOLENOID";

export interface InputBinding {
  address: string; // e.g. "I:0/0"
  tag: string; // named BOOL tag the device drives
  device: InputDevice;
  label: string; // Dymo-tape label
}

export interface OutputBinding {
  address: string; // e.g. "O:0/0"
  tag: string; // named BOOL tag that lights the device
  device: OutputDevice;
  label: string;
}

/** Section C — analog input channel (raw 0–rawMax counts → engineering units). */
export interface AnalogInBinding {
  channel: string; // e.g. "AI:0"
  tag: string; // DINT raw-counts tag the channel feeds
  label: string;
  signal: "0-10V" | "4-20mA";
  rawMax: number; // ADC full scale (e.g. 4095)
  engMin: number;
  engMax: number;
  unit: string;
  /** manual = operator drags a slider; plant = driven by the process model. */
  driver: "manual" | "plant";
}

/** Section D — analog output channel (engineering value written by program). */
export interface AnalogOutBinding {
  channel: string; // e.g. "AO:0"
  tag: string; // REAL/DINT tag the program writes
  label: string;
  engMin: number;
  engMax: number;
  unit: string;
  device: "VFD" | "VALVE";
}

/** Sections E–G — a register-backed special module bound to a DINT tag. */
export interface RegisterBinding {
  tag: string; // DINT register the module reads/writes
  label: string; // Dymo-tape label
}

export type WidgetKind = "tank" | "motor" | "oven" | "traffic" | "garage" | "conveyor";

export interface Scenario {
  id: string;
  number: number;
  title: string;
  /** Markdown-ish objective shown in the task brief pane. */
  brief: string;
  inputs: InputBinding[];
  outputs: OutputBinding[];
  analogIn?: AnalogInBinding[];
  analogOut?: AnalogOutBinding[];
  /** Section E — BCD thumbwheel input register. */
  thumbwheel?: RegisterBinding;
  /** Section F — 7-segment display output register. */
  sevenSeg?: RegisterBinding;
  /** Section G — high-speed counter / encoder register. */
  hsc?: RegisterBinding;
  /** Animated process widgets to show alongside the chassis. */
  widgets?: WidgetKind[];
  /** Initial tag store (presets, comments). Bits start reset. */
  tags: TagStore;
  /** Pre-loaded reference solution (editable in the canvas). */
  program: Program;
  tests: TestSpec;
}
