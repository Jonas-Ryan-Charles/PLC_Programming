// Process-control scenarios: timer-sequenced traffic light, garage door with
// limit-switch feedback, and a box-counting conveyor. Each drives a live plant.
import {
  boolTag,
  ctu,
  ote,
  parallel,
  program,
  res,
  realTag,
  rung,
  series,
  tags,
  timerTag,
  ton,
  counterTag,
  withPlant,
  xic,
  xio,
} from "./builders";
import type { Scenario } from "./types";
import type { Tag } from "../engine/types";

/** A BOOL that rests HIGH (e.g. an NC stop contact, closed at rest). */
const highBool = (name: string, comment?: string): Tag => ({ name, type: "BOOL", value: true, comment });

export const PROCESS_SCENARIOS: Scenario[] = [
  // ── P1 — Traffic Light sequence (cascaded TON timers) ──────────────────────
  {
    id: "proc-01",
    number: 23,
    title: "Traffic Light (timer sequence)",
    brief:
      "Sequence a traffic light with three on-delay timers using the **cumulative-timer** method. " +
      "While **Run** is on, T1/T2/T3 free-run and reset every cycle (`XIO T3.DN`). **GREEN** is lit " +
      "until T1 (5 s), **AMBER** between T1 and T2 (5–7 s), **RED** after T2 (7–12 s); at 12 s T3 " +
      "resets the cycle. Watch the lamp post follow the sequence.",
    inputs: [{ address: "I:0/0", tag: "Run", device: "TOGGLE", label: "RUN" }],
    outputs: [
      { address: "O:0/0", tag: "Green", device: "PILOT_GREEN", label: "GREEN" },
      { address: "O:0/1", tag: "Amber", device: "PILOT_AMBER", label: "AMBER" },
      { address: "O:0/2", tag: "Red", device: "PILOT_RED", label: "RED" },
    ],
    widgets: ["traffic"],
    tags: tags(
      boolTag("Run", "Enable sequence"),
      boolTag("Green"),
      boolTag("Amber"),
      boolTag("Red"),
      timerTag("T1", 5000, "Green ends"),
      timerTag("T2", 7000, "Amber ends"),
      timerTag("T3", 12000, "Cycle length"),
    ),
    program: program(
      rung(series(xic("Run"), xio("T3.DN"), ton("T1"), ton("T2"), ton("T3")), "Free-run timers; reset each cycle"),
      rung(series(xic("Run"), xio("T1.DN"), ote("Green")), "0–5 s → GREEN"),
      rung(series(xic("Run"), xic("T1.DN"), xio("T2.DN"), ote("Amber")), "5–7 s → AMBER"),
      rung(series(xic("Run"), xic("T2.DN"), ote("Red")), "7–12 s → RED"),
    ),
    tests: {
      tests: [
        { set: { Run: true }, holdMs: 1000, expect: { Green: true, Amber: false, Red: false }, label: "0–5 s → GREEN" },
        { holdMs: 5000, expect: { Amber: true, Green: false, Red: false }, label: "5–7 s → AMBER" },
        { holdMs: 3000, expect: { Red: true, Amber: false }, label: "7–12 s → RED" },
        { holdMs: 4000, expect: { Green: true, Red: false }, label: "cycle repeats → GREEN" },
        { set: { Run: false }, holdMs: 200, expect: { Green: false, Amber: false, Red: false }, label: "Run off → all dark" },
      ],
    },
  },

  // ── P2 — Garage Door with limit switches + interlock ───────────────────────
  {
    id: "proc-02",
    number: 24,
    title: "Garage Door (limit switches)",
    brief:
      "Drive a garage door up and down with **seal-in** control and **limit-switch** feedback. " +
      "**OPEN** raises the door (**MotorUp**) until **UpperLS**; **CLOSE** lowers it (**MotorDown**) " +
      "until **LowerLS**. Up and down are interlocked (never both), and the **NC STOP** button drops " +
      "everything. The door, driven by a live plant, trips the limit switches at each end of travel.",
    inputs: [
      { address: "I:0/0", tag: "OpenPB", device: "NO_PB", label: "OPEN" },
      { address: "I:0/1", tag: "ClosePB", device: "NO_PB", label: "CLOSE" },
      { address: "I:0/2", tag: "StopPB", device: "NC_PB", label: "STOP" },
    ],
    outputs: [
      { address: "O:0/0", tag: "MotorUp", device: "PILOT_GREEN", label: "UP" },
      { address: "O:0/1", tag: "MotorDown", device: "PILOT_AMBER", label: "DOWN" },
    ],
    widgets: ["garage"],
    tags: tags(
      boolTag("OpenPB", "Open pushbutton"),
      boolTag("ClosePB", "Close pushbutton"),
      highBool("StopPB", "NC stop (HIGH at rest)"),
      boolTag("MotorUp", "Raise door"),
      boolTag("MotorDown", "Lower door"),
      highBool("LowerLS", "Closed limit (door down)"),
      boolTag("UpperLS", "Open limit (door up)"),
      realTag("DoorPos", 0, "Door position 0–100 %"),
    ),
    program: withPlant(
      program(
        rung(series(parallel(xic("OpenPB"), xic("MotorUp")), xic("StopPB"), xio("UpperLS"), xio("MotorDown"), ote("MotorUp")), "Open: seal-in, stop at top, interlock"),
        rung(series(parallel(xic("ClosePB"), xic("MotorDown")), xic("StopPB"), xio("LowerLS"), xio("MotorUp"), ote("MotorDown")), "Close: seal-in, stop at bottom, interlock"),
      ),
      { model: "garage", params: { pos: "DoorPos", up: "MotorUp", down: "MotorDown", rate: 50, upperLS: "UpperLS", lowerLS: "LowerLS" } },
    ),
    tests: {
      tests: [
        { set: { OpenPB: true }, expect: { MotorUp: true, MotorDown: false }, label: "OPEN pressed → motor up" },
        { set: { OpenPB: false }, holdMs: 500, expect: { MotorUp: true }, label: "released → seal-in holds" },
        { holdMs: 2000, expect: { UpperLS: true, MotorUp: false }, label: "reaches top → stops at UpperLS" },
        { set: { ClosePB: true }, expect: { MotorDown: true, MotorUp: false }, label: "CLOSE pressed → motor down" },
        { set: { ClosePB: false }, holdMs: 2500, expect: { LowerLS: true, MotorDown: false }, label: "reaches bottom → stops at LowerLS" },
        { set: { OpenPB: true }, holdMs: 300, expect: { MotorUp: true }, label: "OPEN again → motor up" },
        { set: { StopPB: false }, holdMs: 100, expect: { MotorUp: false }, label: "NC STOP pressed → halts" },
      ],
    },
  },

  // ── P3 — Box-counting conveyor (CTU + seal-in) ─────────────────────────────
  {
    id: "proc-03",
    number: 25,
    title: "Conveyor — count 5 boxes (CTU)",
    brief:
      "Run a conveyor and count boxes past a sensor with a **CTU**. **START** seals **Run** on; the belt " +
      "carries boxes that pulse **BeltSensor** as they cross. When the count reaches **5** the counter " +
      "**DN** bit stops the belt and lights **FULL**. **NC STOP** halts the belt; **RESET** clears the " +
      "count to run again.",
    inputs: [
      { address: "I:0/0", tag: "StartPB", device: "NO_PB", label: "START" },
      { address: "I:0/1", tag: "StopPB", device: "NC_PB", label: "STOP" },
      { address: "I:0/2", tag: "ResetPB", device: "NO_PB", label: "RESET" },
    ],
    outputs: [
      { address: "O:0/0", tag: "Run", device: "MOTOR", label: "CONVEYOR" },
      { address: "O:0/1", tag: "Full", device: "PILOT_RED", label: "FULL" },
    ],
    widgets: ["conveyor"],
    tags: tags(
      boolTag("StartPB", "Start"),
      highBool("StopPB", "NC stop (HIGH at rest)"),
      boolTag("ResetPB", "Reset count"),
      boolTag("Run", "Belt motor"),
      boolTag("BeltSensor", "Box-detect sensor"),
      boolTag("Full", "Batch complete"),
      counterTag("BoxCount", 5, "Boxes counted"),
      realTag("Dist", 0, "Belt travel"),
    ),
    program: withPlant(
      program(
        rung(series(parallel(xic("StartPB"), xic("Run")), xic("StopPB"), xio("BoxCount.DN"), ote("Run")), "Start → seal Run until full or stop"),
        rung(series(xic("Run"), xic("BeltSensor"), ctu("BoxCount")), "Count each box past the sensor"),
        rung(series(xic("BoxCount.DN"), ote("Full")), "5 boxes → FULL"),
        rung(series(xic("ResetPB"), res("BoxCount")), "RESET → clear count"),
      ),
      { model: "conveyor", params: { run: "Run", sensor: "BeltSensor", speed: 50, spacing: 20, dist: "Dist" } },
    ),
    tests: {
      tests: [
        { set: { StartPB: true }, expect: { Run: true, Full: false }, label: "START → conveyor runs" },
        { set: { StartPB: false }, holdMs: 2500, expect: { Run: false, Full: true, BoxCount: 5 }, label: "5 boxes → stop + FULL" },
        { set: { StartPB: true }, holdMs: 200, expect: { Run: false }, label: "still full → won't restart" },
        { set: { ResetPB: true }, holdMs: 50, expect: { Full: false, BoxCount: 0 }, label: "RESET → count cleared" },
        { set: { ResetPB: false, StartPB: true }, holdMs: 50, expect: { Run: true }, label: "START → runs again" },
      ],
    },
  },
];
