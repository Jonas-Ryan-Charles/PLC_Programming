import type { MouseEvent } from "react";
import type { CounterVal, Instruction, InstrKind, TagStore, TimerVal } from "../../engine/types";

const SYM = "#E6EDF3";
const SELECT = "#F97316";
const DND_MIME = "application/x-plc-instr";

const CONTACTS = new Set(["XIC", "XIO", "ONS"]);
const COILS = new Set(["OTE", "OTL", "OTU"]);

export function instrCategory(kind: string): "contact" | "coil" | "box" {
  if (CONTACTS.has(kind)) return "contact";
  if (COILS.has(kind)) return "coil";
  return "box";
}

/** Draw an instruction centred at (cx,cy) on a rung wire. */
export function drawInstr(
  instr: Instruction,
  cx: number,
  cy: number,
  tags: TagStore,
  wire: string,
  selected: boolean,
  onSelect: (e?: MouseEvent) => void,
  onDropReplace?: (kind: InstrKind) => void,
) {
  const cat = instrCategory(instr.kind);
  const sel = selected ? SELECT : SYM;
  const hit = (
    <rect
      x={cx - 56}
      y={cy - 28}
      width={112}
      height={56}
      fill={selected ? "rgba(249,115,22,0.08)" : "transparent"}
      stroke={selected ? SELECT : "transparent"}
      strokeDasharray="3 2"
      rx={4}
      style={{ cursor: "pointer" }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(e);
      }}
      onDragOver={
        onDropReplace
          ? (e) => {
              if (e.dataTransfer.types.includes(DND_MIME)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            }
          : undefined
      }
      onDrop={
        onDropReplace
          ? (e) => {
              const k = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData("text/plain");
              if (k) {
                e.preventDefault();
                e.stopPropagation();
                onDropReplace(k as InstrKind);
              }
            }
          : undefined
      }
    />
  );

  if (cat === "contact") {
    return (
      <g>
        <text x={cx} y={cy - 15} fill={sel} fontSize={11} fontFamily="JetBrains Mono" textAnchor="middle">
          {instr.tag || "?"}
        </text>
        <line x1={cx - 56} y1={cy} x2={cx - 10} y2={cy} stroke={wire} strokeWidth={2} />
        <line x1={cx + 10} y1={cy} x2={cx + 56} y2={cy} stroke={wire} strokeWidth={2} />
        <line x1={cx - 10} y1={cy - 11} x2={cx - 10} y2={cy + 11} stroke={sel} strokeWidth={2.5} />
        <line x1={cx + 10} y1={cy - 11} x2={cx + 10} y2={cy + 11} stroke={sel} strokeWidth={2.5} />
        {(instr.kind === "XIO" || instr.kind === "ONS") && (
          <line x1={cx - 10} y1={cy + 11} x2={cx + 10} y2={cy - 11} stroke={sel} strokeWidth={2.5} />
        )}
        {instr.kind === "ONS" && (
          <text x={cx} y={cy + 22} fill="#9CA3AF" fontSize={8} textAnchor="middle">
            ONS
          </text>
        )}
        {hit}
      </g>
    );
  }

  if (cat === "coil") {
    const m = instr.kind === "OTL" ? "L" : instr.kind === "OTU" ? "U" : "";
    return (
      <g>
        <text x={cx} y={cy - 15} fill={sel} fontSize={11} fontFamily="JetBrains Mono" textAnchor="middle">
          {instr.tag || "?"}
        </text>
        <line x1={cx - 56} y1={cy} x2={cx - 14} y2={cy} stroke={wire} strokeWidth={2} />
        <line x1={cx + 14} y1={cy} x2={cx + 56} y2={cy} stroke={wire} strokeWidth={2} />
        <path d={`M ${cx - 12} ${cy - 11} A 11 11 0 0 0 ${cx - 12} ${cy + 11}`} fill="none" stroke={sel} strokeWidth={2.5} />
        <path d={`M ${cx + 12} ${cy - 11} A 11 11 0 0 1 ${cx + 12} ${cy + 11}`} fill="none" stroke={sel} strokeWidth={2.5} />
        {m && (
          <text x={cx} y={cy + 4} fill={sel} fontSize={11} fontFamily="JetBrains Mono" textAnchor="middle">
            {m}
          </text>
        )}
        {hit}
      </g>
    );
  }

  // ── box / function-block instruction (FBD-style with labelled I/O pins) ──────
  const model = boxModel(instr, tags);
  const HDR = 15;
  const ROW = 12;
  const rows = Math.max(model.left.length, model.right.length, 1);
  const boxW = 120;
  const boxH = HDR + rows * ROW + 5;
  const top = cy - boxH / 2;
  const left = cx - boxW / 2;
  const right = cx + boxW / 2;
  const isCompare = model.gate;
  const outColor = isCompare ? "#22C55E" : "#F59E0B"; // continuity vs data
  const pinY = (i: number) => top + HDR + i * ROW + ROW / 2;

  return (
    <g>
      {/* rung wire passes through the block at centre */}
      <line x1={cx - 56} y1={cy} x2={left} y2={cy} stroke={wire} strokeWidth={2} />
      <line x1={right} y1={cy} x2={cx + 56} y2={cy} stroke={wire} strokeWidth={2} />
      <rect x={left} y={top} width={boxW} height={boxH} rx={3} fill="#0F141B" stroke={selected ? SELECT : "#3B82F6"} strokeWidth={selected ? 2.5 : 1.5} />
      {/* header bar */}
      <rect x={left} y={top} width={boxW} height={HDR} rx={3} fill={selected ? "rgba(249,115,22,0.18)" : "rgba(59,130,246,0.16)"} />
      <text x={cx} y={top + 11} fill={sel} fontSize={10} fontWeight={700} fontFamily="JetBrains Mono" textAnchor="middle">
        {model.title}
      </text>

      {/* input pins (left) */}
      {model.left.map((label, i) => (
        <g key={`l${i}`}>
          <circle cx={left} cy={pinY(i)} r={2.4} fill="#38BDF8" />
          <text x={left + 6} y={pinY(i) + 3} fill="#9CA3AF" fontSize={8.5} fontFamily="JetBrains Mono" textAnchor="start">
            {label}
          </text>
        </g>
      ))}
      {/* output pins (right) */}
      {model.right.map((label, i) => (
        <g key={`r${i}`}>
          <circle cx={right} cy={pinY(i)} r={2.4} fill={outColor} />
          <text x={right - 6} y={pinY(i) + 3} fill="#9CA3AF" fontSize={8.5} fontFamily="JetBrains Mono" textAnchor="end">
            {label}
          </text>
        </g>
      ))}
      {hit}
    </g>
  );
}

interface BoxModel {
  title: string;
  left: string[]; // input operands (pins on the left)
  right: string[]; // output operands / result (pins on the right)
  gate?: boolean; // true for compares (output = rung continuity)
}

const CMP: Record<string, string> = { EQU: "=", NEQ: "≠", LES: "<", LEQ: "≤", GRT: ">", GEQ: "≥" };

function boxModel(instr: Instruction, tags: TagStore): BoxModel {
  const a = instr.a || "?";
  const b = instr.b || "?";
  const c = instr.c || "?";
  const d = instr.d || "?";
  const e = instr.e || "?";
  const t = instr.tag || "?";
  const base = instr.tag ? tags[instr.tag] : undefined;

  switch (instr.kind) {
    case "TON":
    case "TOF":
    case "RTO": {
      const v = base?.type === "TIMER" ? (base.value as TimerVal) : null;
      return { title: instr.kind, left: [t, `PRE ${v ? v.pre : "?"}`, `ACC ${v ? Math.round(v.acc) : 0}`], right: ["DN", "TT"] };
    }
    case "CTU":
    case "CTD": {
      const v = base?.type === "COUNTER" ? (base.value as CounterVal) : null;
      return { title: instr.kind, left: [t, `PRE ${v ? v.pre : "?"}`, `ACC ${v ? v.acc : 0}`], right: ["DN"] };
    }
    case "RES":
      return { title: "RES", left: [t], right: ["↺"] };
    case "ADD":
    case "SUB":
    case "MUL":
    case "DIV":
    case "MOD":
      return { title: instr.kind, left: [`A ${a}`, `B ${b}`], right: [`→ ${c}`] };
    case "SQR":
      return { title: "SQR", left: [`√ ${a}`], right: [`→ ${t}`] };
    case "ABS":
      return { title: "ABS", left: [`|${a}|`], right: [`→ ${t}`] };
    case "NEG":
      return { title: "NEG", left: [`−${a}`], right: [`→ ${t}`] };
    case "MOV":
      return { title: "MOV", left: [a], right: [`→ ${t}`] };
    case "CLR":
      return { title: "CLR", left: [], right: [`${t} ← 0`] };
    case "TOD":
      return { title: "TOD", left: [a], right: [`BCD→ ${t}`] };
    case "FRD":
      return { title: "FRD", left: [`BCD ${a}`], right: [`→ ${t}`] };
    case "EQU":
    case "NEQ":
    case "LES":
    case "LEQ":
    case "GRT":
    case "GEQ":
      return { title: instr.kind, left: [`A ${a}`, `B ${b}`], right: [CMP[instr.kind]], gate: true };
    case "LIM":
      return { title: "LIM", left: [`lo ${a}`, `test ${b}`, `hi ${c}`], right: ["in"], gate: true };
    case "SCP":
      return { title: "SCP", left: [a, `in ${b}–${c}`], right: [`→ ${t}`] };
    case "SCL":
      return { title: "SCL", left: [a], right: [`→ ${t}`] };
    case "PID":
      return { title: "PID", left: [`SP ${b}`, `PV ${a}`, `K ${c}/${d}/${e}`], right: [`CV→ ${t}`] };
    default:
      return { title: instr.kind, left: [t], right: [] };
  }
}

/** Small standalone glyph for the palette. */
export function PaletteGlyph({ kind }: { kind: string }) {
  const cat = instrCategory(kind);
  const c = "#C9D1D9";
  if (cat === "contact") {
    return (
      <svg width={34} height={22} viewBox="0 0 34 22">
        <line x1={0} y1={11} x2={12} y2={11} stroke="#6B7280" strokeWidth={1.5} />
        <line x1={22} y1={11} x2={34} y2={11} stroke="#6B7280" strokeWidth={1.5} />
        <line x1={12} y1={4} x2={12} y2={18} stroke={c} strokeWidth={2} />
        <line x1={22} y1={4} x2={22} y2={18} stroke={c} strokeWidth={2} />
        {(kind === "XIO" || kind === "ONS") && <line x1={12} y1={18} x2={22} y2={4} stroke={c} strokeWidth={2} />}
      </svg>
    );
  }
  if (cat === "coil") {
    const m = kind === "OTL" ? "L" : kind === "OTU" ? "U" : "";
    return (
      <svg width={34} height={22} viewBox="0 0 34 22">
        <line x1={0} y1={11} x2={10} y2={11} stroke="#6B7280" strokeWidth={1.5} />
        <line x1={24} y1={11} x2={34} y2={11} stroke="#6B7280" strokeWidth={1.5} />
        <path d={`M 12 3 A 9 9 0 0 0 12 19`} fill="none" stroke={c} strokeWidth={2} />
        <path d={`M 22 3 A 9 9 0 0 1 22 19`} fill="none" stroke={c} strokeWidth={2} />
        {m && (
          <text x={17} y={15} fill={c} fontSize={9} fontFamily="JetBrains Mono" textAnchor="middle">
            {m}
          </text>
        )}
      </svg>
    );
  }
  return (
    <svg width={34} height={22} viewBox="0 0 34 22">
      <rect x={3} y={3} width={28} height={16} rx={2} fill="none" stroke="#3B82F6" strokeWidth={1.5} />
      <text x={17} y={15} fill={c} fontSize={8} fontWeight={700} fontFamily="JetBrains Mono" textAnchor="middle">
        {kind}
      </text>
    </svg>
  );
}
