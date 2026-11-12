import { SiteShell } from "@/components/layout/site-shell";
import { ButtonLink } from "@/components/ui/button";

// Rendered inside the site shell so the skip link, header, footer and light
// theme match every other page. Styled with utilities only: the root
// not-found boundary ships to every route, so a CSS module here would count
// against the homepage stylesheet budget.
export default function NotFound() {
  return (
    <SiteShell>
      <section
        style={{
          padding: "176px max(24px, calc((100% - 1120px) / 2)) 96px",
        }}
      >
        <p className="mb-4 text-sm font-semibold tracking-wider text-brand-primary">
          404
        </p>
        <h1 className="mb-6 max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          We couldn’t find that page.
        </h1>
        <p className="mb-8 max-w-xl text-lg text-text-muted">
          The link may have changed. Visit our homepage or contact us for help.
        </p>
        <div className="flex flex-wrap gap-4">
          <ButtonLink href="/" size="lg" magnetic>
            Go to homepage <span aria-hidden="true">&nbsp;→</span>
          </ButtonLink>
          <ButtonLink
            href="/contact"
            variant="secondary"
            size="lg"
            magnetic
            className="hover:bg-foreground hover:text-white"
          >
            Contact FSS
          </ButtonLink>
        </div>
      </section>
    </SiteShell>
  );
}
