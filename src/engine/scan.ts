// ─────────────────────────────────────────────────────────────────────────────
// VoltRung PLC Engine — scan cycle + instruction execution
//
// Faithful-enough IEC 61131-3 evaluation for the Beginner / early-Intermediate
// curriculum: series (AND) + parallel (OR) rung trees, contacts, coils, latch,
// one-shots, on-delay/off-delay/retentive timers, up/down counters, compares,
// and basic math. Every instruction reads and writes the rung's continuity rail.
// ─────────────────────────────────────────────────────────────────────────────

import { runPlant } from "./plant";
import type {
  CounterVal,
  Instruction,
  PLCState,
  Program,
  RungNode,
  Tag,
  TagStore,
  TimerVal,
} from "./types";

// ─── Tag access (supports member addressing: Timer1.DN, Counter1.ACC, …) ─────

const BOOL_MEMBERS = new Set(["EN", "TT", "DN", "CU", "CD", "OV", "UN"]);
const NUM_MEMBERS = new Set(["ACC", "PRE"]);

function splitMember(name: string): [string, string | null] {
  const dot = name.indexOf(".");
  if (dot === -1) return [name, null];
  return [name.slice(0, dot), name.slice(dot + 1).toUpperCase()];
}

/** Read a boolean from a tag or a member bit. Unknown tags read as false. */
export function getBool(tags: TagStore, name: string): boolean {
  const [base, member] = splitMember(name);
  const tag = tags[base];
  if (!tag) return false;
  if (member && BOOL_MEMBERS.has(member)) {
    const v = tag.value as unknown as Record<string, unknown>;
    return Boolean(v[member.toLowerCase()]);
  }
  if (typeof tag.value === "boolean") return tag.value;
  if (typeof tag.value === "number") return tag.value !== 0;
  return false;
}

/** Read a number from a literal, a tag, or a member register. */
export function getNum(tags: TagStore, operand: string | undefined): number {
  if (operand === undefined || operand === "") return 0;
  const asNum = Number(operand);
  if (!Number.isNaN(asNum) && /^-?\d*\.?\d+$/.test(operand.trim())) return asNum;

  const [base, member] = splitMember(operand);
  const tag = tags[base];
  if (!tag) return 0;
  if (member && NUM_MEMBERS.has(member)) {
    const v = tag.value as unknown as Record<string, unknown>;
    return Number(v[member.toLowerCase()]) || 0;
  }
  if (typeof tag.value === "number") return tag.value;
  if (typeof tag.value === "boolean") return tag.value ? 1 : 0;
  if (tag.type === "TIMER" || tag.type === "COUNTER") {
    return (tag.value as TimerVal | CounterVal).acc;
  }
  return 0;
}

function setBool(tags: TagStore, name: string, val: boolean): void {
  const tag = tags[name];
  if (!tag) return;
  if (tag.type === "BOOL") tag.value = val;
}

function setNum(tags: TagStore, name: string | undefined, val: number): void {
  if (!name) return;
  const tag = tags[name];
  if (!tag) return;
  if (tag.type === "DINT") tag.value = Math.trunc(val);
  else if (tag.type === "REAL") tag.value = val;
}

function timerOf(tags: TagStore, name?: string): TimerVal | null {
  if (!name) return null;
  const t = tags[name];
  return t && t.type === "TIMER" ? (t.value as TimerVal) : null;
}

function counterOf(tags: TagStore, name?: string): CounterVal | null {
  if (!name) return null;
  const t = tags[name];
  return t && t.type === "COUNTER" ? (t.value as CounterVal) : null;
}

/** Pack a 0–9999 decimal value into a 16-bit BCD code (4 nibbles). */
export function decToBcd(dec: number): number {
  let bcd = 0;
  for (let shift = 0; shift < 16; shift += 4) {
    bcd |= (dec % 10) << shift;
    dec = Math.floor(dec / 10);
  }
  return bcd;
}

/** Unpack a 16-bit BCD code to decimal; returns null if any nibble is > 9. */
export function bcdToDec(bcd: number): number | null {
  let dec = 0;
  let mult = 1;
  for (let shift = 0; shift < 16; shift += 4) {
    const nibble = (bcd >> shift) & 0xf;
    if (nibble > 9) return null; // invalid BCD digit → conversion fault
    dec += nibble * mult;
    mult *= 10;
  }
  return dec;
}

// ─── Instruction classification ──────────────────────────────────────────────

const GATE_KINDS = new Set([
  "XIC",
  "XIO",
  "ONS",
  "EQU",
  "NEQ",
  "LES",
  "LEQ",
  "GRT",
  "GEQ",
  "LIM",
]);

export function isGate(instr: Instruction): boolean {
  return GATE_KINDS.has(instr.kind);
}

// ─── Evaluate one instruction within the rung continuity model ───────────────

function evalGate(tags: TagStore, instr: Instruction, powerIn: boolean): boolean {
  switch (instr.kind) {
    case "XIC":
      return powerIn && getBool(tags, instr.tag ?? "");
    case "XIO":
      return powerIn && !getBool(tags, instr.tag ?? "");
    case "ONS": {
      // Rising-edge one-shot: true for a single scan when powerIn rises.
      const fire = powerIn && !instr._edge;
      instr._edge = powerIn;
      return fire;
    }
    case "EQU":
      return powerIn && getNum(tags, instr.a) === getNum(tags, instr.b);
    case "NEQ":
      return powerIn && getNum(tags, instr.a) !== getNum(tags, instr.b);
    case "LES":
      return powerIn && getNum(tags, instr.a) < getNum(tags, instr.b);
    case "LEQ":
      return powerIn && getNum(tags, instr.a) <= getNum(tags, instr.b);
    case "GRT":
      return powerIn && getNum(tags, instr.a) > getNum(tags, instr.b);
    case "GEQ":
      return powerIn && getNum(tags, instr.a) >= getNum(tags, instr.b);
    case "LIM": {
      // LIM(low=a, test=b, high=c) — inclusive limit test
      const lo = getNum(tags, instr.a);
      const test = getNum(tags, instr.b);
      const hi = getNum(tags, instr.c);
      return powerIn && test >= lo && test <= hi;
    }
    default:
      return powerIn;
  }
}

function execOutput(
  tags: TagStore,
  instr: Instruction,
  powerIn: boolean,
  dt: number,
): void {
  switch (instr.kind) {
    case "OTE":
      setBool(tags, instr.tag ?? "", powerIn);
      break;
    case "OTL":
      if (powerIn) setBool(tags, instr.tag ?? "", true);
      break;
    case "OTU":
      if (powerIn) setBool(tags, instr.tag ?? "", false);
      break;

    case "TON": {
      const t = timerOf(tags, instr.tag);
      if (!t) break;
      t.en = powerIn;
      if (powerIn) {
        if (t.acc < t.pre) t.acc = Math.min(t.pre, t.acc + dt);
        t.dn = t.acc >= t.pre;
        t.tt = !t.dn;
      } else {
        t.acc = 0;
        t.dn = false;
        t.tt = false;
      }
      break;
    }
    case "RTO": {
      // Retentive: accumulates while in; ACC held when out; cleared only by RES.
      const t = timerOf(tags, instr.tag);
      if (!t) break;
      t.en = powerIn;
      if (powerIn && t.acc < t.pre) t.acc = Math.min(t.pre, t.acc + dt);
      t.dn = t.acc >= t.pre;
      t.tt = powerIn && !t.dn;
      break;
    }
    case "TOF": {
      const t = timerOf(tags, instr.tag);
      if (!t) break;
      t.en = powerIn;
      if (powerIn) {
        // energised → output on, accumulator held at 0, off-delay armed
        t.armed = true;
        t.acc = 0;
        t.dn = true;
        t.tt = false;
      } else if (t.armed) {
        // de-energised after having been on → run the off-delay
        if (t.acc < t.pre) t.acc = Math.min(t.pre, t.acc + dt);
        t.dn = t.acc < t.pre;
        t.tt = t.dn;
      } else {
        // never energised (e.g. cold start) → sit idle, do not time out
        t.acc = 0;
        t.dn = false;
        t.tt = false;
      }
      break;
    }

    case "CTU": {
      const c = counterOf(tags, instr.tag);
      if (!c) break;
      if (powerIn && !c.cu) {
        c.acc += 1;
        if (c.acc > 2147483647) c.ov = true;
      }
      c.cu = powerIn;
      c.dn = c.acc >= c.pre;
      break;
    }
    case "CTD": {
      const c = counterOf(tags, instr.tag);
      if (!c) break;
      if (powerIn && !c.cd) {
        c.acc -= 1;
        if (c.acc < -2147483648) c.un = true;
      }
      c.cd = powerIn;
      c.dn = c.acc >= c.pre;
      break;
    }
    case "RES": {
      if (!powerIn) break;
      const t = timerOf(tags, instr.tag);
      if (t) {
        t.acc = 0;
        t.dn = false;
        t.tt = false;
        t.en = false;
        t.armed = false;
      }
      const c = counterOf(tags, instr.tag);
      if (c) {
        c.acc = 0;
        c.dn = false;
        c.ov = false;
        c.un = false;
        c.cu = false;
        c.cd = false;
      }
      break;
    }

    case "ADD":
      if (powerIn) setNum(tags, instr.c, getNum(tags, instr.a) + getNum(tags, instr.b));
      break;
    case "SUB":
      if (powerIn) setNum(tags, instr.c, getNum(tags, instr.a) - getNum(tags, instr.b));
      break;
    case "MUL":
      if (powerIn) setNum(tags, instr.c, getNum(tags, instr.a) * getNum(tags, instr.b));
      break;
    case "DIV":
      if (powerIn) {
        const d = getNum(tags, instr.b);
        // Divide-by-zero is a math fault on a real PLC: leave the destination
        // unchanged rather than silently writing 0.
        if (d !== 0) setNum(tags, instr.c, getNum(tags, instr.a) / d);
      }
      break;
    case "MOD":
      if (powerIn) {
        const d = getNum(tags, instr.b);
        if (d !== 0) setNum(tags, instr.c, getNum(tags, instr.a) % d);
      }
      break;
    case "SQR":
      if (powerIn) {
        const v = getNum(tags, instr.a);
        if (v >= 0) setNum(tags, instr.tag, Math.sqrt(v)); // negative root = math fault, leave dest
      }
      break;
    case "ABS":
      if (powerIn) setNum(tags, instr.tag, Math.abs(getNum(tags, instr.a)));
      break;
    case "NEG":
      if (powerIn) setNum(tags, instr.tag, -getNum(tags, instr.a));
      break;
    case "MOV":
      if (powerIn) setNum(tags, instr.tag, getNum(tags, instr.a));
      break;
    case "CLR":
      if (powerIn) setNum(tags, instr.tag, 0);
      break;

    case "TOD":
      // To BCD: pack a 0–9999 decimal source into a 16-bit BCD register
      // (one decimal digit per nibble). Out-of-range source is a conversion
      // fault → leave the destination unchanged.
      if (powerIn) {
        const v = Math.trunc(getNum(tags, instr.a));
        if (v >= 0 && v <= 9999) setNum(tags, instr.tag, decToBcd(v));
      }
      break;
    case "FRD":
      // From BCD: unpack a BCD-coded source (e.g. a thumbwheel register) to a
      // plain decimal integer. A nibble > 9 is invalid BCD → conversion fault,
      // leave the destination unchanged.
      if (powerIn) {
        const dec = bcdToDec(Math.trunc(getNum(tags, instr.a)));
        if (dec !== null) setNum(tags, instr.tag, dec);
      }
      break;

    case "SCP": {
      // SCP(input=a, inMin=b, inMax=c, outMin=d, outMax=e) → dest=tag
      if (!powerIn) break;
      const input = getNum(tags, instr.a);
      const inMin = getNum(tags, instr.b);
      const inMax = getNum(tags, instr.c);
      const outMin = getNum(tags, instr.d);
      const outMax = getNum(tags, instr.e);
      const span = inMax - inMin;
      const scaled = span === 0 ? outMin : outMin + ((input - inMin) * (outMax - outMin)) / span;
      // clamp to the engineering range (handles inverted ranges too)
      const lo = Math.min(outMin, outMax);
      const hi = Math.max(outMin, outMax);
      setNum(tags, instr.tag, Math.max(lo, Math.min(hi, scaled)));
      break;
    }
    case "SCL": {
      // SCL(input=a, rate=d /10000, offset=e) → dest=tag  (legacy slope/offset)
      if (!powerIn) break;
      const input = getNum(tags, instr.a);
      setNum(tags, instr.tag, (input * getNum(tags, instr.d)) / 10000 + getNum(tags, instr.e));
      break;
    }

    case "PID": {
      // PID(PV=a, SP=b, Kp=c, Ki=d, Kd=e) → CV=tag, output clamped 0–100 %.
      // When the rung is de-energised the controller is OFF: the output is
      // driven to 0 and the integrator is cleared so re-enabling starts clean.
      // Anti-windup: the integrator does not accumulate while CV is saturated.
      if (!powerIn) {
        instr._integral = 0;
        instr._prevErr = undefined;
        setNum(tags, instr.tag, 0);
        break;
      }
      const sec = dt / 1000;
      const pv = getNum(tags, instr.a);
      const sp = getNum(tags, instr.b);
      const kp = getNum(tags, instr.c);
      const ki = getNum(tags, instr.d);
      const kd = getNum(tags, instr.e);
      const err = sp - pv;
      const prevErr = instr._prevErr ?? err;
      const deriv = sec > 0 ? (err - prevErr) / sec : 0;
      let integral = (instr._integral ?? 0) + err * sec;

      const LO = 0;
      const HI = 100;
      let cv = kp * err + ki * integral + kd * deriv;
      if (cv > HI) {
        cv = HI;
        integral -= err * sec; // stop integral wind-up while saturated high
      } else if (cv < LO) {
        cv = LO;
        integral -= err * sec; // stop wind-up while saturated low
      }
      instr._integral = integral;
      instr._prevErr = err;
      setNum(tags, instr.tag, cv);
      break;
    }
  }
}

// ─── Rung-tree evaluation ────────────────────────────────────────────────────

function evalNode(
  tags: TagStore,
  node: RungNode,
  powerIn: boolean,
  dt: number,
): boolean {
  switch (node.kind) {
    case "instr": {
      if (isGate(node.instr)) return evalGate(tags, node.instr, powerIn);
      execOutput(tags, node.instr, powerIn, dt);
      return powerIn; // coils/blocks pass continuity through
    }
    case "series": {
      let power = powerIn;
      for (const child of node.children) power = evalNode(tags, child, power, dt);
      return power;
    }
    case "parallel": {
      // Evaluate ALL branches (side effects must run) then OR their outputs.
      let out = false;
      for (const child of node.children) {
        if (evalNode(tags, child, powerIn, dt)) out = true;
      }
      return out;
    }
  }
}

// ─── Scan cycle ──────────────────────────────────────────────────────────────

/**
 * Execute one scan: evaluate every rung left→right, top→bottom.
 * `dt` is the elapsed time in ms since the previous scan (drives timers).
 * Inputs are assumed already latched into the tag store by the caller
 * (the chassis writes input tags; this mirrors the input-image-read phase).
 */
export function runScanCycle(program: Program, state: PLCState, dt: number): PLCState {
  const start = performanceNow();
  for (const rung of program.rungs) {
    rung.energised = evalNode(state.tags, rung.root, true, dt);
  }
  // Process plant evolves after outputs are written (post-scan housekeeping).
  runPlant(program.plant, state.tags, dt);
  state.scanCount += 1;
  state.scanTimeMs = performanceNow() - start;
  return state;
}

function performanceNow(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

// ─── Helpers for building state ──────────────────────────────────────────────

export function newTimer(pre = 0): TimerVal {
  return { pre, acc: 0, en: false, tt: false, dn: false };
}

export function newCounter(pre = 0): CounterVal {
  return { pre, acc: 0, cu: false, cd: false, dn: false, ov: false, un: false };
}

/** Deep-clone a tag store (structuredClone fallback for older runtimes). */
export function cloneTags(tags: TagStore): TagStore {
  if (typeof structuredClone === "function") return structuredClone(tags);
  return JSON.parse(JSON.stringify(tags)) as TagStore;
}

export function makeTag(
  name: string,
  type: Tag["type"],
  value: Tag["value"],
  comment?: string,
): Tag {
  return { name, type, value, comment };
}
