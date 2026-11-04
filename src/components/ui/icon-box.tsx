import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
  Pixel icon plate: the 3px ink border plus a foreground token that is known to
  read against its own fill in all ten accent/mode palettes. Size, shadow and
  hover states stay with the caller; the colour pairing never leaves this file.
*/
const toneClasses = {
  brand: "bg-brand text-on-brand",
  gold: "bg-gold text-on-gold",
  soft: "bg-brand-soft text-brand",
  card: "bg-card text-brand",
} as const;

export function IconBox({
  tone = "soft",
  className,
  children,
}: {
  tone?: keyof typeof toneClasses;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("flex items-center justify-center border-[3px] border-edge", toneClasses[tone], className)}>
      {children}
    </span>
  );
}
