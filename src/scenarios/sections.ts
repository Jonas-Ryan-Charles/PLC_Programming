// Sections E–G hands-on scenarios — BCD thumbwheel setpoint entry, 7-segment
// counter display, and high-speed-counter positioning. These exercise the
// special chassis modules (thumbwheel / 7-seg / encoder) bound via the scenario.
import {
  boolTag,
  counterTag,
  ctu,
  dintTag,
  frd,
  grt,
  lim,
  mov,
  ote,
  program,
  res,
  rung,
  series,
  tags,
  xic,
} from "./builders";
import type { Scenario } from "./types";

export const SECTION_EG_SCENARIOS: Scenario[] = [
  // ── 17 — BCD setpoint to 7-segment readout ─────────────────────────────────
  {
    id: "eg-01",
    number: 17,
    title: "BCD setpoint → 7-seg readout",
    brief:
      "A **thumbwheel** outputs **BCD** — each decimal digit lives in its own 4-bit nibble, so the " +
      "raw register is *not* the decimal value (dialing 25 gives 0x0025 = 37). Use **FRD** to " +
      "convert BCD→decimal, then **MOV** it to the **7-segment display**. Dial the wheel and watch " +
      "the readout track it.",
    inputs: [],
    outputs: [],
    thumbwheel: { tag: "SetRaw", label: "SETPOINT" },
    sevenSeg: { tag: "Readout", label: "READOUT" },
    tags: tags(
      dintTag("SetRaw", 0, "Thumbwheel (BCD-coded)"),
      dintTag("SetDec", 0, "Decoded setpoint"),
      dintTag("Readout", 0, "7-seg display"),
    ),
    program: program(
      rung(frd("SetRaw", "SetDec"), "Convert BCD thumbwheel → decimal"),
      rung(mov("SetDec", "Readout"), "Show it on the 7-seg"),
    ),
    tests: {
      tests: [
        { set: { SetRaw: 0x0025 }, expect: { SetDec: 25, Readout: 25 }, label: "Dial 25 (BCD 0x25) → 25" },
        { set: { SetRaw: 0x0099 }, expect: { SetDec: 99, Readout: 99 }, label: "Dial 99 → 99" },
        { set: { SetRaw: 0x1234 }, expect: { SetDec: 1234, Readout: 1234 }, label: "Dial 1234 → 1234" },
      ],
    },
  },

  // ── 18 — Encoder positioning window (HSC + LIM) ────────────────────────────
  {
    id: "eg-02",
    number: 18,
    title: "Encoder positioning window",
    brief:
      "Jog the **encoder** to drive a position count. Light the green **In-Position** lamp (O:0/0) " +
      "when the count is within the target window **95–105** using a **LIM** instruction, and the " +
      "red **Overshoot** lamp (O:0/1) when it goes past 105 (a **GRT** compare).",
    inputs: [],
    outputs: [
      { address: "O:0/0", tag: "InPosition", device: "PILOT_GREEN", label: "IN POS" },
      { address: "O:0/1", tag: "Overshoot", device: "PILOT_RED", label: "OVER" },
    ],
    hsc: { tag: "Position", label: "ENCODER" },
    tags: tags(
      dintTag("Position", 0, "Encoder count"),
      boolTag("InPosition"),
      boolTag("Overshoot"),
    ),
    program: program(
      rung(series(lim("95", "Position", "105"), ote("InPosition")), "Within 95–105 → in position"),
      rung(series(grt("Position", "105"), ote("Overshoot")), "Past 105 → overshoot"),
    ),
    tests: {
      tests: [
        { set: { Position: 50 }, expect: { InPosition: false, Overshoot: false }, label: "50 → short" },
        { set: { Position: 100 }, expect: { InPosition: true, Overshoot: false }, label: "100 → in window" },
        { set: { Position: 110 }, expect: { InPosition: false, Overshoot: true }, label: "110 → overshoot" },
        { set: { Position: 95 }, expect: { InPosition: true, Overshoot: false }, label: "95 → edge, in window" },
      ],
    },
  },

  // ── 19 — Live count on the 7-segment display ───────────────────────────────
  {
    id: "eg-03",
    number: 19,
    title: "Counter on 7-seg display",
    brief:
      "Show a live count on the **7-segment display**. A **CTU** counts pulses from **Sensor " +
      "(I:0/0)**; **MOV** the accumulator to the display register every scan so the readout tracks " +
      "the count. At preset 5 the **Done** lamp (O:0/0) lights. **Reset (I:0/1)** clears it.",
    inputs: [
      { address: "I:0/0", tag: "Sensor", device: "NO_PB", label: "SENSOR" },
      { address: "I:0/1", tag: "ResetPB", device: "NO_PB", label: "RESET" },
    ],
    outputs: [{ address: "O:0/0", tag: "DoneLamp", device: "PILOT_AMBER", label: "DONE" }],
    sevenSeg: { tag: "Disp", label: "COUNT" },
    tags: tags(
      boolTag("Sensor", "Count pulse"),
      boolTag("ResetPB"),
      counterTag("C1", 5, "Count, preset 5"),
      dintTag("Disp", 0, "7-seg display"),
      boolTag("DoneLamp"),
    ),
    program: program(
      rung(series(xic("Sensor"), ctu("C1")), "Count pulses"),
      rung(series(xic("ResetPB"), res("C1")), "Reset"),
      rung(mov("C1.ACC", "Disp"), "Mirror count to display"),
      rung(series(xic("C1.DN"), ote("DoneLamp")), "Preset reached → done"),
    ),
    tests: {
      tests: [
        { set: { Sensor: true }, expect: { "C1.ACC": 1, Disp: 1 }, label: "Pulse 1 → display 1" },
        { set: { Sensor: false }, label: "clear" },
        { set: { Sensor: true }, expect: { Disp: 2 }, label: "Pulse 2 → display 2" },
        { set: { Sensor: false }, label: "clear" },
        { set: { Sensor: true }, label: "3" },
        { set: { Sensor: false }, label: "clear" },
        { set: { Sensor: true }, label: "4" },
        { set: { Sensor: false }, label: "clear" },
        { set: { Sensor: true }, expect: { Disp: 5, DoneLamp: true }, label: "Pulse 5 → done" },
        { set: { ResetPB: true }, expect: { Disp: 0, DoneLamp: false }, label: "Reset → display 0" },
      ],
    },
  },
];
