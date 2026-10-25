"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

/*
  Pixel button: hard 3px shadow, hover = lift + bigger shadow, active =
  press into the shadow. Bitmap display font, chunky 3px ink border.
*/
const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand border-edge text-on-brand hover:bg-brand-strong",
  secondary:
    "bg-card border-edge text-ink hover:bg-brand-soft hover:text-brand",
  ghost:
    "bg-transparent border-transparent text-ink-soft hover:bg-brand-soft hover:text-brand",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3 text-[9px] gap-1.5",
  md: "h-11 px-4 text-[10px] gap-2",
  lg: "h-12 px-6 text-[11px] gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center border-[3px] font-display uppercase tracking-wide",
        "shadow-[3px_3px_0_0_var(--color-shadow)]",
        "transition-[transform,box-shadow,background-color,color] duration-100",
        "hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_var(--color-shadow)]",
        "active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
