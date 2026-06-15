// First Beginner-track hands-on scenarios, encoded against the VoltRung engine.
// Each ships a reference solution (editable on the canvas) and an auto-grader spec.
import {
  boolTag,
  counterTag,
  ctu,
  ote,
  parallel,
  program,
  res,
  rung,
  series,
  tags,
  timerTag,
  tof,
  ton,
  xic,
  xio,
} from "./builders";
import type { Scenario } from "./types";

export const SCENARIOS: Scenario[] = [
  // ── 01 — Switch turns on Light ─────────────────────────────────────────────
  {
    id: "beg-01",
    number: 1,
    title: "Switch turns on Light",
    brief:
      "Wire one toggle switch to input **I:0/0** and a green pilot light to output **O:0/0**. " +
      "Write a single rung so the light follows the switch: closed switch → light ON.",
    inputs: [{ address: "I:0/0", tag: "Switch1", device: "TOGGLE", label: "SWITCH" }],
    outputs: [{ address: "O:0/0", tag: "Light1", device: "PILOT_GREEN", label: "LIGHT" }],
    tags: tags(boolTag("Switch1", "Toggle on I:0/0"), boolTag("Light1", "Pilot O:0/0")),
    program: program(rung(series(xic("Switch1"), ote("Light1")), "Light follows switch")),
    tests: {
      tests: [
        { set: { Switch1: true }, expect: { Light1: true }, label: "Switch closed → light ON" },
        { set: { Switch1: false }, expect: { Light1: false }, label: "Switch open → light OFF" },
      ],
    },
  },

  // ── 02 — Two switches (AND) ────────────────────────────────────────────────
  {
    id: "beg-02",
    number: 2,
    title: "Two switches (AND)",
    brief:
      "Both switches must be closed for the light to turn on. Put **SwitchA (I:0/0)** and " +
      "**SwitchB (I:0/1)** in *series* — two XIC contacts on the same rung driving **Light (O:0/0)**.",
    inputs: [
      { address: "I:0/0", tag: "SwitchA", device: "TOGGLE", label: "SW A" },
      { address: "I:0/1", tag: "SwitchB", device: "TOGGLE", label: "SW B" },
    ],
    outputs: [{ address: "O:0/0", tag: "Light1", device: "PILOT_GREEN", label: "LIGHT" }],
    tags: tags(boolTag("SwitchA"), boolTag("SwitchB"), boolTag("Light1")),
    program: program(
      rung(series(xic("SwitchA"), xic("SwitchB"), ote("Light1")), "A AND B → Light"),
    ),
    tests: {
      tests: [
        { set: { SwitchA: true, SwitchB: false }, expect: { Light1: false }, label: "Only A → OFF" },
        { set: { SwitchA: false, SwitchB: true }, expect: { Light1: false }, label: "Only B → OFF" },
        { set: { SwitchA: true, SwitchB: true }, expect: { Light1: true }, label: "A AND B → ON" },
      ],
    },
  },

  // ── 03 — Two switches (OR) ─────────────────────────────────────────────────
  {
    id: "beg-03",
    number: 3,
    title: "Two switches (OR)",
    brief:
      "Either switch turns the light on. Put **SwitchA** and **SwitchB** on *parallel* branches " +
      "(a rung branch) driving **Light (O:0/0)**.",
    inputs: [
      { address: "I:0/0", tag: "SwitchA", device: "TOGGLE", label: "SW A" },
      { address: "I:0/1", tag: "SwitchB", device: "TOGGLE", label: "SW B" },
    ],
    outputs: [{ address: "O:0/0", tag: "Light1", device: "PILOT_GREEN", label: "LIGHT" }],
    tags: tags(boolTag("SwitchA"), boolTag("SwitchB"), boolTag("Light1")),
    program: program(
      rung(series(parallel(xic("SwitchA"), xic("SwitchB")), ote("Light1")), "A OR B → Light"),
    ),
    tests: {
      tests: [
        { set: { SwitchA: false, SwitchB: false }, expect: { Light1: false }, label: "Neither → OFF" },
        { set: { SwitchA: true, SwitchB: false }, expect: { Light1: true }, label: "A → ON" },
        { set: { SwitchA: false, SwitchB: true }, expect: { Light1: true }, label: "B → ON" },
      ],
    },
  },

  // ── 04 — Stop button (NC contact) ──────────────────────────────────────────
  {
    id: "beg-04",
    number: 4,
    title: "Stop button (NC contact)",
    brief:
      "A real stop button is wired **normally-closed**, so its input is HIGH at rest and drops " +
      "when pressed. With **RunCmd (I:0/0)** ON, the light stays on until **StopPB (I:0/1)** is " +
      "pressed. Note both contacts are XIC — the NC wiring does the inverting in the field.",
    inputs: [
      { address: "I:0/0", tag: "RunCmd", device: "TOGGLE", label: "RUN" },
      { address: "I:0/1", tag: "StopPB", device: "NC_PB", label: "STOP" },
    ],
    outputs: [{ address: "O:0/0", tag: "Light1", device: "PILOT_GREEN", label: "RUN LT" }],
    tags: tags(
      boolTag("RunCmd"),
      boolTag("StopPB", "NC — HIGH at rest"),
      boolTag("Light1"),
    ),
    program: program(
      rung(series(xic("RunCmd"), xic("StopPB"), ote("Light1")), "Run AND not-stopped"),
    ),
    tests: {
      // NC_PB device makes StopPB default HIGH; pressing forces it LOW.
      tests: [
        { set: { RunCmd: true, StopPB: true }, expect: { Light1: true }, label: "Run, stop released → ON" },
        { set: { StopPB: false }, expect: { Light1: false }, label: "Stop pressed → OFF" },
      ],
    },
  },

  // ── 05 — Start/Stop (no latch) ─────────────────────────────────────────────
  {
    id: "beg-05",
    number: 5,
    title: "Start/Stop (no latch)",
    brief:
      "Momentary **StartPB (I:0/0)** and NC **StopPB (I:0/1)** drive a motor — but with **no " +
      "seal-in**. Observe the flaw: the motor only runs *while* you hold Start. The next scenario " +
      "fixes it with a latch.",
    inputs: [
      { address: "I:0/0", tag: "StartPB", device: "NO_PB", label: "START" },
      { address: "I:0/1", tag: "StopPB", device: "NC_PB", label: "STOP" },
    ],
    outputs: [{ address: "O:0/0", tag: "MotorRun", device: "MOTOR", label: "MOTOR" }],
    tags: tags(boolTag("StartPB"), boolTag("StopPB", "NC — HIGH at rest"), boolTag("MotorRun")),
    program: program(
      rung(series(xic("StartPB"), xic("StopPB"), ote("MotorRun")), "No seal-in"),
    ),
    tests: {
      tests: [
        { set: { StartPB: true, StopPB: true }, expect: { MotorRun: true }, label: "Hold Start → motor ON" },
        { set: { StartPB: false }, expect: { MotorRun: false }, label: "Release Start → motor OFF (no latch)" },
      ],
    },
  },

  // ── 06 — Latch the start (seal-in) ─────────────────────────────────────────
  {
    id: "beg-06",
    number: 6,
    title: "Latched Start/Stop (seal-in)",
    brief:
      "Add a **seal-in** branch: parallel an XIC of **MotorRun** around **StartPB**, all in series " +
      "with NC **StopPB**. Now a *momentary* Start latches the motor; it stays on until Stop is pressed.",
    inputs: [
      { address: "I:0/0", tag: "StartPB", device: "NO_PB", label: "START" },
      { address: "I:0/1", tag: "StopPB", device: "NC_PB", label: "STOP" },
    ],
    outputs: [{ address: "O:0/0", tag: "MotorRun", device: "MOTOR", label: "MOTOR" }],
    tags: tags(boolTag("StartPB"), boolTag("StopPB", "NC — HIGH at rest"), boolTag("MotorRun")),
    program: program(
      rung(
        series(
          parallel(xic("StartPB"), xic("MotorRun")),
          xic("StopPB"),
          ote("MotorRun"),
        ),
        "Seal-in latch",
      ),
    ),
    tests: {
      tests: [
        { set: { StartPB: true, StopPB: true }, expect: { MotorRun: true }, label: "Pulse Start → motor ON" },
        { set: { StartPB: false }, expect: { MotorRun: true }, label: "Release Start → motor LATCHED" },
        { set: { StopPB: false }, expect: { MotorRun: false }, label: "Press Stop → motor OFF" },
      ],
    },
  },

  // ── 07 — Motor with run / stopped status lamps ─────────────────────────────
  {
    id: "beg-07",
    number: 7,
    title: "Motor with status lamps",
    brief:
      "Extend the latched starter with indicator lamps. **StartPB (I:0/0)** seals the motor " +
      "in through NC **StopPB (I:0/1)**. A **green RUN lamp (O:0/1)** follows the motor; a " +
      "**red STOPPED lamp (O:0/2)** is the *complement* — use an XIO of the motor bit.",
    inputs: [
      { address: "I:0/0", tag: "StartPB", device: "NO_PB", label: "START" },
      { address: "I:0/1", tag: "StopPB", device: "NC_PB", label: "STOP" },
    ],
    outputs: [
      { address: "O:0/0", tag: "MotorRun", device: "MOTOR", label: "MOTOR" },
      { address: "O:0/1", tag: "RunLamp", device: "PILOT_GREEN", label: "RUN" },
      { address: "O:0/2", tag: "StopLamp", device: "PILOT_RED", label: "STOPPED" },
    ],
    tags: tags(
      boolTag("StartPB"),
      boolTag("StopPB", "NC — HIGH at rest"),
      boolTag("MotorRun"),
      boolTag("RunLamp"),
      boolTag("StopLamp"),
    ),
    program: program(
      rung(series(parallel(xic("StartPB"), xic("MotorRun")), xic("StopPB"), ote("MotorRun")), "Seal-in"),
      rung(series(xic("MotorRun"), ote("RunLamp")), "Running → green"),
      rung(series(xio("MotorRun"), ote("StopLamp")), "Stopped → red"),
    ),
    tests: {
      tests: [
        { set: { StartPB: true, StopPB: true }, expect: { MotorRun: true, RunLamp: true, StopLamp: false }, label: "Start → motor + green" },
        { set: { StartPB: false }, expect: { MotorRun: true, StopLamp: false }, label: "Latched, still green" },
        { set: { StopPB: false }, expect: { MotorRun: false, RunLamp: false, StopLamp: true }, label: "Stop → red lamp" },
      ],
    },
  },

  // ── 08 — Delayed-on light (TON) ────────────────────────────────────────────
  {
    id: "beg-08",
    number: 8,
    title: "Delayed-on light (TON)",
    brief:
      "Use a **TON** timer (preset 3 s). When **Switch (I:0/0)** closes, the light should come on " +
      "only after the timer reaches preset. Rung 1: Switch → TON T1. Rung 2: T1.DN → Light.",
    inputs: [{ address: "I:0/0", tag: "Switch1", device: "TOGGLE", label: "SWITCH" }],
    outputs: [{ address: "O:0/0", tag: "Light1", device: "PILOT_AMBER", label: "LIGHT" }],
    tags: tags(boolTag("Switch1"), timerTag("T1", 3000, "On-delay 3 s"), boolTag("Light1")),
    program: program(
      rung(series(xic("Switch1"), ton("T1")), "Run timer while switch closed"),
      rung(series(xic("T1.DN"), ote("Light1")), "Timer done → light"),
    ),
    tests: {
      tests: [
        { set: { Switch1: true }, holdMs: 1000, expect: { Light1: false }, label: "After 1 s → still OFF" },
        { holdMs: 2200, expect: { Light1: true }, label: "After ~3.2 s → ON" },
        { set: { Switch1: false }, expect: { Light1: false }, label: "Switch open → timer resets, OFF" },
      ],
    },
  },

  // ── 09 — Off-delay light (TOF) ─────────────────────────────────────────────
  {
    id: "beg-09",
    number: 9,
    title: "Off-delay light (TOF)",
    brief:
      "A **TOF** off-delay timer keeps a light on for a while *after* its input drops — like a " +
      "stairwell light. While **Switch (I:0/0)** is closed the light is on; when it opens the light " +
      "stays on until the 3 s timer expires. Rung 1: Switch → TOF T1. Rung 2: T1.DN → Light.",
    inputs: [{ address: "I:0/0", tag: "Switch1", device: "TOGGLE", label: "SWITCH" }],
    outputs: [{ address: "O:0/0", tag: "Light1", device: "PILOT_AMBER", label: "LIGHT" }],
    tags: tags(boolTag("Switch1"), timerTag("T1", 3000, "Off-delay 3 s"), boolTag("Light1")),
    program: program(
      rung(series(xic("Switch1"), tof("T1")), "Energise off-delay while closed"),
      rung(series(xic("T1.DN"), ote("Light1")), "Timer done bit → light"),
    ),
    tests: {
      tests: [
        { set: { Switch1: true }, expect: { Light1: true }, label: "Closed → light ON" },
        { set: { Switch1: false }, holdMs: 1000, expect: { Light1: true }, label: "Open 1 s → still ON" },
        { holdMs: 2200, expect: { Light1: false }, label: "After ~3.2 s → OFF" },
      ],
    },
  },

  // ── 10 — Count five boxes (CTU) ────────────────────────────────────────────
  {
    id: "beg-10",
    number: 10,
    title: "Count five boxes (CTU)",
    brief:
      "A photoeye on **I:0/0** pulses once per box. Use a **CTU** (preset 5) so that after the " +
      "fifth box the **Done** light (O:0/0) turns on. **Reset (I:0/1)** clears the count.",
    inputs: [
      { address: "I:0/0", tag: "Photoeye", device: "NO_PB", label: "PHOTOEYE" },
      { address: "I:0/1", tag: "ResetPB", device: "NO_PB", label: "RESET" },
    ],
    outputs: [{ address: "O:0/0", tag: "DoneLight", device: "PILOT_AMBER", label: "DONE" }],
    tags: tags(
      boolTag("Photoeye", "Box detect pulse"),
      boolTag("ResetPB"),
      counterTag("C1", 5, "Box count, preset 5"),
      boolTag("DoneLight"),
    ),
    program: program(
      rung(series(xic("Photoeye"), ctu("C1")), "Count each box"),
      rung(series(xic("ResetPB"), res("C1")), "Reset count"),
      rung(series(xic("C1.DN"), ote("DoneLight")), "5 boxes → done"),
    ),
    tests: {
      tests: [
        { set: { Photoeye: true }, expect: { "C1.ACC": 1 }, label: "Box 1 counted" },
        { set: { Photoeye: false }, label: "Photoeye clears" },
        { set: { Photoeye: true }, label: "Box 2" },
        { set: { Photoeye: false }, label: "clear" },
        { set: { Photoeye: true }, label: "Box 3" },
        { set: { Photoeye: false }, label: "clear" },
        { set: { Photoeye: true }, label: "Box 4" },
        { set: { Photoeye: false }, label: "clear" },
        { set: { Photoeye: true }, expect: { "C1.ACC": 5, DoneLight: true }, label: "Box 5 → DONE" },
        { set: { ResetPB: true }, expect: { "C1.ACC": 0, DoneLight: false }, label: "Reset clears count" },
      ],
    },
  },
];

export const scenarioById = (id: string): Scenario | undefined =>
  SCENARIOS.find((s) => s.id === id);
