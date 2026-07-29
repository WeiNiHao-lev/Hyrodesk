"use client";

import { useEffect, useState } from "react";
import { health, migrateLocalToCloud, resetHealthCache } from "@/lib/store/db";
import { HealthReport } from "@/lib/store/types";
import { Cloud, HardDrive, AlertTriangle, UploadCloud, RefreshCw } from "lucide-react";

export function StorageBadge({ full = false }: { full?: boolean }) {
  const [h, setH] = useState<HealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => {
    resetHealthCache();
    health().then(setH);
  };
  useEffect(() => { health().then(setH); }, []);

  if (!h) return null;

  const cloud = h.storage === "cloud" && h.ok;
  const broken = h.configured && !h.ok;

  if (!full) {
    return (
      <span
        className={`chip ${cloud ? "bg-mint-100 text-mint-700" : broken ? "bg-coral-100 text-coral-700" : "bg-sun-100 text-sun-700"}`}
        title={h.error ?? (cloud ? "Projects are stored in the cloud database" : "Projects are stored in this browser only")}
      >
        {cloud ? <Cloud className="h-3 w-3" /> : broken ? <AlertTriangle className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
        {cloud ? "Cloud database" : broken ? "Database error" : "Local database"}
      </span>
    );
  }

  const migrate = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const n = await migrateLocalToCloud();
      setMsg(n === 0 ? "Nothing found in this browser to copy." : `Copied ${n} project${n === 1 ? "" : "s"} to the cloud database.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <div className={`card border-l-4 p-3.5 ${cloud ? "border-l-mint-500" : broken ? "border-l-coral-500" : "border-l-sun-500"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {cloud ? <Cloud className="h-4 w-4 text-mint-700" /> : broken ? <AlertTriangle className="h-4 w-4 text-coral-700" /> : <HardDrive className="h-4 w-4 text-sun-700" />}
            <h3 className="text-[0.86rem] font-bold text-ink-900">
              {cloud ? "Cloud database active" : broken ? "Database configured but unreachable" : "Browser storage only"}
            </h3>
            {cloud && h.projects != null && (
              <span className="chip bg-mint-100 text-mint-700">{h.projects} stored</span>
            )}
          </div>
          <p className="mt-1 text-[0.74rem] leading-relaxed text-ink-700">
            {cloud
              ? "Projects are saved to Postgres. They are available from any device, survive clearing this browser, and can be shared read-only with a link."
              : broken
                ? h.error
                : "Projects are saved in this browser with IndexedDB. They will not appear on another device and are lost if you clear browsing data. Export regularly, or set DATABASE_URL to enable the cloud database."}
          </p>
          {msg && (
            <p className="mt-2 rounded-lg bg-aqua-50 px-2.5 py-1.5 text-[0.72rem] text-aqua-700">{msg}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-ghost !py-1.5 !text-[0.72rem]" onClick={load}>
            <RefreshCw className="h-3 w-3" /> Recheck
          </button>
          {cloud && (
            <button className="btn btn-mint !py-1.5 !text-[0.72rem]" onClick={migrate} disabled={busy}>
              <UploadCloud className="h-3 w-3" /> {busy ? "Copying…" : "Copy browser data up"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
