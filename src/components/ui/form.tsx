"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/** Label + control + hint wrapper used by all tool option forms. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="font-display text-[9px] tracking-wide text-ink uppercase">{label}</span>
      {children}
      {hint && <span className="text-xs leading-snug text-ink-soft">{hint}</span>}
    </label>
  );
}

const controlClasses =
  "w-full h-11 border-[3px] border-edge bg-card px-3 font-body text-lg text-ink " +
  "placeholder:text-ink-soft/60 focus:border-brand focus:outline-none " +
  "focus:shadow-[3px_3px_0_0_var(--color-brand)] " +
  "disabled:bg-canvas disabled:text-ink-soft";

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(controlClasses, "h-auto min-h-40 p-3 leading-relaxed", className)}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(controlClasses, "appearance-none pr-10", className)} {...rest}>
        {children}
      </select>
      <span
        className="pointer-events-none absolute right-3 top-1/2 font-display text-[10px] text-ink-soft -translate-y-1/2"
        aria-hidden
      >
        ▼
      </span>
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
      <input
        type="checkbox"
        className="pixel-check"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

export function RangeInput({
  value,
  min,
  max,
  step = 1,
  onChange,
  suffix,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="h-8 flex-1 cursor-pointer"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      />
      <output className="w-16 border-[3px] border-edge bg-canvas px-1 text-right font-body text-lg font-medium text-ink tabular-nums">
        {value}
        {suffix ?? ""}
      </output>
    </div>
  );
}

/** Compact pixel tabs for small option sets (split modes, formats). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap border-[3px] border-edge bg-canvas p-1 shadow-[3px_3px_0_0_var(--color-shadow)]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "px-3 py-1.5 font-display text-[9px] uppercase transition-colors",
              active
                ? "bg-brand text-on-brand shadow-[2px_2px_0_0_var(--color-shadow)]"
                : "text-ink-soft hover:bg-brand-soft hover:text-brand",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
