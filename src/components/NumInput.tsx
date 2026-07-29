"use client";

import { useState } from "react";

/**
 * Numeric input that can genuinely be empty.
 *
 * A plain <input type="number" value={x ?? 0}> forces a zero into every unset
 * field, which then cannot be cleared and — worse — makes "not analysed" look
 * identical to "measured as zero" in the balance. This keeps an edit buffer so
 * the field can be blank, can hold a partial entry like "0." or "-", and only
 * reports a number when there is one.
 *
 * The buffer is null whenever the user is not editing, so the displayed value
 * is derived straight from the prop. That way a preset load, a reset or the
 * optimiser is reflected immediately without an effect synchronising state.
 *
 * Empty reports `undefined`, not 0.
 */
export function NumInput({
  value, onChange, placeholder = "—", className = "", step = "any",
  min, max, disabled, id, ariaLabel,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  className?: string;
  step?: string | number;
  min?: number;
  max?: number;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  /** null when not editing: the prop is the source of truth. */
  const [buf, setBuf] = useState<string | null>(null);
  const shown = buf ?? (value == null ? "" : String(value));

  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type="text"
      inputMode="decimal"
      className={`field ${className}`}
      value={shown}
      placeholder={placeholder}
      disabled={disabled}
      step={step}
      onFocus={() => setBuf(shown)}
      onBlur={() => {
        const t = (buf ?? "").trim();
        if (t === "" || t === "-" || t === "." || t === "-.") {
          setBuf(null);
          onChange(undefined);
          return;
        }
        const n = Number(t.replace(",", "."));
        if (!Number.isFinite(n)) {
          setBuf(null); // discard nonsense, fall back to the prop
          return;
        }
        let clamped = n;
        if (min != null && clamped < min) clamped = min;
        if (max != null && clamped > max) clamped = max;
        setBuf(null);
        onChange(clamped);
      }}
      onChange={(e) => {
        const t = e.target.value;
        setBuf(t);
        const s = t.trim();
        if (s === "") {
          onChange(undefined);
          return;
        }
        // Let a partial entry stand without reporting a bogus number.
        if (s === "-" || s === "." || s === "-." || s.endsWith(".")) return;
        const n = Number(s.replace(",", "."));
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

/** Same behaviour, for a value that must always exist (unit parameters). */
export function NumInputRequired({
  value, onChange, className = "", step, min, max,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <NumInput
      value={value}
      onChange={(v) => onChange(v ?? 0)}
      className={className}
      step={step ?? "any"}
      min={min}
      max={max}
      placeholder="0"
    />
  );
}
