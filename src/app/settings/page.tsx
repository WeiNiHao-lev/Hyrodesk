"use client";

import { useSyncExternalStore } from "react";
import { FolderDown, Monitor, Moon, Palette, RotateCcw, Sun, Workflow } from "lucide-react";
import { Section, ShareWithClaude } from "@/components/profile/sections";
import { StorageBadge } from "@/components/StorageBadge";
import { Lang, SaveTo, TextSize, Theme, usePrefs } from "@/lib/prefs";
import { canAskEachTime, canUseFolder, chooseSaveFolder, forgetSaveFolder } from "@/lib/savefile";
import { useAuth } from "@/lib/store/auth";
import { useT } from "@/lib/i18n";

const noSubscribe = () => () => {};

const LANGS: { v: Lang; label: string }[] = [
  { v: "en", label: "English" },
  { v: "id", label: "Bahasa Indonesia" },
  { v: "zh", label: "中文" },
];

export default function SettingsPage() {
  const t = useT();
  const p = usePrefs();
  const { cloud, me } = useAuth();
  // The File System Access API exists only in the browser, and only in some.
  const support = {
    ask: useSyncExternalStore(noSubscribe, canAskEachTime, () => false),
    folder: useSyncExternalStore(noSubscribe, canUseFolder, () => false),
  };

  const sizes: { v: TextSize; label: string; px: string }[] = [
    { v: "s", label: t("Small"), px: "0.8rem" },
    { v: "m", label: t("Normal"), px: "0.95rem" },
    { v: "l", label: t("Large"), px: "1.1rem" },
    { v: "xl", label: t("Extra large"), px: "1.25rem" },
  ];
  const themes: { v: Theme; label: string; icon: typeof Sun }[] = [
    { v: "system", label: t("Follow the system"), icon: Monitor },
    { v: "light", label: t("Light"), icon: Sun },
    { v: "dark", label: t("Dark"), icon: Moon },
  ];
  const saveOpts: { v: SaveTo; label: string; note: string; ok: boolean }[] = [
    { v: "downloads", label: t("The browser's downloads folder"), note: t("Files land where this browser saves downloads."), ok: true },
    { v: "ask", label: t("Ask where to save each time"), note: t("A save dialog opens for every export, so each file can go straight to its project folder."), ok: support.ask },
    { v: "folder", label: t("A folder I choose"), note: t("Every export goes into one folder, for example the project folder on a shared drive. Files with the same name are kept, not overwritten."), ok: support.folder },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-[1.3rem] font-bold tracking-tight text-ink-900">{t("Settings")}</h1>
        <p className="text-[0.75rem] text-ink-500">{t("Saved in this browser, so each computer can have its own.")}</p>
      </div>

      <Section icon={Palette} title={t("Appearance")}>
        <Field label={t("Language")} hint={t("Menus, pages and buttons. Unit names, parameters, standards and reports stay in English, the language of the calculations.")}>
          <Segmented value={p.lang} onChange={(v) => p.set({ lang: v })} options={LANGS.map((l) => ({ v: l.v, label: l.label }))} />
        </Field>
        <Field label={t("Text size")}>
          <div className="flex flex-wrap gap-1.5">
            {sizes.map((s) => (
              <button key={s.v} onClick={() => p.set({ textSize: s.v })}
                className={`flex min-w-[88px] flex-col items-center rounded-lg border px-3 py-1.5 transition ${p.textSize === s.v ? "border-aqua-500 bg-aqua-50 text-aqua-700" : "border-ink-900/10 text-ink-700 hover:bg-white"}`}>
                <span className="font-bold leading-none" style={{ fontSize: s.px }}>Aa</span>
                <span className="mt-1 text-[0.66rem] font-semibold">{s.label}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("Theme")}>
          <div className="flex flex-wrap gap-1.5">
            {themes.map(({ v, label, icon: Icon }) => (
              <button key={v} onClick={() => p.set({ theme: v })}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[0.78rem] font-semibold transition ${p.theme === v ? "border-aqua-500 bg-aqua-50 text-aqua-700" : "border-ink-900/10 text-ink-700 hover:bg-white"}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section icon={FolderDown} title={t("Default save location")}>
        <p className="text-[0.75rem] leading-relaxed text-ink-500">
          {t("Where exported files go: reports, calculation workbooks, workbench pages, stream tables and project backups.")}
        </p>
        <div className="mt-3 space-y-2">
          {saveOpts.map((o) => (
            <label key={o.v} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 ${p.saveTo === o.v ? "border-aqua-500 bg-aqua-50/60" : "border-ink-900/10"} ${o.ok ? "cursor-pointer" : "opacity-55"}`}>
              <input type="radio" name="saveTo" className="mt-0.5" checked={p.saveTo === o.v} disabled={!o.ok}
                onChange={async () => {
                  if (o.v === "folder") { if (!p.folderName) await chooseSaveFolder(); else p.set({ saveTo: "folder" }); }
                  else p.set({ saveTo: o.v });
                }} />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8rem] font-semibold text-ink-900">{o.label}</span>
                <span className="block text-[0.7rem] text-ink-500">{o.note}</span>
                {!o.ok && <span className="block text-[0.68rem] text-sun-700">{t("Needs Chrome or Edge on a computer.")}</span>}
                {o.v === "folder" && o.ok && (
                  <span className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="chip bg-ink-900/5 text-ink-700">{p.folderName ? `📁 ${p.folderName}` : t("No folder chosen")}</span>
                    <button type="button" className="btn btn-ghost !px-2 !py-0.5 !text-[0.7rem]" onClick={(e) => { e.preventDefault(); void chooseSaveFolder(); }}>
                      {p.folderName ? t("Change folder…") : t("Choose folder…")}
                    </button>
                    {p.folderName && (
                      <button type="button" className="btn btn-ghost !px-2 !py-0.5 !text-[0.7rem]" onClick={(e) => { e.preventDefault(); void forgetSaveFolder(); }}>
                        {t("Forget")}
                      </button>
                    )}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-[0.68rem] text-ink-500">
          {t("The browser may ask once per visit before writing to the folder. If it cannot, the file is downloaded as usual.")}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[0.72rem] text-ink-500">
          {t("Projects themselves are saved automatically:")} <StorageBadge />
        </div>
      </Section>

      <Section icon={Workflow} title={t("Canvas")}>
        <Toggle label={t("Snap blocks to the grid")} hint={t("Blocks line up neatly when dragged.")} value={p.snapToGrid} onChange={(v) => p.set({ snapToGrid: v })} />
        <Toggle label={t("Show the minimap")} hint={t("The small overview in the corner of the canvas.")} value={p.minimap} onChange={(v) => p.set({ minimap: v })} />
        <Toggle label={t("Show flows on connections")} hint={t("The m³/h of each stream, written on its line after a simulation.")} value={p.edgeLabels} onChange={(v) => p.set({ edgeLabels: v })} />
      </Section>

      {cloud && me && <ShareWithClaude />}

      <div className="flex justify-end">
        <button className="btn btn-ghost !text-[0.75rem]" onClick={() => { if (confirm(t("Put every setting on this page back to its default?"))) { void forgetSaveFolder(); p.reset(); } }}>
          <RotateCcw className="h-3.5 w-3.5" /> {t("Reset to defaults")}
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-ink-900/6 py-3 first:pt-1 last:border-0 last:pb-0">
      <div className="mb-1.5 text-[0.78rem] font-semibold text-ink-900">{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-[0.68rem] text-ink-500">{hint}</p>}
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[] }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg bg-ink-900/[0.05] p-1">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`rounded-md px-3 py-1.5 text-[0.78rem] font-semibold transition ${value === o.v ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-900"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={value} onClick={() => onChange(!value)}
      className="flex w-full items-start justify-between gap-4 border-b border-ink-900/6 py-2.5 text-left last:border-0">
      <span>
        <span className="block text-[0.8rem] font-semibold text-ink-900">{label}</span>
        {hint && <span className="block text-[0.7rem] text-ink-500">{hint}</span>}
      </span>
      <span className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${value ? "bg-aqua-500" : "bg-ink-300"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full shadow transition-all ${value ? "left-[18px]" : "left-0.5"}`} style={{ background: "#fff" }} />
      </span>
    </button>
  );
}
