import { ALL_SCENARIOS } from "../scenarios";
import { useProject } from "../store/projectStore";

/**
 * Post-login home. Two clearly-separated destinations:
 *  • Simulation Studio — the open-ended sandbox (build & save your own programs)
 *  • VoltRung Academy  — the guided, auto-graded coursework
 */
export default function Hub() {
  const user = useProject((s) => s.user);
  const signOut = useProject((s) => s.signOut);
  const setSection = useProject((s) => s.setSection);
  const projects = useProject((s) => s.projects);
  const progress = useProject((s) => s.progress);

  return (
    <div className="min-h-screen bg-ink text-gray-200">
      <header className="flex items-center justify-between border-b border-[#21262D] bg-[#0F141B] px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-energised font-bold text-black">V</div>
          <span className="font-semibold text-gray-100">VoltRung</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span title={user?.email}>{user?.name}</span>
          <button onClick={signOut} className="text-gray-500 hover:text-fault">
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-gray-100">
          Welcome back, {user?.name?.split(" ")[0] ?? "engineer"}.
        </h1>
        <p className="mb-10 mt-1 text-sm text-gray-500">Choose where you want to work today.</p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Simulation Studio */}
          <button
            onClick={() => setSection("studio")}
            className="group relative overflow-hidden rounded-2xl border border-[#30363D] bg-[#11161D] p-6 text-left transition hover:border-energised hover:shadow-[0_0_0_1px_rgba(249,115,22,0.4)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-energised/15 text-2xl text-energised">⚙</div>
            <div className="text-lg font-semibold text-gray-100">Simulation Studio</div>
            <p className="mt-1 text-sm text-gray-400">
              An open-ended PLC sandbox. Wire up the I/O chassis, build ladder logic, run the scan cycle, and save your programs to your account.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500">
              <span className="rounded bg-[#21262D] px-2 py-0.5">{projects.length} saved file{projects.length === 1 ? "" : "s"}</span>
              <span className="rounded bg-[#21262D] px-2 py-0.5">Free build</span>
            </div>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-energised">
              Open Studio
              <span className="transition group-hover:translate-x-0.5">→</span>
            </div>
          </button>

          {/* VoltRung Academy */}
          <button
            onClick={() => setSection("academy")}
            className="group relative overflow-hidden rounded-2xl border border-[#30363D] bg-[#0E1622] p-6 text-left transition hover:border-sky-500 hover:shadow-[0_0_0_1px_rgba(14,165,233,0.4)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/15 text-2xl text-sky-400">🎓</div>
            <div className="text-lg font-semibold text-gray-100">VoltRung Academy</div>
            <p className="mt-1 text-sm text-gray-400">
              Guided, hands-on coursework. Each lesson loads a wired chassis and a task brief — build the logic, then auto-grade your solution against a test suite.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500">
              {progress ? (
                <>
                  <span className="rounded bg-sky-500/20 px-2 py-0.5 font-semibold text-sky-300">Level {progress.level}</span>
                  <span className="rounded bg-[#21262D] px-2 py-0.5">{progress.totalXp} XP</span>
                  <span className="rounded bg-[#21262D] px-2 py-0.5">{progress.completions.length}/{ALL_SCENARIOS.length} done</span>
                </>
              ) : (
                <>
                  <span className="rounded bg-[#21262D] px-2 py-0.5">{ALL_SCENARIOS.length} scenarios</span>
                  <span className="rounded bg-[#21262D] px-2 py-0.5">Auto-graded</span>
                </>
              )}
            </div>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-400">
              Enter Academy
              <span className="transition group-hover:translate-x-0.5">→</span>
            </div>
          </button>

          {/* Wiring Tutor */}
          <button
            onClick={() => setSection("wiring")}
            className="group relative overflow-hidden rounded-2xl border border-[#30363D] bg-[#161109] p-6 text-left transition hover:border-amber-500 hover:shadow-[0_0_0_1px_rgba(245,158,11,0.4)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-2xl text-amber-400">⎓</div>
            <div className="text-lg font-semibold text-gray-100">Wiring Tutor</div>
            <p className="mt-1 text-sm text-gray-400">
              A DIN-rail wiring lab. Connect field devices to the PLC terminals with correctly-coloured wires —
              the continuity checker flags missing 0 V returns, absent PE bonds, and wrong terminals.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500">
              <span className="rounded bg-[#21262D] px-2 py-0.5">3 exercises</span>
              <span className="rounded bg-[#21262D] px-2 py-0.5">Colour-coded</span>
            </div>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-400">
              Open Wiring Lab
              <span className="transition group-hover:translate-x-0.5">→</span>
            </div>
          </button>

          {/* Certificates */}
          <button
            onClick={() => setSection("certificates")}
            className="group relative overflow-hidden rounded-2xl border border-[#30363D] bg-[#0f1410] p-6 text-left transition hover:border-emerald-500 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.4)]"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl text-emerald-400">🏅</div>
            <div className="text-lg font-semibold text-gray-100">Certificate</div>
            <p className="mt-1 text-sm text-gray-400">
              Complete the entire curriculum to earn your verifiable, print-ready
              <span className="text-gray-300"> Certified PLC Programmer</span> certificate.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-500">
              <span className="rounded bg-[#21262D] px-2 py-0.5">Capstone credential</span>
              <span className="rounded bg-[#21262D] px-2 py-0.5">Printable PDF</span>
            </div>
            <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-400">
              View Certificate
              <span className="transition group-hover:translate-x-0.5">→</span>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
