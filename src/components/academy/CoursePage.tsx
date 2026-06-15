import { useEffect } from "react";
import IOChassis from "../chassis/IOChassis";
import LadderEditor from "../ladder/LadderEditor";
import ProcessView from "../process/ProcessView";
import ScenarioPanel from "../ScenarioPanel";
import TagWatch from "../TagWatch";
import VoltaPanel from "./VoltaPanel";
import { useSim } from "../../store/simulatorStore";
import { useProject } from "../../store/projectStore";

/**
 * VoltRung Academy — the guided coursework workspace.
 * Four panes (matching the master-spec scenario layout):
 *   • Task brief + auto-grader (ScenarioPanel)
 *   • Ladder editor
 *   • I/O chassis + process view
 *   • Tag watch
 */
export default function CoursePage() {
  const setSection = useProject((s) => s.setSection);
  const user = useProject((s) => s.user);

  // Sim controls live in the (separate) simulator store.
  const isRunning = useSim((s) => s.running);
  const scanMs = useSim((s) => s.scanMs);
  const scanTimeMs = useSim((s) => s.scanTimeMs);
  const run = useSim((s) => s.run);
  const stop = useSim((s) => s.stop);
  const step = useSim((s) => s.step);
  const reset = useSim((s) => s.reset);
  const setScanMs = useSim((s) => s.setScanMs);

  // Stop the scan loop when leaving the Academy so it doesn't run in the background.
  useEffect(() => () => stop(), [stop]);

  return (
    <div className="flex h-screen flex-col bg-ink text-gray-200">
      {/* Academy header — distinct sky identity */}
      <header className="flex items-center gap-3 border-b border-sky-900/60 bg-[#0E1622] px-4 py-2">
        <button onClick={() => setSection("hub")} className="rounded border border-[#30363D] px-2 py-1 text-xs text-gray-300 hover:border-sky-500">
          ← Home
        </button>
        <div className="flex h-6 w-6 items-center justify-center rounded bg-sky-500 text-sm font-bold text-black">🎓</div>
        <span className="font-semibold text-gray-100">VoltRung Academy</span>
        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">coursework</span>

        <div className="mx-3 h-5 w-px bg-[#21262D]" />

        <button
          onClick={isRunning ? stop : run}
          className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm font-semibold ${isRunning ? "bg-fault text-white" : "bg-safe text-black"} hover:brightness-110`}
        >
          {isRunning ? "■ Stop" : "▶ Start"}
        </button>
        <button onClick={step} disabled={isRunning} className="rounded border border-[#30363D] px-3 py-1 text-sm text-gray-200 hover:border-sky-500 disabled:opacity-40">
          ⏭ Step
        </button>
        <button onClick={reset} className="rounded border border-[#30363D] px-3 py-1 text-sm text-gray-200 hover:border-sky-500">
          ↺ Reset
        </button>

        <div className="mx-3 h-5 w-px bg-[#21262D]" />
        <label className="flex items-center gap-2 text-xs text-gray-400">
          Scan
          <input type="range" min={1} max={500} value={scanMs} onChange={(e) => setScanMs(Number(e.target.value))} className="accent-sky-500" />
          <span className="w-12 font-mono text-gray-200">{scanMs} ms</span>
        </label>

        <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-gray-400">
          <span className={`flex items-center gap-1 ${isRunning ? "text-safe" : "text-gray-500"}`}>
            <span className={`led ${isRunning ? "led-green-on" : "led-off"}`} />
            {isRunning ? "RUN" : "IDLE"}
          </span>
          <span>exec {scanTimeMs.toFixed(3)} ms</span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-400">{user?.name}</span>
        </div>
      </header>

      {/* Four-pane workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-[300px_1fr_360px]">
        <section className="flex min-h-0 flex-col overflow-auto border-r border-[#21262D] bg-[#0D1117]">
          <div className="min-h-0 flex-1">
            <ScenarioPanel />
          </div>
          <VoltaPanel />
        </section>

        <section className="min-h-0 border-r border-[#21262D]">
          <LadderEditor />
        </section>

        <section className="grid min-h-0 grid-rows-[1fr_220px]">
          <div className="min-h-0 overflow-auto p-2">
            <ProcessView />
            <IOChassis />
          </div>
          <div className="min-h-0 border-t border-[#21262D]">
            <TagWatch />
          </div>
        </section>
      </div>
    </div>
  );
}
