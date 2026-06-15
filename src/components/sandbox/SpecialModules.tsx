import { useEffect, useState } from "react";
import { decToBcd, getNum } from "../../engine/scan";
import type { TagStore } from "../../engine/types";

type SetInput = (name: string, value: number | boolean) => void;

// ─── Section E — BCD thumbwheel input (4-digit, 0000–9999) ───────────────────
// Four mechanical thumbwheel digits. The bank feeds a 16-bit BCD register
// (one decimal digit per nibble) — convert to a working integer in the ladder
// with FRD.

export function BcdThumbwheel({ tag, setInput }: { tag: string; setInput: SetInput }) {
  const [digits, setDigits] = useState([0, 0, 0, 0]); // [thousands…ones]

  const value = digits[0] * 1000 + digits[1] * 100 + digits[2] * 10 + digits[3];
  const bcd = decToBcd(value);

  // push the BCD code to the register whenever a wheel moves (and on mount)
  useEffect(() => {
    setInput(tag, bcd);
  }, [bcd, tag, setInput]);

  const bump = (i: number, dir: 1 | -1) =>
    setDigits((d) => d.map((v, j) => (j === i ? (v + dir + 10) % 10 : v)));

  return (
    <Shell title={`BCD THUMBWHEEL · ${tag}`} accent="#FACC15">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="flex gap-1">
          {digits.map((d, i) => (
            <div key={i} className="flex flex-col items-center">
              <Arrow dir="up" onClick={() => bump(i, 1)} />
              <div className="my-0.5 flex h-8 w-6 items-center justify-center rounded bg-black font-mono text-lg font-bold text-amber-300 shadow-inner">
                {d}
              </div>
              <Arrow dir="down" onClick={() => bump(i, -1)} />
            </div>
          ))}
        </div>
        <div className="ml-auto text-right font-mono text-[10px] leading-relaxed text-gray-400">
          <div>
            value <span className="text-amber-200">{value}</span>
          </div>
          <div>
            BCD code{" "}
            <span className="text-amber-200">
              0x{bcd.toString(16).toUpperCase().padStart(4, "0")}
            </span>{" "}
            ({bcd})
          </div>
          <div className="text-gray-500">→ FRD {tag} to decode</div>
        </div>
      </div>
    </Shell>
  );
}

function Arrow({ dir, onClick }: { dir: "up" | "down"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-4 w-6 items-center justify-center rounded border border-black/40 bg-[#2d343d] text-[9px] text-gray-300 hover:border-energised hover:text-energised active:bg-[#3a424d]"
      title={dir === "up" ? "increment digit" : "decrement digit"}
    >
      {dir === "up" ? "▲" : "▼"}
    </button>
  );
}

// ─── Section F — 7-segment display output (4-digit, 0000–9999) ────────────────
// Reads the decimal value of SS:0 (drive it from the ladder with MOV / TOD).

// Segment map a,b,c,d,e,f,g for each decimal digit.
const SEG: Record<number, [boolean, boolean, boolean, boolean, boolean, boolean, boolean]> = {
  0: [true, true, true, true, true, true, false],
  1: [false, true, true, false, false, false, false],
  2: [true, true, false, true, true, false, true],
  3: [true, true, true, true, false, false, true],
  4: [false, true, true, false, false, true, true],
  5: [true, false, true, true, false, true, true],
  6: [true, false, true, true, true, true, true],
  7: [true, true, true, false, false, false, false],
  8: [true, true, true, true, true, true, true],
  9: [true, true, true, true, false, true, true],
};

export function SevenSegDisplay({ tag, tags }: { tag: string; tags: TagStore }) {
  const raw = Math.trunc(getNum(tags, tag));
  const value = Math.max(0, Math.min(9999, raw));
  const text = value.toString().padStart(4, "0");

  return (
    <Shell title={`7-SEG DISPLAY · ${tag}`} accent="#F97316">
      <div className="flex items-center gap-2 px-2 py-2">
        <div className="flex gap-1.5 rounded bg-black px-2 py-1.5 shadow-inner">
          {text.split("").map((ch, i) => (
            <SegDigit key={i} digit={Number(ch)} />
          ))}
        </div>
        <div className="ml-auto font-mono text-[10px] text-gray-400">
          {raw < 0 || raw > 9999 ? (
            <span className="text-fault">value {raw} out of 0–9999</span>
          ) : (
            <span className="text-gray-500">MOV a value into {tag}</span>
          )}
        </div>
      </div>
    </Shell>
  );
}

function SegDigit({ digit }: { digit: number }) {
  const on = SEG[digit] ?? SEG[0];
  const ON = "#F97316";
  const OFF = "#3a2410";
  const c = (i: number) => (on[i] ? ON : OFF);
  const glow = (i: number) => (on[i] ? `drop-shadow(0 0 1.5px ${ON})` : "none");
  // a=0 b=1 c=2 d=3 e=4 f=5 g=6
  return (
    <svg width="24" height="44" viewBox="0 0 24 44">
      {/* horizontals: a, g, d */}
      <rect x="5" y="2" width="14" height="3" rx="1.5" fill={c(0)} style={{ filter: glow(0) }} />
      <rect x="5" y="20.5" width="14" height="3" rx="1.5" fill={c(6)} style={{ filter: glow(6) }} />
      <rect x="5" y="39" width="14" height="3" rx="1.5" fill={c(3)} style={{ filter: glow(3) }} />
      {/* verticals: f, b (top), e, c (bottom) */}
      <rect x="3" y="5" width="3" height="15" rx="1.5" fill={c(5)} style={{ filter: glow(5) }} />
      <rect x="18" y="5" width="3" height="15" rx="1.5" fill={c(1)} style={{ filter: glow(1) }} />
      <rect x="3" y="24" width="3" height="15" rx="1.5" fill={c(4)} style={{ filter: glow(4) }} />
      <rect x="18" y="24" width="3" height="15" rx="1.5" fill={c(2)} style={{ filter: glow(2) }} />
    </svg>
  );
}

// ─── Section G — high-speed counter input ────────────────────────────────────
// Jog the simulated encoder to accumulate pulses into HSC:0. Compare HSC:0
// against a setpoint in the ladder for positioning lessons.

export function HighSpeedCounter({
  tag,
  tags,
  setInput,
}: {
  tag: string;
  tags: TagStore;
  setInput: SetInput;
}) {
  const pos = Math.trunc(getNum(tags, tag));

  const jog = (delta: number) => setInput(tag, pos + delta);

  return (
    <Shell title={`HIGH-SPEED COUNTER · ${tag}`} accent="#34D399">
      <div className="flex items-center gap-3 px-2 py-2">
        <EncoderDisk pos={pos} />
        <div>
          <div className="font-mono text-lg font-bold text-emerald-300">{pos}</div>
          <div className="font-mono text-[9px] text-gray-500">pulses (counts)</div>
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {[-10, -1, 1, 10].map((d) => (
            <button
              key={d}
              onClick={() => jog(d)}
              className="w-9 rounded border border-black/40 bg-[#1b2027] py-1 font-mono text-[11px] text-gray-200 hover:border-energised hover:text-energised active:bg-[#2d343d]"
            >
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
          <button
            onClick={() => setInput(tag, 0)}
            className="rounded border border-black/40 bg-[#1b2027] px-2 py-1 font-mono text-[11px] text-gray-300 hover:border-fault hover:text-fault"
          >
            RES
          </button>
        </div>
      </div>
    </Shell>
  );
}

function EncoderDisk({ pos }: { pos: number }) {
  // static rotation reflecting position — no animation (screenshot-safe)
  const angle = (pos * 15) % 360;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15" fill="#11151b" stroke="#34D399" strokeWidth="1.3" />
      <g transform={`rotate(${angle} 18 18)`}>
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x="17"
            y="3"
            width="2"
            height="5"
            fill="#34D399"
            transform={`rotate(${i * 45} 18 18)`}
          />
        ))}
        <line x1="18" y1="18" x2="18" y2="5" stroke="#A7F3D0" strokeWidth="1.5" />
      </g>
      <circle cx="18" cy="18" r="2.5" fill="#34D399" />
    </svg>
  );
}

// ─── shared module shell (matches SandboxChassis) ────────────────────────────
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
    <div className="rounded-md border border-black/50 bg-[#252B33]">
      <div
        className="rounded-t-md px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-black"
        style={{ background: accent }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
