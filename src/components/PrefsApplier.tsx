"use client";

import { useEffect } from "react";
import { resolvedTheme, TEXT_SCALE, usePrefs } from "@/lib/prefs";

/**
 * Loads the saved preferences once the page has mounted and keeps the document
 * in step with them: data-theme for the palette, the root font size that every
 * rem in the app scales from, and the page language.
 */
export function PrefsApplier() {
  const theme = usePrefs((s) => s.theme);
  const textSize = usePrefs((s) => s.textSize);
  const lang = usePrefs((s) => s.lang);

  useEffect(() => { void usePrefs.persist.rehydrate(); }, []);

  useEffect(() => {
    const d = document.documentElement;
    const apply = () => {
      const t = resolvedTheme(theme);
      d.setAttribute("data-theme", t);
      d.style.colorScheme = t;
    };
    apply();
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => { document.documentElement.style.fontSize = TEXT_SCALE[textSize]; }, [textSize]);
  useEffect(() => { document.documentElement.lang = lang === "zh" ? "zh-CN" : lang; }, [lang]);

  return null;
}
