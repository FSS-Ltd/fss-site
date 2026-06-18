import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import type { NavItem } from "@/lib/types/marketing";

type MobileNavProps = {
  items: NavItem[];
};

function MenuIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M4 5h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M4 12h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <path d="M4 19h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function MobileNav({ items }: MobileNavProps) {
  return (
    <details className="group md:hidden">
      <summary
        aria-controls="mobile-primary-nav"
        aria-label="Toggle menu"
        className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-border-soft bg-surface-1 text-foreground transition hover:border-brand-primary/70 group-open:fixed group-open:right-6 group-open:top-6 group-open:z-50 group-open:h-9 group-open:w-9 [&::-webkit-details-marker]:hidden"
      >
        <MenuIcon />
      </summary>

      <div className="fixed inset-0 z-30 bg-black/45" />

      <aside className="fixed right-0 top-0 z-40 flex h-dvh w-[min(86vw,23rem)] flex-col border-l border-border-soft bg-surface-1 px-6 pb-8 pt-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-subtle">Menu</p>
          <span className="h-9 w-9" aria-hidden="true" />
        </div>

        <nav aria-label="Mobile primary" className="flex flex-1 flex-col gap-2" id="mobile-primary-nav">
          {items.map((item) => (
            <Link
              className="rounded-xl border border-transparent px-4 py-3 text-base text-text-muted transition hover:border-border-soft hover:bg-surface-2 hover:text-foreground"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <ButtonLink
          className="mt-5 w-full justify-center"
          href="/contact"
          size="lg"
          variant="primary"
        >
          Get a Quote
        </ButtonLink>
      </aside>
    </details>
  );
}
