"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IdCard, Pencil } from "lucide-react";
import { ChangePassword, Msg, Section } from "@/components/profile/sections";
import { fetchProfile, Profile, updateDisplayName, useAuth } from "@/lib/store/auth";
import { useDate, useT } from "@/lib/i18n";

/** Account information: who this account is, a few counts, the name, the sign-in password. */
export default function AccountInformationPage() {
  const t = useT();
  const when = useDate();
  const refresh = useAuth((s) => s.refresh);
  const [p, setP] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => fetchProfile().then(setP).catch((e: Error) => setMsg({ ok: false, text: e.message })), []);
  useEffect(() => { void load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDisplayName(name);
      setEditing(false);
      setMsg({ ok: true, text: t("Name changed.") });
      await Promise.all([load(), refresh()]);
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  };

  const row = (k: string, v: React.ReactNode) => (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-b border-ink-900/6 py-2 text-[0.8rem] last:border-0">
      <dt className="text-ink-500">{k}</dt>
      <dd className="min-w-0 text-ink-900">{v}</dd>
    </div>
  );

  return (
    <>
      <Section icon={IdCard} title={t("Account information")}>
        {p ? (
          <dl>
            {row(t("Name"), editing ? (
              <form onSubmit={save} className="flex flex-wrap gap-2">
                <input className="field !w-64" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus required />
                <button className="btn btn-primary !py-1.5">{t("Save")}</button>
                <button type="button" className="btn btn-ghost !py-1.5" onClick={() => setEditing(false)}>{t("Cancel")}</button>
              </form>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="font-semibold">{p.displayName}</span>
                <button className="btn btn-ghost !px-1.5 !py-0.5 !text-[0.7rem]" onClick={() => { setName(p.displayName); setEditing(true); }}>
                  <Pencil className="h-3 w-3" /> {t("Edit")}
                </button>
              </span>
            ))}
            {row(t("Username"), <>
              <span className="font-mono">{p.username}</span>
              <span className="ml-2 text-[0.68rem] text-ink-500">{t("Used to sign in and to open your workspace; it cannot be changed.")}</span>
            </>)}
            {row(t("Role"), p.isAdmin ? t("Administrator") : t("Member"))}
            {row(t("Member since"), when(p.createdAt))}
            {row(t("My projects"), <Link href="/projects" className="text-aqua-700 hover:underline">{p.projects}</Link>)}
            {row(t("My workspace"), <Link href="/profile/workspaces" className="text-aqua-700 hover:underline">
              {p.workspaceOpen ? t("Open with a password · {n} viewers", { n: p.viewers }) : t("Closed")}
            </Link>)}
            {row(t("Workspaces opened to me"), <Link href="/profile/workspaces" className="text-aqua-700 hover:underline">{p.workspacesOpenToMe}</Link>)}
            {row(t("Claude Code connected"), <Link href="/settings#claude" className="text-aqua-700 hover:underline">{p.machines}</Link>)}
          </dl>
        ) : (
          <div className="h-40 animate-pulse rounded-lg bg-ink-900/5" />
        )}
        <Msg ok={!!msg?.ok} text={msg?.text ?? null} />
      </Section>
      <ChangePassword />
    </>
  );
}
