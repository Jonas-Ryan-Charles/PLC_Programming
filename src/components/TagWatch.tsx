import { useSim } from "../store/simulatorStore";
import type { CounterVal, TimerVal } from "../engine/types";

export default function TagWatch() {
  const tags = useSim((s) => s.tags);
  const scanCount = useSim((s) => s.scanCount);
  const scanTimeMs = useSim((s) => s.scanTimeMs);

  const entries = Object.values(tags);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[#21262D] px-3 py-1.5">
        <h3 className="font-mono text-xs font-bold tracking-wide text-gray-200">TAG WATCH</h3>
        <span className="font-mono text-[10px] text-gray-400">
          scan #{scanCount} · {scanTimeMs.toFixed(3)} ms
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse font-mono text-[11px]">
          <thead className="sticky top-0 bg-[#0F141B] text-gray-500">
            <tr>
              <th className="px-2 py-1 text-left font-medium">Tag</th>
              <th className="px-2 py-1 text-left font-medium">Type</th>
              <th className="px-2 py-1 text-left font-medium">Value</th>
              <th className="px-2 py-1 text-left font-medium">Comment</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((t) => (
              <tr key={t.name} className="border-t border-[#1c2027]">
                <td className="px-2 py-1 text-gray-200">{t.name}</td>
                <td className="px-2 py-1 text-gray-500">{t.type}</td>
                <td className="px-2 py-1">{renderValue(t.type, t.value)}</td>
                <td className="px-2 py-1 text-gray-500">{t.comment ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderValue(type: string, value: unknown) {
  if (type === "BOOL") {
    const v = Boolean(value);
    return (
      <span className={v ? "font-bold text-safe" : "text-gray-500"}>{v ? "1 (TRUE)" : "0"}</span>
    );
  }
  if (type === "DINT" || type === "REAL") {
    return <span className="text-sky-300">{String(value)}</span>;
  }
  if (type === "TIMER") {
    const v = value as TimerVal;
    return (
      <span className="text-amber-300">
        ACC {v.acc}/{v.pre}ms{" "}
        <Bits bits={[["EN", v.en], ["TT", v.tt], ["DN", v.dn]]} />
      </span>
    );
  }
  if (type === "COUNTER") {
    const v = value as CounterVal;
    return (
      <span className="text-amber-300">
        ACC {v.acc}/{v.pre}{" "}
        <Bits bits={[["DN", v.dn], ["OV", v.ov], ["UN", v.un]]} />
      </span>
    );
  }
  return String(value);
}

function Bits({ bits }: { bits: [string, boolean][] }) {
  return (
    <>
      {bits.map(([name, on]) => (
        <span
          key={name}
          className={`ml-1 rounded px-1 ${on ? "bg-safe/20 text-safe" : "text-gray-600"}`}
        >
          {name}
        </span>
      ))}
    </>
  );
}
