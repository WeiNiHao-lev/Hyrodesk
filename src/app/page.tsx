"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listProjects, Project, STATUS_LABEL, STATUS_TONE } from "@/lib/store/db";
import { TEMPLATES } from "@/lib/engine/templates";
import {
  Workflow, FolderKanban, ArrowRight, Beaker, Gauge, FileText, Recycle, Waves,
} from "lucide-react";

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  useEffect(() => {
    listProjects().then(setProjects);
  }, []);

  const runs = projects.reduce((a, p) => a + p.runs.length, 0);
  const open = projects.filter((p) => !["approved", "rejected"].includes(p.status)).length;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6">
      {/* hero */}
      <div className="card overflow-hidden">
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <span className="chip bg-aqua-100 text-aqua-700">Process studio</span>
            <h1 className="mt-3 text-[1.9rem] font-bold leading-tight tracking-tight text-ink-900 sm:text-[2.3rem]">
              Simulate a treatment plant before you commit to it.
            </h1>
            <p className="mt-3 max-w-xl text-[0.92rem] leading-relaxed text-ink-700">
              Build the flowsheet by dragging unit operations onto a canvas, set the recovery, flux,
              retention time and dose on each block, and get a closed water balance with salt, energy
              and chemical balances behind it — enough to judge feasibility and write the
              pre-approval report.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/simulate" className="btn btn-primary">
                <Workflow className="h-4 w-4" /> Open the simulator
              </Link>
              <Link href="/projects" className="btn btn-ghost">
                <FolderKanban className="h-4 w-4" /> Project tracker
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 self-start">
            <Stat icon={FolderKanban} label="Projects" value={projects.length.toString()} />
            <Stat icon={Gauge} label="Open studies" value={open.toString()} />
            <Stat icon={Beaker} label="Simulation runs" value={runs.toString()} />
            <Stat icon={FileText} label="Report export" value="DOCX" />
          </div>
        </div>
      </div>

      {/* what it computes */}
      <h2 className="mt-9 text-[1.05rem] font-bold text-ink-900">What each run gives you</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Feature icon={Waves} title="Water balance"
          text="Every stream closed from feed to product and effluent, with recycle loops converged iteratively." />
        <Feature icon={Beaker} title="Salt & ion balance"
          text="Na, Ca, Mg, Cl, SO₄, HCO₃, silica and TDS tracked per stream — the same way CCEPC reports a desalination balance." />
        <Feature icon={Gauge} title="Energy & SEC"
          text="Power per unit, specific energy per m³ of product, and an indicative operating cost." />
        <Feature icon={Recycle} title="Chemicals & sludge"
          text="Dose rates as 100 % active substance, annual tonnage, dry solids and biological load removed." />
      </div>

      {/* templates */}
      <div className="mt-9 flex items-baseline justify-between">
        <h2 className="text-[1.05rem] font-bold text-ink-900">Start from a proven train</h2>
        <Link href="/library" className="text-[0.78rem] font-semibold text-aqua-700 hover:underline">
          Browse the unit library →
        </Link>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.filter((t) => t.key !== "blank").map((t) => (
          <Link
            key={t.key}
            href={`/simulate?template=${t.key}`}
            className="card group flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="chip w-fit bg-aqua-50 text-aqua-700">{t.category}</span>
            <h3 className="mt-2 text-[0.95rem] font-bold text-ink-900">{t.name}</h3>
            <p className="mt-1.5 flex-1 text-[0.78rem] leading-relaxed text-ink-500">{t.description}</p>
            <span className="mt-3 flex items-center gap-1 text-[0.78rem] font-semibold text-aqua-700">
              Load template
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      {/* recent */}
      {projects.length > 0 && (
        <>
          <h2 className="mt-9 text-[1.05rem] font-bold text-ink-900">Recent projects</h2>
          <div className="card mt-3 overflow-hidden">
            <table className="data">
              <thead>
                <tr>
                  <th>Project</th><th>Client</th><th>Type</th>
                  <th>Status</th><th className="num">Runs</th><th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {projects.slice(0, 6).map((p) => (
                  <tr key={p.id} className="cursor-pointer">
                    <td>
                      <Link href={`/projects/${p.id}`} className="font-semibold text-aqua-700 hover:underline">
                        {p.name || "Untitled"}
                      </Link>
                    </td>
                    <td className="text-ink-500">{p.client || "—"}</td>
                    <td>{p.kind}</td>
                    <td><span className={`chip ring-1 ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                    <td className="num">{p.runs.length}</td>
                    <td className="text-ink-500">{new Date(p.updatedAt).toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-8 rounded-xl bg-white/60 px-4 py-3 text-[0.72rem] leading-relaxed text-ink-500">
        <strong className="text-ink-700">Where your data lives.</strong> Projects and runs are stored
        in this browser using IndexedDB — nothing is uploaded and no account is needed. Use
        Export on the Projects page to back up or move to another machine.
      </p>
    </div>
  );
}

function Stat({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="card-flat p-3">
      <Icon className="h-4 w-4 text-aqua-500" />
      <div className="stat mt-1.5 text-[1.5rem] font-bold leading-none text-ink-900">{value}</div>
      <div className="mt-1 text-[0.62rem] font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </div>
    </div>
  );
}

function Feature({
  icon: Icon, title, text,
}: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="card p-4">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-aqua-50">
        <Icon className="h-4 w-4 text-aqua-600" />
      </span>
      <h3 className="mt-2.5 text-[0.88rem] font-bold text-ink-900">{title}</h3>
      <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-500">{text}</p>
    </div>
  );
}
