import { describe, expect, it } from "vitest";
import { gradeProgram } from "../grader";
import { ALL_SCENARIOS as SCENARIOS } from "../../scenarios";

describe("Scenario reference solutions", () => {
  for (const s of SCENARIOS) {
    it(`${s.id} — ${s.title} passes all auto-grade tests`, () => {
      const result = gradeProgram(s.program, s.tags, s.tests);
      const failed = result.steps.filter((x) => !x.pass).map((x) => `${x.label}: ${x.detail}`);
      expect(failed, failed.join("\n")).toHaveLength(0);
      expect(result.passed).toBe(true);
    });
  }
});

describe("engine primitives", () => {
  it("CTU counts only on rising edges", () => {
    const s = SCENARIOS.find((x) => x.id === "beg-10")!;
    const r = gradeProgram(s.program, s.tags, s.tests);
    expect(r.passed).toBe(true);
  });

  it("TON honours preset before asserting DN", () => {
    const s = SCENARIOS.find((x) => x.id === "beg-08")!;
    const r = gradeProgram(s.program, s.tags, s.tests);
    expect(r.passed).toBe(true);
  });

  it("SCP scales raw counts to engineering units and clamps", () => {
    const s = SCENARIOS.find((x) => x.id === "an-02")!;
    const r = gradeProgram(s.program, s.tags, s.tests);
    expect(r.passed).toBe(true);
  });

  it("tank plant fills and drains under bang-bang control", () => {
    const s = SCENARIOS.find((x) => x.id === "an-01")!;
    const r = gradeProgram(s.program, s.tags, s.tests);
    expect(r.passed).toBe(true);
  });
});
