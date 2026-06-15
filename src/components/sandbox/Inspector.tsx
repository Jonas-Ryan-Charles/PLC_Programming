import { useMemo } from "react";
import { findInstr } from "../../engine/ladder";
import type { CounterVal, Instruction, InstrKind, TimerVal } from "../../engine/types";
import { ALL_ADDRS } from "../../sandbox/project";
import { useProject } from "../../store/projectStore";

export default function Inspector() {
  const program = useProject((s) => s.project?.program);
  const tags = useProject((s) => s.tags);
  const selectedInstrId = useProject((s) => s.selectedInstrId);
  const selAddr = useProject((s) => s.selAddr);
  const spanAnchorId = useProject((s) => s.spanAnchorId);
  const editInstr = useProject((s) => s.editInstr);
  const branch = useProject((s) => s.branch);
  const addLeg = useProject((s) => s.addLeg);
  const wrapSpan = useProject((s) => s.wrapSpan);
  const removeInstr = useProject((s) => s.removeInstr);
  const setPreset = useProject((s) => s.setPreset);

  const addr = useMemo(
    () => (program && selectedInstrId ? findInstr(program, selectedInstrId) : null),
    [program, selectedInstrId],
  );

  if (!addr) {
    return (
      <div className="border-t border-[#21262D] bg-[#0F141B] px-3 py-2 text-[11px] text-gray-500">
        Click an instruction to edit it. Drag from the palette onto a rung — drop on the orange slots to
        place it on the trunk or inside a branch leg. Hit <span className="text-gray-300">⎇ OR</span> under an
        element to branch it, or <kbd className="rounded bg-[#21262D] px-1">Shift</kbd>-click a second element
        then “Wrap span”.
      </div>
    );
  }

  const instr = addr.instr;
  const selTag = instr.tag ? tags[instr.tag] : undefined;
  const inParallel = selAddr?.legIndex !== undefined;

  return (
    <div className="border-t border-[#21262D] bg-[#0F141B] px-3 py-2">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Instruction</div>
          <div className="font-mono text-sm text-energised">{instr.kind}</div>
        </div>

        {needsTag(instr.kind) && (
          <Operand label={tagLabel(instr.kind)} value={instr.tag ?? ""} onCommit={(v) => editInstr(instr.id, { tag: v })} />
        )}
        {needsSourceA(instr.kind) && (
          <Operand label="Source" value={instr.a ?? ""} onCommit={(v) => editInstr(instr.id, { a: v })} />
        )}
        {needsAB(instr.kind) && (
          <>
            <Operand label={opLabel(instr.kind, "a")} value={instr.a ?? ""} onCommit={(v) => editInstr(instr.id, { a: v })} />
            <Operand label={opLabel(instr.kind, "b")} value={instr.b ?? ""} onCommit={(v) => editInstr(instr.id, { b: v })} />
          </>
        )}
        {needsC(instr.kind) && (
          <Operand label={opLabel(instr.kind, "c")} value={instr.c ?? ""} onCommit={(v) => editInstr(instr.id, { c: v })} />
        )}
        {needsDE(instr.kind) && (
          <>
            <Operand label={opLabel(instr.kind, "d")} value={instr.d ?? ""} onCommit={(v) => editInstr(instr.id, { d: v })} />
            <Operand label={opLabel(instr.kind, "e")} value={instr.e ?? ""} onCommit={(v) => editInstr(instr.id, { e: v })} />
          </>
        )}

        {selTag && (selTag.type === "TIMER" || selTag.type === "COUNTER") && (
          <label className="flex flex-col text-[10px] uppercase tracking-wide text-gray-500">
            Preset {selTag.type === "TIMER" ? "(ms)" : "(count)"}
            <input
              type="number"
              defaultValue={selTag.type === "TIMER" ? (selTag.value as TimerVal).pre : (selTag.value as CounterVal).pre}
              key={instr.tag! + "pre"}
              onBlur={(e) => setPreset(instr.tag!, Number(e.target.value) || 0)}
              className="mt-0.5 w-24 rounded border border-[#30363D] bg-[#161B22] px-2 py-1 font-mono text-xs text-gray-100 normal-case"
            />
          </label>
        )}

        <div className="ml-auto flex items-center gap-2">
          {spanAnchorId && spanAnchorId !== selectedInstrId ? (
            <button
              onClick={wrapSpan}
              className="rounded border border-violet-500/60 px-2.5 py-1 text-[11px] text-violet-300 hover:bg-violet-500/10"
              title="Wrap the highlighted span of elements in one OR branch"
            >
              ⎇ Wrap span in branch
            </button>
          ) : (
            <button
              onClick={() => addr && branch(addr.rungId, addr.elementIndex)}
              className="rounded border border-[#30363D] px-2.5 py-1 text-[11px] text-gray-200 hover:border-energised hover:text-energised"
              title="Add an OR branch around this element (Shift-click two elements to branch a group)"
            >
              ⎇ Branch (OR)
            </button>
          )}
          {inParallel && (
            <button
              onClick={() => addr && addLeg(addr.rungId, addr.elementIndex)}
              className="rounded border border-[#30363D] px-2.5 py-1 text-[11px] text-gray-200 hover:border-energised hover:text-energised"
              title="Add another parallel leg to this branch"
            >
              + Leg
            </button>
          )}
          <button
            onClick={() => removeInstr(instr.id)}
            className="rounded border border-[#30363D] px-2.5 py-1 text-[11px] text-gray-300 hover:border-fault hover:text-fault"
          >
            ✕ Delete (Del)
          </button>
        </div>
      </div>

      <datalist id="plc-addrs">
        {ALL_ADDRS().map((a) => (
          <option key={a} value={a}>
            {tags[a]?.comment ?? ""}
          </option>
        ))}
      </datalist>
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
        className="mt-0.5 w-32 rounded border border-[#30363D] bg-[#161B22] px-2 py-1 font-mono text-xs text-gray-100 normal-case"
        placeholder="address or literal"
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

function tagLabel(k: InstrKind): string {
  if (["OTE", "OTL", "OTU"].includes(k)) return "Coil address";
  if (["TON", "TOF", "RTO"].includes(k)) return "Timer";
  if (["CTU", "CTD"].includes(k)) return "Counter";
  if (k === "RES") return "Timer/Counter";
  if (k === "PID") return "CV (output)";
  if (["MOV", "CLR", "TOD", "FRD", "SCP", "SCL"].includes(k)) return "Destination";
  return "Address";
}

function opLabel(k: InstrKind, slot: "a" | "b" | "c" | "d" | "e"): string {
  if (k === "SCP") return { a: "Input", b: "In Min", c: "In Max", d: "Out Min", e: "Out Max" }[slot];
  if (k === "SCL") return { a: "Input", b: "—", c: "—", d: "Rate /10000", e: "Offset" }[slot];
  if (k === "LIM") return { a: "Low Lim", b: "Test", c: "High Lim", d: "", e: "" }[slot];
  if (k === "PID") return { a: "PV", b: "SP", c: "Kp", d: "Ki", e: "Kd" }[slot];
  if (["ADD", "SUB", "MUL", "DIV", "MOD"].includes(k)) return { a: "Source A", b: "Source B", c: "Dest", d: "", e: "" }[slot];
  return { a: "A", b: "B", c: "C", d: "D", e: "E" }[slot];
}

export type { Instruction };
