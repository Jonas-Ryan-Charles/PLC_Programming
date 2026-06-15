import type { CSSProperties } from "react";
import type { CertDef } from "../../certificates/certificates";

interface Props {
  recipientName: string;
  cert: CertDef;
  verifyId: string;
  dateStr: string;
  xp?: number;
  /** Name shown on the signature line (the course developer). */
  signatory?: string;
}

// All inner sizing is in cqw (1% of the certificate's own width) so the whole
// document scales proportionally — text, seal, borders — with no overflow.
const fs = (min: number, cqw: number, max: number): CSSProperties => ({
  fontSize: `clamp(${min}px, ${cqw}cqw, ${max}px)`,
});

/** A print-ready certificate. Fixed A4-landscape ratio; scales to its container. */
export default function Certificate({ recipientName, cert, verifyId, dateStr, xp, signatory = "Jonas" }: Props) {
  const accent = cert.accent;
  return (
    <div
      className="certificate relative mx-auto w-full select-none bg-[#FBF7EC] text-[#1A2238] shadow-2xl"
      style={{ aspectRatio: "1.414 / 1", maxWidth: 980, containerType: "inline-size", fontFamily: '"Cormorant Garamond", Georgia, serif' }}
    >
      {/* engraved guilloché backdrop */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1414 1000" preserveAspectRatio="none">
        <defs>
          <radialGradient id={`vig-${cert.id}`} cx="50%" cy="40%" r="72%">
            <stop offset="0%" stopColor="#FFFDF8" />
            <stop offset="100%" stopColor="#F3EAD3" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="1414" height="1000" fill={`url(#vig-${cert.id})`} />
        {Array.from({ length: 24 }, (_, i) => (
          <circle key={i} cx="707" cy="470" r={70 + i * 30} fill="none" stroke={accent} strokeWidth="0.7" opacity="0.045" />
        ))}
      </svg>

      {/* double border + corner flourishes */}
      <div className="absolute" style={{ inset: "2.2%", border: `0.32cqw solid ${accent}` }} />
      <div className="absolute" style={{ inset: "3.1%", border: "0.1cqw solid #9C8A4E" }} />
      {([
        ["top-0 left-0", "rotate-0"],
        ["top-0 right-0", "rotate-90"],
        ["bottom-0 right-0", "rotate-180"],
        ["bottom-0 left-0", "-rotate-90"],
      ] as const).map(([pos, rot], i) => (
        <svg key={i} className={`absolute ${pos} ${rot}`} style={{ width: "7cqw", height: "7cqw", margin: "2.2%" }} viewBox="0 0 68 68" fill="none">
          <path d="M2 2 L42 2 M2 2 L2 42 M2 2 Q32 9 38 38 Q9 32 2 2 Z" stroke={accent} strokeWidth="1.4" fill={accent} fillOpacity="0.08" />
          <circle cx="12" cy="12" r="2.4" fill="#9C8A4E" />
        </svg>
      ))}

      {/* content */}
      <div className="absolute inset-0 flex flex-col items-center px-[9%] pb-[8%] pt-[6%] text-center">
        {/* emblem / wordmark */}
        <div className="flex items-center gap-2">
          <Mark accent={accent} />
          <div className="text-left">
            <div className="font-mono font-bold uppercase tracking-[0.42em] text-[#1A2238]" style={fs(9, 1.35, 14)}>VoltRung</div>
            <div className="font-mono uppercase tracking-[0.4em] text-[#9C8A4E]" style={fs(6, 0.92, 9)}>Academy of Automation</div>
          </div>
        </div>

        <div className="mt-[3%] font-bold uppercase tracking-[0.22em]" style={{ ...fs(20, 4.4, 44), fontFamily: '"Playfair Display", Georgia, serif', color: accent }}>
          Certificate
        </div>
        <div className="-mt-[0.3%] font-mono uppercase tracking-[0.55em] text-[#6B6450]" style={fs(7, 1.1, 12)}>of Completion</div>

        <div className="mt-[3%] italic text-[#5B5642]" style={fs(11, 1.55, 17)}>This is proudly presented to</div>

        {/* recipient */}
        <div className="mt-[0.4%] leading-none text-[#16203A]" style={{ ...fs(30, 8.2, 80), fontFamily: '"Great Vibes", "Cormorant Garamond", cursive' }}>
          {recipientName}
        </div>
        <div className="mx-auto mt-[1.2%] h-px w-[56%]" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

        {/* body */}
        <p className="mt-[2.6%] max-w-[80%] leading-snug text-[#3A3729]" style={fs(11, 1.9, 18)}>
          {cert.description}
        </p>

        <div className="mt-[2%] font-semibold" style={{ ...fs(15, 2.5, 27), fontFamily: '"Playfair Display", Georgia, serif', color: "#16203A" }}>
          {cert.title}
        </div>
        {typeof xp === "number" && (
          <div className="mt-[0.6%] font-mono uppercase tracking-[0.3em] text-[#9C8A4E]" style={fs(8, 1, 11)}>
            {xp.toLocaleString()} XP earned
          </div>
        )}

        {/* footer: date (left) · seal (centre) · signature (right) — bottom-aligned */}
        <div className="mt-auto grid w-full grid-cols-3 items-end gap-3">
          {/* date */}
          <div className="text-center">
            <div className="leading-tight" style={fs(11, 1.45, 16)}>{dateStr}</div>
            <div className="mt-1 border-t border-[#9C8A4E]" />
            <div className="mt-1 font-mono uppercase tracking-[0.25em] text-[#6B6450]" style={fs(7, 0.85, 9)}>Date of Issue</div>
          </div>
          {/* seal + verification id */}
          <div className="flex flex-col items-center">
            <div style={{ width: "13cqw" }}>
              <Seal accent={accent} code={cert.code} />
            </div>
            <div className="mt-1 font-mono uppercase tracking-[0.16em] text-[#8A8266]" style={fs(7, 0.78, 9)}>{verifyId}</div>
          </div>
          {/* signature */}
          <div className="text-center">
            <div className="leading-tight" style={{ ...fs(15, 2, 24), fontFamily: '"Great Vibes", cursive', color: "#16203A" }}>{signatory}</div>
            <div className="mt-1 border-t border-[#9C8A4E]" />
            <div className="mt-1 font-mono uppercase tracking-[0.25em] text-[#6B6450]" style={fs(7, 0.85, 9)}>Course Developer</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lightning-bolt "V" emblem. */
function Mark({ accent }: { accent: string }) {
  return (
    <svg style={{ width: "4.2cqw", height: "4.2cqw", minWidth: 30 }} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18.5" fill="none" stroke={accent} strokeWidth="1.6" />
      <circle cx="20" cy="20" r="15" fill="none" stroke="#9C8A4E" strokeWidth="0.8" />
      <path d="M22 8 L13 22 L19 22 L17 32 L27 17 L21 17 Z" fill={accent} />
    </svg>
  );
}

/** Engraved gold seal medallion with an industrial cog ring. */
function Seal({ accent, code }: { accent: string; code: string }) {
  const teeth = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return (
      <line key={i} x1={60 + Math.cos(a) * 46} y1={60 + Math.sin(a) * 46} x2={60 + Math.cos(a) * 53} y2={60 + Math.sin(a) * 53} stroke="#C9A227" strokeWidth="2.6" />
    );
  });
  return (
    <svg className="w-full" viewBox="0 0 120 120" style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" }}>
      <defs>
        <radialGradient id={`seal-${code}`} cx="42%" cy="36%" r="72%">
          <stop offset="0%" stopColor="#F6E27A" />
          <stop offset="55%" stopColor="#D4AF37" />
          <stop offset="100%" stopColor="#9C7A14" />
        </radialGradient>
      </defs>
      {teeth}
      <circle cx="60" cy="60" r="46" fill={`url(#seal-${code})`} stroke="#8A6A10" strokeWidth="1.5" />
      <circle cx="60" cy="60" r="38" fill="none" stroke="#FBF3CF" strokeWidth="1.2" opacity="0.7" />
      <circle cx="60" cy="60" r="29" fill={accent} />
      <circle cx="60" cy="60" r="29" fill="none" stroke="#FBF3CF" strokeWidth="0.8" opacity="0.5" />
      <text x="60" y="56" textAnchor="middle" fontFamily='"Playfair Display", serif' fontSize="20" fontWeight="700" fill="#FFFDF5">{code}</text>
      <text x="60" y="71" textAnchor="middle" fontFamily="monospace" fontSize="6.2" letterSpacing="2" fill="#FFFDF5">CERTIFIED</text>
    </svg>
  );
}
