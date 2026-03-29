import Link from "next/link";

import { MobileNav } from "@/components/layout/mobile-nav";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { mainNavItems } from "@/lib/navigation";
import { siteConfig } from "@/lib/site-config";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border-soft/45 bg-background/84 backdrop-blur">
      <Container className="flex h-18 items-center justify-between gap-6">
        <Link className="text-sm font-semibold uppercase tracking-[0.25em] text-foreground" href="/">
          {siteConfig.name}
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {mainNavItems.map((item) => (
            <Link key={item.href} className="text-sm text-text-muted transition hover:text-brand-primary" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <ButtonLink className="hidden md:inline-flex" href="/contact" size="default" variant="primary">
          Get a Quote
        </ButtonLink>
        <MobileNav items={mainNavItems} />
      </Container>
    </header>
  );
}
