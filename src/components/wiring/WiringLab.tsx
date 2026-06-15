import { useMemo, useState } from "react";
import {
  COLOR_HEX,
  COLOR_LABEL,
  gradeWiring,
  WIRING_EXERCISES,
  type StudentWire,
  type WireColor,
  type WiringResult,
} from "../../wiring/exercises";
import { useProject } from "../../store/projectStore";

const COLORS: WireColor[] = ["red", "blue", "green", "black"];
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

export default function WiringLab() {
  const setSection = useProject((s) => s.setSection);

  const [exIdx, setExIdx] = useState(0);
  const [wires, setWires] = useState<StudentWire[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [color, setColor] = useState<WireColor>("red");
  const [result, setResult] = useState<WiringResult | null>(null);

  const ex = WIRING_EXERCISES[exIdx];
  const termById = useMemo(() => {
    const m: Record<string, (typeof ex.terminals)[number]> = {};
    for (const t of ex.terminals) m[t.id] = t;
    return m;
  }, [ex]);

  const loadExercise = (idx: number) => {
    setExIdx(idx);
    setWires([]);
    setPending(null);
    setResult(null);
  };

  const clickTerminal = (id: string) => {
    setResult(null);
    if (pending === null) {
      setPending(id);
      return;
    }
    if (pending === id) {
      setPending(null);
      return;
    }
    const k = pairKey(pending, id);
    setWires((ws) => {
      const without = ws.filter((w) => pairKey(w.a, w.b) !== k);
      return [...without, { a: pending, b: id, color }];
    });
    setPending(null);
  };

  const removeWire = (a: string, b: string) => {
    setResult(null);
    const k = pairKey(a, b);
    setWires((ws) => ws.filter((w) => pairKey(w.a, w.b) !== k));
  };

  const check = () => setResult(gradeWiring(ex, wires));

  return (
    <div className="flex h-screen flex-col bg-ink text-gray-200">
      {/* header */}
      <header className="flex items-center gap-3 border-b border-amber-900/60 bg-[#1a1407] px-4 py-2">
        <button onClick={() => setSection("hub")} className="rounded border border-[#30363D] px-2 py-1 text-xs text-gray-300 hover:border-amber-500">
          ← Home
        </button>
        <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-500 text-sm font-bold text-black">⎓</div>
        <span className="font-semibold text-gray-100">Wiring Tutor</span>
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">DIN-rail lab</span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr]">
        {/* left: exercise list + brief */}
        <aside className="min-h-0 overflow-auto border-r border-[#21262D] bg-[#0D1117] p-3">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">Exercises</div>
          <div className="space-y-1">
            {WIRING_EXERCISES.map((e, i) => (
              <button
                key={e.id}
                onClick={() => loadExercise(i)}
                className={`block w-full rounded border px-2 py-1.5 text-left text-[12px] ${
                  i === exIdx ? "border-amber-500 bg-amber-500/10 text-amber-200" : "border-[#21262D] text-gray-300 hover:border-[#30363D]"
                }`}
              >
                {i + 1}. {e.title}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded border border-[#21262D] bg-[#0F141B] p-2">
            <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">Task</div>
            <p className="text-[12px] leading-relaxed text-gray-300" dangerouslySetInnerHTML={{ __html: mdInline(ex.brief) }} />
          </div>

          <div className="mt-3 text-[10px] text-gray-500">
            Click a terminal, then another, to lay a wire in the selected colour. Click a wire to remove it.
          </div>
        </aside>

        {/* right: canvas + controls */}
        <main className="flex min-h-0 flex-col">
          <div className="flex items-center gap-3 border-b border-[#21262D] bg-[#0E1116] px-4 py-2">
            <span className="text-[11px] text-gray-500">Wire colour:</span>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={COLOR_LABEL[c]}
                className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] ${
                  color === c ? "border-gray-200" : "border-transparent hover:border-[#30363D]"
                }`}
              >
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLOR_HEX[c] }} />
                {COLOR_LABEL[c]}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <button onClick={() => loadExercise(exIdx)} className="rounded border border-[#30363D] px-3 py-1 text-[12px] text-gray-300 hover:border-fault hover:text-fault">
                ↺ Reset
              </button>
              <button onClick={check} className="rounded bg-amber-500 px-3 py-1 text-[12px] font-semibold text-black hover:brightness-110">
                ✓ Check wiring
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            <svg viewBox="0 0 600 360" className="w-full max-w-3xl rounded-lg border border-black/40 bg-[#11151b]" data-testid="wiring-canvas">
              {/* rails backdrop */}
              <rect x={500} y={20} width={4} height={320} fill="#2d343d" />
              <rect x={56} y={20} width={4} height={320} fill="#2d343d" />

              {/* wires */}
              {wires.map((w, i) => {
                const a = termById[w.a];
                const b = termById[w.b];
                if (!a || !b) return null;
                return (
                  <g key={i} onClick={() => removeWire(w.a, w.b)} style={{ cursor: "pointer" }}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12} />
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={COLOR_HEX[w.color]} strokeWidth={2.5} />
                  </g>
                );
              })}

              {/* terminals */}
              {ex.terminals.map((t) => {
                const onLeft = t.x < 300;
                return (
                  <g key={t.id} onClick={() => clickTerminal(t.id)} style={{ cursor: "pointer" }} data-term={t.id}>
                    <circle
                      cx={t.x}
                      cy={t.y}
                      r={7}
                      fill={pending === t.id ? "#F59E0B" : "#1b2027"}
                      stroke={pending === t.id ? "#FCD34D" : "#6B7280"}
                      strokeWidth={2}
                    />
                    <text
                      x={onLeft ? t.x + 13 : t.x - 13}
                      y={t.y + 3.5}
                      fontSize={11}
                      fontFamily="JetBrains Mono, monospace"
                      fill="#C9D1D9"
                      textAnchor={onLeft ? "start" : "end"}
                    >
                      {t.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* result */}
            {result && (
              <div className="mt-3 max-w-3xl">
                {result.correct ? (
                  <div className="rounded border border-safe/40 bg-safe/10 px-3 py-2 text-sm font-bold text-safe" data-testid="wiring-result">
                    ✓ Wiring correct — continuity verified, colours and 0 V / PE returns all present.
                  </div>
                ) : (
                  <div className="rounded border border-fault/40 bg-fault/10 px-3 py-2" data-testid="wiring-result">
                    <div className="mb-1 text-sm font-bold text-fault">{result.faults.length} issue{result.faults.length === 1 ? "" : "s"} found</div>
                    <ul className="space-y-1 text-[12px] text-gray-200">
                      {result.faults.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-fault">✗</span>
                          <span>{f.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function mdInline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-100">$1</strong>');
}
