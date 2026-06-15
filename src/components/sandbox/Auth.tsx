import { useState } from "react";
import { useProject } from "../../store/projectStore";

/** Email/password sign-in + registration. Shown whenever no user is signed in. */
export default function Auth() {
  const register = useProject((s) => s.register);
  const login = useProject((s) => s.login);
  const pending = useProject((s) => s.authPending);
  const authError = useProject((s) => s.authError);
  const clearAuthError = useProject((s) => s.clearAuthError);

  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register") register(email, name, password);
    else login(email, password);
  };

  const swap = (next: "login" | "register") => {
    setMode(next);
    clearAuthError();
  };

  return (
    <div className="flex h-screen items-center justify-center bg-ink">
      <div className="w-96 rounded-xl border border-[#21262D] bg-panel p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-energised font-bold text-black">V</div>
          <div>
            <div className="font-semibold text-gray-100">VoltRung</div>
            <div className="text-[11px] text-gray-500">Sign in to simulate and learn PLCs</div>
          </div>
        </div>

        <div className="mb-4 flex rounded-lg border border-[#21262D] p-0.5 text-sm">
          <button
            type="button"
            onClick={() => swap("register")}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === "register" ? "bg-energised text-black" : "text-gray-400"}`}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => swap("login")}
            className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === "login" ? "bg-energised text-black" : "text-gray-400"}`}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Engineer" className={inputCls} />
            </Field>
          )}
          <Field label="Email">
            <input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "At least 6 characters" : "••••••••"}
              className={inputCls}
            />
          </Field>

          {authError && <div className="rounded border border-fault/40 bg-fault/10 px-3 py-2 text-xs text-fault">{authError}</div>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded bg-energised px-3 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Working…" : mode === "register" ? "Create account →" : "Sign in →"}
          </button>
        </form>

        <p className="mt-4 text-[10px] leading-relaxed text-gray-600">
          Your account and saved programs are stored on the VoltRung server, so they follow you across devices.
        </p>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded border border-[#30363D] bg-[#0D1117] px-3 py-2 text-sm text-gray-100 focus:border-energised focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}
