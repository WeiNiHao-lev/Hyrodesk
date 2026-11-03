"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { WorkspaceProvider, useWorkspace } from "@/components/workspace/WorkspaceContext";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/store/db";
import {
  ArrowLeft, LayoutDashboard, ClipboardList, Compass, Workflow, BarChart3, History,
} from "lucide-react";

/**
 * Everything inside a project lives under its address.
 *
 * The header and the tabs are the only navigation inside a project, and the
 * only way out is back to the list. There is no project selector to drift out
 * of step with the page, which is what let a study be drawn in one project and
 * saved into another.
 */
export default function ProjectWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  return (
    <WorkspaceProvider id={id}>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}

const TABS = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/prepare", label: "Prepare", icon: ClipboardList },
  { href: "/advisor", label: "Advisor", icon: Compass },
  { href: "/simulate", label: "Simulate", icon: Workflow },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/runs", label: "Runs", icon: History },
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  const { base, project, notFound } = useWorkspace();
  const path = usePathname();

  if (notFound) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <p className="text-[0.9rem] text-ink-500">This project could not be found.</p>
        <Link href="/projects" className="btn btn-ghost mt-4">
          <ArrowLeft className="h-3.5 w-3.5" /> All projects
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="shrink-0 border-b border-ink-900/8 bg-white/80 px-4 pt-2.5 backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-[0.72rem] font-semibold text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All projects
          </Link>
          <span className="h-4 w-px bg-ink-900/10" />
          {project ? (
            <>
              <h1 className="truncate text-[1rem] font-bold tracking-tight text-ink-900">
                {project.name || "Untitled project"}
              </h1>
              {project.client && <span className="text-[0.75rem] text-ink-500">{project.client}</span>}
              <span className="chip bg-aqua-50 text-aqua-700">{project.kind}</span>
              <span className={`chip ring-1 ${STATUS_TONE[project.status]}`}>{STATUS_LABEL[project.status]}</span>
            </>
          ) : (
            <span className="h-5 w-56 animate-pulse rounded bg-ink-900/5" />
          )}
        </div>

        <nav className="-mb-px mt-2 flex gap-1 overflow-x-auto">
          {TABS.map(({ href, label, icon: Icon }) => {
            const to = `${base}${href}`;
            const active = href === "" ? path === base : path.startsWith(to);
            const count = href === "/runs" && project ? project.runs.length : null;
            return (
              <Link
                key={href}
                href={to}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[0.78rem] font-semibold transition ${
                  active
                    ? "border-aqua-500 text-aqua-700"
                    : "border-transparent text-ink-500 hover:text-ink-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {count != null && (
                  <span className="rounded-full bg-ink-900/5 px-1.5 text-[0.62rem] text-ink-500">{count}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
