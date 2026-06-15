import { getBool, getNum } from "../../engine/scan";
import type { TagStore } from "../../engine/types";
import type { Scenario } from "../../scenarios/types";
import { useSim } from "../../store/simulatorStore";

export default function ProcessView() {
  const scenario = useSim((s) => s.scenario);
  const tags = useSim((s) => s.tags);
  if (!scenario.widgets || scenario.widgets.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-[#21262D] bg-[#0F141B] p-3">
      <div className="mb-2 font-mono text-xs font-bold tracking-wide text-gray-200">
        PROCESS VIEW
      </div>
      <div className="flex flex-wrap gap-4">
        {scenario.widgets.map((w) =>
          w === "tank" ? (
            <TankWidget key="tank" scenario={scenario} tags={tags} />
          ) : w === "oven" ? (
            <OvenWidget key="oven" scenario={scenario} tags={tags} />
          ) : w === "traffic" ? (
            <TrafficWidget key="traffic" scenario={scenario} tags={tags} />
          ) : w === "garage" ? (
            <GarageWidget key="garage" scenario={scenario} tags={tags} />
          ) : w === "conveyor" ? (
            <ConveyorWidget key="conveyor" scenario={scenario} tags={tags} />
          ) : (
            <MotorWidget key="motor" scenario={scenario} tags={tags} />
          ),
        )}
      </div>
    </div>
  );
}

function TankWidget({ scenario, tags }: { scenario: Scenario; tags: TagStore }) {
  const plant = scenario.program.plant;
  if (!plant || plant.model !== "tank") return null;
  const p = plant.params;
  const levelTag = String(p.level);
  const max = Number(p.max ?? 4095);
  const raw = getNum(tags, levelTag);
  const frac = Math.max(0, Math.min(1, raw / max));
  const inlet = getBool(tags, String(p.inlet));
  const outlet = getBool(tags, String(p.outlet));

  const ai = scenario.analogIn?.find((c) => c.tag === levelTag);
  const engVal = ai ? ai.engMin + frac * (ai.engMax - ai.engMin) : raw;
  const unit = ai?.unit ?? "cts";

  const W = 120;
  const H = 150;
  const fluidH = frac * (H - 20);

  return (
    <div className="flex flex-col items-center">
      <svg width={W} height={H + 24} viewBox={`0 0 ${W} ${H + 24}`}>
        {/* inlet pipe */}
        <rect x={10} y={4} width={28} height={8} fill={inlet ? "#22C55E" : "#374151"} />
        <text x={24} y={22} fontSize="8" fill={inlet ? "#22C55E" : "#6B7280"} textAnchor="middle">
          IN
        </text>
        {/* tank body */}
        <rect x={20} y={16} width={W - 40} height={H - 20} rx={6} fill="#0A0D12" stroke="#4B5563" strokeWidth={2} />
        {/* fluid */}
        <rect
          x={22}
          y={16 + (H - 20 - fluidH)}
          width={W - 44}
          height={fluidH}
          fill="url(#fluid)"
          style={{ transition: "all 150ms linear" }}
        />
        <defs>
          <linearGradient id="fluid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {/* outlet pipe */}
        <rect x={W - 38} y={H - 8} width={28} height={8} fill={outlet ? "#F97316" : "#374151"} />
        <text x={W - 24} y={H + 18} fontSize="8" fill={outlet ? "#F97316" : "#6B7280"} textAnchor="middle">
          DRAIN
        </text>
      </svg>
      <div className="mt-1 font-mono text-sm text-sky-300">
        {engVal.toFixed(2)} {unit}
      </div>
      <div className="font-mono text-[10px] text-gray-500">Tank level</div>
    </div>
  );
}

function MotorWidget({ scenario, tags }: { scenario: Scenario; tags: TagStore }) {
  const ao = scenario.analogOut?.find((c) => c.device === "VFD") ?? scenario.analogOut?.[0];
  const rpm = ao ? getNum(tags, ao.tag) : 0;
  const engMax = ao?.engMax ?? 1750;
  const frac = Math.max(0, Math.min(1, rpm / engMax));
  const spinning = rpm > 0.5;
  const dur = spinning ? Math.max(0.18, 1.6 - 1.45 * frac) : 0;

  return (
    <div className="flex flex-col items-center">
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={42} fill="#0A0D12" stroke="#4B5563" strokeWidth={3} />
        <g
          style={{
            transformOrigin: "60px 60px",
            animation: spinning ? `vr-spin ${dur}s linear infinite` : "none",
          }}
        >
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <line
              key={a}
              x1={60}
              y1={60}
              x2={60 + 38 * Math.cos((a * Math.PI) / 180)}
              y2={60 + 38 * Math.sin((a * Math.PI) / 180)}
              stroke={spinning ? "#22C55E" : "#4B5563"}
              strokeWidth={3}
            />
          ))}
          <circle cx={60} cy={60} r={8} fill={spinning ? "#22C55E" : "#374151"} />
        </g>
        {/* speed arc */}
        <path
          d={describeArc(60, 60, 50, -135, -135 + frac * 270)}
          fill="none"
          stroke="#A78BFA"
          strokeWidth={4}
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 font-mono text-sm text-violet-300">
        {rpm.toFixed(0)} {ao?.unit ?? "rpm"}
      </div>
      <div className="font-mono text-[10px] text-gray-500">VFD motor</div>
    </div>
  );
}

function OvenWidget({ scenario, tags }: { scenario: Scenario; tags: TagStore }) {
  const plant = scenario.program.plant;
  if (!plant || plant.model !== "oven") return null;
  const p = plant.params;
  const pv = getNum(tags, String(p.pv));
  const cv = getNum(tags, String(p.cv));
  const ambient = Number(p.ambient ?? 25);
  const gain = Number(p.gain ?? 220);
  const maxT = ambient + gain;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const frac = clamp01((pv - ambient) / (maxT - ambient)); // 0 cold … 1 hot
  const heat = clamp01(cv / 100); // heater command

  const W = 120;
  const H = 140;
  const elementColor = `rgb(${Math.round(75 + heat * 174)}, ${Math.round(85 - heat * 30)}, ${Math.round(99 - heat * 80)})`;

  return (
    <div className="flex flex-col items-center">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* chamber */}
        <rect x={12} y={10} width={96} height={108} rx={5} fill="#0A0D12" stroke="#4B5563" strokeWidth={2} />
        {/* interior heat tint (hotter → redder) */}
        <rect x={14} y={12} width={92} height={104} rx={4} fill="#EF4444" opacity={frac * 0.45} style={{ transition: "opacity 150ms" }} />
        {/* heating elements at the bottom, glow ∝ heater command */}
        {[0, 1, 2].map((i) => (
          <line
            key={i}
            x1={24}
            x2={96}
            y1={104 - i * 7}
            y2={104 - i * 7}
            stroke={elementColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            style={{ filter: heat > 0.05 ? `drop-shadow(0 0 ${2 + heat * 4}px ${elementColor})` : "none", transition: "all 150ms" }}
          />
        ))}
        {/* temperature scale on the right */}
        <rect x={W - 8} y={12} width={4} height={104} rx={2} fill="#1f2933" />
        <rect x={W - 8} y={12 + (1 - frac) * 104} width={4} height={frac * 104} rx={2} fill="#F97316" style={{ transition: "all 150ms" }} />
      </svg>
      <div className="mt-1 font-mono text-sm text-orange-300">{pv.toFixed(1)} °C</div>
      <div className="font-mono text-[10px] text-gray-500">heater {cv.toFixed(0)} % · oven</div>
    </div>
  );
}

function TrafficWidget({ scenario, tags }: { scenario: Scenario; tags: TagStore }) {
  const byDevice = (d: string) => scenario.outputs.find((o) => o.device === d)?.tag;
  const lamps = [
    { tag: byDevice("PILOT_RED"), on: "#EF4444" },
    { tag: byDevice("PILOT_AMBER"), on: "#F59E0B" },
    { tag: byDevice("PILOT_GREEN"), on: "#22C55E" },
  ];
  return (
    <div className="flex flex-col items-center">
      <svg width={56} height={140} viewBox="0 0 56 140">
        <rect x={14} y={6} width={28} height={108} rx={6} fill="#0A0D12" stroke="#4B5563" strokeWidth={2} />
        <rect x={24} y={114} width={8} height={20} fill="#4B5563" />
        {lamps.map((l, i) => {
          const lit = l.tag ? getBool(tags, l.tag) : false;
          return (
            <circle
              key={i}
              cx={28}
              cy={26 + i * 32}
              r={11}
              fill={lit ? l.on : "#1f2933"}
              style={{ filter: lit ? `drop-shadow(0 0 6px ${l.on})` : "none", transition: "all 120ms" }}
            />
          );
        })}
      </svg>
      <div className="font-mono text-[10px] text-gray-500">traffic light</div>
    </div>
  );
}

function GarageWidget({ scenario, tags }: { scenario: Scenario; tags: TagStore }) {
  const plant = scenario.program.plant;
  if (!plant || plant.model !== "garage") return null;
  const p = plant.params;
  const pos = Math.max(0, Math.min(100, getNum(tags, String(p.pos)))); // 0 closed … 100 open
  const upperLS = getBool(tags, String(p.upperLS));
  const lowerLS = getBool(tags, String(p.lowerLS));
  const W = 110;
  const openingH = 96;
  const doorH = openingH * (1 - pos / 100); // door panel visible height (drops from top)

  return (
    <div className="flex flex-col items-center">
      <svg width={W} height={130} viewBox={`0 0 ${W} 130`}>
        {/* frame + opening */}
        <rect x={8} y={10} width={W - 16} height={openingH} fill="#0A0D12" stroke="#4B5563" strokeWidth={2} />
        {/* door panel slides up; remaining height = closed portion */}
        <rect x={10} y={12} width={W - 20} height={Math.max(0, doorH)} fill="#6B7280" stroke="#9CA3AF" strokeWidth={1} style={{ transition: "height 120ms" }} />
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={10} x2={W - 10} y1={12 + doorH * f} y2={12 + doorH * f} stroke="#4B5563" strokeWidth={0.5} />
        ))}
        {/* limit-switch lamps */}
        <circle cx={16} cy={16} r={4} fill={upperLS ? "#22C55E" : "#1f2933"} />
        <circle cx={16} cy={102} r={4} fill={lowerLS ? "#F59E0B" : "#1f2933"} />
        <text x={W - 6} y={16} fontSize={7} fill={upperLS ? "#22C55E" : "#6B7280"} textAnchor="end">UP LS</text>
        <text x={W - 6} y={106} fontSize={7} fill={lowerLS ? "#F59E0B" : "#6B7280"} textAnchor="end">DN LS</text>
      </svg>
      <div className="font-mono text-[10px] text-gray-500">door {pos.toFixed(0)} % open</div>
    </div>
  );
}

function ConveyorWidget({ scenario, tags }: { scenario: Scenario; tags: TagStore }) {
  const plant = scenario.program.plant;
  if (!plant || plant.model !== "conveyor") return null;
  const p = plant.params;
  const run = getBool(tags, String(p.run));
  const dist = getNum(tags, String(p.dist));
  const spacing = Number(p.spacing ?? 20);
  // box count from the first counter tag in the scenario
  const counter = Object.values(scenario.tags).find((t) => t.type === "COUNTER");
  const count = counter ? getNum(tags, counter.name) : 0;
  const W = 150;
  const beltY = 40;
  // box screen positions derived from belt travel (data-driven → no CSS animation)
  const phase = ((dist / spacing) % 1) * 36;
  const boxes = [0, 1, 2, 3].map((i) => W - 12 - phase - i * 36);

  return (
    <div className="flex flex-col items-center">
      <svg width={W} height={70} viewBox={`0 0 ${W} 70`}>
        <rect x={6} y={beltY} width={W - 12} height={6} rx={3} fill={run ? "#374151" : "#1f2933"} />
        {[18, W / 2, W - 18].map((x) => (
          <circle key={x} cx={x} cy={beltY + 12} r={7} fill="none" stroke="#4B5563" strokeWidth={2} />
        ))}
        {boxes.map((x, i) => (x > 4 && x < W - 8 ? <rect key={i} x={x} y={beltY - 16} width={16} height={16} rx={2} fill="#A16207" stroke="#F59E0B" strokeWidth={1} /> : null))}
        {/* sensor */}
        <line x1={W - 30} y1={beltY - 22} x2={W - 30} y2={beltY} stroke="#EF4444" strokeWidth={1} strokeDasharray="2 2" />
      </svg>
      <div className="font-mono text-sm text-amber-300">{count} {count === 1 ? "box" : "boxes"}</div>
      <div className="font-mono text-[10px] text-gray-500">conveyor {run ? "running" : "stopped"}</div>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const large = endDeg - startDeg <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}
