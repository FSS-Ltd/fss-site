import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { ResourceMeta } from "@/lib/types/resource";

import { ResourceCard } from "@/components/resources/resource-card";

type ResourceLibraryProps = {
  resources: ResourceMeta[];
};

export function ResourceLibrary({ resources }: ResourceLibraryProps) {
  return (
    <>
      <section className="relative overflow-hidden bg-[#f2f3f5] px-7 pb-20 pt-[138px]">
        <canvas
          data-hero-canvas
          className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(10,26,46,.026)_1px,transparent_1px),linear-gradient(90deg,rgba(10,26,46,.026)_1px,transparent_1px)] bg-[length:64px_64px] [mask-image:radial-gradient(120%_90%_at_42%_12%,#000,transparent_76%)]" />
        <div className="relative mx-auto max-w-[1080px]">
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
        </div>
      </section>

      <section className="bg-[#f2f3f5] px-7 py-[clamp(80px,10vw,130px)]">
        <div className="mx-auto max-w-[1180px]">
          <div
            data-reveal
            className="mb-12 max-w-[720px] opacity-0 transition-[opacity,transform] duration-700 ease-out"
            style={{ transform: "translateY(26px)" }}
          >
            <p className="font-mono text-xs tracking-[0.14em] text-[#0f7a83]">
              RESOURCE LIBRARY
            </p>
            <h2 className="mt-4 text-[clamp(28px,4vw,46px)] leading-[1.05] font-semibold text-[#0a1a2e]">
              Use the right tool before commissioning the wrong system.
            </h2>
          </div>

          {resources.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
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
            className="relative mt-16 overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#07182e_0%,#0d2a45_56%,#14989e_130%)] px-8 py-12 text-[#fff] opacity-0 transition-[opacity,transform] duration-700 ease-out sm:px-12"
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
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-[#0a1a2e] transition hover:bg-[#eef0f2]"
                >
                  Read the blog
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
