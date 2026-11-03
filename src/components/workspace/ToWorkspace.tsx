"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/lib/store/useProject";

/**
 * The old top-level pages, kept so a bookmark or a link in a sent report still
 * lands somewhere sensible. They no longer show anything themselves: work
 * belongs to a project, so they forward into the last project used, or to the
 * project list if there is none. Query strings are carried across, so
 * /simulate?template=x still opens that template.
 */
export function ToWorkspace({ tab }: { tab: string }) {
  const router = useRouter();
  const hydrate = useProject((s) => s.hydrate);
  const hydrated = useProject((s) => s.hydrated);
  const active = useProject((s) => s.active);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (!hydrated) return;
    const qs = window.location.search;
    const params = new URLSearchParams(qs);
    const id = params.get("project") || active?.id;
    params.delete("project");
    const rest = params.toString();
    router.replace(id ? `/projects/${id}/${tab}${rest ? `?${rest}` : ""}` : "/projects");
  }, [hydrated, active, tab, router]);

  return <div className="p-10 text-center text-[0.85rem] text-ink-500">Opening the project…</div>;
}
