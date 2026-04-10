"use client";

import Link from "next/link";
import { useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import type { NavItem } from "@/lib/types/marketing";
import { cn } from "@/lib/utils/cn";

type MobileNavProps = {
  items: NavItem[];
};

function MobileMenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="m6 6 12 12" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  ) : (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M4 5h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M4 12h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M4 19h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function MobileNav({ items }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        aria-controls="mobile-primary-nav"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-soft bg-surface-1 text-foreground transition hover:border-brand-primary/70 md:hidden"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <MobileMenuIcon open={isOpen} />
      </button>

      <div
        aria-hidden={!isOpen}
        className={cn(
          "fixed inset-0 z-30 bg-black/45 transition-opacity md:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setIsOpen(false)}
      />

      <aside
        className={cn(
          "fixed right-0 top-0 z-40 flex h-dvh w-[min(86vw,23rem)] flex-col border-l border-border-soft bg-surface-1 px-6 pb-8 pt-6 shadow-2xl transition-transform duration-200 md:hidden",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-subtle">Menu</p>
          <button
            aria-label="Close menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-soft text-foreground transition hover:border-brand-primary/70"
            onClick={() => setIsOpen(false)}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path d="M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              <path d="m6 6 12 12" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <nav aria-label="Mobile primary" className="flex flex-1 flex-col gap-2" id="mobile-primary-nav">
          {items.map((item) => (
            <Link
              className="rounded-xl border border-transparent px-4 py-3 text-base text-text-muted transition hover:border-border-soft hover:bg-surface-2 hover:text-foreground"
              href={item.href}
              key={item.href}
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <ButtonLink
          className="mt-5 w-full justify-center"
          href="/contact"
          onClick={() => setIsOpen(false)}
          size="lg"
          variant="primary"
        >
          Get a Quote
        </ButtonLink>
      </aside>
    </>
  );
}
