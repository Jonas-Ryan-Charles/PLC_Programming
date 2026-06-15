import { useEffect } from "react";
import { ALL_SCENARIOS as SCENARIOS } from "../scenarios";
import { useSim } from "../store/simulatorStore";
import { useProject } from "../store/projectStore";
import { xpForScenario } from "../api/progress";

export default function ScenarioPanel() {
  const scenario = useSim((s) => s.scenario);
  const grade = useSim((s) => s.grade);
  const loadScenario = useSim((s) => s.loadScenario);
  const runTests = useSim((s) => s.runTests);

  const progress = useProject((s) => s.progress);
  const lastAward = useProject((s) => s.lastAward);
  const recordCompletion = useProject((s) => s.recordCompletion);

  const completedIds = new Set(progress?.completions.map((c) => c.scenarioId));
  const isCompleted = completedIds.has(scenario.id);

  // When the auto-grader passes, record the completion (idempotent server-side).
  useEffect(() => {
    if (grade?.passed) recordCompletion(scenario.id, xpForScenario(scenario));
  }, [grade, scenario, recordCompletion]);

  return (
    <div className="flex h-full flex-col">
      {/* progress header */}
      {progress && (
        <div className="flex items-center gap-2 border-b border-[#21262D] bg-[#0E1622] px-3 py-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 font-mono text-[11px] font-bold text-sky-300">
            {progress.level}
          </span>
          <div className="flex-1">
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span>Level {progress.level}</span>
              <span>
                {progress.completions.length}/{SCENARIOS.length} done · {progress.totalXp} XP
              </span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded bg-black/40">
              <div
                className="h-full rounded bg-sky-400"
                style={{ width: `${Math.min(100, (progress.xpIntoLevel / progress.xpPerLevel) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* scenario picker */}
      <div className="border-b border-[#21262D] px-3 py-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">
          Hands-on Scenarios
        </div>
        <select
          value={scenario.id}
          onChange={(e) => loadScenario(e.target.value)}
          className="w-full rounded border border-[#30363D] bg-[#161B22] px-2 py-1.5 text-sm text-gray-100"
        >
          {SCENARIOS.map((s) => (
            <option key={s.id} value={s.id}>
              {completedIds.has(s.id) ? "✓ " : ""}
              {String(s.number).padStart(2, "0")} — {s.title}
            </option>
          ))}
        </select>
      </div>

      {/* brief */}
      <div className="flex-1 overflow-auto px-3 py-2">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-100">
          {scenario.title}
          {isCompleted && (
            <span className="rounded bg-safe/15 px-1.5 py-0.5 text-[10px] font-bold text-safe">✓ Completed</span>
          )}
        </h2>
        <p
          className="text-[12px] leading-relaxed text-gray-300"
          dangerouslySetInnerHTML={{ __html: mdInline(scenario.brief) }}
        />

        <div className="mt-3 rounded border border-[#21262D] bg-[#0F141B] p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">Wiring</div>
          <ul className="space-y-0.5 text-[11px] font-mono text-gray-300">
            {scenario.inputs.map((i) => (
              <li key={i.address}>
                <span className="text-safe">{i.address}</span> ← {i.device} → {i.tag}
              </li>
            ))}
            {scenario.outputs.map((o) => (
              <li key={o.address}>
                <span className="text-energised">{o.address}</span> → {o.device} → {o.tag}
              </li>
            ))}
            {scenario.analogIn?.map((a) => (
              <li key={a.channel}>
                <span className="text-sky-400">{a.channel}</span> ← {a.signal} → {a.tag} ({a.engMin}–
                {a.engMax} {a.unit})
              </li>
            ))}
            {scenario.analogOut?.map((a) => (
              <li key={a.channel}>
                <span className="text-sky-400">{a.channel}</span> → {a.device} → {a.tag} ({a.engMin}–
                {a.engMax} {a.unit})
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* auto-grade */}
      <div className="border-t border-[#21262D] px-3 py-2">
        <button
          onClick={runTests}
          className="mb-2 w-full rounded bg-safe px-3 py-1.5 text-sm font-semibold text-black hover:brightness-110"
        >
          ✓ Run Tests ({scenario.tests.tests.length})
        </button>
        {grade && (
          <div>
            <div
              className={`mb-1 text-xs font-bold ${grade.passed ? "text-safe" : "text-fault"}`}
            >
              {grade.passed ? "ALL TESTS PASSED 🏅" : "Some tests failed"}
            </div>
            {grade.passed && lastAward?.scenarioId === scenario.id && (
              <div className="mb-1 rounded bg-sky-500/15 px-2 py-1 text-[11px] font-semibold text-sky-300">
                +{lastAward.xp} XP earned!
              </div>
            )}
            <ul className="space-y-1">
              {grade.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px]">
                  <span className={s.pass ? "text-safe" : "text-fault"}>{s.pass ? "✓" : "✗"}</span>
                  <span className="text-gray-300">
                    {s.label}
                    {s.detail && <span className="block text-fault/80">{s.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// minimal inline markdown: **bold** and `code`
function mdInline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-100">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-[#21262D] px-1 font-mono text-energised">$1</code>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}
