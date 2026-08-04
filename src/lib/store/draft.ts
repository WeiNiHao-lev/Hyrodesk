"use client";

import { get, set, del } from "idb-keyval";
import { create } from "zustand";
import { Flowsheet } from "../engine/types";

/**
 * The work in progress, kept without being asked.
 *
 * Everything on the canvas used to live only in memory. Closing the tab threw
 * away every block placed and every parameter typed, and nothing warned you,
 * because saving was a deliberate act filed under "Save to project". That is
 * the wrong default: a study becomes a saved run when you decide it is worth
 * keeping, but the draft has to survive a closed laptop regardless.
 *
 * One draft per project, plus one for work started before a project was chosen.
 * Switching projects therefore parks the current drawing and picks up the other
 * one where you left it, which is what "working inside a project" has to mean
 * if the phrase is to be worth anything.
 *
 * IndexedDB rather than localStorage: a flowsheet with results attached runs to
 * hundreds of kilobytes and localStorage would refuse it silently.
 */

const PREFIX = "wtpsim:draft:";
export const SCRATCH = "scratch";

export interface StudyDraft {
  flowsheet: Flowsheet;
  studyName: string;
  /** Which project this draft belongs to, or SCRATCH. */
  key: string;
  savedAt: string;
}

/**
 * Autosave status, so the editor can say so. After a session where work was
 * silently lost, "it saves automatically" is not a claim the user should have
 * to take on trust.
 */
interface DraftStatus {
  savedAt: string | null;
  saving: boolean;
  markSaving: () => void;
  markSaved: (at: string) => void;
}

export const useDraftStatus = create<DraftStatus>((setState) => ({
  savedAt: null,
  saving: false,
  markSaving: () => setState({ saving: true }),
  markSaved: (at) => setState({ saving: false, savedAt: at }),
}));

export function draftKey(projectId: string | null | undefined): string {
  return projectId ?? SCRATCH;
}

export async function loadDraft(key: string): Promise<StudyDraft | undefined> {
  try {
    return await get<StudyDraft>(PREFIX + key);
  } catch {
    return undefined;
  }
}

export async function saveDraft(d: StudyDraft): Promise<void> {
  useDraftStatus.getState().markSaving();
  try {
    await set(PREFIX + d.key, d);
    useDraftStatus.getState().markSaved(new Date().toISOString());
  } catch {
    // Storage full or blocked. Losing an autosave is bad; throwing here and
    // breaking the editor the user is typing into is worse.
  }
}

export async function clearDraft(key: string): Promise<void> {
  try {
    await del(PREFIX + key);
  } catch { /* nothing to do */ }
}

/** True when the study has nothing in it worth keeping. */
export function isEmptyStudy(fs: Flowsheet): boolean {
  const feedTouched =
    Object.keys(fs.feed.c ?? {}).length > 0 ||
    !!fs.feed.name ||
    fs.feed.alkalinityAsCaCO3 != null ||
    fs.feed.hardnessAsCaCO3 != null ||
    fs.feed.conductivityUScm != null ||
    Object.keys(fs.feed.trace ?? {}).length > 0;
  return fs.nodes.length === 0 && fs.edges.length === 0 && !feedTouched;
}
