import { useProject } from "../../store/projectStore";

export default function WorkspaceToolbar() {
  const project = useProject((s) => s.project);
  const running = useProject((s) => s.running);
  const scanMs = useProject((s) => s.scanMs);
  const scanTimeMs = useProject((s) => s.scanTimeMs);
  const dirty = useProject((s) => s.dirty);
  const saving = useProject((s) => s.saving);
  const fileError = useProject((s) => s.fileError);

  const run = useProject((s) => s.run);
  const stop = useProject((s) => s.stop);
  const step = useProject((s) => s.step);
  const reset = useProject((s) => s.reset);
  const setScanMs = useProject((s) => s.setScanMs);
  const save = useProject((s) => s.saveFile);
  const close = useProject((s) => s.closeFile);
  const rename = useProject((s) => s.renameFile);
  const exportFile = useProject((s) => s.exportFile);

  if (!project) return null;

  return (
    <header className="flex items-center gap-2 border-b border-[#21262D] bg-[#0F141B] px-3 py-2">
      <button onClick={close} className="rounded border border-[#30363D] px-2 py-1 text-xs text-gray-300 hover:border-energised" title="Back to files">
        ← Files
      </button>
      <div className="flex h-6 w-6 items-center justify-center rounded bg-energised text-xs font-bold text-black">V</div>
      <input
        value={project.name}
        onChange={(e) => rename(e.target.value)}
        className="w-48 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-gray-100 hover:border-[#30363D] focus:border-[#30363D]"
      />
      <button
        onClick={save}
        disabled={saving}
        title={fileError ?? undefined}
        className={`rounded px-3 py-1 text-sm font-medium disabled:opacity-60 ${
          fileError ? "bg-fault text-white" : dirty ? "bg-[#1F6FEB] text-white" : "border border-[#30363D] text-gray-400"
        }`}
      >
        {saving ? "Saving…" : fileError ? "⚠ Retry save" : dirty ? "● Save" : "Saved"}
      </button>
      <button onClick={exportFile} className="rounded border border-[#30363D] px-2 py-1 text-xs text-gray-300 hover:border-energised">
        Export
      </button>

      <div className="mx-2 h-5 w-px bg-[#21262D]" />

      <button
        onClick={running ? stop : run}
        className={`rounded px-3 py-1 text-sm font-semibold ${running ? "bg-fault text-white" : "bg-safe text-black"} hover:brightness-110`}
      >
        {running ? "■ Stop" : "▶ Run"}
      </button>
      <button onClick={step} disabled={running} className="rounded border border-[#30363D] px-3 py-1 text-sm text-gray-200 hover:border-energised disabled:opacity-40">
        ⏭ Step
      </button>
      <button onClick={reset} className="rounded border border-[#30363D] px-3 py-1 text-sm text-gray-200 hover:border-energised">
        ↺ Reset
      </button>

      <div className="mx-2 h-5 w-px bg-[#21262D]" />
      <label className="flex items-center gap-2 text-xs text-gray-400">
        Scan
        <input type="range" min={1} max={500} value={scanMs} onChange={(e) => setScanMs(Number(e.target.value))} className="accent-energised" />
        <span className="w-12 font-mono text-gray-200">{scanMs}ms</span>
      </label>

      <div className="ml-auto flex items-center gap-3 font-mono text-[11px] text-gray-400">
        <span className={`flex items-center gap-1 ${running ? "text-safe" : "text-gray-500"}`}>
          <span className={`led ${running ? "led-green-on" : "led-off"}`} />
          {running ? "RUN" : "IDLE"}
        </span>
        <span>exec {scanTimeMs.toFixed(3)}ms</span>
      </div>
    </header>
  );
}
