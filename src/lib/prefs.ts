"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * How HydroDesk looks and behaves for whoever uses this browser: language,
 * text size, theme, where exported files go, and a few canvas habits.
 *
 * Kept in this browser (localStorage), not in the account: the right text size
 * on a laptop is not the right one on the meeting-room screen. The theme and
 * text size are also applied by a small script in the page head before the
 * first paint, so a dark-mode user never sees a white flash (see PREFS_BOOT).
 */

export type Lang = "en" | "id" | "zh";
export type TextSize = "s" | "m" | "l" | "xl";
export type Theme = "system" | "light" | "dark";
/** downloads: the browser's download folder. ask: a save dialog each time. folder: one folder chosen once. */
export type SaveTo = "downloads" | "ask" | "folder";

export interface Prefs {
  lang: Lang;
  textSize: TextSize;
  theme: Theme;
  saveTo: SaveTo;
  /** Name of the chosen folder, for display; the handle itself lives in IndexedDB. */
  folderName: string | null;
  snapToGrid: boolean;
  minimap: boolean;
  edgeLabels: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  lang: "en",
  textSize: "m",
  theme: "system",
  saveTo: "downloads",
  folderName: null,
  snapToGrid: false,
  minimap: true,
  edgeLabels: true,
};

export const TEXT_SCALE: Record<TextSize, string> = { s: "87.5%", m: "100%", l: "112.5%", xl: "125%" };
export const PREFS_KEY = "hd-prefs";

interface PrefsState extends Prefs {
  set: (p: Partial<Prefs>) => void;
  reset: () => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFS,
      set: (p) => set(p),
      reset: () => set({ ...DEFAULT_PREFS }),
    }),
    {
      name: PREFS_KEY,
      version: 1,
      // Read after the first render, so the server's HTML and the first client
      // render agree; PrefsApplier rehydrates right after mounting.
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Prefs => ({
        lang: s.lang, textSize: s.textSize, theme: s.theme, saveTo: s.saveTo, folderName: s.folderName,
        snapToGrid: s.snapToGrid, minimap: s.minimap, edgeLabels: s.edgeLabels,
      }),
    },
  ),
);

/** Current prefs outside React (download helpers). */
export const getPrefs = (): Prefs => usePrefs.getState();

export function resolvedTheme(t: Theme): "light" | "dark" {
  if (t !== "system") return t;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Runs in the page head before anything paints: theme, text size and language
 * from the saved prefs. Kept tiny and defensive; any failure leaves defaults.
 */
export const PREFS_BOOT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(PREFS_KEY)})||"{}").state||{};var d=document.documentElement;var t=s.theme||"system";if(t==="system")t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.setAttribute("data-theme",t);d.style.colorScheme=t;var z={s:"87.5%",m:"100%",l:"112.5%",xl:"125%"}[s.textSize];if(z)d.style.fontSize=z;if(s.lang)d.lang=s.lang==="zh"?"zh-CN":s.lang;}catch(e){}})();`;
