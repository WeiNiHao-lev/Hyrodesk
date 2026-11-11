"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bot, KeyRound, Lock, LockOpen, Users, FolderOpen, ShieldCheck, Trash2, X } from "lucide-react";
import {
  AdminView, adminView, ApiToken, changePassword, listTokens, revokeToken, getAccess, leaveWorkspace, openWorkspace, resetMemberPassword,
  revokeViewer, setAccessPassword, setInviteCode, SharedWorkspace, sharedWorkspaces, useAuth, WorkspaceAccess,
} from "@/lib/store/auth";

const when = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Account, workspace password, other people's workspaces, and team administration. */
export default function AccountPage() {
  const { cloud, me } = useAuth();
  if (!cloud) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14 text-center text-[0.8rem] text-ink-500">
        This deployment keeps projects in this browser only, so there are no accounts. Accounts and
        workspace sharing need the cloud database (DATABASE_URL).
      </div>
    );
  }
  if (!me) return null;
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-[1.2rem] font-bold text-ink-900">{me.displayName}</h1>
        <p className="text-[0.75rem] text-ink-500">
          Signed in as <span className="font-mono">{me.username}</span>{me.isAdmin ? " · administrator" : ""}
        </p>
      </div>
      <WorkspacePassword />
      <OtherWorkspaces />
      <ConnectedMachines />
      <ChangePassword />
      {me.isAdmin && <Admin />}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Lock; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-2 flex items-center gap-2 text-[0.9rem] font-bold text-ink-900">
        <Icon className="h-4 w-4 text-aqua-600" /> {title}
      </div>
      {children}
    </div>
  );
}

function Msg({ ok, text }: { ok: boolean; text: string | null }) {
  if (!text) return null;
  return <p className={`mt-2 rounded-lg px-3 py-2 text-[0.75rem] ${ok ? "bg-mint-100 text-mint-700" : "bg-coral-100 text-coral-700"}`}>{text}</p>;
}

/* ------------------------------------------------------------ my workspace */

function WorkspacePassword() {
  const [access, setAccess] = useState<WorkspaceAccess | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => getAccess().then(setAccess).catch((e) => setMsg({ ok: false, text: e.message })), []);
  useEffect(() => { void load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { setMsg({ ok: false, text: "The two passwords do not match." }); return; }
    try {
      await setAccessPassword(pw);
      setPw(""); setPw2("");
      setMsg({ ok: true, text: access?.open
        ? "Password changed. Everyone who had access must now be given the new one."
        : "Your workspace is open to anyone you give this password and your username to." });
      await load();
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  };

  return (
    <Section icon={access?.open ? LockOpen : Lock} title="My workspace password">
      <p className="text-[0.75rem] leading-relaxed text-ink-500">
        Your projects are visible only to you. To let a teammate see them, set a password here and give
        it to them with your username. They get <strong>view-only</strong> access: they can open your
        projects, runs and results, but cannot change, save over or delete anything.
      </p>
      <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${access?.open ? "bg-sun-100 text-sun-700" : "bg-mint-100 text-mint-700"}`}>
        {access?.open ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
        {access?.open ? "Open with a password" : "Closed: only you can see your projects"}
      </div>

      <form onSubmit={save} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="field" type="password" autoComplete="new-password" placeholder={access?.open ? "New workspace password" : "Workspace password"}
          value={pw} onChange={(e) => setPw(e.target.value)} required />
        <input className="field" type="password" autoComplete="new-password" placeholder="Repeat" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        <button className="btn btn-primary">{access?.open ? "Change" : "Open workspace"}</button>
      </form>
      <p className="mt-1 text-[0.66rem] text-ink-500">Use a different password from your sign-in password. Changing it removes everyone&apos;s access at once.</p>

      {access?.open && (
        <>
          <div className="mt-4 text-[0.75rem] font-semibold text-ink-700">Who can see your workspace</div>
          {access.viewers.length === 0 ? (
            <p className="mt-1 text-[0.72rem] text-ink-500">Nobody has used the password yet.</p>
          ) : (
            <table className="data mt-1">
              <thead><tr><th>Name</th><th>Username</th><th>Since</th><th></th></tr></thead>
              <tbody>
                {access.viewers.map((v) => (
                  <tr key={v.id}>
                    <td>{v.displayName}</td>
                    <td className="font-mono text-[0.72rem]">{v.username}</td>
                    <td>{when(v.since)}</td>
                    <td className="text-right">
                      <button className="btn btn-ghost !py-0.5 !text-[0.7rem]" title="Remove this person's access"
                        onClick={async () => { await revokeViewer(v.id); await load(); }}>
                        <X className="h-3 w-3" /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-1 text-[0.66rem] text-ink-500">Removing one person ends their access now; they could return with the same password, so change it if that matters.</p>
          <button className="btn btn-ghost mt-3 !text-[0.75rem]"
            onClick={async () => {
              if (!confirm("Close your workspace? Everyone loses access.")) return;
              await setAccessPassword(null);
              setMsg({ ok: true, text: "Closed. Only you can see your projects." });
              await load();
            }}>
            <Lock className="h-3.5 w-3.5" /> Close my workspace
          </button>
        </>
      )}
      <Msg ok={!!msg?.ok} text={msg?.text ?? null} />
    </Section>
  );
}

/* --------------------------------------------------- other people's workspaces */

function OtherWorkspaces() {
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
      setMsg({ ok: true, text: `${r.owner.displayName}'s workspace is open to you, view only.` });
      await load();
    } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
  };

  return (
    <Section icon={Users} title="Teammates' workspaces">
      <p className="text-[0.75rem] text-ink-500">Enter a teammate&apos;s username and the workspace password they gave you.</p>
      <form onSubmit={open} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="field" placeholder="Their username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input className="field" type="password" autoComplete="off" placeholder="Their workspace password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <button className="btn btn-primary">Open</button>
      </form>
      <Msg ok={!!msg?.ok} text={msg?.text ?? null} />
      {list.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {list.map((w) => (
            <div key={w.id} className="flex items-center gap-3 rounded-lg border border-ink-900/8 px-3 py-2">
              <FolderOpen className="h-4 w-4 text-violet-600" />
              <div className="min-w-0 flex-1">
                <div className="text-[0.8rem] font-semibold text-ink-900">{w.displayName}</div>
                <div className="text-[0.66rem] text-ink-500">{w.username} · {w.projects} project{w.projects === 1 ? "" : "s"} · view only</div>
              </div>
              <Link href={`/projects?owner=${encodeURIComponent(w.id)}`} className="btn btn-ghost !text-[0.72rem]">View projects</Link>
              <button className="btn btn-ghost !p-1" title="Give up access" onClick={async () => { await leaveWorkspace(w.id); await load(); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------- connected machines */

function ConnectedMachines() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const load = useCallback(() => listTokens().then(setTokens).catch(() => setTokens([])), []);
  useEffect(() => { void load(); }, [load]);
  return (
    <Section icon={Bot} title="Claude Code and scripts">
      <p className="text-[0.75rem] leading-relaxed text-ink-500">
        Claude Code sessions connected with the HydroDesk skill. They can read your projects, run
        simulations and save runs; they cannot delete, share, change passwords or open workspaces.
        Connect a new one by asking Claude Code to log in to HydroDesk and approving the link it gives you.
      </p>
      {tokens.length === 0 ? (
        <p className="mt-2 text-[0.72rem] text-ink-500">Nothing connected.</p>
      ) : (
        <table className="data mt-2">
          <thead><tr><th>Name</th><th>Connected</th><th>Last used</th><th></th></tr></thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id}>
                <td>{t.label}</td>
                <td>{when(t.createdAt)}</td>
                <td>{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString("en-GB") : "never"}</td>
                <td className="text-right">
                  <button className="btn btn-ghost !py-0.5 !text-[0.7rem]" onClick={async () => { await revokeToken(t.id); await load(); }}>
                    <X className="h-3 w-3" /> Disconnect
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

function ChangePassword() {
  const [cur, setCur] = useState("");
  const [nx, setNx] = useState("");
  const [nx2, setNx2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Section icon={KeyRound} title="Sign-in password">
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (nx !== nx2) { setMsg({ ok: false, text: "The two new passwords do not match." }); return; }
          try {
            await changePassword(cur, nx);
            setCur(""); setNx(""); setNx2("");
            setMsg({ ok: true, text: "Changed. Your other sessions have been signed out." });
          } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
        }}
      >
        <input className="field" type="password" autoComplete="current-password" placeholder="Current" value={cur} onChange={(e) => setCur(e.target.value)} required />
        <input className="field" type="password" autoComplete="new-password" placeholder="New" value={nx} onChange={(e) => setNx(e.target.value)} required />
        <input className="field" type="password" autoComplete="new-password" placeholder="Repeat new" value={nx2} onChange={(e) => setNx2(e.target.value)} required />
        <button className="btn btn-primary">Change</button>
      </form>
      <Msg ok={!!msg?.ok} text={msg?.text ?? null} />
    </Section>
  );
}

/* ------------------------------------------------------------------- admin */

function Admin() {
  const [view, setView] = useState<AdminView | null>(null);
  const [code, setCode] = useState("");
  const [resetUser, setResetUser] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => adminView().then(setView).catch((e) => setMsg({ ok: false, text: e.message })), []);
  useEffect(() => { void load(); }, [load]);

  return (
    <Section icon={ShieldCheck} title="Team administration">
      <div className="text-[0.75rem] font-semibold text-ink-700">Invite code</div>
      <p className="text-[0.72rem] text-ink-500">
        Teammates need it to create an account. Registration is
        <strong className={view?.registrationOpen ? " text-sun-700" : " text-mint-700"}>{view?.registrationOpen ? " open" : " closed"}</strong>.
        The code is stored only as a hash, so write it down when you set it.
      </p>
      <form
        className="mt-2 flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await setInviteCode(code);
            setMsg({ ok: true, text: `Invite code set. Give teammates: ${code}` });
            setCode("");
            await load();
          } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
        }}
      >
        <input className="field !w-64" placeholder="New invite code (8+ characters)" value={code} onChange={(e) => setCode(e.target.value)} required />
        <button className="btn btn-primary">Set code</button>
        {view?.registrationOpen && (
          <button type="button" className="btn btn-ghost"
            onClick={async () => { await setInviteCode(null); setMsg({ ok: true, text: "Registration closed." }); await load(); }}>
            Close registration
          </button>
        )}
      </form>

      <div className="mt-5 text-[0.75rem] font-semibold text-ink-700">Members</div>
      <table className="data mt-1">
        <thead><tr><th>Name</th><th>Username</th><th className="num">Projects</th><th>Joined</th></tr></thead>
        <tbody>
          {view?.members.map((m) => (
            <tr key={m.username}>
              <td>{m.displayName}{m.isAdmin ? " (admin)" : ""}</td>
              <td className="font-mono text-[0.72rem]">{m.username}</td>
              <td className="num">{m.projects}</td>
              <td>{when(m.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1 text-[0.66rem] text-ink-500">You see how many projects each member has, not the projects themselves.</p>

      <div className="mt-5 text-[0.75rem] font-semibold text-ink-700">Reset a member&apos;s sign-in password</div>
      <form
        className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!confirm(`Set a new sign-in password for ${resetUser}? They will be signed out everywhere.`)) return;
          try {
            await resetMemberPassword(resetUser, resetPw);
            setMsg({ ok: true, text: `New password set for ${resetUser}. Tell them, and ask them to change it.` });
            setResetUser(""); setResetPw("");
          } catch (err) { setMsg({ ok: false, text: (err as Error).message }); }
        }}
      >
        <input className="field" placeholder="Username" value={resetUser} onChange={(e) => setResetUser(e.target.value)} required />
        <input className="field" type="text" autoComplete="off" placeholder="Temporary password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} required />
        <button className="btn btn-ghost">Reset</button>
      </form>
      <Msg ok={!!msg?.ok} text={msg?.text ?? null} />
    </Section>
  );
}
