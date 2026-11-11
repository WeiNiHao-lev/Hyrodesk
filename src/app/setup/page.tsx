"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { setupAdmin, useAuth } from "@/lib/store/auth";
import { resetHealthCache } from "@/lib/store/db";

/** The first account on a fresh cloud database. Gone once it exists. */
export default function SetupPage() {
  const router = useRouter();
  const { loaded, cloud, me, needsSetup, refresh } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    if (!cloud) router.replace("/projects");
    else if (me) router.replace("/projects");
    else if (!needsSetup) router.replace("/login");
  }, [loaded, cloud, me, needsSetup, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    setBusy(true);
    try {
      await setupAdmin({ username, password, displayName });
      resetHealthCache();
      await refresh();
      router.replace("/account");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (!loaded || !needsSetup) return <div className="p-10 text-center text-[0.8rem] text-ink-300">Loading…</div>;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-14">
      <div className="card p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-aqua-600" />
          <h1 className="text-[1.05rem] font-bold text-ink-900">Create the administrator account</h1>
        </div>
        <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-500">
          This database has no accounts yet. The account made here becomes the administrator and
          owns every project already stored. The administrator sets the invite code teammates use to
          create their own accounts. Do this now: until it is done, the first person to open this page
          could take it.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label className="label">Your name</label>
            <input className="field mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="label">Username</label>
            <input className="field mt-1" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password (at least 8 characters)</label>
            <input className="field mt-1" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">Repeat password</label>
            <input className="field mt-1" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && <p className="rounded-lg bg-coral-100 px-3 py-2 text-[0.75rem] text-coral-700">{error}</p>}
          <button className="btn btn-primary w-full justify-center" disabled={busy}>
            {busy ? "Creating…" : "Create administrator"}
          </button>
        </form>
      </div>
    </div>
  );
}
