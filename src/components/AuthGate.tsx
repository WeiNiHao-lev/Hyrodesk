"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/store/auth";

const PUBLIC = ["/login", "/setup", "/share"];

/**
 * Holds every page behind sign-in when the app runs on the cloud database. The
 * data is protected by the API, which refuses anything without a session; this
 * only spares a signed-out visitor a page of empty lists and failed requests,
 * and sends them to sign in (or, on a fresh database, to create the first
 * account). On browser storage there is one user per browser and no gate.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loaded, cloud, me, needsSetup, refresh } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC.some((p) => path.startsWith(p));

  useEffect(() => { void refresh(); }, [refresh]);

  const blocked = loaded && cloud && !me && !isPublic;
  useEffect(() => {
    if (!blocked) return;
    // Keep the query: /connect?code=… must still carry its code after signing in.
    const here = path + (typeof window !== "undefined" ? window.location.search : "");
    router.replace(needsSetup ? "/setup" : `/login?next=${encodeURIComponent(here)}`);
  }, [blocked, needsSetup, path, router]);

  if (isPublic) return <>{children}</>;
  if (!loaded || blocked) {
    return <div className="p-10 text-center text-[0.8rem] text-ink-300">Checking sign-in…</div>;
  }
  return <>{children}</>;
}
