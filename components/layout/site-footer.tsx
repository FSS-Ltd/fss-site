import Link from "next/link";

import { Container } from "@/components/ui/container";
import { mainNavItems } from "@/lib/navigation";
import { siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#050608] py-10">
      <Container className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-white">{siteConfig.name}</p>
          <p className="max-w-sm text-sm text-zinc-400">{siteConfig.description}</p>
          <p className="text-xs text-zinc-500">© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
        </div>
        <ul className="flex flex-wrap items-center gap-5">
          {mainNavItems.map((item) => (
            <li key={item.href}>
              <Link className="text-sm text-zinc-400 transition hover:text-white" href={item.href}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </footer>
  );
}
