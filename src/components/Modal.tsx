"use client";

import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";

export function Modal({
  title, subtitle, onClose, children, footer, wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/25 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`card relative flex max-h-[88vh] w-full flex-col ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-ink-900/8 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[0.98rem] font-bold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[0.72rem] text-ink-500">{subtitle}</p>}
          </div>
          <button className="btn btn-ghost !px-1.5 !py-1" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-ink-900/8 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
