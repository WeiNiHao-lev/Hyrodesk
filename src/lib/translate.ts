"use client";

/**
 * Machine translation done by the browser itself, when it has one built in
 * (the Translator API of recent Chrome on a computer). Nothing is sent to any
 * outside service: the model runs on the device, downloaded once by the
 * browser. Where the browser has none, canTranslate() is false and callers
 * fall back to text typed by hand.
 */

export type TLang = "en" | "id" | "zh";

interface TranslatorLike { translate(s: string): Promise<string> }
interface TranslatorStatic {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorLike>;
}

const api = (): TranslatorStatic | null =>
  typeof window !== "undefined" && "Translator" in window
    ? (window as unknown as { Translator: TranslatorStatic }).Translator
    : null;

export const canTranslate = () => api() !== null;

/** Line by line, so lists keep their shape. Throws when the pair is not available. */
export async function translateText(text: string, from: TLang, to: TLang): Promise<string> {
  const T = api();
  if (!T) throw new Error("This browser has no built-in translator.");
  if (!text.trim() || from === to) return text;
  const pair = { sourceLanguage: from, targetLanguage: to };
  if ((await T.availability(pair)) === "unavailable") throw new Error(`No ${from} → ${to} translation in this browser.`);
  const tr = await T.create(pair);
  const out: string[] = [];
  for (const line of text.split("\n")) out.push(line.trim() ? await tr.translate(line) : "");
  return out.join("\n");
}
