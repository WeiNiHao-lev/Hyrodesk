"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Bot, Check, Copy, KeyRound, Lock, LockOpen, Users, FolderOpen, ShieldCheck, Trash2, X } from "lucide-react";
import {
  AdminView, adminView, ApiToken, changePassword, listTokens, revokeToken, getAccess, leaveWorkspace, openWorkspace, resetMemberPassword,
  revokeViewer, setAccessPassword, setInviteCode, SharedWorkspace, sharedWorkspaces, WorkspaceAccess,
} from "@/lib/store/auth";
import { useDate, useT } from "@/lib/i18n";

export function Section({ icon: Icon, title, children, id }: { icon: typeof Lock; title: string; children: React.ReactNode; id?: string }) {
  return (
    <div className="card p-4 sm:p-5" id={id}>
      <div className="mb-2 flex items-center gap-2 text-[0.9rem] font-bold text-ink-900">
        <Icon className="h-4 w-4 text-aqua-600" /> {title}
      </div>
      {children}
    </div>
  );
}

export function Msg({ ok, text }: { ok: boolean; text: string | null }) {
  if (!text) return null;
  return <p className={`mt-2 rounded-lg px-3 py-2 text-[0.75rem] ${ok ? "bg-mint-100 text-mint-700" : "bg-coral-100 text-coral-700"}`}>{text}</p>;
}

/* ------------------------------------------------------------ my workspace */

export function WorkspacePassword() {
  const t = useT();
  const when = useDate();
  const [access, setAccess] = useState<WorkspaceAccess | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => getAccess().then(setAccess).catch((e) => setMsg({ ok: false, text: e.message })), []);
  useEffect(() => { void load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { setMsg({ ok: false, text: t("The two passwords do not match.") }); return; }
    try {
      await setAccessPassword(pw);
      setPw(""); setPw2("");
      setMsg({ ok: true, text: access?.open
        ? t("Password changed. Everyone who had access must now be given the new one.")
        : t("Your workspace is open to anyone you give this password and your username to.") });
      await load();
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  };

  return (
    <Section icon={access?.open ? LockOpen : Lock} title={t("My workspace password")}>
      <p className="text-[0.75rem] leading-relaxed text-ink-500">
        {t("Your projects are visible only to you. To let a teammate see them, set a password here and give it to them with your username. They get view-only access: they can open your projects, runs and results, but cannot change, save over or delete anything.")}
      </p>
      <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${access?.open ? "bg-sun-100 text-sun-700" : "bg-mint-100 text-mint-700"}`}>
        {access?.open ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
        {access?.open ? t("Open with a password") : t("Closed: only you can see your projects")}
      </div>

      <form onSubmit={save} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="field" type="password" autoComplete="new-password" placeholder={access?.open ? t("New workspace password") : t("Workspace password")}
          value={pw} onChange={(e) => setPw(e.target.value)} required />
        <input className="field" type="password" autoComplete="new-password" placeholder={t("Repeat")} value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        <button className="btn btn-primary">{access?.open ? t("Change") : t("Open workspace")}</button>
      </form>
      <p className="mt-1 text-[0.66rem] text-ink-500">{t("Use a different password from your sign-in password. Changing it removes everyone's access at once.")}</p>

      {access?.open && (
        <>
          <div className="mt-4 text-[0.75rem] font-semibold text-ink-700">{t("Who can see your workspace")}</div>
          {access.viewers.length === 0 ? (
            <p className="mt-1 text-[0.72rem] text-ink-500">{t("Nobody has used the password yet.")}</p>
          ) : (
            <table className="data mt-1">
              <thead><tr><th>{t("Name")}</th><th>{t("Username")}</th><th>{t("Since")}</th><th></th></tr></thead>
              <tbody>
                {access.viewers.map((v) => (
                  <tr key={v.id}>
                    <td>{v.displayName}</td>
                    <td className="font-mono text-[0.72rem]">{v.username}</td>
                    <td>{when(v.since)}</td>
                    <td className="text-right">
                      <button className="btn btn-ghost !py-0.5 !text-[0.7rem]" title={t("Remove this person's access")}
                        onClick={async () => { await revokeViewer(v.id); await load(); }}>
                        <X className="h-3 w-3" /> {t("Remove")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-1 text-[0.66rem] text-ink-500">{t("Removing one person ends their access now; they could return with the same password, so change it if that matters.")}</p>
          <button className="btn btn-ghost mt-3 !text-[0.75rem]"
            onClick={async () => {
              if (!confirm(t("Close your workspace? Everyone loses access."))) return;
              await setAccessPassword(null);
              setMsg({ ok: true, text: t("Closed. Only you can see your projects.") });
              await load();
            }}>
            <Lock className="h-3.5 w-3.5" /> {t("Close my workspace")}
          </button>
        </>
      )}
      <Msg ok={!!msg?.ok} text={msg?.text ?? null} />
    </Section>
  );
}

/* --------------------------------------------------- other people's workspaces */

export function OtherWorkspaces() {
  const t = useT();
  const [list, setList] = useState<SharedWorkspace[]>([]);
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => sharedWorkspaces().then(setList).catch(() => setList([])), []);
  useEffect(() => { void load(); }, [load]);

  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await openWorkspace(username, pw);
      setPw(""); setUsername("");
      setMsg({ ok: true, text: t("{name}'s workspace is open to you, view only.", { name: r.owner.displayName }) });
      await load();
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  };

  return (
    <Section icon={Users} title={t("Teammates' workspaces")}>
      <p className="text-[0.75rem] text-ink-500">{t("Enter a teammate's username and the workspace password they gave you.")}</p>
      <form onSubmit={open} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="field" placeholder={t("Their username")} value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input className="field" type="password" autoComplete="off" placeholder={t("Their workspace password")} value={pw} onChange={(e) => setPw(e.target.value)} required />
        <button className="btn btn-primary">{t("Open")}</button>
      </form>
      <Msg ok={!!msg?.ok} text={msg?.text ?? null} />
      {list.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {list.map((w) => (
            <div key={w.id} className="flex items-center gap-3 rounded-lg border border-ink-900/8 px-3 py-2">
              <FolderOpen className="h-4 w-4 text-violet-600" />
              <div className="min-w-0 flex-1">
                <div className="text-[0.8rem] font-semibold text-ink-900">{w.displayName}</div>
                <div className="text-[0.66rem] text-ink-500">{w.username} · {t(w.projects === 1 ? "1 project" : "{n} projects", { n: w.projects })} · {t("view only")}</div>
              </div>
              <Link href={`/projects?owner=${encodeURIComponent(w.id)}`} className="btn btn-ghost !text-[0.72rem]">{t("View projects")}</Link>
              <button className="btn btn-ghost !p-1" title={t("Give up access")} onClick={async () => { await leaveWorkspace(w.id); await load(); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------- Claude Code */

/**
 * Each person connects their own Claude Code to their own account: one
 * sentence to paste into Claude Code, which installs the skill from this
 * HydroDesk and asks for approval here.
 */
export function ShareWithClaude() {
  const t = useT();
  const when = useDate();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  const load = useCallback(() => listTokens().then(setTokens).catch(() => setTokens([])), []);
  useEffect(() => { void load(); }, [load]);

  const instruction = t("Install the HydroDesk skill from {url} (download the files with curl and follow its steps), then connect it to my HydroDesk account.", {
    url: `${origin}/claude-skill/install.md`,
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(instruction); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* select by hand */ }
  };

  return (
    <Section icon={Bot} title={t("Share with Claude")} id="claude">
      <p className="text-[0.75rem] leading-relaxed text-ink-500">
        {t("Let your own Claude Code work in HydroDesk for you: read your projects, run simulations and save runs. Each person connects their own Claude Code to their own account; nobody else's machine can use yours.")}
      </p>
      <ol className="mt-3 space-y-2 text-[0.75rem] text-ink-700">
        <li>
          <span className="font-semibold">1.</span> {t("Copy this sentence and send it to Claude Code on your computer:")}
          <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-ink-900/[0.04] p-2.5">
            <code className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-[0.7rem] text-ink-900">{instruction}</code>
            <button className="btn btn-ghost !px-2 !py-1 !text-[0.7rem]" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? t("Copied") : t("Copy")}
            </button>
          </div>
        </li>
        <li><span className="font-semibold">2.</span> {t("Claude Code installs the skill and gives you a link with a code. Open it here while signed in, check the code, and click Approve.")}</li>
        <li><span className="font-semibold">3.</span> {t("From then on, ask Claude Code things like \"simulate this in HydroDesk and save it to project X\".")}</li>
      </ol>
      <p className="mt-2 text-[0.68rem] text-ink-500">
        {t("A connected Claude Code can read your projects and workspaces opened to you, run simulations and save runs. It cannot delete projects, create share links, change passwords or open workspaces.")}
      </p>

      <div className="mt-4 text-[0.75rem] font-semibold text-ink-700">{t("Connected")}</div>
      {tokens.length === 0 ? (
        <p className="mt-1 text-[0.72rem] text-ink-500">{t("Nothing connected.")}</p>
      ) : (
        <table className="data mt-1">
          <thead><tr><th>{t("Name")}</th><th>{t("Connected")}</th><th>{t("Last used")}</th><th></th></tr></thead>
          <tbody>
            {tokens.map((tk) => (
              <tr key={tk.id}>
                <td>{tk.label}</td>
                <td>{when(tk.createdAt)}</td>
                <td>{tk.lastUsedAt ? when(tk.lastUsedAt, true) : t("never")}</td>
                <td className="text-right">
                  <button className="btn btn-ghost !py-0.5 !text-[0.7rem]" onClick={async () => { await revokeToken(tk.id); await load(); }}>
                    <X className="h-3 w-3" /> {t("Disconnect")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

/* ---------------------------------------------------------------- password */

export function ChangePassword() {
  const t = useT();
  const [cur, setCur] = useState("");
  const [nx, setNx] = useState("");
  const [nx2, setNx2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Section icon={KeyRound} title={t("Sign-in password")}>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (nx !== nx2) { setMsg({ ok: false, text: t("The two new passwords do not match.") }); return; }
          try {
            await changePassword(cur, nx);
            setCur(""); setNx(""); setNx2("");
            setMsg({ ok: true, text: t("Changed. Your other sessions have been signed out.") });
          } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
        }}
      >
        <input className="field" type="password" autoComplete="current-password" placeholder={t("Current")} value={cur} onChange={(e) => setCur(e.target.value)} required />
        <input className="field" type="password" autoComplete="new-password" placeholder={t("New password")} value={nx} onChange={(e) => setNx(e.target.value)} required />
        <input className="field" type="password" autoComplete="new-password" placeholder={t("Repeat new")} value={nx2} onChange={(e) => setNx2(e.target.value)} required />
        <button className="btn btn-primary">{t("Change")}</button>
      </form>
      <Msg ok={!!msg?.ok} text={msg?.text ?? null} />
    </Section>
  );
}

/* ------------------------------------------------------------------- admin */

export function Admin() {
  const t = useT();
  const when = useDate();
  const [view, setView] = useState<AdminView | null>(null);
  const [code, setCode] = useState("");
  const [resetUser, setResetUser] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => adminView().then(setView).catch((e) => setMsg({ ok: false, text: e.message })), []);
  useEffect(() => { void load(); }, [load]);

  return (
    <Section icon={ShieldCheck} title={t("Team administration")}>
      <div className="text-[0.75rem] font-semibold text-ink-700">{t("Invite code")}</div>
      <p className="text-[0.72rem] text-ink-500">
        {t("Teammates need it to create an account.")}{" "}
        {view?.registrationOpen
          ? <strong className="text-sun-700">{t("Registration is open.")}</strong>
          : <strong className="text-mint-700">{t("Registration is closed.")}</strong>}{" "}
        {t("The code is stored only as a hash, so write it down when you set it.")}
      </p>
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await setInviteCode(code);
            setMsg({ ok: true, text: t("Invite code set. Give teammates: {code}", { code }) });
            setCode("");
            await load();
          } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
        }}
      >
        <input className="field !w-64" placeholder={t("New invite code (8+ characters)")} value={code} onChange={(e) => setCode(e.target.value)} required />
        <button className="btn btn-primary">{t("Set code")}</button>
        {view?.registrationOpen && (
          <button type="button" className="btn btn-ghost"
            onClick={async () => { await setInviteCode(null); setMsg({ ok: true, text: t("Registration closed.") }); await load(); }}>
            {t("Close registration")}
          </button>
        )}
      </form>

      <div className="mt-5 text-[0.75rem] font-semibold text-ink-700">{t("Members")}</div>
      <table className="data mt-1">
        <thead><tr><th>{t("Name")}</th><th>{t("Username")}</th><th className="num">{t("Projects")}</th><th>{t("Joined")}</th></tr></thead>
        <tbody>
          {view?.members.map((m) => (
            <tr key={m.username}>
              <td>{m.displayName}{m.isAdmin ? ` (${t("admin")})` : ""}</td>
              <td className="font-mono text-[0.72rem]">{m.username}</td>
              <td className="num">{m.projects}</td>
              <td>{when(m.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[0.66rem] text-ink-500">{t("You see how many projects each member has, not the projects themselves.")}</p>

      <div className="mt-5 text-[0.75rem] font-semibold text-ink-700">{t("Reset a member's sign-in password")}</div>
      <form
        className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!confirm(t("Set a new sign-in password for {user}? They will be signed out everywhere.", { user: resetUser }))) return;
          try {
            await resetMemberPassword(resetUser, resetPw);
            setMsg({ ok: true, text: t("New password set for {user}. Tell them, and ask them to change it.", { user: resetUser }) });
            setResetUser(""); setResetPw("");
          } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
        }}
      >
        <input className="field" placeholder={t("Username")} value={resetUser} onChange={(e) => setResetUser(e.target.value)} required />
        <input className="field" type="text" autoComplete="off" placeholder={t("Temporary password")} value={resetPw} onChange={(e) => setResetPw(e.target.value)} required />
        <button className="btn btn-ghost">{t("Reset")}</button>
      </form>
      <Msg ok={!!msg?.ok} text={msg?.text ?? null} />
    </Section>
  );
}
