import { useSim } from "../store/simulatorStore";

export default function Toolbar() {
  const running = useSim((s) => s.running);
  const scanMs = useSim((s) => s.scanMs);
  const scanTimeMs = useSim((s) => s.scanTimeMs);
  const run = useSim((s) => s.run);
  const stop = useSim((s) => s.stop);
  const step = useSim((s) => s.step);
  const reset = useSim((s) => s.reset);
  const setScanMs = useSim((s) => s.setScanMs);

  return (
    <header className="flex items-center gap-3 border-b border-[#21262D] bg-[#0F141B] px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-energised font-bold text-black">
          V
        </div>
        <span className="font-semibold text-gray-100">VoltRung Academy</span>
        <span className="rounded bg-[#21262D] px-1.5 py-0.5 font-mono text-[10px] text-gray-400">
          core sim
        </span>
      </div>

      <div className="mx-3 h-5 w-px bg-[#21262D]" />

      <button
        onClick={running ? stop : run}
        className={`flex items-center gap-1.5 rounded px-3 py-1 text-sm font-semibold ${
          running ? "bg-fault text-white" : "bg-safe text-black"
        } hover:brightness-110`}
      >
        {running ? "■ Stop" : "▶ Start"}
      </button>
      <button
        onClick={step}
        disabled={running}
        className="rounded border border-[#30363D] px-3 py-1 text-sm text-gray-200 hover:border-energised disabled:opacity-40"
      >
        ⏭ Step
      </button>
      <button
        onClick={reset}
        className="rounded border border-[#30363D] px-3 py-1 text-sm text-gray-200 hover:border-energised"
      >
        ↺ Reset
      </button>

      <div className="mx-3 h-5 w-px bg-[#21262D]" />

      <label className="flex items-center gap-2 text-xs text-gray-400">
        Scan
        <input
          type="range"
          min={1}
          max={500}
          value={scanMs}
          onChange={(e) => setScanMs(Number(e.target.value))}
          className="accent-energised"
        />
        <span className="w-12 font-mono text-gray-200">{scanMs} ms</span>
      </label>

      <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-gray-400">
        <span
          className={`flex items-center gap-1 ${running ? "text-safe" : "text-gray-500"}`}
        >
          <span className={`led ${running ? "led-green-on" : "led-off"}`} />
          {running ? "RUN" : "IDLE"}
        </span>
        <span>exec {scanTimeMs.toFixed(3)} ms</span>
      </div>
    </header>
  );
}
