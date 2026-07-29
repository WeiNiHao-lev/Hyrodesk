"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Droplets, FolderKanban, Workflow, BarChart3, BookOpen } from "lucide-react";

const LINKS = [
  { href: "/", label: "Overview", icon: Droplets },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/simulate", label: "Simulate", icon: Workflow },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/library", label: "Library", icon: BookOpen },
];

export function NavBar() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-ink-900/8 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-b from-aqua-400 to-aqua-600 shadow-sm">
            <Droplets className="h-4.5 w-4.5 text-white" strokeWidth={2.4} />
          </span>
          <span className="flex flex-col leading-none">
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
            const active = href === "/" ? path === "/" : path.startsWith(href);
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
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
          <span className="chip bg-mint-100 text-mint-700">Local database</span>
        </div>
      </div>
    </header>
  );
}
