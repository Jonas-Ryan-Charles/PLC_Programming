import { getNum } from "../../engine/scan";
import type { AnalogInBinding, AnalogOutBinding } from "../../scenarios/types";
import { useSim } from "../../store/simulatorStore";

const eng = (raw: number, rawMax: number, lo: number, hi: number) =>
  lo + (raw / rawMax) * (hi - lo);

export function AnalogInputModule({ channels }: { channels: AnalogInBinding[] }) {
  const tags = useSim((s) => s.tags);
  const setInput = useSim((s) => s.setInput);

  return (
    <Shell title="ANALOG INPUT  ·  AI" accent="#38BDF8">
      {channels.map((ch) => {
        const raw = getNum(tags, ch.tag);
        const value = eng(raw, ch.rawMax, ch.engMin, ch.engMax);
        const frac = Math.max(0, Math.min(1, raw / ch.rawMax));
        return (
          <div key={ch.channel} className="px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="w-10 font-mono text-[10px] text-gray-400">{ch.channel}</span>
              <span className="dymo">{ch.label}</span>
              <span className="rounded bg-black/30 px-1 font-mono text-[9px] text-sky-300">
                {ch.signal}
              </span>
              <span className="ml-auto font-mono text-[11px] text-sky-200">
                {value.toFixed(1)} {ch.unit}
              </span>
              <span className="font-mono text-[9px] text-gray-500">{Math.round(raw)} cts</span>
            </div>
            {ch.driver === "manual" ? (
              <input
                type="range"
                min={0}
                max={ch.rawMax}
                value={Math.round(raw)}
                onChange={(e) => setInput(ch.tag, Number(e.target.value))}
                className="mt-1 w-full accent-sky-400"
              />
            ) : (
              <div className="mt-1 h-1.5 w-full rounded bg-black/40">
                <div
                  className="h-full rounded bg-sky-400 transition-[width] duration-150"
                  style={{ width: `${frac * 100}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </Shell>
  );
}

export function AnalogOutputModule({ channels }: { channels: AnalogOutBinding[] }) {
  const tags = useSim((s) => s.tags);
  return (
    <Shell title="ANALOG OUTPUT  ·  AO" accent="#A78BFA">
      {channels.map((ch) => {
        const value = getNum(tags, ch.tag);
        const frac = Math.max(0, Math.min(1, (value - ch.engMin) / (ch.engMax - ch.engMin)));
        return (
          <div key={ch.channel} className="px-2 py-1.5">
            <div className="flex items-center gap-2">
              <span className="w-10 font-mono text-[10px] text-gray-400">{ch.channel}</span>
              <span className="dymo">{ch.label}</span>
              <span className="rounded bg-black/30 px-1 font-mono text-[9px] text-violet-300">
                {ch.device}
              </span>
              <span className="ml-auto font-mono text-[11px] text-violet-200">
                {value.toFixed(1)} {ch.unit}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded bg-black/40">
              <div
                className="h-full rounded bg-violet-400 transition-[width] duration-150"
                style={{ width: `${frac * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </Shell>
  );
}

function Shell({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-md border border-black/50 bg-[#252B33]">
      <div
        className="rounded-t-md px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-black"
        style={{ background: accent }}
      >
        {title}
      </div>
      <div className="divide-y divide-black/30">{children}</div>
    </div>
  );
}
