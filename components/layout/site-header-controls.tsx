"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { navItems } from "./site-header-nav-items";
import styles from "./site-header.module.css";
import { ButtonLink } from "@/components/ui/button";

function HeaderLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return navItems.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      prefetch={false}
      aria-current={pathname === item.activePath ? "page" : undefined}
      onClick={onNavigate}
    >
      {item.label}
    </Link>
  ));
}

function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <div
      className={styles.mobile}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        className="min-h-11 min-w-14 cursor-pointer rounded-lg border border-border-strong bg-white px-3 py-2 text-sm font-semibold"
        type="button"
        aria-expanded={open}
        aria-controls="site-mobile-navigation"
        onClick={() => setOpen(!open)}
      >
        Menu
      </button>
      <nav
        id="site-mobile-navigation"
        aria-label="Mobile primary"
        hidden={!open}
        className={styles.mobilePanel}
      >
        <HeaderLinks onNavigate={() => setOpen(false)} />
      </nav>
    </div>
  );
}

export function SiteHeaderNavigation() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1.5">
      <nav className={styles.desktop} aria-label="Primary">
        <HeaderLinks />
      </nav>
      <ButtonLink
        size="lg"
        className="px-3 text-sm sm:px-5"
        href="/contact"
        prefetch={false}
      >
        Discuss a project
      </ButtonLink>
      <MobileNavigation key={pathname} />
    </div>
  );
}
