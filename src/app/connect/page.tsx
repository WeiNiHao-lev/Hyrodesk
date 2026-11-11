"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Check, X } from "lucide-react";
import { answerCliRequest, CliRequest, getCliRequest, useAuth } from "@/lib/store/auth";

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <Connect />
    </Suspense>
  );
}

/**
 * Approves a machine — a Claude Code session or a script — that asked to use
 * this account. Reached from the link that machine printed; only a signed-in
 * person can approve, and only for their own account.
 */
function Connect() {
  const code = useSearchParams().get("code") ?? "";
  const me = useAuth((s) => s.me);
  const [req, setReq] = useState<CliRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "refused" | null>(null);

  useEffect(() => {
    if (!code) return;
    getCliRequest(code).then(setReq).catch((e: Error) => setError(e.message));
  }, [code]);

  const answer = async (approve: boolean) => {
    try {
      await answerCliRequest(code, approve);
      setDone(approve ? "approved" : "refused");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-14">
      <div className="card p-6">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-aqua-600" />
          <h1 className="text-[1.05rem] font-bold text-ink-900">Connect Claude Code to HydroDesk</h1>
        </div>
        {error && <p className="mt-3 rounded-lg bg-coral-100 px-3 py-2 text-[0.75rem] text-coral-700">{error}</p>}
        {!code && <p className="mt-3 text-[0.8rem] text-ink-500">No request code in this link.</p>}
        {done === "approved" && (
          <p className="mt-3 rounded-lg bg-mint-100 px-3 py-2 text-[0.8rem] text-mint-700">
            Connected. Go back to Claude Code: it will pick this up within a few seconds. You can disconnect it
            any time from <Link className="underline" href="/account">your account page</Link>.
          </p>
        )}
        {done === "refused" && <p className="mt-3 text-[0.8rem] text-ink-500">Refused. Nothing was connected.</p>}
        {req && !done && (
          <>
            <p className="mt-3 text-[0.78rem] leading-relaxed text-ink-700">
              <strong>{req.label}</strong> is asking to use your HydroDesk account
              {me ? <> (<span className="font-mono">{me.username}</span>)</> : null}. It will be able to read your
              projects and those workspaces opened to you, run simulations, and save runs and projects in your
              workspace. It cannot delete projects, create share links, change passwords or open anyone&apos;s
              workspace.
            </p>
            <div className="mt-3 rounded-lg bg-ink-900/[0.04] px-3 py-2 text-center font-mono text-[1.1rem] font-bold tracking-widest text-ink-900">
              {req.code}
            </div>
            <p className="mt-2 text-[0.7rem] text-ink-500">
              Approve only if you started this yourself just now and Claude Code shows the same code.
              Requested {new Date(req.createdAt).toLocaleTimeString("en-GB")}.
            </p>
            {req.status === "pending" ? (
              <div className="mt-4 flex gap-2">
                <button className="btn btn-primary flex-1 justify-center" onClick={() => answer(true)}>
                  <Check className="h-4 w-4" /> Approve
                </button>
                <button className="btn btn-ghost flex-1 justify-center" onClick={() => answer(false)}>
                  <X className="h-4 w-4" /> Refuse
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[0.8rem] text-ink-500">This request is {req.status}. Start again from Claude Code if needed.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
