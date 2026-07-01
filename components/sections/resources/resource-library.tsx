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
      <section className="relative overflow-hidden bg-[radial-gradient(110%_70%_at_82%_-10%,rgba(70,199,216,.10),transparent_52%),#f2f3f5] px-7 pb-16 pt-[138px]">
        <canvas
          data-hero-canvas
          className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(10,26,46,.026)_1px,transparent_1px),linear-gradient(90deg,rgba(10,26,46,.026)_1px,transparent_1px)] bg-[length:64px_64px] [mask-image:radial-gradient(120%_90%_at_42%_12%,#000,transparent_76%)]" />
        <div className="relative mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[1.02fr_.8fr] lg:items-end">
          <div>
            <div className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-[rgba(10,26,46,.12)] bg-white/60 py-1.5 pr-3.5 pl-2.5">
              <span className="h-2 w-2 rounded-full bg-[#14989e] shadow-[0_0_0_4px_rgba(20,152,158,.18)]" />
              <span className="font-mono text-[11px] font-medium tracking-[0.12em] text-[#41506a]">
                FREE STRATEGIC RESOURCES
              </span>
            </div>
            <h1 className="max-w-[850px] text-[clamp(40px,6vw,78px)] leading-[.99] font-bold text-[#0a1a2e]">
              Practical guides for better software decisions.
            </h1>
            <p className="mt-7 max-w-[590px] text-[clamp(16px,1.6vw,20px)] leading-[1.6] text-[#46566c]">
              Download planning tools and playbooks for leaders deciding what to
              build, what to automate, and how to modernise without losing
              control.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                data-magnetic
                href={primaryCtaHref}
                className="inline-flex items-center gap-2 rounded-full bg-[#0a1a2e] px-6 py-3.5 text-sm font-semibold text-[#fff] transition hover:bg-[#102642]"
              >
                <span data-mag-label className="inline-flex items-center gap-2">
                  {primaryCtaLabel}
                  <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-[#14989e]">
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </span>
                </span>
              </Link>
              <Link
                href="#library"
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(10,26,46,.14)] bg-white/70 px-6 py-3.5 text-sm font-semibold text-[#0a1a2e] transition hover:border-[rgba(10,26,46,.28)] hover:bg-white"
              >
                Browse all resources
              </Link>
            </div>
          </div>

          <aside
            data-reveal
            className="relative overflow-hidden rounded-[22px] border border-[rgba(10,26,46,.09)] bg-white p-6 opacity-0 shadow-[0_40px_90px_-56px_rgba(10,26,46,.45)] transition-[opacity,transform] duration-700 ease-out sm:p-7"
            style={{ transform: "translateY(26px)" }}
            aria-label="Resource library summary"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(20,152,158,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(20,152,158,.055)_1px,transparent_1px)] bg-[length:34px_34px] [mask-image:radial-gradient(80%_80%_at_100%_0,#000,transparent_72%)]" />
            <div className="relative">
              <p className="font-mono text-[11px] tracking-[0.14em] text-[#0f7a83]">
                LIBRARY SNAPSHOT
              </p>
              <div className="mt-6 grid gap-3">
                <div className="flex items-start gap-3 rounded-[16px] bg-[#f7f8f9] p-4">
                  <FileText className="mt-0.5 size-5 flex-none text-[#0f7a83]" />
                  <div>
                    <p className="text-sm font-semibold text-[#0a1a2e]">
                      {formatCount(resources.length, "resource", "resources")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#56657a]">
                      Decision tools, kits, and frameworks ready to use.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[16px] bg-[#f7f8f9] p-4">
                  <FolderOpen className="mt-0.5 size-5 flex-none text-[#0f7a83]" />
                  <div>
                    <p className="text-sm font-semibold text-[#0a1a2e]">
                      {formatCount(categoryCount, "focus area", "focus areas")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#56657a]">
                      Strategy, operations, and implementation planning.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-[16px] bg-[#0a1a2e] p-4 text-white">
                  <Download className="mt-0.5 size-5 flex-none text-[#46c7d8]" />
                  <div>
                    <p className="text-sm font-semibold">
                      {formatCount(
                        featuredCount,
                        "featured download",
                        "featured downloads",
                      )}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#bcd2e2]">
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
      >
        <div className="mx-auto max-w-[1180px]">
          <div
            data-reveal
            className="mb-12 grid gap-6 opacity-0 transition-[opacity,transform] duration-700 ease-out lg:grid-cols-[.85fr_1.15fr] lg:items-end"
            style={{ transform: "translateY(26px)" }}
          >
            <div>
              <p className="font-mono text-xs tracking-[0.14em] text-[#0f7a83]">
                RESOURCE LIBRARY
              </p>
              <h2 className="mt-4 max-w-[620px] text-[clamp(28px,4vw,46px)] leading-[1.05] font-semibold text-[#0a1a2e]">
                Use the right tool before commissioning the wrong system.
              </h2>
            </div>
            <p className="max-w-[470px] text-sm leading-7 text-[#56657a] lg:ml-auto">
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
            <p className="text-center text-[#56657a]">
              No resources available yet.
            </p>
          )}

          <div
            data-reveal
            className="relative mt-16 overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#07182e_0%,#0d2a45_56%,#14989e_130%)] px-8 py-12 text-[#fff] opacity-0 transition-[opacity,transform] duration-700 ease-out sm:px-12"
            style={{ transform: "translateY(26px)" }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[length:60px_60px] [mask-image:radial-gradient(100%_100%_at_90%_10%,#000,transparent_72%)]" />
            <div className="relative max-w-[620px]">
              <p className="font-mono text-xs tracking-[0.14em] text-[#7fe0ec]">
                NEXT STEP
              </p>
              <h2 className="mt-4 text-[clamp(28px,4vw,46px)] leading-[1.05] font-semibold">
                Need implementation guidance after the download?
              </h2>
              <p className="mt-5 text-base leading-7 text-[#bcd2e2]">
                Our blog covers architecture, sector-specific decisions, and
                real project lessons from FSS engineering work.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/blog"
                  data-magnetic
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#0a1a2e] transition hover:bg-[#eef0f2]"
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
