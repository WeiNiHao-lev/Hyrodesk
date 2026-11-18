"use client";

import { useCallback } from "react";
import { Lang, usePrefs } from "./prefs";
import { DICT } from "./i18n-dict";

/**
 * Interface language. The English text is the key: t("Projects") reads the
 * same in the code as on screen, and anything not yet in the dictionary simply
 * shows in English. {name} placeholders are filled from `vars`.
 *
 * What is translated: navigation, menus, settings, profile, sign-in and the
 * headings, tabs and buttons of the main pages. Engineering content (unit
 * names, parameters, standards, warnings from the engine, reports) stays in
 * English, the language of the calculations and of the source standards.
 */

export type Vars = Record<string, string | number>;

export function translate(lang: Lang, en: string, vars?: Vars): string {
  let s = lang === "en" ? en : DICT[en]?.[lang] ?? en;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return s;
}

export function useT() {
  const lang = usePrefs((s) => s.lang);
  return useCallback((en: string, vars?: Vars) => translate(lang, en, vars), [lang]);
}

/** Dates in the interface language. */
export function useDate() {
  const lang = usePrefs((s) => s.lang);
  const loc = lang === "zh" ? "zh-CN" : lang === "id" ? "id-ID" : "en-GB";
  return useCallback((d: string | Date, time = false) => {
    const x = typeof d === "string" ? new Date(d) : d;
    return time
      ? x.toLocaleString(loc, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : x.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" });
  }, [loc]);
}
