"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { login, register, useAuth } from "@/lib/store/auth";
import { resetHealthCache } from "@/lib/store/db";
import { useT } from "@/lib/i18n";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const refresh = useAuth((s) => s.refresh);
  const t = useT();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Only a path inside this app: never an outside address passed in the link.
  const nextRaw = params.get("next") ?? "/projects";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/projects";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (tab === "register" && password !== confirm) { setError(t("The two passwords do not match.")); return; }
    setBusy(true);
    try {
      if (tab === "login") await login(username, password);
      else await register({ username, password, displayName, inviteCode });
      resetHealthCache();
      await refresh();
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-14">
      <div className="card p-6">
        <div className="mb-4 flex rounded-lg bg-ink-900/[0.04] p-1 text-[0.8rem] font-semibold">
          {(["login", "register"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setTab(k); setError(null); }}
              className={`flex-1 rounded-md px-3 py-1.5 transition ${tab === k ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"}`}
            >
              {k === "login" ? t("Sign in") : t("Create account")}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {tab === "register" && (
            <div>
              <label className="label">{t("Your name")}</label>
              <input className="field mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("Shown to teammates")} />
            </div>
          )}
          <div>
            <label className="label">{t("Username")}</label>
            <input className="field mt-1" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="label">{t("Password")}</label>
            <input className="field mt-1" type="password" autoComplete={tab === "login" ? "current-password" : "new-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {tab === "register" && (
            <>
              <div>
                <label className="label">{t("Repeat password")}</label>
                <input className="field mt-1" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <div>
                <label className="label">{t("Invite code")}</label>
                <input className="field mt-1" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
                <p className="mt-1 text-[0.68rem] text-ink-500">{t("From the HydroDesk administrator in your team.")}</p>
              </div>
            </>
          )}
          {error && <p className="rounded-lg bg-coral-100 px-3 py-2 text-[0.75rem] text-coral-700">{error}</p>}
          <button className="btn btn-primary w-full justify-center" disabled={busy}>
            {tab === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {busy ? t("Please wait…") : tab === "login" ? t("Sign in") : t("Create account")}
          </button>
        </form>
      </div>
      <p className="mt-3 text-center text-[0.68rem] text-ink-500">
        {t("Each account sees only its own projects. Someone else's work opens only with the workspace password its owner sets.")}
      </p>
      {tab === "login" && (
        <p className="mt-2 text-center text-[0.68rem] text-ink-500">
          {t("Forgot your password? Ask the HydroDesk administrator to reset it from Team administration.")}{" "}
          {t("An administrator who is locked out resets it from the database with")} <span className="font-mono">tools/admin-recovery.mjs</span>.
        </p>
      )}
    </div>
  );
}
