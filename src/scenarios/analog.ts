// Analog-track scenarios: scaling (SCP), engineering units, closed-loop plant.
import {
  boolTag,
  clr,
  dintTag,
  geq,
  les,
  lim,
  ote,
  otl,
  otu,
  pid,
  program,
  realTag,
  rung,
  scp,
  series,
  tags,
  withPlant,
  xic,
  xio,
} from "./builders";
import type { Scenario } from "./types";

export const ANALOG_SCENARIOS: Scenario[] = [
  // ── A1 — Tank Level Control (SCP + bang-bang + plant) ──────────────────────
  {
    id: "an-01",
    number: 20,
    title: "Tank Level Control (analog)",
    brief:
      "A 4–20 mA level transmitter feeds raw counts to **AI:0 (LevelRaw, 0–4095 = 0–5 m)**. " +
      "Scale it to metres with **SCP**, then run a **bang-bang** fill: open **InletValve** below " +
      "1.0 m, close it at 4.0 m (hysteresis via OTL/OTU). The **DrainCmd** toggle empties the tank. " +
      "Watch the level actually rise and fall — the tank is a live first-order plant.",
    inputs: [{ address: "I:0/0", tag: "DrainCmd", device: "TOGGLE", label: "DRAIN" }],
    outputs: [
      { address: "O:0/0", tag: "InletValve", device: "SOLENOID", label: "INLET" },
      { address: "O:0/1", tag: "HiAlarm", device: "PILOT_RED", label: "HI ALM" },
    ],
    analogIn: [
      {
        channel: "AI:0",
        tag: "LevelRaw",
        label: "LEVEL XMTR",
        signal: "4-20mA",
        rawMax: 4095,
        engMin: 0,
        engMax: 5,
        unit: "m",
        driver: "plant",
      },
    ],
    widgets: ["tank"],
    tags: tags(
      dintTag("LevelRaw", 0, "Raw counts 0–4095"),
      realTag("LevelM", 0, "Scaled level (m)"),
      boolTag("InletValve", "Fill valve"),
      boolTag("DrainCmd", "Manual drain"),
      boolTag("HiAlarm", "High-level alarm"),
    ),
    program: withPlant(
      program(
        rung(series(scp("LevelRaw", "0", "4095", "0", "5", "LevelM")), "Scale counts → metres"),
        rung(series(les("LevelM", "1"), otl("InletValve")), "Below 1.0 m → start fill"),
        rung(series(geq("LevelM", "4"), otu("InletValve")), "At 4.0 m → stop fill"),
        rung(series(geq("LevelM", "4.5"), ote("HiAlarm")), "≥4.5 m → high alarm"),
      ),
      {
        model: "tank",
        params: {
          level: "LevelRaw",
          inlet: "InletValve",
          outlet: "DrainCmd",
          fillRate: 700, // counts/sec
          drainRate: 1100,
          max: 4095,
        },
      },
    ),
    tests: {
      tests: [
        { expect: { InletValve: true, HiAlarm: false }, label: "Empty tank → inlet opens" },
        { holdMs: 3000, expect: { InletValve: true }, label: "Filling (≈2.5 m) → inlet still open" },
        { holdMs: 4000, expect: { InletValve: false }, label: "Reaches 4 m setpoint → inlet closes" },
        { set: { DrainCmd: true }, holdMs: 5000, expect: { InletValve: true }, label: "Drain empties → inlet re-opens" },
      ],
    },
  },

  // ── A2 — Potentiometer sets VFD speed (SCP to analog out) ──────────────────
  {
    id: "an-02",
    number: 21,
    title: "Pot sets VFD speed (analog out)",
    brief:
      "A 0–10 V potentiometer on **AI:0 (0–4095 = 0–100 %)** sets a motor speed reference. When " +
      "**RunCmd** is on, **SCP** the pot to **0–1750 rpm** and write it to analog out **AO:0 " +
      "(MotorRPM)**. When stopped, **CLR** the reference to zero. The VFD gauge follows the value.",
    inputs: [{ address: "I:0/0", tag: "RunCmd", device: "TOGGLE", label: "RUN" }],
    outputs: [{ address: "O:0/0", tag: "RunPilot", device: "PILOT_GREEN", label: "RUNNING" }],
    analogIn: [
      {
        channel: "AI:0",
        tag: "SpeedPot",
        label: "SPEED POT",
        signal: "0-10V",
        rawMax: 4095,
        engMin: 0,
        engMax: 100,
        unit: "%",
        driver: "manual",
      },
    ],
    analogOut: [
      {
        channel: "AO:0",
        tag: "MotorRPM",
        label: "VFD SPEED",
        engMin: 0,
        engMax: 1750,
        unit: "rpm",
        device: "VFD",
      },
    ],
    widgets: ["motor"],
    tags: tags(
      dintTag("SpeedPot", 0, "Pot raw counts"),
      boolTag("RunCmd", "Run request"),
      realTag("MotorRPM", 0, "Speed ref (rpm)"),
      boolTag("RunPilot"),
    ),
    program: program(
      rung(series(xic("RunCmd"), scp("SpeedPot", "0", "4095", "0", "1750", "MotorRPM")), "Run → scale pot to rpm"),
      rung(series(xio("RunCmd"), clr("MotorRPM")), "Stopped → zero speed"),
      rung(series(xic("RunCmd"), ote("RunPilot")), "Run pilot"),
    ),
    tests: {
      tests: [
        { set: { RunCmd: true, SpeedPot: 4095 }, expect: { MotorRPM: 1750, RunPilot: true }, label: "Run + full pot → 1750 rpm" },
        { set: { SpeedPot: 0 }, expect: { MotorRPM: 0 }, label: "Pot at zero → 0 rpm" },
        { set: { RunCmd: false, SpeedPot: 4095 }, expect: { MotorRPM: 0, RunPilot: false }, label: "Stop → speed cleared" },
      ],
    },
  },

  // ── A3 — PID Oven Temperature Control (closed loop) ─────────────────────────
  {
    id: "an-03",
    number: 22,
    title: "PID Oven Temperature Control",
    brief:
      "Hold an industrial oven at **200 °C** with a **PID** controller. When **Run** is on, the PID " +
      "block reads the temperature **PV**, compares it to the **200 °C** setpoint, and drives the " +
      "heater command **CV (0–100 %)** on analog out **AO:0** — `Kp 2 · Ki 0.8 · Kd 0`. A **LIM** " +
      "instruction lights **AT TEMP** when PV is within ±5 °C. The oven is a live first-order thermal " +
      "plant: heat rises with lag, and it cools back to ambient when Run is off.",
    inputs: [{ address: "I:0/0", tag: "Run", device: "TOGGLE", label: "RUN" }],
    outputs: [{ address: "O:0/0", tag: "AtTemp", device: "PILOT_GREEN", label: "AT TEMP" }],
    analogOut: [
      {
        channel: "AO:0",
        tag: "CV",
        label: "HEATER CMD",
        engMin: 0,
        engMax: 100,
        unit: "%",
        device: "VALVE",
      },
    ],
    widgets: ["oven"],
    tags: tags(
      boolTag("Run", "Enable controller"),
      realTag("PV", 25, "Oven temp (°C)"),
      realTag("CV", 0, "Heater command (%)"),
      boolTag("AtTemp", "Within ±5 °C of setpoint"),
    ),
    program: withPlant(
      program(
        rung(series(xic("Run"), pid("PV", "200", "2", "0.8", "0", "CV")), "Run → PID holds 200 °C"),
        rung(series(lim("195", "PV", "205"), ote("AtTemp")), "PV within ±5 °C → AT TEMP"),
      ),
      {
        model: "oven",
        params: { pv: "PV", cv: "CV", ambient: 25, gain: 220, tau: 5 },
      },
    ),
    tests: {
      tests: [
        { expect: { AtTemp: false }, label: "Cold start (25 °C) → not at temp" },
        { set: { Run: true }, holdMs: 150_000, expect: { AtTemp: true }, label: "Run → PID warms oven to 200 °C" },
        { set: { Run: false }, holdMs: 120_000, expect: { AtTemp: false }, label: "Stop → oven cools below band" },
      ],
    },
  },
];
