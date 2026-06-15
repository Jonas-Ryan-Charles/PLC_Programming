import { useEffect, useState } from "react";
import { getBool, getNum } from "../../engine/scan";
import {
  AIN_ADDRS,
  AOUT_ADDRS,
  HSC_ADDR,
  INPUT_ADDRS,
  INPUT_DEVICE_SPECS,
  OUTPUT_ADDRS,
  OUTPUT_DEVICE_SPECS,
  SS_ADDR,
  TW_ADDR,
  type InputDeviceKind,
  type OutputDeviceKind,
} from "../../sandbox/project";
import { useProject } from "../../store/projectStore";
import { BcdThumbwheel, HighSpeedCounter, SevenSegDisplay } from "./SpecialModules";

const INPUT_KINDS = Object.keys(INPUT_DEVICE_SPECS) as InputDeviceKind[];
const OUTPUT_KINDS = Object.keys(OUTPUT_DEVICE_SPECS) as OutputDeviceKind[];

const isMomentary = (k: InputDeviceKind) => INPUT_DEVICE_SPECS[k].momentary;
const electrical = (k: InputDeviceKind, actuated: boolean) =>
  INPUT_DEVICE_SPECS[k].nc ? !actuated : actuated;

export default function SandboxChassis() {
  const project = useProject((s) => s.project);
  const tags = useProject((s) => s.tags);
  const setInput = useProject((s) => s.setInput);
  const setInputDevice = useProject((s) => s.setInputDevice);
  const setOutputDevice = useProject((s) => s.setOutputDevice);

  const [act, setAct] = useState<Record<string, boolean>>({});

  // initialise every input to its rest electrical state on project change
  useEffect(() => {
    if (!project) return;
    const init: Record<string, boolean> = {};
    for (const addr of INPUT_ADDRS) {
      init[addr] = false;
      setInput(addr, electrical(project.inputDevices[addr] ?? "NO_TOGGLE", false));
    }
    setAct(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  if (!project) return null;

  const drive = (addr: string, actuated: boolean) => {
    setAct((a) => ({ ...a, [addr]: actuated }));
    setInput(addr, electrical(project.inputDevices[addr] ?? "NO_TOGGLE", actuated));
  };
  const changeDevice = (addr: string, kind: InputDeviceKind) => {
    setInputDevice(addr, kind);
    setInput(addr, electrical(kind, act[addr] ?? false));
  };

  return (
    <div className="rounded-lg border border-black/40 bg-gunmetal p-2 shadow-inner">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="font-mono text-xs font-bold tracking-wide text-gray-200">I/O CHASSIS</h3>
        <span className="font-mono text-[10px] text-gray-400">24 VDC · all points live</span>
      </div>

      <Module title="DISCRETE INPUT · I:0" accent="#22C55E">
        {INPUT_ADDRS.map((addr) => {
          const kind = project.inputDevices[addr] ?? "NO_TOGGLE";
          const on = electrical(kind, act[addr] ?? false);
          const momentary = isMomentary(kind);
          const handlers = momentary
            ? {
                onMouseDown: () => drive(addr, true),
                onMouseUp: () => drive(addr, false),
                onMouseLeave: () => act[addr] && drive(addr, false),
              }
            : { onClick: () => drive(addr, !(act[addr] ?? false)) };
          return (
            <div key={addr} className="flex items-center gap-1.5 px-1.5 py-0.5">
              <span className={`led ${on ? "led-green-on" : "led-off"}`} />
              <span className="w-11 font-mono text-[10px] text-gray-400">{addr}</span>
              <button
                {...handlers}
                className={`w-12 rounded border px-1 py-0.5 text-center text-[11px] ${
                  on ? "border-safe text-safe" : "border-black/40 text-gray-300"
                } bg-[#1b2027] hover:border-energised active:bg-[#2d343d]`}
                title={momentary ? "Hold to actuate" : "Click to toggle"}
              >
                {on ? "ON" : "OFF"}
              </button>
              <select
                value={kind}
                onChange={(e) => changeDevice(addr, e.target.value as InputDeviceKind)}
                className="rounded border border-black/40 bg-[#11151b] px-1 py-0.5 font-mono text-[10px] text-gray-300"
              >
                {INPUT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {INPUT_DEVICE_SPECS[k].label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </Module>

      <div className="mt-2">
        <Module title="DISCRETE OUTPUT · O:0" accent="#F97316">
          {OUTPUT_ADDRS.map((addr) => {
            const on = getBool(tags, addr);
            const dev = project.outputDevices[addr] ?? "LED_GREEN";
            return (
              <div key={addr} className="flex items-center gap-1.5 px-1.5 py-0.5">
                <OutLed on={on} dev={dev} />
                <span className="w-11 font-mono text-[10px] text-gray-400">{addr}</span>
                <span className={`w-12 text-center font-mono text-[11px] ${on ? "text-safe" : "text-gray-500"}`}>
                  {on ? "ON" : "off"}
                </span>
                <select
                  value={dev}
                  onChange={(e) => setOutputDevice(addr, e.target.value as OutputDeviceKind)}
                  className="rounded border border-black/40 bg-[#11151b] px-1 py-0.5 font-mono text-[10px] text-gray-300"
                >
                  {OUTPUT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {OUTPUT_DEVICE_SPECS[k].label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </Module>
      </div>

      <div className="mt-2">
        <Module title="ANALOG INPUT · AI (0–4095)" accent="#38BDF8">
          {AIN_ADDRS.map((addr) => {
            const raw = getNum(tags, addr);
            return (
              <div key={addr} className="px-1.5 py-1">
                <div className="flex items-center gap-2">
                  <span className="w-10 font-mono text-[10px] text-gray-400">{addr}</span>
                  <span className="ml-auto font-mono text-[11px] text-sky-200">{Math.round(raw)}</span>
                  <span className="font-mono text-[9px] text-gray-500">
                    {((raw / 4095) * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={4095}
                  value={Math.round(raw)}
                  onChange={(e) => setInput(addr, Number(e.target.value))}
                  className="mt-0.5 w-full accent-sky-400"
                />
              </div>
            );
          })}
        </Module>
      </div>

      <div className="mt-2">
        <Module title="ANALOG OUTPUT · AO (0–4095)" accent="#A78BFA">
          {AOUT_ADDRS.map((addr) => {
            const val = getNum(tags, addr);
            const frac = Math.max(0, Math.min(1, val / 4095));
            return (
              <div key={addr} className="px-1.5 py-1">
                <div className="flex items-center gap-2">
                  <span className="w-10 font-mono text-[10px] text-gray-400">{addr}</span>
                  <span className="ml-auto font-mono text-[11px] text-violet-200">{Math.round(val)}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded bg-black/40">
                  <div className="h-full rounded bg-violet-400" style={{ width: `${frac * 100}%` }} />
                </div>
              </div>
            );
          })}
        </Module>
      </div>

      <div className="mt-2">
        <BcdThumbwheel tag={TW_ADDR} setInput={setInput} />
      </div>
      <div className="mt-2">
        <SevenSegDisplay tag={SS_ADDR} tags={tags} />
      </div>
      <div className="mt-2">
        <HighSpeedCounter tag={HSC_ADDR} tags={tags} setInput={setInput} />
      </div>
    </div>
  );
}

function Module({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-black/50 bg-[#252B33]">
      <div
        className="rounded-t-md px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-black"
        style={{ background: accent }}
      >
        {title}
      </div>
      <div className="divide-y divide-black/20">{children}</div>
    </div>
  );
}

function OutLed({ on, dev }: { on: boolean; dev: OutputDeviceKind }) {
  const spec = OUTPUT_DEVICE_SPECS[dev];
  const color = spec.color;
  const off = "#4B5563";

  switch (spec.viz) {
    case "motor":
      return (
        <svg width="15" height="15" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="6" fill="none" stroke={on ? color : off} strokeWidth="1.3" />
          <g style={{ transformOrigin: "7px 7px", animation: on ? "vr-spin 0.7s linear infinite" : "none" }}>
            <line x1="7" y1="2" x2="7" y2="7" stroke={on ? color : off} strokeWidth="1.3" />
          </g>
        </svg>
      );

    case "bulb":
      // incandescent: warm filament glow that ramps in
      return (
        <svg width="15" height="15" viewBox="0 0 14 14">
          <circle cx="7" cy="6.5" r="5" fill={on ? color : "#1f2933"} stroke={on ? color : off} strokeWidth="1"
            style={{ filter: on ? `drop-shadow(0 0 4px ${color})` : "none", transition: "all 200ms" }} />
          <path d="M5 5.5 Q7 8 9 5.5" fill="none" stroke={on ? "#7c2d12" : off} strokeWidth="0.8" />
          <rect x="5.5" y="11" width="3" height="2" fill={off} />
        </svg>
      );

    case "solenoid": {
      // valve body; flow shown when (NO open at rest) XOR energised
      const open = spec.normallyOpen ? !on : on;
      return (
        <svg width="15" height="15" viewBox="0 0 14 14" aria-label={open ? "open" : "shut"}>
          <rect x="2" y="4" width="10" height="6" rx="1" fill="none" stroke={on ? color : off} strokeWidth="1.2" />
          <path d={open ? "M3 7 H11" : "M5 5 L9 9 M9 5 L5 9"} stroke={open ? color : off} strokeWidth="1.3" fill="none" />
        </svg>
      );
    }

    case "coil":
      // relay / contactor coil — energised glow
      return (
        <svg width="15" height="15" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5.5" fill="none" stroke={on ? color : off} strokeWidth="1.2"
            style={{ filter: on ? `drop-shadow(0 0 3px ${color})` : "none" }} />
          <text x="7" y="9.5" fontSize="6" textAnchor="middle" fill={on ? color : off}>~</text>
        </svg>
      );

    case "buzzer":
      return (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[11px]" style={{ color: on ? color : off }}>
          {on ? "♪" : "♩"}
        </span>
      );

    case "ssr":
      return (
        <svg width="15" height="15" viewBox="0 0 14 14">
          <rect x="2" y="2" width="10" height="10" rx="1.5" fill={on ? color : "#1f2933"} stroke={on ? color : off} strokeWidth="1"
            style={{ boxShadow: on ? `0 0 6px ${color}` : "none" }} />
          <text x="7" y="9.5" fontSize="5" textAnchor="middle" fill={on ? "#000" : off} fontFamily="monospace">SSR</text>
        </svg>
      );

    default: // led / pilot lamp / tower segment
      return (
        <span
          className="led"
          style={{ background: on ? color : "#1f2933", boxShadow: on ? `0 0 8px 2px ${color}` : "none" }}
        />
      );
  }
}
