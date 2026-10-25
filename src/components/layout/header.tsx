"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { activeCategories } from "@/lib/tools/registry";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { AccentPicker } from "./accent-picker";
import { openSearch } from "./search-dialog";
import { ThemeToggle } from "./theme-toggle";

/**
 * Sticky pixel-cabinet header: brand, category tabs, search trigger,
 * light/dark/system toggle and a mobile menu — all registry-driven.
 */
export function Header() {
  const categories = activeCategories();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.platform.toLowerCase().includes("mac"));
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b-[3px] border-edge bg-card/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5" aria-label={`${site.name} home`}>
          <LogoMark className="size-9 transition-transform duration-100 group-hover:-translate-y-0.5" />
          <span className="font-display text-sm tracking-tight text-ink">
            OMNI<span className="text-brand">TOOLZ</span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-3 hidden flex-1 items-center gap-1 xl:flex">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/${category.slug}`}
              className="group border-[3px] border-transparent px-2.5 py-1.5 font-display text-[10px] text-ink-soft uppercase transition-colors hover:border-edge hover:bg-brand-soft hover:text-brand"
            >
              <span className="mr-1 inline-block opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                ▸
              </span>
              {category.shortName}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openSearch()}
            className="flex h-9 items-center gap-2 border-[3px] border-edge bg-card px-3 font-display text-[9px] text-ink-soft uppercase shadow-[3px_3px_0_0_var(--color-shadow)] transition-all hover:-translate-y-0.5 hover:text-ink hover:shadow-[4px_4px_0_0_var(--color-shadow)] active:translate-y-0.5 active:shadow-none"
            aria-label="Search tools"
          >
            <Search className="size-4" aria-hidden />
            <span className="hidden md:inline">Search</span>
            <kbd className="hidden whitespace-nowrap border-2 border-line-strong bg-canvas px-1 py-0.5 text-[8px] lg:inline">
              {isMac ? "⌘K" : "CTRL K"}
            </kbd>
          </button>

          <div className="hidden items-center gap-2.5 md:flex">
            <ThemeToggle />
            <AccentPicker />
          </div>

          <button
            type="button"
            className="flex size-9 items-center justify-center border-[3px] border-edge bg-card shadow-[3px_3px_0_0_var(--color-shadow)] transition-all active:translate-y-0.5 active:shadow-none xl:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        className={cn("border-t-[3px] border-edge bg-card xl:hidden", menuOpen ? "block" : "hidden")}
      >
        <nav aria-label="Mobile" className="mx-auto grid max-w-6xl gap-1.5 px-4 py-4">
          <div className="mb-1 flex flex-wrap items-center gap-2.5 md:hidden">
            <ThemeToggle />
            <AccentPicker />
          </div>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/${category.slug}`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between border-[3px] border-edge bg-canvas px-3 py-2.5 font-display text-[10px] text-ink uppercase transition-colors hover:bg-brand-soft hover:text-brand"
            >
              {category.name}
              <span className="text-[9px] text-ink-soft">{category.toolCount}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
