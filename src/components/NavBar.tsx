"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Droplets, FolderKanban, BookOpen, LogOut, UserRound, Settings, ChevronDown, IdCard, Users, ShieldCheck,
} from "lucide-react";
import { StorageBadge } from "./StorageBadge";
import { logout, useAuth } from "@/lib/store/auth";
import { resetHealthCache } from "@/lib/store/db";
import { useT } from "@/lib/i18n";

// Two places only. Everything that belongs to a project — preparation,
// simulation, results, saved runs — is reached from inside that project, so
// the bar has no project selector to fall out of step with the page.
const LINKS = [
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/library", label: "Library", icon: BookOpen },
];

export function NavBar() {
  const t = useT();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-ink-900/8 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
        <Link href="/projects" className="flex items-center gap-2.5 shrink-0">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-b from-aqua-400 to-aqua-600 shadow-sm">
            <Droplets className="h-4.5 w-4.5 text-white" strokeWidth={2.4} />
          </span>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="text-[0.95rem] font-bold tracking-tight text-ink-900">
              HydroDesk
            </span>
            <span className="mt-0.5 text-[0.6rem] font-medium uppercase tracking-[0.12em] text-ink-500">
              Process Studio
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.82rem] font-semibold transition ${
                  active
                    ? "bg-aqua-100 text-aqua-700"
                    : "text-ink-500 hover:bg-white hover:text-ink-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                {t(label)}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <span className="hidden md:flex"><StorageBadge /></span>
          <Link href="/settings" title={t("Settings")}
            className={`rounded-lg p-1.5 transition ${path.startsWith("/settings") ? "bg-aqua-100 text-aqua-700" : "text-ink-500 hover:bg-white hover:text-ink-900"}`}>
            <Settings className="h-4 w-4" />
          </Link>
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}

/** My profile: account information, workspaces, team (admin), settings, sign out. Cloud mode only. */
function ProfileMenu() {
  const t = useT();
  const path = usePathname();
  const { cloud, me, refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("mousedown", away); window.removeEventListener("keydown", esc); };
  }, [open]);

  if (!cloud || !me) return null;

  const item = (href: string, label: string, Icon: typeof IdCard) => (
    <Link href={href} role="menuitem" onClick={() => setOpen(false)}
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.8rem] font-medium text-ink-700 hover:bg-aqua-50 hover:text-ink-900">
      <Icon className="h-4 w-4 text-ink-500" /> {label}
    </Link>
  );

  return (
    <div className="relative" ref={box}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu" aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.78rem] font-semibold transition ${open || path.startsWith("/profile") ? "bg-aqua-100 text-aqua-700" : "text-ink-700 hover:bg-white"}`}
      >
        <UserRound className="h-3.5 w-3.5" />
        <span className="hidden max-w-[160px] truncate sm:inline">{me.displayName}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 top-full z-50 mt-1.5 w-64 p-1.5" style={{ background: "var(--color-white)" }}>
          <div className="px-2.5 pb-2 pt-1.5">
            <div className="truncate text-[0.85rem] font-bold text-ink-900">{me.displayName}</div>
            <div className="truncate font-mono text-[0.68rem] text-ink-500">{me.username}{me.isAdmin ? ` · ${t("administrator")}` : ""}</div>
          </div>
          <div className="mb-1 border-t border-ink-900/8" />
          <div className="px-2.5 pb-1 pt-1 text-[0.6rem] font-bold uppercase tracking-wider text-ink-300">{t("My profile")}</div>
          {item("/profile", t("Account information"), IdCard)}
          {item("/profile/workspaces", t("Workspaces"), Users)}
          {me.isAdmin && item("/profile/team", t("Team administration"), ShieldCheck)}
          <div className="my-1 border-t border-ink-900/8" />
          {item("/settings", t("Settings"), Settings)}
          <button
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[0.8rem] font-medium text-coral-700 hover:bg-coral-100"
            onClick={async () => {
              await logout();
              resetHealthCache();
              await refresh();
              window.location.assign("/login");
            }}
          >
            <LogOut className="h-4 w-4" /> {t("Sign out")}
          </button>
        </div>
      )}
    </div>
  );
}
