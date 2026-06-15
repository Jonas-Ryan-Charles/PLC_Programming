// ─────────────────────────────────────────────────────────────────────────────
// Wiring Tutor — exercise definitions + a pure continuity grader.
//
// Each exercise is a small panel of terminals the student must connect with
// correctly-coloured wires (Red = 24 VDC L+, Blue = 0 VDC L−, Green = PE/earth,
// Black = signal). The grader is framework-agnostic so it can be unit-tested.
// ─────────────────────────────────────────────────────────────────────────────

export type WireColor = "red" | "blue" | "green" | "black";

export const COLOR_HEX: Record<WireColor, string> = {
  red: "#EF4444",
  blue: "#3B82F6",
  green: "#22C55E",
  black: "#9CA3AF",
};

export const COLOR_LABEL: Record<WireColor, string> = {
  red: "Red — L+ 24 VDC",
  blue: "Blue — L− 0 VDC",
  green: "Green/Yellow — PE earth",
  black: "Black — signal",
};

export interface Terminal {
  id: string;
  label: string;
  x: number;
  y: number;
}

export type WireRole = "Lplus" | "0v" | "pe" | "signal";

export interface ExpectedWire {
  a: string;
  b: string;
  color: WireColor;
  role: WireRole;
}

export interface StudentWire {
  a: string;
  b: string;
  color: WireColor;
}

export interface WiringExercise {
  id: string;
  title: string;
  brief: string;
  terminals: Terminal[];
  expected: ExpectedWire[];
}

export interface WiringFault {
  kind: "missing" | "0v" | "pe" | "color" | "extra";
  message: string;
}

export interface WiringResult {
  correct: boolean;
  faults: WiringFault[];
}

const key = (a: string, b: string) => [a, b].sort().join("|");

/** Grade a student's wiring against the exercise's expected wire set. */
export function gradeWiring(ex: WiringExercise, wires: StudentWire[]): WiringResult {
  const label = (id: string) => ex.terminals.find((t) => t.id === id)?.label ?? id;
  const studentByPair = new Map<string, StudentWire>();
  for (const w of wires) studentByPair.set(key(w.a, w.b), w);

  const faults: WiringFault[] = [];
  const expectedKeys = new Set<string>();

  for (const e of ex.expected) {
    const k = key(e.a, e.b);
    expectedKeys.add(k);
    const got = studentByPair.get(k);
    if (!got) {
      if (e.role === "0v") {
        faults.push({ kind: "0v", message: `No 0 V return — connect ${label(e.a)} to ${label(e.b)} (blue).` });
      } else if (e.role === "pe") {
        faults.push({ kind: "pe", message: `Missing PE/earth bond — connect ${label(e.a)} to ${label(e.b)} (green).` });
      } else {
        faults.push({ kind: "missing", message: `Missing connection: ${label(e.a)} ↔ ${label(e.b)}.` });
      }
    } else if (got.color !== e.color) {
      faults.push({
        kind: "color",
        message: `Wrong wire colour on ${label(e.a)} ↔ ${label(e.b)} — should be ${e.color}.`,
      });
    }
  }

  for (const w of wires) {
    if (!expectedKeys.has(key(w.a, w.b))) {
      faults.push({ kind: "extra", message: `Unexpected connection: ${label(w.a)} ↔ ${label(w.b)} — remove it.` });
    }
  }

  return { correct: faults.length === 0, faults };
}

// ─── Exercises ───────────────────────────────────────────────────────────────

export const WIRING_EXERCISES: WiringExercise[] = [
  {
    id: "wire-01",
    title: "Wire a Start pushbutton to an input",
    brief:
      "Power a normally-open pushbutton from **L+**, take its output to input **I:0/0**, and bond the " +
      "input module common to **L−** so the loop has a 0 V return.",
    terminals: [
      { id: "Lp", label: "L+ 24V", x: 520, y: 50 },
      { id: "Lm", label: "L− 0V", x: 520, y: 320 },
      { id: "pb1", label: "PB ·1", x: 90, y: 120 },
      { id: "pb2", label: "PB ·2", x: 90, y: 200 },
      { id: "i00", label: "I:0/0", x: 430, y: 150 },
      { id: "com", label: "IN COM", x: 430, y: 280 },
    ],
    expected: [
      { a: "Lp", b: "pb1", color: "red", role: "Lplus" },
      { a: "pb2", b: "i00", color: "black", role: "signal" },
      { a: "com", b: "Lm", color: "blue", role: "0v" },
    ],
  },
  {
    id: "wire-02",
    title: "Wire a pilot lamp to an output",
    brief:
      "Feed the output module's supply terminal from **L+**, switch output **O:0/0** to the lamp's " +
      "positive, and return the lamp's negative to **L−**.",
    terminals: [
      { id: "Lp", label: "L+ 24V", x: 520, y: 50 },
      { id: "Lm", label: "L− 0V", x: 520, y: 320 },
      { id: "vout", label: "OUT V+", x: 430, y: 90 },
      { id: "o00", label: "O:0/0", x: 430, y: 170 },
      { id: "l1", label: "LAMP +", x: 90, y: 130 },
      { id: "l2", label: "LAMP −", x: 90, y: 230 },
    ],
    expected: [
      { a: "vout", b: "Lp", color: "red", role: "Lplus" },
      { a: "o00", b: "l1", color: "black", role: "signal" },
      { a: "l2", b: "Lm", color: "blue", role: "0v" },
    ],
  },
  {
    id: "wire-03",
    title: "3-wire PNP sensor + earth bond",
    brief:
      "Wire a PNP proximity sensor: brown to **L+**, blue to **L−**, black (signal) to input **I:0/1**. " +
      "Then bond the enclosure to the **PE** bar with a green/yellow earth wire.",
    terminals: [
      { id: "Lp", label: "L+ 24V", x: 520, y: 40 },
      { id: "Lm", label: "L− 0V", x: 520, y: 300 },
      { id: "pe", label: "PE bar", x: 520, y: 170 },
      { id: "sb", label: "Sensor BN", x: 90, y: 70 },
      { id: "sbl", label: "Sensor BU", x: 90, y: 140 },
      { id: "sbk", label: "Sensor BK", x: 90, y: 210 },
      { id: "enc", label: "Encl. PE", x: 90, y: 300 },
      { id: "i01", label: "I:0/1", x: 430, y: 150 },
    ],
    expected: [
      { a: "sb", b: "Lp", color: "red", role: "Lplus" },
      { a: "sbl", b: "Lm", color: "blue", role: "0v" },
      { a: "sbk", b: "i01", color: "black", role: "signal" },
      { a: "enc", b: "pe", color: "green", role: "pe" },
    ],
  },
];
