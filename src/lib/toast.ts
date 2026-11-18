/** A short notice at the bottom of the screen, from anywhere (see Toaster). */
export function toast(text: string, tone: "ok" | "warn" = "ok") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("hd-toast", { detail: { text, tone } }));
}
