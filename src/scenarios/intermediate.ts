// Intermediate-track hands-on scenarios: interlocks, toggle flip-flop, timed
// motor starting, modulo diversion, level seal-in, and retentive run-hours.
// Each ships a reference solution (auto-verified by scenarios.test.ts).
import {
  boolTag,
  counterTag,
  ctu,
  dintTag,
  equ,
  grt,
  mod,
  ons,
  ote,
  parallel,
  program,
  res,
  rto,
  rung,
  series,
  tags,
  timerTag,
  ton,
  xic,
  xio,
} from "./builders";
import type { Scenario } from "./types";

export const INTERMEDIATE_SCENARIOS: Scenario[] = [
  // ── 11 — Forward / Reverse with interlock ──────────────────────────────────
  {
    id: "int-01",
    number: 11,
    title: "Forward / Reverse interlock",
    brief:
      "A reversing motor must never have both contactors energised. **FwdPB (I:0/0)** and " +
      "**RevPB (I:0/1)** each latch their direction through NC **StopPB (I:0/2)**, and each rung " +
      "is *interlocked* by an **XIO of the opposite output** so one direction blocks the other.",
    inputs: [
      { address: "I:0/0", tag: "FwdPB", device: "NO_PB", label: "FWD" },
      { address: "I:0/1", tag: "RevPB", device: "NO_PB", label: "REV" },
      { address: "I:0/2", tag: "StopPB", device: "NC_PB", label: "STOP" },
    ],
    outputs: [
      { address: "O:0/0", tag: "FwdRun", device: "MOTOR", label: "FWD" },
      { address: "O:0/1", tag: "RevRun", device: "MOTOR", label: "REV" },
    ],
    tags: tags(
      boolTag("FwdPB"),
      boolTag("RevPB"),
      boolTag("StopPB", "NC — HIGH at rest"),
      boolTag("FwdRun"),
      boolTag("RevRun"),
    ),
    program: program(
      rung(
        series(parallel(xic("FwdPB"), xic("FwdRun")), xic("StopPB"), xio("RevRun"), ote("FwdRun")),
        "Forward (interlocked by RevRun)",
      ),
      rung(
        series(parallel(xic("RevPB"), xic("RevRun")), xic("StopPB"), xio("FwdRun"), ote("RevRun")),
        "Reverse (interlocked by FwdRun)",
      ),
    ),
    tests: {
      tests: [
        { set: { FwdPB: true, StopPB: true }, expect: { FwdRun: true, RevRun: false }, label: "Fwd start → FWD on" },
        { set: { FwdPB: false }, expect: { FwdRun: true }, label: "Latched forward" },
        { set: { RevPB: true }, expect: { RevRun: false, FwdRun: true }, label: "Rev blocked while fwd runs" },
        { set: { RevPB: false, StopPB: false }, expect: { FwdRun: false, RevRun: false }, label: "Stop both" },
        { set: { StopPB: true, RevPB: true }, expect: { RevRun: true, FwdRun: false }, label: "Now reverse runs" },
        { set: { RevPB: false }, expect: { RevRun: true }, label: "Latched reverse" },
      ],
    },
  },

  // ── 12 — Single-button toggle (flip-flop) ──────────────────────────────────
  {
    id: "int-02",
    number: 12,
    title: "One-button toggle (flip-flop)",
    brief:
      "Make a single pushbutton **toggle** a light: press → on, press again → off. The trick is a " +
      "**one-shot** (ONS) so each press is a single-scan pulse, feeding an **XOR** of the pulse and " +
      "the light's current state. Rung 1 builds the pulse; rung 2 is the XOR (two parallel AND legs).",
    inputs: [{ address: "I:0/0", tag: "TogglePB", device: "NO_PB", label: "TOGGLE" }],
    outputs: [{ address: "O:0/0", tag: "Light1", device: "PILOT_GREEN", label: "LIGHT" }],
    tags: tags(
      boolTag("TogglePB"),
      boolTag("Pulse", "1-scan press pulse"),
      boolTag("Light1"),
    ),
    program: program(
      rung(series(xic("TogglePB"), ons("PB_OS"), ote("Pulse")), "Press → 1-scan pulse"),
      rung(
        series(
          parallel(
            series(xic("Pulse"), xio("Light1")),
            series(xio("Pulse"), xic("Light1")),
          ),
          ote("Light1"),
        ),
        "Light = Pulse XOR Light",
      ),
    ),
    tests: {
      tests: [
        { set: { TogglePB: true }, expect: { Light1: true }, label: "1st press → ON" },
        { set: { TogglePB: false }, expect: { Light1: true }, label: "Release → holds ON" },
        { set: { TogglePB: true }, expect: { Light1: false }, label: "2nd press → OFF" },
        { set: { TogglePB: false }, expect: { Light1: false }, label: "Release → holds OFF" },
        { set: { TogglePB: true }, expect: { Light1: true }, label: "3rd press → ON" },
      ],
    },
  },

  // ── 13 — Star-Delta timed starter ──────────────────────────────────────────
  {
    id: "int-03",
    number: 13,
    title: "Star-Delta timed starter",
    brief:
      "Start a large motor in **star** to limit inrush, then transfer to **delta** after 5 s. " +
      "**StartPB (I:0/0)** seals a Run bit through NC **StopPB (I:0/1)**. While running, a **TON " +
      "(5 s)** holds star (O:0/1) until done, then switches to delta (O:0/2). Main contactor O:0/0 " +
      "runs the whole time.",
    inputs: [
      { address: "I:0/0", tag: "StartPB", device: "NO_PB", label: "START" },
      { address: "I:0/1", tag: "StopPB", device: "NC_PB", label: "STOP" },
    ],
    outputs: [
      { address: "O:0/0", tag: "Main", device: "MOTOR", label: "MAIN" },
      { address: "O:0/1", tag: "Star", device: "SOLENOID", label: "STAR" },
      { address: "O:0/2", tag: "Delta", device: "SOLENOID", label: "DELTA" },
    ],
    tags: tags(
      boolTag("StartPB"),
      boolTag("StopPB", "NC — HIGH at rest"),
      boolTag("Run"),
      timerTag("T1", 5000, "Star→Delta transition"),
      boolTag("Main"),
      boolTag("Star"),
      boolTag("Delta"),
    ),
    program: program(
      rung(series(parallel(xic("StartPB"), xic("Run")), xic("StopPB"), ote("Run")), "Run seal-in"),
      rung(series(xic("Run"), ote("Main")), "Main contactor while running"),
      rung(series(xic("Run"), ton("T1")), "Transition timer"),
      rung(series(xic("Run"), xio("T1.DN"), ote("Star")), "Star until timer done"),
      rung(series(xic("Run"), xic("T1.DN"), ote("Delta")), "Delta after timer"),
    ),
    tests: {
      tests: [
        { set: { StartPB: true, StopPB: true }, expect: { Main: true, Star: true, Delta: false }, label: "Start → star" },
        { set: { StartPB: false }, holdMs: 5200, expect: { Star: false, Delta: true, Main: true }, label: "After 5 s → delta" },
        { set: { StopPB: false }, expect: { Main: false, Star: false, Delta: false }, label: "Stop → all off" },
      ],
    },
  },

  // ── 14 — Divert every 3rd box (MOD) ────────────────────────────────────────
  {
    id: "int-04",
    number: 14,
    title: "Divert every third box (MOD)",
    brief:
      "Count boxes on **Sensor (I:0/0)** and fire the **Divert** solenoid (O:0/0) on every third " +
      "box. Use a **CTU**, then **MOD** the accumulated count by 3 — when the remainder is 0 (and " +
      "the count is non-zero) the box is a multiple of three. **Reset (I:0/1)** clears the count.",
    inputs: [
      { address: "I:0/0", tag: "Sensor", device: "NO_PB", label: "SENSOR" },
      { address: "I:0/1", tag: "ResetPB", device: "NO_PB", label: "RESET" },
    ],
    outputs: [{ address: "O:0/0", tag: "Divert", device: "SOLENOID", label: "DIVERT" }],
    tags: tags(
      boolTag("Sensor", "Box pulse"),
      boolTag("ResetPB"),
      counterTag("C1", 0, "Box count"),
      dintTag("Rem", 0, "Count mod 3"),
      boolTag("Divert"),
    ),
    program: program(
      rung(series(xic("Sensor"), ctu("C1")), "Count each box"),
      rung(series(xic("ResetPB"), res("C1")), "Reset count"),
      rung(mod("C1.ACC", "3", "Rem"), "Remainder of count ÷ 3"),
      rung(series(equ("Rem", "0"), grt("C1.ACC", "0"), ote("Divert")), "Every 3rd → divert"),
    ),
    tests: {
      tests: [
        { set: { Sensor: true }, expect: { "C1.ACC": 1, Divert: false }, label: "Box 1" },
        { set: { Sensor: false }, label: "clear" },
        { set: { Sensor: true }, expect: { "C1.ACC": 2, Divert: false }, label: "Box 2" },
        { set: { Sensor: false }, label: "clear" },
        { set: { Sensor: true }, expect: { "C1.ACC": 3, Divert: true }, label: "Box 3 → divert" },
        { set: { Sensor: false }, label: "clear" },
        { set: { Sensor: true }, expect: { "C1.ACC": 4, Divert: false }, label: "Box 4" },
        { set: { Sensor: false }, label: "clear" },
        { set: { Sensor: true }, expect: { "C1.ACC": 5, Divert: false }, label: "Box 5" },
        { set: { Sensor: false }, label: "clear" },
        { set: { Sensor: true }, expect: { "C1.ACC": 6, Divert: true }, label: "Box 6 → divert" },
      ],
    },
  },

  // ── 15 — Pump-down level control (two floats) ──────────────────────────────
  {
    id: "int-05",
    number: 15,
    title: "Pump-down level control",
    brief:
      "Empty a sump with two float switches. The pump **starts** when the **High float (I:0/0)** " +
      "is made and **seals in**, running until the level falls below the **Low float (I:0/1)**. It " +
      "won't restart until the level rises to High again — classic differential-gap control.",
    inputs: [
      { address: "I:0/0", tag: "HighFloat", device: "NO_LS", label: "HIGH" },
      { address: "I:0/1", tag: "LowFloat", device: "NO_LS", label: "LOW" },
    ],
    outputs: [{ address: "O:0/0", tag: "Pump", device: "MOTOR", label: "PUMP" }],
    tags: tags(
      boolTag("HighFloat", "True above high mark"),
      boolTag("LowFloat", "True above low mark"),
      boolTag("Pump"),
    ),
    program: program(
      rung(
        series(parallel(xic("HighFloat"), xic("Pump")), xic("LowFloat"), ote("Pump")),
        "Start at high, run until below low",
      ),
    ),
    tests: {
      tests: [
        { set: { HighFloat: true, LowFloat: true }, expect: { Pump: true }, label: "High made → pump runs" },
        { set: { HighFloat: false }, expect: { Pump: true }, label: "Sealed in while above low" },
        { set: { LowFloat: false }, expect: { Pump: false }, label: "Below low → pump stops" },
        { set: { LowFloat: true }, expect: { Pump: false }, label: "Above low but not high → stays off" },
        { set: { HighFloat: true }, expect: { Pump: true }, label: "High again → restart" },
      ],
    },
  },

  // ── 16 — Run-hours service alarm (RTO) ─────────────────────────────────────
  {
    id: "int-06",
    number: 16,
    title: "Run-hours service alarm (RTO)",
    brief:
      "A **retentive** timer (RTO) totalises motor run time across stops — unlike a TON it does " +
      "**not** reset when de-energised. Accumulate run time while **Motor (I:0/0)** runs; after 8 s " +
      "of total runtime light the **Service** lamp (O:0/0). Only **Reset (I:0/1)** clears it.",
    inputs: [
      { address: "I:0/0", tag: "MotorRun", device: "TOGGLE", label: "MOTOR" },
      { address: "I:0/1", tag: "ResetPB", device: "NO_PB", label: "RESET" },
    ],
    outputs: [{ address: "O:0/0", tag: "ServiceLamp", device: "PILOT_AMBER", label: "SERVICE" }],
    tags: tags(
      boolTag("MotorRun"),
      boolTag("ResetPB"),
      timerTag("T1", 8000, "Service interval"),
      boolTag("ServiceLamp"),
    ),
    program: program(
      rung(series(xic("MotorRun"), rto("T1")), "Accumulate run time"),
      rung(series(xic("ResetPB"), res("T1")), "Reset service timer"),
      rung(series(xic("T1.DN"), ote("ServiceLamp")), "Interval reached → service"),
    ),
    tests: {
      tests: [
        { set: { MotorRun: true }, holdMs: 5000, expect: { ServiceLamp: false }, label: "5 s run → not yet" },
        { set: { MotorRun: false }, holdMs: 2000, expect: { ServiceLamp: false }, label: "Stopped → ACC retained" },
        { set: { MotorRun: true }, holdMs: 3200, expect: { ServiceLamp: true }, label: "+3.2 s → 8 s total → service" },
        { set: { ResetPB: true }, expect: { ServiceLamp: false }, label: "Reset clears it" },
      ],
    },
  },
];
