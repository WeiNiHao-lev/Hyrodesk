"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";

/**
 * A name that can be changed where it is shown.
 *
 * Runs used to be named once, at save time, in a field that was in fact read
 * only — so every run in a project came out as "Untitled study" and the list
 * could not tell them apart. A run's name is how it is found again, so it has to
 * be editable wherever it is read.
 *
 * Click the name or the pencil to edit. Enter or leaving the field keeps the
 * change, Escape throws it away. An empty name is refused rather than saved,
 * because a blank entry in a list is worse than the old one.
 */
export function InlineName({
  value, onSave, className = "", placeholder = "Untitled", title = "Rename",
}: {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  className?: string;
  placeholder?: string;
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);

  const begin = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDraft(value);
    setEditing(true);
  };

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (next && next !== value) await onSave(next);
  };

  if (editing) {
    return (
      <span className="flex min-w-0 flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          className={`field !py-0.5 ${className}`}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void commit(); }
            if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
          }}
          onBlur={() => { void commit(); }}
        />
        <button
          type="button"
          className="btn btn-ghost !p-1"
          title="Keep"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { void commit(); }}
        >
          <Check className="h-3.5 w-3.5 text-mint-700" />
        </button>
        <button
          type="button"
          className="btn btn-ghost !p-1"
          title="Cancel"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); setEditing(false); }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className="group inline-flex min-w-0 max-w-full items-center gap-1">
      <span
        role="button"
        tabIndex={0}
        title={title}
        onClick={begin}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); setDraft(value); setEditing(true); } }}
        className={`min-w-0 cursor-text truncate rounded px-0.5 hover:bg-aqua-50 ${className}`}
      >
        {value || <span className="text-ink-300">{placeholder}</span>}
      </span>
      <button
        type="button"
        title={title}
        onClick={begin}
        className="shrink-0 rounded p-0.5 text-ink-300 opacity-60 transition hover:bg-aqua-50 hover:text-aqua-700 group-hover:opacity-100"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}
