import { useEffect, useState } from "react";
import { getBool } from "../../engine/scan";
import { useSim } from "../../store/simulatorStore";
import type { InputBinding, InputDevice, OutputBinding } from "../../scenarios/types";
import { AnalogInputModule, AnalogOutputModule } from "./AnalogModules";
import { BcdThumbwheel, HighSpeedCounter, SevenSegDisplay } from "../sandbox/SpecialModules";

// 16-point modules
const POINTS = Array.from({ length: 16 }, (_, i) => i);

export default function IOChassis() {
  const scenario = useSim((s) => s.scenario);
  const tags = useSim((s) => s.tags);
  const setInput = useSim((s) => s.setInput);

  // local actuation state per input address (pressed/toggled)
  const [act, setAct] = useState<Record<string, boolean>>({});

  // electrical value of a device given its actuation state
  const electrical = (dev: InputDevice, on: boolean): boolean => {
    switch (dev) {
      case "NC_PB":
        return !on; // HIGH at rest, LOW while held
      default:
        return on; // NO_PB / TOGGLE / NO_LS / PROX
    }
  };

  // (re)initialise inputs to their rest state whenever the scenario changes
  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const inp of scenario.inputs) {
      init[inp.address] = false;
      setInput(inp.tag, electrical(inp.device, false));
    }
    setAct(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  const drive = (inp: InputBinding, on: boolean) => {
    setAct((a) => ({ ...a, [inp.address]: on }));
    setInput(inp.tag, electrical(inp.device, on));
  };

  const inputByAddr = (addr: string) => scenario.inputs.find((i) => i.address === addr);
  const outputByAddr = (addr: string) => scenario.outputs.find((o) => o.address === addr);

  return (
    <div className="rounded-lg border border-black/40 bg-gunmetal p-3 shadow-inner">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-mono text-xs font-bold tracking-wide text-gray-200">I/O CHASSIS</h3>
        <span className="font-mono text-[10px] text-gray-400">24 VDC · sourcing</span>
      </div>

      {/* SECTION A — Discrete Inputs */}
      <ModuleShell title="DISCRETE INPUT  ·  I:0" accent="#22C55E">
        {POINTS.map((p) => {
          const addr = `I:0/${p}`;
          const inp = inputByAddr(addr);
          const on = inp ? electrical(inp.device, act[addr] ?? false) : false;
          return (
            <InputRow key={addr} addr={addr} on={on} binding={inp} onDrive={drive} />
          );
        })}
      </ModuleShell>

      {/* SECTION B — Discrete Outputs */}
      <div className="mt-3">
        <ModuleShell title="DISCRETE OUTPUT  ·  O:0" accent="#F97316">
          {POINTS.map((p) => {
            const addr = `O:0/${p}`;
            const out = outputByAddr(addr);
            const on = out ? getBool(tags, out.tag) : false;
            return <OutputRow key={addr} addr={addr} on={on} binding={out} />;
          })}
        </ModuleShell>
      </div>

      {/* SECTION C — Analog Inputs */}
      {scenario.analogIn && scenario.analogIn.length > 0 && (
        <AnalogInputModule channels={scenario.analogIn} />
      )}

      {/* SECTION D — Analog Outputs */}
      {scenario.analogOut && scenario.analogOut.length > 0 && (
        <AnalogOutputModule channels={scenario.analogOut} />
      )}

      {/* SECTION E — BCD Thumbwheel input */}
      {scenario.thumbwheel && (
        <div className="mt-3">
          <BcdThumbwheel key={scenario.id} tag={scenario.thumbwheel.tag} setInput={setInput} />
        </div>
      )}

      {/* SECTION F — 7-Segment display output */}
      {scenario.sevenSeg && (
        <div className="mt-3">
          <SevenSegDisplay tag={scenario.sevenSeg.tag} tags={tags} />
        </div>
      )}

      {/* SECTION G — High-Speed Counter input */}
      {scenario.hsc && (
        <div className="mt-3">
          <HighSpeedCounter tag={scenario.hsc.tag} tags={tags} setInput={setInput} />
        </div>
      )}
    </div>
  );
}

function ModuleShell({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-black/50 bg-[#252B33]">
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

function InputRow({
  addr,
  on,
  binding,
  onDrive,
}: {
  addr: string;
  on: boolean;
  binding?: InputBinding;
  onDrive: (b: InputBinding, on: boolean) => void;
}) {
  const momentary = binding?.device === "NO_PB" || binding?.device === "NC_PB";

  const handlers = binding
    ? momentary
      ? {
          onMouseDown: () => onDrive(binding, true),
          onMouseUp: () => onDrive(binding, false),
          onMouseLeave: () => onDrive(binding, false),
        }
      : { onClick: () => onDrive(binding, !(activeState(binding, on))) }
    : {};

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <span className={`led ${on ? "led-green-on" : "led-off"}`} />
      <span className="w-12 font-mono text-[10px] text-gray-400">{addr}</span>
      {binding ? (
        <>
          <button
            {...handlers}
            className="rounded border border-black/40 bg-[#1b2027] px-2 py-0.5 text-[10px] text-gray-100 hover:border-energised active:bg-[#2d343d]"
            title={deviceTitle(binding.device)}
          >
            {deviceGlyph(binding.device)} {binding.device}
          </button>
          <span className="dymo">{binding.label}</span>
          <span className="ml-auto font-mono text-[10px] text-gray-500">{binding.tag}</span>
        </>
      ) : (
        <span className="font-mono text-[10px] text-gray-600">spare</span>
      )}
    </div>
  );
}

// derive the latched "actuation" boolean back out of electrical state for toggles
function activeState(b: InputBinding, electricalOn: boolean): boolean {
  return b.device === "NC_PB" ? !electricalOn : electricalOn;
}

function OutputRow({
  addr,
  on,
  binding,
}: {
  addr: string;
  on: boolean;
  binding?: OutputBinding;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <span className={`led ${on ? "led-amber-on" : "led-off"}`} />
      <span className="w-12 font-mono text-[10px] text-gray-400">{addr}</span>
      {binding ? (
        <>
          <OutputDeviceGlyph binding={binding} on={on} />
          <span className="dymo">{binding.label}</span>
          <span className="ml-auto font-mono text-[10px] text-gray-500">{binding.tag}</span>
        </>
      ) : (
        <span className="font-mono text-[10px] text-gray-600">spare</span>
      )}
    </div>
  );
}

function OutputDeviceGlyph({ binding, on }: { binding: OutputBinding; on: boolean }) {
  const color =
    binding.device === "PILOT_GREEN"
      ? "#22C55E"
      : binding.device === "PILOT_RED"
        ? "#EF4444"
        : "#F59E0B";

  if (binding.device === "MOTOR") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-gray-200">
        <svg width="18" height="18" viewBox="0 0 18 18">
          <circle cx="9" cy="9" r="7" fill="none" stroke={on ? "#22C55E" : "#4B5563"} strokeWidth="1.5" />
          <g style={{ transformOrigin: "9px 9px", animation: on ? "spin 0.8s linear infinite" : "none" }}>
            <line x1="9" y1="3" x2="9" y2="9" stroke={on ? "#22C55E" : "#4B5563"} strokeWidth="1.5" />
          </g>
        </svg>
        <span style={{ color: on ? "#22C55E" : "#6B7280" }}>{on ? "RUN" : "stop"}</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </span>
    );
  }
  if (binding.device === "SOLENOID") {
    return (
      <span className="text-[10px]" style={{ color: on ? "#22C55E" : "#6B7280" }}>
        {on ? "▣ OPEN" : "▢ shut"}
      </span>
    );
  }
  if (binding.device === "BUZZER") {
    return (
      <span className="text-[10px]" style={{ color: on ? color : "#6B7280" }}>
        {on ? "♪ horn" : "horn"}
      </span>
    );
  }
  // pilot lights
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-3 w-3 rounded-full border border-black/50"
        style={{
          background: on ? color : "#1f2933",
          boxShadow: on ? `0 0 8px 2px ${color}` : "none",
        }}
      />
      <span className="text-[10px] text-gray-300">pilot</span>
    </span>
  );
}

function deviceGlyph(d: InputDevice): string {
  switch (d) {
    case "NO_PB":
      return "⊙";
    case "NC_PB":
      return "⊘";
    case "TOGGLE":
      return "⇄";
    case "NO_LS":
      return "⌐";
    case "PROX":
      return "◧";
  }
}
function deviceTitle(d: InputDevice): string {
  switch (d) {
    case "NO_PB":
      return "NO momentary pushbutton — HIGH while held";
    case "NC_PB":
      return "NC momentary pushbutton — LOW while held (HIGH at rest)";
    case "TOGGLE":
      return "SPST toggle — click to latch on/off";
    case "NO_LS":
      return "NO limit switch — click to toggle";
    case "PROX":
      return "Proximity sensor — click to toggle target";
  }
}
