import { describe, expect, it } from "vitest";
import { gradeWiring, WIRING_EXERCISES, type StudentWire } from "../exercises";

const correctWiring = (id: string): StudentWire[] => {
  const ex = WIRING_EXERCISES.find((e) => e.id === id)!;
  return ex.expected.map((e) => ({ a: e.a, b: e.b, color: e.color }));
};

describe("wiring grader", () => {
  it("accepts the fully-correct wiring for every exercise", () => {
    for (const ex of WIRING_EXERCISES) {
      const r = gradeWiring(ex, correctWiring(ex.id));
      expect(r.correct, `${ex.id}: ${r.faults.map((f) => f.message).join("; ")}`).toBe(true);
    }
  });

  it("flags a missing 0 V return", () => {
    const ex = WIRING_EXERCISES.find((e) => e.id === "wire-01")!;
    const wires = correctWiring("wire-01").filter((w) => !(w.a === "com" || w.b === "com"));
    const r = gradeWiring(ex, wires);
    expect(r.correct).toBe(false);
    expect(r.faults.some((f) => f.kind === "0v")).toBe(true);
  });

  it("flags a missing PE bond", () => {
    const ex = WIRING_EXERCISES.find((e) => e.id === "wire-03")!;
    const wires = correctWiring("wire-03").filter((w) => !(w.a === "enc" || w.b === "enc"));
    const r = gradeWiring(ex, wires);
    expect(r.faults.some((f) => f.kind === "pe")).toBe(true);
  });

  it("flags a wrong wire colour", () => {
    const ex = WIRING_EXERCISES.find((e) => e.id === "wire-01")!;
    const wires = correctWiring("wire-01").map((w) =>
      w.a === "Lp" || w.b === "Lp" ? { ...w, color: "blue" as const } : w,
    );
    const r = gradeWiring(ex, wires);
    expect(r.faults.some((f) => f.kind === "color")).toBe(true);
  });

  it("flags an unexpected connection", () => {
    const ex = WIRING_EXERCISES.find((e) => e.id === "wire-01")!;
    const wires = [...correctWiring("wire-01"), { a: "pb1", b: "i00", color: "black" as const }];
    const r = gradeWiring(ex, wires);
    expect(r.faults.some((f) => f.kind === "extra")).toBe(true);
  });
});
