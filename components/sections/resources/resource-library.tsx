import Link from "next/link";
import { ArrowRight, Download, FileText, FolderOpen } from "lucide-react";

import type { ResourceMeta } from "@/lib/types/resource";

import { ResourceCard } from "@/components/resources/resource-card";

type ResourceLibraryProps = {
  resources: ResourceMeta[];
};

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ResourceLibrary({ resources }: ResourceLibraryProps) {
  const featuredResource =
    resources.find((resource) => resource.featured) ?? resources[0];
  const categoryCount = new Set(resources.map((resource) => resource.category))
    .size;
  const featuredCount = resources.filter(
    (resource) => resource.featured,
  ).length;
  const primaryCtaHref = featuredResource
    ? `/resources/${featuredResource.slug}`
    : "#library";
  const primaryCtaLabel = featuredResource
    ? "Start with the featured guide"
    : "Browse all resources";

  return (
    <>
      <section
        className="relative overflow-hidden px-7 pb-16 pt-[138px]"
        style={{
          background:
            "radial-gradient(110% 70% at 82% -10%, rgba(230,160,127,.10), transparent 52%), #f2f3f5",
        }}
      >
        <canvas
          data-hero-canvas
          className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(33,27,23,.026)_1px,transparent_1px),linear-gradient(90deg,rgba(33,27,23,.026)_1px,transparent_1px)] bg-[length:64px_64px] [mask-image:radial-gradient(120%_90%_at_42%_12%,#000,transparent_76%)]" />
        <div
          className="relative mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-2 lg:items-end"
          data-motion-reveal="mask"
        >
          <div>
            <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-border-soft bg-white/60 py-1.5 pr-3.5 pl-2.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: "var(--brand-fss-teal)",
                  boxShadow:
                    "0 0 0 4px color-mix(in srgb, var(--brand-fss-teal) 18%, transparent)",
                }}
              />
              <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-text-muted">
                FREE STRATEGIC RESOURCES
              </span>
            </div>
            <h1 className="max-w-[850px] text-[clamp(40px,6vw,78px)] leading-[.99] font-bold text-foreground">
              Practical guides for better software decisions.
            </h1>
            <p className="mt-7 max-w-[590px] text-[clamp(16px,1.6vw,20px)] leading-[1.6] text-text-muted">
              Download planning tools and playbooks for leaders deciding what to
              build, what to automate, and how to modernise without losing
              control.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                data-magnetic
                href={primaryCtaHref}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--button-primary)] px-6 py-3.5 text-sm font-semibold text-cta-text transition hover:bg-[var(--button-primary-hover)]"
              >
                <span data-mag-label className="inline-flex items-center gap-2">
                  {primaryCtaLabel}
                  <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-[var(--brand-fss-teal)]">
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </span>
              </Link>
              <Link
                href="#library"
                className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-white/70 px-6 py-3.5 text-sm font-semibold text-foreground transition hover:border-border-strong hover:bg-white"
              >
                Browse all resources
              </Link>
            </div>
          </div>

          <aside
            data-reveal
            className="relative overflow-hidden rounded-2xl border border-border-soft bg-white p-6 sm:p-7"
            style={{
              boxShadow: "0 40px 90px -56px rgba(33,27,23,.45)",
            }}
            aria-label="Resource library summary"
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(20,152,158,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(20,152,158,.055) 1px, transparent 1px)",
                backgroundSize: "34px 34px",
                maskImage:
                  "radial-gradient(80% 80% at 100% 0, #000, transparent 72%)",
                WebkitMaskImage:
                  "radial-gradient(80% 80% at 100% 0, #000, transparent 72%)",
              }}
            />
            <div className="relative">
              <p className="font-mono text-[11px] tracking-[0.14em] text-[#0f7078]">
                LIBRARY SNAPSHOT
              </p>
              <div className="mt-6 grid gap-3">
                <div className="flex items-start gap-3 rounded-2xl bg-[#f7f8f9] p-4">
                  <FileText className="mt-0.5 size-5 flex-none text-[#0f7078]" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatCount(resources.length, "resource", "resources")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-text-muted">
                      Decision tools, kits, and frameworks ready to use.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-[#f7f8f9] p-4">
                  <FolderOpen className="mt-0.5 size-5 flex-none text-[#0f7078]" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {formatCount(categoryCount, "focus area", "focus areas")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-text-muted">
                      Strategy, operations, and implementation planning.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-brand-secondary p-4 text-white">
                  <Download className="mt-0.5 size-5 flex-none text-[var(--brand-fss-cyan)]" />
                  <div>
                    <p className="text-sm font-semibold">
                      {formatCount(
                        featuredCount,
                        "featured download",
                        "featured downloads",
                      )}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#d8cdc4]">
                      Prioritised starting points for project planning.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section
        id="library"
        className="bg-[#f2f3f5] px-7 py-[clamp(80px,10vw,130px)]"
        data-motion-reveal="up"
      >
        <div className="mx-auto max-w-[1180px]">
          <div
            data-reveal
            className="mb-12 grid gap-6 lg:grid-cols-2 lg:items-end"
          >
            <div>
              <p className="font-mono text-xs tracking-[0.14em] text-[#0f7078]">
                RESOURCE LIBRARY
              </p>
              <h2 className="mt-4 max-w-[620px] text-[clamp(28px,4vw,46px)] leading-[1.05] font-semibold text-foreground">
                Use the right tool before commissioning the wrong system.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-text-muted lg:ml-auto">
              Each resource is built to help you make a clearer decision before
              scope, budget, or delivery pressure starts driving the project.
            </p>
          </div>

          {resources.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {resources.map((resource) => (
                <ResourceCard key={resource.slug} resource={resource} />
              ))}
            </div>
          ) : (
            <p className="text-center text-text-muted">
              No resources available yet.
            </p>
          )}

          <div
            data-reveal
            className="relative mt-16 overflow-hidden rounded-3xl px-8 py-12 text-[#fff] sm:px-12"
            style={{
              background:
                "linear-gradient(135deg, #211b17 0%, #302722 56%, #b55937 130%)",
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[length:60px_60px] [mask-image:radial-gradient(100%_100%_at_90%_10%,#000,transparent_72%)]" />
            <div className="relative max-w-[620px]">
              <p className="font-mono text-xs tracking-[0.14em] text-[#46c7d8]">
                NEXT STEP
              </p>
              <h2 className="mt-4 text-[clamp(28px,4vw,46px)] leading-[1.05] font-semibold">
                Need implementation guidance after the download?
              </h2>
              <p className="mt-5 text-base leading-7 text-[#d8cdc4]">
                Our blog covers architecture, sector-specific decisions, and
                real project lessons from FSS engineering work.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/blog"
                  data-magnetic
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-foreground transition hover:bg-[#eef0f2]"
                >
                  <span
                    data-mag-label
                    className="inline-flex items-center gap-2"
                  >
                    Read the blog
                  </span>
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,.2)] bg-[rgba(255,255,255,.08)] px-6 py-3.5 text-sm font-semibold text-[#fff] transition hover:bg-[rgba(255,255,255,.14)]"
                >
                  Talk to FSS{" "}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
