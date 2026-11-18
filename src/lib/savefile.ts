"use client";

import { del, get, set } from "idb-keyval";
import { getPrefs, usePrefs } from "./prefs";
import { translate } from "./i18n";
import { toast } from "./toast";

/**
 * Where exported files go: the browser's downloads folder, a save dialog each
 * time, or one folder chosen once in Settings.
 *
 * The last two use the File System Access API, which only Chromium browsers
 * (Chrome, Edge) have. Anywhere it is missing, or when the browser refuses,
 * the file is downloaded the ordinary way, so an export is never lost.
 */

interface WritableLike { write(b: Blob): Promise<void>; close(): Promise<void> }
interface FileHandleLike { createWritable(): Promise<WritableLike> }
interface DirHandleLike {
  name: string;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<FileHandleLike>;
  queryPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
}
type PickerWindow = Window & {
  showSaveFilePicker?: (o: { suggestedName: string }) => Promise<FileHandleLike>;
  showDirectoryPicker?: (o: { id?: string; mode: "readwrite" }) => Promise<DirHandleLike>;
};

const DIR_KEY = "hd-save-dir";
const w = () => window as PickerWindow;
const t = (en: string, vars?: Record<string, string | number>) => translate(getPrefs().lang, en, vars);

export const canAskEachTime = () => typeof window !== "undefined" && typeof w().showSaveFilePicker === "function";
export const canUseFolder = () => typeof window !== "undefined" && typeof w().showDirectoryPicker === "function";

/** Asks for the folder (from a click in Settings) and remembers it. */
export async function chooseSaveFolder(): Promise<string | null> {
  if (!canUseFolder()) return null;
  try {
    const dir = await w().showDirectoryPicker!({ id: "hydrodesk-exports", mode: "readwrite" });
    await set(DIR_KEY, dir);
    usePrefs.getState().set({ saveTo: "folder", folderName: dir.name });
    return dir.name;
  } catch {
    return null; // cancelled
  }
}

export async function forgetSaveFolder() {
  await del(DIR_KEY);
  usePrefs.getState().set({ saveTo: "downloads", folderName: null });
}

function plainDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** "report.docx" -> "report (2).docx" until the name is free, so nothing is overwritten. */
async function freeName(dir: DirHandleLike, filename: string): Promise<string> {
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  for (let i = 1; i < 100; i++) {
    const name = i === 1 ? filename : `${stem} (${i})${ext}`;
    try { await dir.getFileHandle(name); } catch { return name; }
  }
  return `${stem}-${Date.now()}${ext}`;
}

export async function saveFile(filename: string, blob: Blob): Promise<void> {
  const { saveTo } = getPrefs();

  if (saveTo === "ask" && canAskEachTime()) {
    try {
      const h = await w().showSaveFilePicker!({ suggestedName: filename });
      const out = await h.createWritable();
      await out.write(blob);
      await out.close();
      toast(t("Saved {name}", { name: filename }));
      return;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return; // the user cancelled
      // Refused (for instance the click is too long ago): fall through to a download.
    }
  }

  if (saveTo === "folder" && canUseFolder()) {
    const dir = (await get(DIR_KEY).catch(() => undefined)) as DirHandleLike | undefined;
    if (dir) {
      try {
        let perm = (await dir.queryPermission?.({ mode: "readwrite" })) ?? "granted";
        if (perm !== "granted") perm = (await dir.requestPermission?.({ mode: "readwrite" })) ?? "denied";
        if (perm === "granted") {
          const name = await freeName(dir, filename);
          const out = await (await dir.getFileHandle(name, { create: true })).createWritable();
          await out.write(blob);
          await out.close();
          toast(t("Saved to {folder}/{name}", { folder: dir.name, name }));
          return;
        }
      } catch {
        /* fall through */
      }
      toast(t("Could not write to {folder}; downloaded instead. Allow the folder again in Settings.", { folder: dir.name }), "warn");
    }
  }

  plainDownload(filename, blob);
}
