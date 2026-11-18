"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IdCard, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/lib/store/auth";
import { useT } from "@/lib/i18n";

/** My profile: account information, workspaces, and (for the administrator) the team. */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const path = usePathname();
  const { cloud, me } = useAuth();
  if (!cloud) {
    return (
      <div className="mx-auto max-w-xl px-4 py-14 text-center text-[0.8rem] text-ink-500">
        {t("This deployment keeps projects in this browser only, so there are no accounts. Accounts and workspace sharing need the cloud database (DATABASE_URL).")}
      </div>
    );
  }
  if (!me) return null;
  const tabs = [
    { href: "/profile", label: t("Account information"), icon: IdCard },
    { href: "/profile/workspaces", label: t("Workspaces"), icon: Users },
    ...(me.isAdmin ? [{ href: "/profile/team", label: t("Team administration"), icon: ShieldCheck }] : []),
  ];
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-[1.3rem] font-bold tracking-tight text-ink-900">{t("My profile")}</h1>
        <p className="text-[0.75rem] text-ink-500">
          {me.displayName} · <span className="font-mono">{me.username}</span>{me.isAdmin ? ` · ${t("administrator")}` : ""}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link key={href} href={href}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[0.8rem] font-semibold transition ${
                  active ? "bg-aqua-100 text-aqua-700" : "text-ink-500 hover:bg-white hover:text-ink-900"}`}>
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </div>
  );
}
