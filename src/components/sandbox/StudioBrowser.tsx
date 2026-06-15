import { useEffect, useState } from "react";
import type { ProjectFile } from "../../sandbox/project";
import { useProject } from "../../store/projectStore";

/** File browser for the Simulation Studio — create / open / import saved programs. */
export default function StudioBrowser() {
  const projects = useProject((s) => s.projects);
  const refresh = useProject((s) => s.refreshProjects);
  const create = useProject((s) => s.createFile);
  const open = useProject((s) => s.openFile);
  const remove = useProject((s) => s.removeFile);
  const importFile = useProject((s) => s.importFile);
  const fileError = useProject((s) => s.fileError);
  const setSection = useProject((s) => s.setSection);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then((txt) => {
      try {
        importFile(JSON.parse(txt) as ProjectFile);
      } catch {
        /* ignore malformed */
      }
    });
    e.target.value = "";
  };

  return (
    <div className="min-h-screen bg-ink">
      <header className="flex items-center justify-between border-b border-[#21262D] bg-[#0F141B] px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setSection("hub")} className="rounded border border-[#30363D] px-2 py-1 text-xs text-gray-300 hover:border-energised">
            ← Home
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded bg-energised font-bold text-black">V</div>
          <div>
            <div className="font-semibold text-gray-100">Simulation Studio</div>
            <div className="text-[10px] text-gray-500">Free PLC sandbox</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="mb-1 text-xl font-semibold text-gray-100">Your PLC files</h1>
        <p className="mb-6 text-sm text-gray-500">Create a new program or open a saved one. Pure sandbox — build whatever you like.</p>

        <div className="mb-6 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New file name…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                create(newName);
                setNewName("");
              }
            }}
            className="flex-1 rounded border border-[#30363D] bg-[#0D1117] px-3 py-2 text-sm text-gray-100"
          />
          <button
            onClick={() => {
              create(newName || "Untitled");
              setNewName("");
            }}
            className="rounded bg-energised px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
          >
            + New File
          </button>
          <label className="cursor-pointer rounded border border-[#30363D] px-4 py-2 text-sm text-gray-300 hover:border-energised">
            Import
            <input type="file" accept=".json" className="hidden" onChange={onImport} />
          </label>
        </div>

        {fileError && <div className="mb-4 rounded border border-fault/40 bg-fault/10 px-3 py-2 text-xs text-fault">{fileError}</div>}

        <div className="divide-y divide-[#21262D] rounded-lg border border-[#21262D]">
          {projects.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-600">No files yet — create your first one above.</div>
          )}
          {projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-[#0F141B]">
              <button onClick={() => open(p.id)} className="flex-1 text-left">
                <div className="text-sm font-medium text-gray-100">{p.name}</div>
                <div className="text-[11px] text-gray-500">
                  {p.program.rungs.length} rungs · {new Date(p.updatedAt).toLocaleString()}
                </div>
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => open(p.id)} className="text-sm text-energised hover:underline">
                  Open
                </button>
                <button onClick={() => remove(p.id)} className="text-sm text-gray-600 hover:text-fault">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
