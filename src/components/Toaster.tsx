"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface Item { id: number; text: string; tone: "ok" | "warn" }

/** Shows notices sent with toast(), a few seconds each. */
export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { text, tone } = (e as CustomEvent<{ text: string; tone: "ok" | "warn" }>).detail;
      const id = ++n;
      setItems((xs) => [...xs.slice(-2), { id, text, tone }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500);
    };
    window.addEventListener("hd-toast", on);
    return () => window.removeEventListener("hd-toast", on);
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {items.map((x) => (
        <div key={x.id} className={`card pointer-events-auto flex max-w-lg items-center gap-2 px-3.5 py-2 text-[0.78rem] font-medium ${x.tone === "ok" ? "text-mint-700" : "text-sun-700"}`}>
          {x.tone === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span className="text-ink-900">{x.text}</span>
        </div>
      ))}
    </div>
  );
}
