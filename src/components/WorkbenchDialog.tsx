"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Globe, Languages } from "lucide-react";
import { Modal } from "./Modal";
import { Flowsheet, SimulationResult } from "@/lib/engine/types";
import {
  Multi, ProjectStage, suggestDataNeeded, Verdict, WbLang, WorkbenchOptions,
} from "@/lib/report/workbench";
import { analysePrepare } from "@/lib/engine/prepareAnalysis";
import { DOCUMENTS, resolveCondition, resolveGuide, UNIVERSAL } from "@/lib/engine/sitevisit";
import { Project } from "@/lib/store/types";
import { canTranslate, translateText } from "@/lib/translate";
import { usePrefs } from "@/lib/prefs";
import { useT } from "@/lib/i18n";

/**
 * Before a workbench page is built: where the project stands, whether it is
 * feasible, what data is still missing, and any comments, written in the
 * engineer's own language. The page shows three languages; each translation
 * is typed here, filled by the browser's built-in translator when it has one,
 * or left empty, in which case the page shows the original marked as such.
 *
 * What was written is kept in this browser per study, so a second export
 * starts from the first one's notes.
 */

const STAGES: ProjectStage[] = ["lead", "data-collection", "simulation", "pre-approval", "approved", "on-hold", "rejected"];
const STAGE_LABEL: Record<ProjectStage, string> = {
  lead: "Lead", "data-collection": "Data collection", simulation: "Simulation", "pre-approval": "Pre-approval review",
  approved: "Approved", rejected: "Not feasible", "on-hold": "On hold",
};
const VERDICT_LABEL: Record<Verdict, string> = {
  feasible: "Feasible", conditional: "Feasible with conditions", "not-feasible": "Not feasible",
};
const LANG_LABEL: Record<WbLang, string> = { en: "English", id: "Bahasa Indonesia", zh: "中文" };
const LANGS: WbLang[] = ["zh", "en", "id"];

interface Saved {
  stage: ProjectStage | "";
  verdict: Verdict | "";
  source: WbLang;
  comments: Multi;
  dataNeeded: Multi;
  skipped: string[];
}

const noSubscribe = () => () => {};

export function WorkbenchDialog({
  flowsheet, result, studyName, project, runVerdict, onClose, onBuild,
}: {
  flowsheet: Flowsheet;
  result: SimulationResult;
  studyName: string;
  project?: Project | null;
  runVerdict?: Verdict;
  onClose: () => void;
  onBuild: (o: Omit<WorkbenchOptions, "title">) => void;
}) {
  const t = useT();
  const uiLang = usePrefs((s) => s.lang) as WbLang;
  const key = `hd-wb-notes:${studyName}`;
  const translatorHere = useSyncExternalStore(noSubscribe, canTranslate, () => false);

  const saved = useMemo<Partial<Saved>>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "{}"); } catch { return {}; }
  }, [key]);

  const [stage, setStage] = useState<ProjectStage | "">(saved.stage ?? (project?.status as ProjectStage | undefined) ?? "");
  const [verdict, setVerdict] = useState<Verdict | "">(saved.verdict ?? runVerdict ?? "");
  const [source, setSource] = useState<WbLang>(saved.source ?? uiLang);
  const [comments, setComments] = useState<Multi>(saved.comments ?? {});
  const [dataNeeded, setDataNeeded] = useState<Multi>(saved.dataNeeded ?? {});
  const [skipped, setSkipped] = useState<string[]>(saved.skipped ?? []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // What HydroDesk can tell is still missing, already in three languages.
  const suggestions = useMemo(() => {
    let prep: { answered: number; total: number; criticalOpen: number } | null = null;
    if (project) {
      const p = project.prepare;
      const groups = [...UNIVERSAL, ...resolveCondition(p?.condition).groups, ...resolveGuide(p?.type).groups];
      const a = analysePrepare(groups, DOCUMENTS, p?.checked ?? {}, p?.notes ?? {});
      prep = { answered: a.answered, total: a.total, criticalOpen: a.criticalOpen };
    }
    return suggestDataNeeded(flowsheet, result, prep);
  }, [flowsheet, result, project]);

  const others = LANGS.filter((l) => l !== source);

  const autoTranslate = async () => {
    setBusy(true);
    setMsg(t("Translating… the first time, the browser may download its language model."));
    try {
      const c = { ...comments }, d = { ...dataNeeded };
      for (const l of others) {
        if (comments[source]?.trim()) c[l] = await translateText(comments[source]!, source, l);
        if (dataNeeded[source]?.trim()) d[l] = await translateText(dataNeeded[source]!, source, l);
      }
      setComments(c);
      setDataNeeded(d);
      setMsg(t("Translated. Check the wording before building the page."));
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };

  const build = () => {
    const s: Saved = { stage, verdict, source, comments, dataNeeded, skipped };
    try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* private window */ }
    onBuild({
      stage: stage || undefined,
      verdict: verdict || undefined,
      gaps: suggestions.filter((g) => !skipped.includes(g.en)),
      notes: { source, comments, dataNeeded },
    });
  };

  const area = (value: string | undefined, set: (v: string) => void, placeholder: string, rows = 3) => (
    <textarea className="field mt-1 resize-y text-[0.8rem]" rows={rows} value={value ?? ""} placeholder={placeholder}
      onChange={(e) => set(e.target.value)} />
  );

  return (
    <Modal
      wide
      title={t("Workbench page")}
      subtitle={t("Project notes shown at the end of the page, in 中文 / English / Bahasa Indonesia.")}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t("Cancel")}</button>
          <button className="btn btn-primary" onClick={build} disabled={busy}>
            <Globe className="h-3.5 w-3.5" /> {t("Build page")}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t("Project stage")}</label>
            <select className="field mt-1" value={stage} onChange={(e) => setStage(e.target.value as ProjectStage | "")}>
              <option value="">{t("Not shown")}</option>
              {STAGES.map((s) => <option key={s} value={s}>{t(STAGE_LABEL[s])}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t("Feasibility")}</label>
            <select className="field mt-1" value={verdict} onChange={(e) => setVerdict(e.target.value as Verdict | "")}>
              <option value="">{t("Not stated")}</option>
              {(Object.keys(VERDICT_LABEL) as Verdict[]).map((v) => <option key={v} value={v}>{t(VERDICT_LABEL[v])}</option>)}
            </select>
            <p className="mt-1 text-[0.66rem] text-ink-500">{t("The page adds a line on how the product compares with the standard.")}</p>
          </div>
        </div>

        <div>
          <div className="label">{t("Data still needed")}</div>
          {suggestions.length > 0 ? (
            <div className="mt-1 space-y-1">
              <p className="text-[0.68rem] text-ink-500">{t("Found by HydroDesk, already in three languages. Untick what does not apply.")}</p>
              {suggestions.map((g) => (
                <label key={g.en} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1 text-[0.78rem] text-ink-900 hover:bg-ink-900/[0.03]">
                  <input type="checkbox" className="mt-0.5" checked={!skipped.includes(g.en)}
                    onChange={(e) => setSkipped((xs) => (e.target.checked ? xs.filter((x) => x !== g.en) : [...xs, g.en]))} />
                  <span>{g[uiLang] ?? g.en}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-[0.7rem] text-ink-500">{t("HydroDesk found nothing missing on its own.")}</p>
          )}
        </div>

        <div className="rounded-xl border border-ink-900/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[0.8rem] font-semibold text-ink-900">{t("Your notes")}</div>
            <label className="flex items-center gap-1.5 text-[0.72rem] text-ink-500">
              {t("Written in")}
              <select className="field !w-auto !py-1 !text-[0.75rem]" value={source} onChange={(e) => setSource(e.target.value as WbLang)}>
                {LANGS.map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-2">
            <label className="label">{t("Other data still needed (one per line)")}</label>
            {area(dataNeeded[source], (v) => setDataNeeded({ ...dataNeeded, [source]: v }), t("e.g. Tide levels at the intake point"))}
          </div>
          <div className="mt-2">
            <label className="label">{t("Comments")}</label>
            {area(comments[source], (v) => setComments({ ...comments, [source]: v }), t("e.g. The owner has offered us the feasibility study."), 4)}
          </div>
        </div>

        <div className="rounded-xl border border-ink-900/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[0.8rem] font-semibold text-ink-900">
              <Languages className="h-4 w-4 text-aqua-600" /> {t("Translations")}
            </div>
            {translatorHere && (
              <button className="btn btn-ghost !py-1 !text-[0.72rem]" onClick={autoTranslate}
                disabled={busy || (!comments[source]?.trim() && !dataNeeded[source]?.trim())}>
                <Languages className="h-3.5 w-3.5" /> {busy ? t("Translating…") : t("Translate automatically")}
              </button>
            )}
          </div>
          <p className="mt-1 text-[0.68rem] text-ink-500">
            {translatorHere
              ? t("Done by this browser's built-in translator, on this computer. Check the result: you can edit it below.")
              : t("This browser cannot translate on its own (recent Chrome can). Type the translations, or leave them empty: the page then shows your text marked as the original. Claude Code can also build the page with translations.")}
          </p>
          {msg && <p className="mt-1 rounded-lg bg-aqua-50 px-2.5 py-1.5 text-[0.7rem] text-aqua-700">{msg}</p>}
          {others.map((l) => (
            <div key={l} className="mt-3">
              <div className="text-[0.72rem] font-semibold text-ink-700">{LANG_LABEL[l]}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {area(dataNeeded[l], (v) => setDataNeeded({ ...dataNeeded, [l]: v }), t("Other data still needed (one per line)"), 2)}
                {area(comments[l], (v) => setComments({ ...comments, [l]: v }), t("Comments"), 2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
