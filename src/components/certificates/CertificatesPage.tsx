import { useState } from "react";
import { CERTIFICATES, certStatus, verifyId, type CertDef } from "../../certificates/certificates";
import { useProject } from "../../store/projectStore";
import Certificate from "./Certificate";

export default function CertificatesPage() {
  const setSection = useProject((s) => s.setSection);
  const user = useProject((s) => s.user);
  const progress = useProject((s) => s.progress);

  const completions = progress?.completions ?? [];
  const statuses = CERTIFICATES.map((c) => certStatus(c, completions));
  const [viewing, setViewing] = useState<CertDef | null>(null);

  const fmtDate = (ts: number | null) =>
    new Date(ts ?? Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  if (viewing) {
    const st = statuses.find((s) => s.cert.id === viewing.id)!;
    return (
      <div className="min-h-screen bg-[#0B0E13] text-gray-200">
        <style>{`@media print {
          body * { visibility: hidden !important; }
          #cert-print, #cert-print * { visibility: visible !important; }
          #cert-print { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4 landscape; margin: 10mm; }
        }`}</style>
        <header className="no-print flex items-center gap-3 border-b border-[#21262D] bg-[#0F141B] px-4 py-2">
          <button onClick={() => setViewing(null)} className="rounded border border-[#30363D] px-2 py-1 text-xs text-gray-300 hover:border-amber-500">
            ← Back to certificates
          </button>
          <span className="font-semibold text-gray-100">{viewing.title}</span>
          <button onClick={() => window.print()} className="ml-auto rounded bg-amber-500 px-3 py-1 text-sm font-semibold text-black hover:brightness-110">
            ⎙ Print / Save PDF
          </button>
        </header>
        <div className="flex justify-center p-6">
          <div id="cert-print" className="w-full max-w-5xl">
            <Certificate
              recipientName={user?.name ?? "Apprentice Engineer"}
              cert={viewing}
              verifyId={verifyId(viewing, user?.id ?? 0)}
              dateStr={fmtDate(st.earnedAt)}
              xp={progress?.totalXp}
            />
          </div>
        </div>
        <p className="no-print pb-8 text-center text-xs text-gray-600">
          Tip: in the print dialog choose “Save as PDF”, landscape, and enable “Background graphics”.
        </p>
      </div>
    );
  }

  const earnedCount = statuses.filter((s) => s.earned).length;

  return (
    <div className="min-h-screen bg-ink text-gray-200">
      <header className="flex items-center justify-between border-b border-[#21262D] bg-[#0F141B] px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setSection("hub")} className="rounded border border-[#30363D] px-2 py-1 text-xs text-gray-300 hover:border-amber-500">
            ← Home
          </button>
          <span className="font-semibold text-gray-100">Certificates</span>
        </div>
        <span className="font-mono text-[11px] text-gray-400">{earnedCount}/{statuses.length} earned</span>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-100">Your certificate</h1>
        <p className="mb-8 mt-1 text-sm text-gray-500">
          Complete every scenario in the curriculum to earn the Certified PLC Programmer certificate — verifiable and ready to print or save as PDF.
        </p>

        <div className="grid gap-5">
          {statuses.map(({ cert, earned, done, total, earnedAt }) => (
            <div
              key={cert.id}
              className={`relative overflow-hidden rounded-2xl border p-5 transition ${
                earned ? "cursor-pointer border-[#3a3322] bg-[#16130c] hover:border-amber-500" : "border-[#21262D] bg-[#11141a]"
              }`}
              onClick={() => earned && setViewing(cert)}
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${cert.accent}22`, color: cert.accent }}>
                  <RibbonIcon />
                </div>
                {earned ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">✓ Earned</span>
                ) : (
                  <span className="rounded-full bg-[#21262D] px-2 py-0.5 text-[10px] font-medium text-gray-500">Locked</span>
                )}
              </div>

              <div className="mt-3 text-base font-semibold text-gray-100">{cert.title}</div>
              <div className="text-[12px] text-gray-500">{cert.subtitle}</div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[10px] text-gray-500">
                  <span>{done}/{total} scenarios</span>
                  {earned && earnedAt && <span>{fmtDate(earnedAt)}</span>}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded bg-black/40">
                  <div className="h-full rounded" style={{ width: `${total ? (done / total) * 100 : 0}%`, background: cert.accent }} />
                </div>
              </div>

              {earned && (
                <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: cert.accent }}>
                  View certificate
                  <span>→</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function RibbonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14.5 L7 22 L12 19 L17 22 L15 14.5" />
    </svg>
  );
}
