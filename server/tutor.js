// ─────────────────────────────────────────────────────────────────────────────
// "Volta" — the VoltRung AI tutor.
//
// Two paths, same response shape:
//   • If an Anthropic API key is configured (VOLTRUNG_ANTHROPIC_KEY or
//     ANTHROPIC_API_KEY), Volta asks Claude for a short, Socratic ladder-logic
//     hint, given the scenario brief, the student's current program, and the
//     auto-grader result.
//   • Otherwise (or on any API error) it falls back to a deterministic,
//     rule-based hint derived from the grader output — so the tutor always
//     responds, even fully offline.
//
// The API key lives only on the server; the browser never sees it.
// ─────────────────────────────────────────────────────────────────────────────

const API_KEY = process.env.VOLTRUNG_ANTHROPIC_KEY ?? process.env.ANTHROPIC_API_KEY ?? null;
const MODEL = process.env.VOLTRUNG_TUTOR_MODEL ?? "claude-opus-4-8";

/**
 * Deterministic, offline hint. Reads the grader summary and the program shape
 * to produce a genuinely useful nudge without an LLM.
 */
export function buildFallbackHint(ctx) {
  const { brief, grade, rungs, question } = ctx ?? {};

  // No program written yet → orient them on the objective.
  if (!rungs || rungs.trim() === "" || /no rungs|empty/i.test(rungs)) {
    return (
      "Start by restating the goal in your own words, then place your input " +
      "contacts on the left of the rung and your output coil on the right. " +
      (brief ? `Reread the brief: it tells you which addresses to wire. ` : "") +
      "Drag an instruction from the palette onto a rung to begin."
    );
  }

  // Tests have run and something failed → point at the first failure.
  if (grade && grade.passed === false && Array.isArray(grade.failing) && grade.failing.length) {
    const f = grade.failing[0];
    const detail = (f.detail ?? "").toLowerCase();
    const tips = [];

    if (/expected true, got false/.test(detail)) {
      tips.push(
        "an output that should be ON is staying OFF — check that power can reach the coil: " +
          "are your series contacts the right type (XIC vs XIO), and is every condition satisfied?",
      );
    }
    if (/expected false, got true/.test(detail)) {
      tips.push(
        "an output is ON when it should be OFF — look for a missing interlock or a contact that " +
          "should be normally-closed (XIO) breaking the rung.",
      );
    }
    if (/expected (\d+), got 0/.test(detail) || /\.acc/.test(detail)) {
      tips.push(
        "a timer/counter isn't advancing as expected — verify its preset, that the rung feeding it " +
          "is energised, and (for counters) that the input actually pulses off-and-on between counts.",
      );
    }
    if (/expected (\d+), got (\d+)/.test(detail) && !tips.length) {
      tips.push(
        "a numeric value is off — re-check the operands on your math/move/convert block and the order " +
          "of your rungs (later rungs overwrite earlier ones in the same scan).",
      );
    }
    const base = `The test "${f.label}" is failing`;
    const because = tips.length ? `: ${tips[0]}` : f.detail ? ` (${f.detail}).` : ".";
    return `${base}${because} Fix that rung and run the tests again.`;
  }

  // Tests passed.
  if (grade && grade.passed === true) {
    return "Nice — all tests pass! Try explaining *why* your rung works, or tweak it and predict what breaks before re-running.";
  }

  // Have a program but haven't graded → nudge to verify.
  if (question && question.trim()) {
    return (
      "Good question. Trace the power flow left-to-right across each rung: a series path is an AND, a " +
      "branch is an OR, and a coil only energises when power reaches it. Run the tests to see exactly " +
      "which condition isn't met yet."
    );
  }
  return "Press ✓ Run Tests to check your logic — the grader will tell you exactly which condition isn't met, and I can help you fix it.";
}

const SYSTEM = `You are Volta, a warm, encouraging tutor inside VoltRung Academy, a browser PLC-programming course. The student is building ladder logic for a hands-on scenario.

Give a SHORT hint — 2 to 4 sentences. Nudge them toward the fix; do NOT hand over a full solution unless their message says they're truly stuck or asks outright. Use correct ladder-logic vocabulary (XIC, XIO, OTE, OTL/OTU, seal-in, TON/TOF/RTO, CTU/CTD, branch/parallel, FRD/TOD, LIM, etc.). Be concrete about THIS rung and THIS grader result. Never invent instructions that aren't part of the program. Plain text only, no markdown headers.`;

/**
 * Ask Claude for a hint. Falls back to the deterministic hint if no key is
 * configured or the API call fails. Always resolves with { hint, source }.
 */
export async function askVolta(ctx) {
  if (!API_KEY) return { hint: buildFallbackHint(ctx), source: "local" };

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: API_KEY });

    const userText = renderContext(ctx);
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!text) return { hint: buildFallbackHint(ctx), source: "local" };
    return { hint: text, source: "volta" };
  } catch (err) {
    // Network/auth/rate-limit — degrade gracefully to the offline hint.
    return { hint: buildFallbackHint(ctx), source: "local", error: String(err?.message ?? err) };
  }
}

function renderContext(ctx) {
  const { title, brief, rungs, grade, question } = ctx ?? {};
  const lines = [];
  if (title) lines.push(`Scenario: ${title}`);
  if (brief) lines.push(`\nObjective:\n${brief}`);
  if (rungs) lines.push(`\nThe student's current ladder program:\n${rungs}`);
  if (grade) {
    if (grade.passed) {
      lines.push(`\nAuto-grader: ALL TESTS PASS.`);
    } else if (Array.isArray(grade.failing) && grade.failing.length) {
      const fails = grade.failing
        .slice(0, 4)
        .map((f) => `  - ${f.label}${f.detail ? ` → ${f.detail}` : ""}`)
        .join("\n");
      lines.push(`\nAuto-grader: FAILING steps:\n${fails}`);
    } else {
      lines.push(`\nAuto-grader: not run yet.`);
    }
  }
  lines.push(`\nStudent asks: ${question && question.trim() ? question.trim() : "Give me a hint for what to do next."}`);
  return lines.join("\n");
}

export const tutorConfigured = () => Boolean(API_KEY);
