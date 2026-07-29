"use client";

import { useEffect, useState } from "react";

/**
 * Numeric input that can genuinely be empty.
 *
 * A plain <input type="number" value={x ?? 0}> forces a zero into every unset
 * field, which then cannot be cleared and — worse — makes "not analysed" look
 * identical to "measured as zero" in the balance. This keeps a string buffer so
 * the field can be blank, can hold a partial entry like "0." or "-", and only
 * reports a number when there is one.
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
  const [buf, setBuf] = useState<string>(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);

  // Track external changes (preset load, reset, optimiser) unless the user is typing.
  useEffect(() => {
    if (focused) return;
    setBuf(value == null ? "" : String(value));
  }, [value, focused]);

  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type="text"
      inputMode="decimal"
      className={`field ${className}`}
      value={buf}
      placeholder={placeholder}
      disabled={disabled}
      step={step}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const t = buf.trim();
        if (t === "" || t === "-" || t === ".") {
          setBuf("");
          onChange(undefined);
          return;
        }
        const n = Number(t.replace(",", "."));
        if (!Number.isFinite(n)) {
          setBuf(value == null ? "" : String(value));
          return;
        }
        let clamped = n;
        if (min != null && clamped < min) clamped = min;
        if (max != null && clamped > max) clamped = max;
        setBuf(String(clamped));
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
        // Let partial entries stand without reporting a bogus number.
        if (s === "-" || s === "." || s === "-." || s.endsWith(".")) return;
        const n = Number(s.replace(",", "."));
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

/** Same behaviour, but for a value that must always exist (unit parameters). */
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
