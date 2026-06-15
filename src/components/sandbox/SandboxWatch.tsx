import { useState } from "react";
import type { CounterVal, Tag, TimerVal } from "../../engine/types";
import { useProject } from "../../store/projectStore";

export default function SandboxWatch() {
  const tags = useProject((s) => s.tags);
  const scanCount = useProject((s) => s.scanCount);
  const scanTimeMs = useProject((s) => s.scanTimeMs);
  const [activeOnly, setActiveOnly] = useState(true);

  const entries = Object.values(tags).filter((t) => (activeOnly ? isActive(t) : true));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#21262D] px-3 py-1.5">
        <h3 className="font-mono text-xs font-bold tracking-wide text-gray-200">TAG WATCH</h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-[10px] text-gray-400">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            active only
          </label>
          <span className="font-mono text-[10px] text-gray-400">
            #{scanCount} · {scanTimeMs.toFixed(3)}ms
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-[11px]">
          <tbody>
            {entries.map((t) => (
              <tr key={t.name} className="border-t border-[#1c2027]">
                <td className="px-2 py-0.5 text-gray-200">{t.name}</td>
                <td className="px-2 py-0.5 text-gray-600">{t.type}</td>
                <td className="px-2 py-0.5">{renderValue(t)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td className="px-2 py-2 text-gray-600">No active tags — toggle a switch or run the program.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isActive(t: Tag): boolean {
  if (t.type === "BOOL") return Boolean(t.value);
  if (t.type === "DINT" || t.type === "REAL") return t.value !== 0;
  if (t.type === "TIMER") {
    const v = t.value as TimerVal;
    return v.acc > 0 || v.en || v.dn;
  }
  if (t.type === "COUNTER") {
    const v = t.value as CounterVal;
    return v.acc !== 0 || v.dn;
  }
  return false;
}

function renderValue(t: Tag) {
  if (t.type === "BOOL") {
    const v = Boolean(t.value);
    return <span className={v ? "font-bold text-safe" : "text-gray-500"}>{v ? "1" : "0"}</span>;
  }
  if (t.type === "DINT" || t.type === "REAL") {
    const n = t.value as number;
    return <span className="text-sky-300">{t.type === "REAL" ? n.toFixed(2) : n}</span>;
  }
  if (t.type === "TIMER") {
    const v = t.value as TimerVal;
    return (
      <span className="text-amber-300">
        {Math.round(v.acc)}/{v.pre}ms <Bits bits={[["EN", v.en], ["TT", v.tt], ["DN", v.dn]]} />
      </span>
    );
  }
  const v = t.value as CounterVal;
  return (
    <span className="text-amber-300">
      {v.acc}/{v.pre} <Bits bits={[["DN", v.dn], ["OV", v.ov], ["UN", v.un]]} />
    </span>
  );
}

function Bits({ bits }: { bits: [string, boolean][] }) {
  return (
    <>
      {bits.map(([name, on]) => (
        <span key={name} className={`ml-1 rounded px-1 ${on ? "bg-safe/20 text-safe" : "text-gray-600"}`}>
          {name}
        </span>
      ))}
    </>
  );
}
