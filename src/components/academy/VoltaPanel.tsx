import { useState } from "react";
import { askTutor, type TutorReply } from "../../api/client";
import type { Program, RungNode } from "../../engine/types";
import { useSim } from "../../store/simulatorStore";

/** Compact, human-readable summary of a rung tree for the tutor context. */
function describeNode(node: RungNode): string {
  if (node.kind === "series") {
    const parts = node.children.map(describeNode).filter(Boolean);
    return parts.join(" · ");
  }
  if (node.kind === "parallel") {
    return "(" + node.children.map(describeNode).join(" | ") + ")";
  }
  const i = node.instr;
  const ops = [i.tag, i.a, i.b, i.c, i.d, i.e].filter((x) => x !== undefined && x !== "");
  return ops.length ? `${i.kind} ${ops.join(",")}` : i.kind;
}

function describeProgram(program: Program): string {
  const rungs = program.rungs
    .map((r, idx) => {
      const body = describeNode(r.root);
      return `Rung ${idx + 1}: ${body || "(empty)"}`;
    })
    .filter((line) => !line.endsWith("(empty)") || program.rungs.length <= 3);
  return rungs.join("\n") || "(no rungs yet)";
}

export default function VoltaPanel() {
  const scenario = useSim((s) => s.scenario);
  const grade = useSim((s) => s.grade);
  const program = useSim((s) => s.program);

  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<TutorReply | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    setLoading(true);
    setReply(null);
    try {
      const res = await askTutor({
        scenarioId: scenario.id,
        title: scenario.title,
        brief: scenario.brief,
        rungs: describeProgram(program),
        grade: grade
          ? {
              passed: grade.passed,
              failing: grade.steps
                .filter((s) => !s.pass)
                .map((s) => ({ label: s.label, detail: s.detail })),
            }
          : undefined,
        question: question.trim() || undefined,
      });
      setReply(res);
    } catch (e) {
      setReply({ hint: `Couldn't reach Volta (${(e as Error).message}).`, source: "local" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-[#21262D] bg-[#0E1622] px-3 py-2">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/25 text-[11px]">⚡</span>
        <span className="text-[11px] font-semibold text-violet-200">Ask Volta</span>
        <span className="text-[10px] text-gray-500">your AI tutor</span>
      </div>

      <div className="flex gap-1.5">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && ask()}
          placeholder="Stuck? Ask a question, or just hit Hint…"
          className="min-w-0 flex-1 rounded border border-[#30363D] bg-[#161B22] px-2 py-1 text-[12px] text-gray-100 placeholder:text-gray-600"
        />
        <button
          onClick={ask}
          disabled={loading}
          className="shrink-0 rounded bg-violet-600 px-2.5 py-1 text-[12px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {loading ? "…" : "Hint"}
        </button>
      </div>

      {reply && (
        <div className="mt-2 rounded border border-violet-900/50 bg-[#11131f] p-2">
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-gray-200">{reply.hint}</p>
          <div className="mt-1 text-[9px] uppercase tracking-wide text-gray-600">
            {reply.source === "volta" ? "Volta · Claude" : "Volta · offline tip"}
          </div>
        </div>
      )}
    </div>
  );
}
