import { useEffect } from "react";
import { useProject } from "../../store/projectStore";
import RungView from "../ladder/RungView";

export default function LadderProgram() {
  const program = useProject((s) => s.project?.program);
  const tags = useProject((s) => s.tags);
  const rungEnergised = useProject((s) => s.rungEnergised);
  const selectedInstrId = useProject((s) => s.selectedInstrId);
  const spanAnchorId = useProject((s) => s.spanAnchorId);

  const addRung = useProject((s) => s.addRung);
  const deleteRung = useProject((s) => s.deleteRung);
  const selectInstr = useProject((s) => s.selectInstr);
  const insertTrunk = useProject((s) => s.insertTrunk);
  const insertLeg = useProject((s) => s.insertLeg);
  const branch = useProject((s) => s.branch);
  const replaceInstr = useProject((s) => s.replaceInstr);
  const deleteSelected = useProject((s) => s.deleteSelected);

  // Delete / Backspace removes the selected instruction (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if (typing) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedInstrId) {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === "Escape") selectInstr(null, null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedInstrId, deleteSelected, selectInstr]);

  if (!program) return null;

  return (
    <div className="flex h-full flex-col bg-[#0A0D12]">
      <div className="flex-1 overflow-auto p-2">
        <RungView
          program={program}
          tags={tags}
          rungEnergised={rungEnergised}
          selectedId={selectedInstrId}
          spanAnchorId={spanAnchorId}
          onSelect={(addr, id, shift) => selectInstr(addr, id, shift)}
          onInsertTrunk={insertTrunk}
          onInsertLeg={insertLeg}
          onReplace={(_rungId, id, kind) => replaceInstr(id, kind)}
          onBranch={branch}
          onDeleteRung={deleteRung}
        />
        <button
          onClick={addRung}
          className="mt-2 w-full rounded border border-dashed border-[#30363D] py-2 text-xs text-gray-500 hover:border-energised hover:text-energised"
        >
          + Add Rung
        </button>
      </div>
    </div>
  );
}
