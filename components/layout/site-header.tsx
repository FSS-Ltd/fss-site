import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { mainNavItems } from "@/lib/navigation";
import { siteConfig } from "@/lib/site-config";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#06070b]/90 backdrop-blur">
      <Container className="flex h-18 items-center justify-between gap-6">
        <Link className="text-sm font-semibold uppercase tracking-[0.25em] text-white" href="/">
          {siteConfig.name}
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {mainNavItems.map((item) => (
            <Link key={item.href} className="text-sm text-zinc-300 transition hover:text-white" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <ButtonLink href="/contact" size="default" variant="secondary">
          Book a demo
        </ButtonLink>
      </Container>
    </header>
  );
}
