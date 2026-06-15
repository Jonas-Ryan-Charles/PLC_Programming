import { useState, type DragEvent } from "react";
import { rungColumns, type Column } from "../../engine/ladder";
import type { InstrKind, Program, Rung, TagStore } from "../../engine/types";
import { drawInstr } from "../sandbox/symbols";

// ── geometry ──────────────────────────────────────────────────────────────────
const COL_W = 130;
// How close (px) to a symbol's centre a drop must land to mean "replace this
// instruction" rather than "insert a new one beside it".
const REPLACE_HALF = 30;
const LANE_H = 60;
const RAIL_L = 22;
const LEFT_PAD = 18;
const TOP = 16;
const WIRE_ON = "#22C55E";
const WIRE_OFF = "#4B5563";
const RAIL = "#9CA3AF";

/** Where an instruction lives in a rung — passed up on select. */
export interface SelAddr {
  rungId: string;
  elementIndex: number;
  legIndex?: number;
  posInLeg?: number;
}

export interface RungViewProps {
  program: Program;
  rungEnergised: Record<string, boolean>;
  tags: TagStore;
  selectedId: string | null;
  /** Secondary selection used to wrap a span of trunk elements in a branch. */
  spanAnchorId?: string | null;
  onSelect: (addr: SelAddr, instrId: string, shift: boolean) => void;
  onInsertTrunk: (rungId: string, index: number, kind: InstrKind) => void;
  onInsertLeg: (rungId: string, elementIndex: number, legIndex: number, posInLeg: number, kind: InstrKind) => void;
  onReplace: (rungId: string, instrId: string, kind: InstrKind) => void;
  onBranch: (rungId: string, elementIndex: number) => void;
  onDeleteRung: (rungId: string) => void;
}

export const LADDER_DRAG_MIME = "application/x-plc-instr";

function readKind(e: DragEvent): InstrKind | null {
  const k = e.dataTransfer.getData(LADDER_DRAG_MIME) || e.dataTransfer.getData("text/plain");
  return (k || null) as InstrKind | null;
}

export default function RungView(props: RungViewProps) {
  return (
    <div className="space-y-1">
      {props.program.rungs.map((rung, i) => (
        <RungRow key={rung.id} rung={rung} index={i} {...props} />
      ))}
    </div>
  );
}

function RungRow({
  rung,
  index,
  tags,
  rungEnergised,
  selectedId,
  spanAnchorId,
  onSelect,
  onInsertTrunk,
  onInsertLeg,
  onReplace,
  onBranch,
  onDeleteRung,
}: RungViewProps & { rung: Rung; index: number }) {
  const [drop, setDrop] = useState<string | null>(null);

  const cols = rungColumns(rung);
  const totalCells = Math.max(1, cols.reduce((n, c) => n + c.widthCells, 0));
  const branchCount = Math.max(1, ...cols.map((c) => (c.kind === "parallel" ? c.legs.length : 1)));

  const energised = Boolean(rungEnergised[rung.id]);
  const color = energised ? WIRE_ON : WIRE_OFF;

  const trunkY = TOP + LANE_H / 2;
  const handleY = TOP + branchCount * LANE_H + 12;
  const height = handleY + 14;
  const railRight = RAIL_L + LEFT_PAD + totalCells * COL_W + 16;
  const width = railRight + 14;

  const cellX = (cell: number) => RAIL_L + LEFT_PAD + cell * COL_W;

  // resolve cell offset of each element (cumulative)
  let cursor = 0;
  const placed = cols.map((c) => {
    const startCell = cursor;
    cursor += c.widthCells;
    return { col: c, startCell };
  });

  return (
    <div className={`flex items-stretch rounded border ${energised ? "border-energised/40" : "border-[#1c2128]"} bg-[#0D1117]`}>
      <div className="flex w-10 shrink-0 flex-col items-center justify-center border-r border-[#1c2128] py-1">
        <span className="font-mono text-xs text-gray-500">{index}</span>
        <button onClick={() => onDeleteRung(rung.id)} className="mt-1 text-[10px] text-gray-600 hover:text-fault" title="Delete rung">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(LADDER_DRAG_MIME)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            // Branch-leg slots handle their own drops (stopPropagation). Everything
            // else lands here: if the drop is ON a trunk instruction's symbol,
            // replace it; if it's to the left/right of one, insert at that position.
            const k = readKind(e);
            if (!k) return;
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const centerOf = (p: (typeof placed)[number]) =>
              cellX(p.startCell) + (p.col.widthCells * COL_W) / 2;
            const onSymbol = placed.find(
              (p) => p.col.kind === "instr" && Math.abs(x - centerOf(p)) <= REPLACE_HALF,
            );
            if (onSymbol && onSymbol.col.kind === "instr") {
              onReplace(rung.id, onSymbol.col.instr.id, k);
              return;
            }
            const idx = placed.filter((p) => centerOf(p) < x).length;
            onInsertTrunk(rung.id, idx, k);
          }}
        >
          {/* power rails */}
          <line x1={RAIL_L} y1={0} x2={RAIL_L} y2={height} stroke={RAIL} strokeWidth={3} />
          <line x1={railRight} y1={0} x2={railRight} y2={height} stroke={RAIL} strokeWidth={3} />
          {/* trunk */}
          <line x1={RAIL_L} y1={trunkY} x2={railRight} y2={trunkY} stroke={color} strokeWidth={2} />

          {placed.map(({ col, startCell }) =>
            col.kind === "instr" ? (
              <g key={col.elementIndex}>
                {drawInstr(
                  col.instr,
                  cellX(startCell) + COL_W / 2,
                  trunkY,
                  tags,
                  color,
                  selectedId === col.instr.id,
                  (e) => onSelect({ rungId: rung.id, elementIndex: col.elementIndex }, col.instr.id, !!e?.shiftKey),
                  // No hit-rect drop handler on the trunk: the rung-level onDrop
                  // decides replace-vs-insert by where the drop lands.
                  undefined,
                )}
                {spanAnchorId === col.instr.id && (
                  <rect x={cellX(startCell) + 6} y={trunkY - 26} width={COL_W - 12} height={52} rx={4} fill="none" stroke="#A78BFA" strokeDasharray="4 3" strokeWidth={2} />
                )}
              </g>
            ) : (
              <ParallelGroup
                key={col.elementIndex}
                col={col}
                leftX={cellX(startCell)}
                trunkY={trunkY}
                color={color}
                tags={tags}
                selectedId={selectedId}
                rungId={rung.id}
                drop={drop}
                setDrop={setDrop}
                onSelect={onSelect}
                onInsertLeg={onInsertLeg}
                onReplace={onReplace}
              />
            ),
          )}

          {/* per-element branch handles */}
          {placed.map(({ col, startCell }) => {
            const cx = cellX(startCell) + (col.widthCells * COL_W) / 2;
            return (
              <g key={`h${col.elementIndex}`} style={{ cursor: "pointer" }} onClick={() => onBranch(rung.id, col.elementIndex)}>
                <rect x={cx - 26} y={handleY - 9} width={52} height={16} rx={8} fill="#161B22" stroke="#30363D" />
                <text x={cx} y={handleY + 2} fill="#8B949E" fontSize={9} fontFamily="JetBrains Mono" textAnchor="middle">
                  ⎇ OR
                </text>
              </g>
            );
          })}

          {cols.length === 0 && (
            <text x={RAIL_L + 26} y={trunkY + 4} fill="#4B5563" fontSize={12} fontFamily="JetBrains Mono">
              drag an instruction here →
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

function ParallelGroup({
  col,
  leftX,
  trunkY,
  color,
  tags,
  selectedId,
  rungId,
  drop,
  setDrop,
  onSelect,
  onInsertLeg,
  onReplace,
}: {
  col: Extract<Column, { kind: "parallel" }>;
  leftX: number;
  trunkY: number;
  color: string;
  tags: TagStore;
  selectedId: string | null;
  rungId: string;
  drop: string | null;
  setDrop: (s: string | null) => void;
  onSelect: RungViewProps["onSelect"];
  onInsertLeg: RungViewProps["onInsertLeg"];
  onReplace: RungViewProps["onReplace"];
}) {
  const W = col.widthCells * COL_W;
  const exitX = leftX + W;
  const bottomY = trunkY + (col.legs.length - 1) * LANE_H;

  return (
    <g>
      {/* entry / exit vertical rails */}
      <line x1={leftX} y1={trunkY} x2={leftX} y2={bottomY} stroke={color} strokeWidth={2} />
      <line x1={exitX} y1={trunkY} x2={exitX} y2={bottomY} stroke={color} strokeWidth={2} />

      {col.legs.map((leg) => {
        const laneY = trunkY + leg.legIndex * LANE_H;
        return (
          <g key={leg.legIndex}>
            {/* lane wire (leg 0 sits on the trunk already) */}
            {leg.legIndex > 0 && <line x1={leftX} y1={laneY} x2={exitX} y2={laneY} stroke={color} strokeWidth={2} />}
            {leg.instrs.map((instr, j) => (
              <g key={instr.id}>
                {drawInstr(
                  instr,
                  leftX + j * COL_W + COL_W / 2,
                  laneY,
                  tags,
                  color,
                  selectedId === instr.id,
                  (e) => onSelect({ rungId, elementIndex: col.elementIndex, legIndex: leg.legIndex, posInLeg: j }, instr.id, !!e?.shiftKey),
                  (kind) => onReplace(rungId, instr.id, kind),
                )}
              </g>
            ))}
            {/* append-into-leg drop slot at the leg's tail */}
            {(() => {
              const id = `l${col.elementIndex}-${leg.legIndex}`;
              const x = leftX + leg.instrs.length * COL_W;
              return (
                <rect
                  x={Math.min(x, exitX) - 9}
                  y={laneY - 26}
                  width={18}
                  height={52}
                  rx={3}
                  fill={drop === id ? "rgba(249,115,22,0.28)" : "transparent"}
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes(LADDER_DRAG_MIME)) {
                      e.preventDefault();
                      setDrop(id);
                    }
                  }}
                  onDragLeave={() => setDrop(drop === id ? null : drop)}
                  onDrop={(e) => {
                    const k = readKind(e);
                    setDrop(null);
                    if (k) {
                      e.preventDefault();
                      e.stopPropagation(); // don't also trigger the rung-level trunk insert
                      onInsertLeg(rungId, col.elementIndex, leg.legIndex, leg.instrs.length, k);
                    }
                  }}
                />
              );
            })()}
          </g>
        );
      })}
    </g>
  );
}
