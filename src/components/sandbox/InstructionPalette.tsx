import type { InstrKind } from "../../engine/types";
import { useProject } from "../../store/projectStore";
import { PaletteGlyph } from "./symbols";

export const DRAG_MIME = "application/x-plc-instr";

interface Group {
  label: string;
  items: { kind: InstrKind; name: string }[];
}

const GROUPS: Group[] = [
  {
    label: "Contacts",
    items: [
      { kind: "XIC", name: "Examine If Closed (NO)" },
      { kind: "XIO", name: "Examine If Open (NC)" },
      { kind: "ONS", name: "One-Shot Rising" },
    ],
  },
  {
    label: "Coils",
    items: [
      { kind: "OTE", name: "Output Energise" },
      { kind: "OTL", name: "Output Latch (Set)" },
      { kind: "OTU", name: "Output Unlatch (Reset)" },
    ],
  },
  {
    label: "Timers / Counters",
    items: [
      { kind: "TON", name: "Timer On-Delay" },
      { kind: "TOF", name: "Timer Off-Delay" },
      { kind: "RTO", name: "Retentive Timer" },
      { kind: "CTU", name: "Count Up" },
      { kind: "CTD", name: "Count Down" },
      { kind: "RES", name: "Reset Timer/Counter" },
    ],
  },
  {
    label: "Compare",
    items: [
      { kind: "EQU", name: "Equal" },
      { kind: "NEQ", name: "Not Equal" },
      { kind: "LES", name: "Less Than" },
      { kind: "LEQ", name: "Less or Equal" },
      { kind: "GRT", name: "Greater Than" },
      { kind: "GEQ", name: "Greater or Equal" },
      { kind: "LIM", name: "Limit Test" },
    ],
  },
  {
    label: "Math / Move",
    items: [
      { kind: "ADD", name: "Add" },
      { kind: "SUB", name: "Subtract" },
      { kind: "MUL", name: "Multiply" },
      { kind: "DIV", name: "Divide" },
      { kind: "MOD", name: "Modulo" },
      { kind: "SQR", name: "Square Root" },
      { kind: "ABS", name: "Absolute Value" },
      { kind: "NEG", name: "Negate" },
      { kind: "MOV", name: "Move" },
      { kind: "CLR", name: "Clear" },
    ],
  },
  {
    label: "BCD Convert",
    items: [
      { kind: "TOD", name: "To BCD (→ 7-seg)" },
      { kind: "FRD", name: "From BCD (thumbwheel →)" },
    ],
  },
  {
    label: "Analog Scaling",
    items: [
      { kind: "SCP", name: "Scale w/ Parameters" },
      { kind: "SCL", name: "Scale (linear)" },
    ],
  },
  {
    label: "Application",
    items: [{ kind: "PID", name: "PID Controller" }],
  },
];

export default function InstructionPalette() {
  const insertActive = useProject((s) => s.insertActive);

  const onClick = (kind: InstrKind) => insertActive(kind);

  return (
    <div className="flex h-full flex-col overflow-auto bg-[#0D1117]">
      <div className="border-b border-[#21262D] px-3 py-2">
        <div className="text-xs font-semibold text-gray-200">Instruction Palette</div>
        <div className="text-[10px] text-gray-500">Drag onto any rung — or click to add to the active rung.</div>
      </div>
      <div className="flex-1 space-y-1 px-2 py-2">
        {GROUPS.map((g) => (
          <div key={g.label} className="mb-2">
            <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {g.label}
            </div>
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <button
                  key={it.kind}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_MIME, it.kind);
                    e.dataTransfer.setData("text/plain", it.kind);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onClick(it.kind)}
                  title={it.name}
                  className="flex w-full cursor-grab items-center gap-2 rounded border border-transparent px-2 py-1 text-left hover:border-[#30363D] hover:bg-[#161B22] active:cursor-grabbing"
                >
                  <span className="flex h-6 w-9 shrink-0 items-center justify-center rounded bg-[#0A0D12]">
                    <PaletteGlyph kind={it.kind} />
                  </span>
                  <span className="font-mono text-[11px] font-bold text-gray-200">{it.kind}</span>
                  <span className="truncate text-[10px] text-gray-500">{it.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
