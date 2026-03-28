import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/site-config";

const footerSolutions = [
  { label: "Business Solutions", href: "/#services" },
  { label: "Education Systems", href: "/#services" },
  { label: "Religious Tech", href: "/#services" },
  { label: "Non-Profit Support", href: "/#services" },
];

const footerCompany = [
  { label: "About Us", href: "/#about" },
  { label: "Case Studies", href: "/#case-studies" },
  { label: "Blog", href: "/blog" },
  { label: "Contact Us", href: "/contact" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border-soft/30 bg-background pt-16 pb-8">
      <Container>
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1 space-y-4">
            <p className="font-semibold text-foreground">{siteConfig.name}</p>
            <p className="text-sm leading-relaxed text-text-muted max-w-xs">
              Precision engineering for businesses, schools, and churches. Reliable technology since 2012.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">Solutions</h4>
            <ul className="space-y-3">
              {footerSolutions.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-text-muted transition hover:text-brand-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">Company</h4>
            <ul className="space-y-3">
              {footerCompany.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-text-muted transition hover:text-brand-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">Newsletter</h4>
            <p className="text-sm text-text-muted">Stay updated with our latest tech insights.</p>
            <div className="flex">
              <input
                type="email"
                placeholder="Email address"
                className="w-full rounded-l border border-border-strong/50 bg-surface-1 px-4 py-2 text-sm text-foreground placeholder:text-text-subtle focus:border-brand-primary focus:outline-none"
              />
              <button
                type="button"
                aria-label="Subscribe"
                className="flex items-center justify-center rounded-r bg-brand-primary px-4 py-2 text-cta-text hover:brightness-110 transition"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border-soft/30 pt-8 md:flex-row">
          <p className="text-xs text-text-subtle">
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex gap-6 text-xs font-bold uppercase tracking-widest text-text-subtle">
            <Link href="/privacy" className="hover:text-foreground transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition">Terms of Service</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
