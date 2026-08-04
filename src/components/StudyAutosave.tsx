"use client";

import { useCallback, useEffect, useRef } from "react";
import { useStudy } from "@/lib/store/useStudy";
import { useProject } from "@/lib/store/useProject";
import {
  clearDraft, draftKey, isEmptyStudy, loadDraft, saveDraft, StudyDraft,
} from "@/lib/store/draft";

/**
 * Keeps the working study alive across a closed tab.
 *
 * Mounted once in the layout so it runs on every page: the canvas is not the
 * only place a study changes — the advisor can load a feed, the optimiser can
 * rewrite parameters — and an autosave that only worked on one route would lose
 * exactly the edits made everywhere else.
 *
 * Three behaviours, in order of how easily each is got wrong:
 *
 *   1. Restore before anything can overwrite. The draft is loaded once the
 *      project context has hydrated, and only applied if the editor is still
 *      empty, so it can never clobber a study the user has already started or
 *      one that a project page has just opened.
 *   2. Save on change, debounced. Typing a parameter should not write to disk
 *      forty times.
 *   3. Flush on the way out. A debounce that has not fired when the tab closes
 *      is a lost edit, which is the exact failure this component exists to fix,
 *      so pagehide and the visibility change both force a write.
 */
export function StudyAutosave() {
  const hydrated = useProject((s) => s.hydrated);
  const hydrate = useProject((s) => s.hydrate);
  const activeId = useProject((s) => s.active?.id ?? null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentKey = useRef<string | null>(null);
  const restored = useRef(false);
  const latest = useRef<StudyDraft | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  // Stable for the life of the component: it only ever reads refs, so it never
  // needs to be recreated and can be used safely in an effect cleanup.
  const flush = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const d = latest.current;
    if (d) void saveDraft(d);
  }, []);

  /* ---- restore, and swap drafts when the project changes ---- */
  useEffect(() => {
    if (!hydrated) return;
    const key = draftKey(activeId);
    if (currentKey.current === key) return;

    // Park whatever is open under the key it belonged to before switching.
    if (currentKey.current !== null) flush();
    currentKey.current = key;

    // "Start a new study" must beat the autosave, and the two race: the restore
    // awaits IndexedDB while the simulate page clears the store synchronously.
    // Reading the intent from the URL here settles it in one place instead of
    // coordinating two components that cannot see each other.
    const wantsNew =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("new") === "1";
    if (wantsNew) {
      void clearDraft(key);
      restored.current = true;
      return;
    }

    let cancelled = false;
    void (async () => {
      const d = await loadDraft(key);
      if (cancelled || !d) {
        // No draft for this project. Leave whatever is on screen alone on the
        // very first pass; on a deliberate switch, start clean rather than
        // carrying the previous project's drawing into this one.
        if (restored.current) useStudy.getState().newStudy();
        restored.current = true;
        return;
      }
      const st = useStudy.getState();
      // Only restore into an untouched editor. A project page that has just
      // pushed a saved run into the store must win over an old autosave.
      if (restored.current || isEmptyStudy(st.flowsheet)) {
        st.setFlowsheet(d.flowsheet);
        st.setStudyName(d.studyName);
        if (d.flowsheet.nodes.length > 0) st.run();
      }
      restored.current = true;
    })();
    return () => { cancelled = true; };
  }, [hydrated, activeId, flush]);

  /* ---- save on change ---- */
  useEffect(() => {
    const unsub = useStudy.subscribe((s, prev) => {
      if (s.flowsheet === prev.flowsheet && s.studyName === prev.studyName) return;
      if (currentKey.current === null) return;
      latest.current = {
        flowsheet: s.flowsheet,
        studyName: s.studyName,
        key: currentKey.current,
        savedAt: new Date().toISOString(),
      };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        const d = latest.current;
        if (!d) return;
        // An emptied canvas is a deliberate act; remember that too, or the next
        // reload helpfully restores the blocks the user just deleted.
        if (isEmptyStudy(d.flowsheet)) void clearDraft(d.key);
        else void saveDraft(d);
      }, 700);
    });
    return () => { unsub(); };
  }, []);

  /* ---- flush before the tab goes away ---- */
  useEffect(() => {
    const onHide = () => flush();
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [flush]);

  return null;
}
