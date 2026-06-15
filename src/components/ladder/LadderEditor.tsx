import { useMemo } from "react";
import { findInstr } from "../../engine/ladder";
import type { InstrKind } from "../../engine/types";
import { useSim } from "../../store/simulatorStore";
import { PaletteGlyph } from "../sandbox/symbols";
import RungView, { LADDER_DRAG_MIME } from "./RungView";

const GROUPS: { label: string; kinds: InstrKind[] }[] = [
  { label: "Bit", kinds: ["XIC", "XIO", "ONS", "OTE", "OTL", "OTU"] },
  { label: "Timer/Counter", kinds: ["TON", "TOF", "RTO", "CTU", "CTD", "RES"] },
  { label: "Compare", kinds: ["EQU", "NEQ", "LES", "LEQ", "GRT", "GEQ", "LIM"] },
  { label: "Math", kinds: ["ADD", "SUB", "MUL", "DIV", "MOD", "SQR", "ABS", "NEG", "MOV", "CLR"] },
  { label: "BCD", kinds: ["TOD", "FRD"] },
  { label: "Analog", kinds: ["SCP", "SCL"] },
  { label: "Application", kinds: ["PID"] },
];

export default function LadderEditor() {
  const program = useSim((s) => s.program);
  const rungEnergised = useSim((s) => s.rungEnergised);
  const tags = useSim((s) => s.tags);
  const selectedId = useSim((s) => s.selectedId);
  const spanAnchorId = useSim((s) => s.spanAnchorId);
  const scenario = useSim((s) => s.scenario);

  const selectInstr = useSim((s) => s.selectInstr);
  const insertActive = useSim((s) => s.insertActive);
  const insertTrunk = useSim((s) => s.insertTrunk);
  const insertLeg = useSim((s) => s.insertLeg);
  const branch = useSim((s) => s.branch);
  const addLeg = useSim((s) => s.addLeg);
  const wrapSpan = useSim((s) => s.wrapSpan);
  const removeInstr = useSim((s) => s.removeInstr);
  const replaceInstr = useSim((s) => s.replaceInstr);
  const editInstr = useSim((s) => s.editInstr);
  const addRung = useSim((s) => s.addRung);
  const deleteRung = useSim((s) => s.deleteRung);

  const tagNames = useMemo(() => Object.keys(scenario.tags), [scenario.tags]);
  const sel = useMemo(() => (selectedId ? findInstr(program, selectedId) : null), [selectedId, program]);
  const selAddr = useSim((s) => s.selAddr);
  const inParallel = selAddr?.legIndex !== undefined;

  return (
    <div className="flex h-full flex-col">
      {/* palette */}
      <div className="border-b border-[#21262D] bg-[#0F141B] px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {GROUPS.map((g) => (
            <div key={g.label} className="flex items-center gap-1">
              <span className="mr-1 text-[10px] uppercase tracking-wide text-gray-500">{g.label}</span>
              {g.kinds.map((k) => (
                <button
                  key={k}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(LADDER_DRAG_MIME, k);
                    e.dataTransfer.setData("text/plain", k);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => insertActive(k)}
                  className="flex cursor-grab items-center gap-1 rounded border border-[#30363D] bg-[#161B22] px-1.5 py-1 font-mono text-[11px] text-gray-200 hover:border-sky-500 hover:text-sky-300 active:cursor-grabbing"
                  title={`Insert ${k} — drag onto a rung or click to add to the selection`}
                >
                  <PaletteGlyph kind={k} />
                  {k}
                </button>
              ))}
            </div>
          ))}
          <button onClick={addRung} className="ml-auto rounded bg-[#1F6FEB] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#388BFD]">
            + Rung
          </button>
        </div>
      </div>

      {/* canvas */}
      <div className="flex-1 overflow-auto bg-[#0A0D12] p-3">
        <RungView
          program={program}
          rungEnergised={rungEnergised}
          tags={tags}
          selectedId={selectedId}
          spanAnchorId={spanAnchorId}
          onSelect={(addr, id, shift) => selectInstr(addr, id, shift)}
          onInsertTrunk={insertTrunk}
          onInsertLeg={insertLeg}
          onReplace={(_rungId, id, kind) => replaceInstr(id, kind)}
          onBranch={branch}
          onDeleteRung={deleteRung}
        />
      </div>

      {/* inspector */}
      <div className="border-t border-[#21262D] bg-[#0F141B] px-3 py-2">
        {sel ? (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Instruction</div>
              <div className="font-mono text-sm text-sky-300">{sel.instr.kind}</div>
            </div>
            {needsTag(sel.instr.kind) && (
              <Operand label="Operand / Tag" value={sel.instr.tag ?? ""} onCommit={(v) => editInstr(sel.instr.id, { tag: v })} />
            )}
            {needsSourceA(sel.instr.kind) && (
              <Operand label="Source" value={sel.instr.a ?? ""} onCommit={(v) => editInstr(sel.instr.id, { a: v })} />
            )}
            {needsAB(sel.instr.kind) && (
              <>
                <Operand label={opLabel(sel.instr.kind, "a")} value={sel.instr.a ?? ""} onCommit={(v) => editInstr(sel.instr.id, { a: v })} />
                <Operand label={opLabel(sel.instr.kind, "b")} value={sel.instr.b ?? ""} onCommit={(v) => editInstr(sel.instr.id, { b: v })} />
              </>
            )}
            {needsC(sel.instr.kind) && (
              <Operand label={opLabel(sel.instr.kind, "c")} value={sel.instr.c ?? ""} onCommit={(v) => editInstr(sel.instr.id, { c: v })} />
            )}
            {needsDE(sel.instr.kind) && (
              <>
                <Operand label={opLabel(sel.instr.kind, "d")} value={sel.instr.d ?? ""} onCommit={(v) => editInstr(sel.instr.id, { d: v })} />
                <Operand label={opLabel(sel.instr.kind, "e")} value={sel.instr.e ?? ""} onCommit={(v) => editInstr(sel.instr.id, { e: v })} />
              </>
            )}

            <div className="ml-auto flex items-center gap-2">
              {spanAnchorId && spanAnchorId !== selectedId ? (
                <button onClick={wrapSpan} className="rounded border border-violet-500/60 px-2.5 py-1 text-[11px] text-violet-300 hover:bg-violet-500/10">
                  ⎇ Wrap span in branch
                </button>
              ) : (
                <button
                  onClick={() => branch(sel.rungId, sel.elementIndex)}
                  className="rounded border border-[#30363D] px-2.5 py-1 text-[11px] text-gray-200 hover:border-sky-500 hover:text-sky-300"
                  title="Add an OR branch (Shift-click two elements to branch a group)"
                >
                  ⎇ Branch (OR)
                </button>
              )}
              {inParallel && (
                <button onClick={() => addLeg(sel.rungId, sel.elementIndex)} className="rounded border border-[#30363D] px-2.5 py-1 text-[11px] text-gray-200 hover:border-sky-500 hover:text-sky-300">
                  + Leg
                </button>
              )}
              <button onClick={() => removeInstr(sel.instr.id)} className="rounded border border-[#30363D] px-2.5 py-1 text-[11px] text-gray-300 hover:border-fault hover:text-fault">
                ✕ Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-gray-500">
            Click an instruction to edit it. Drag from the palette onto the orange slots (trunk or branch leg). Hit
            <span className="text-gray-300"> ⎇ OR</span> under an element to branch it, or Shift-click two elements then “Wrap span”.
          </div>
        )}
        <datalist id="plc-addrs">
          {tagNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

function Operand({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  return (
    <label className="flex flex-col text-[10px] uppercase tracking-wide text-gray-500">
      {label}
      <input
        list="plc-addrs"
        defaultValue={value}
        key={label + value}
        onBlur={(e) => onCommit(e.target.value)}
        className="mt-0.5 w-28 rounded border border-[#30363D] bg-[#161B22] px-2 py-1 font-mono text-xs text-gray-100 normal-case"
      />
    </label>
  );
}

const needsTag = (k: InstrKind) =>
  ["XIC", "XIO", "ONS", "OTE", "OTL", "OTU", "TON", "TOF", "RTO", "CTU", "CTD", "RES", "MOV", "CLR", "SQR", "ABS", "NEG", "TOD", "FRD", "SCP", "SCL", "PID"].includes(k);
const needsSourceA = (k: InstrKind) => ["MOV", "SQR", "ABS", "NEG", "TOD", "FRD"].includes(k);
const needsAB = (k: InstrKind) =>
  ["EQU", "NEQ", "LES", "LEQ", "GRT", "GEQ", "LIM", "ADD", "SUB", "MUL", "DIV", "MOD", "SCP", "SCL", "PID"].includes(k);
const needsC = (k: InstrKind) => ["ADD", "SUB", "MUL", "DIV", "MOD", "SCP", "LIM", "PID"].includes(k);
const needsDE = (k: InstrKind) => ["SCP", "SCL", "PID"].includes(k);

function opLabel(k: InstrKind, slot: "a" | "b" | "c" | "d" | "e"): string {
  if (k === "SCP") return { a: "Input", b: "In Min", c: "In Max", d: "Out Min", e: "Out Max" }[slot];
  if (k === "SCL") return { a: "Input", b: "—", c: "—", d: "Rate /10000", e: "Offset" }[slot];
  if (k === "LIM") return { a: "Low Lim", b: "Test", c: "High Lim", d: "", e: "" }[slot];
  if (k === "PID") return { a: "PV", b: "SP", c: "Kp", d: "Ki", e: "Kd" }[slot];
  if (["ADD", "SUB", "MUL", "DIV", "MOD"].includes(k)) return { a: "Source A", b: "Source B", c: "Dest", d: "", e: "" }[slot];
  return { a: "A", b: "B", c: "C", d: "D", e: "E" }[slot];
}
