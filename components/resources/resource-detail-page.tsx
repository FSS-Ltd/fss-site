import { Check, Quote } from "lucide-react";
import { compileMDX } from "next-mdx-remote/rsc";
import Link from "next/link";

import type { ResourceItem, ResourceMeta } from "@/lib/types/resource";

import { ResourceCard } from "@/components/resources/resource-card";
import { resourceMdxComponents } from "@/components/resources/resource-mdx-components";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { GlowCard } from "@/components/ui/spotlight-card";
import { getDeliveryPromise } from "@/lib/resource-delivery";
import { LeadMagnetCaptureForm } from "@/components/forms/lead-magnet-capture-form";

type ResourceDetailPageProps = {
  resource: ResourceItem;
  relatedResources: ResourceMeta[];
};

export async function ResourceDetailPage({ resource, relatedResources }: ResourceDetailPageProps) {
  const { content } = await compileMDX({
    source: resource.body,
    components: resourceMdxComponents,
  });

  const redirectPath = "/resources/" + resource.meta.slug + "/thank-you";
  const deliveryPromise = getDeliveryPromise(resource.meta);

  return (
    <div className="py-14 sm:py-20 lg:py-24">
      <Container>
        <section id="download-form" className="grid gap-16 lg:grid-cols-2 lg:items-start">
          <div className="space-y-8">
            <span className="inline-flex items-center rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-primary">
              {resource.meta.category} · {resource.meta.format}
            </span>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-foreground leading-tight sm:text-5xl lg:text-6xl">
              {resource.meta.title}
            </h1>
            <p className="text-lg leading-relaxed text-text-muted">
              {resource.meta.fullDescription}
            </p>
            <ul className="space-y-4">
              {resource.meta.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-4">
                  <span className="mt-0.5 shrink-0 rounded bg-brand-primary/10 p-1 text-brand-primary">
                    <Check className="size-3.5" />
                  </span>
                  <p className="text-sm text-text-muted">{benefit}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-4 rounded-full bg-brand-primary/8 blur-3xl" />
            <GlowCard customSize className="relative p-8 shadow-2xl">
              <h3 className="text-xl font-bold text-foreground">Download for Free</h3>
              <p className="mt-1 text-sm text-text-muted">{deliveryPromise}</p>
              <div className="mt-5">
                <LeadMagnetCaptureForm
                  resourceSlug={resource.meta.slug}
                  sourceContext={"resource:" + resource.meta.slug}
                  ctaLabel={resource.meta.ctaLabel}
                  redirectPath={redirectPath}
                />
              </div>
              <p className="mt-3 text-center text-[11px] text-text-subtle">
                By downloading, you agree to receive strategic updates. Unsubscribe anytime.
              </p>
            </GlowCard>
          </div>
        </section>

        <section className="mt-20 rounded-2xl bg-surface-1/60 py-14 sm:py-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              Trusted by Institutional Leaders
            </h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-brand-primary" />
          </div>
          <div className="mt-10 grid gap-6 px-6 md:grid-cols-2 sm:px-8">
            <GlowCard customSize className="relative p-8" as="blockquote">
              <Quote className="absolute right-6 top-5 size-10 text-brand-primary/15" aria-hidden="true" />
              <p className="relative z-10 italic leading-relaxed text-text-muted">
                &ldquo;Faithful Software Solutions understood our unique needs as a large school
                district. Their architectural approach to modernization saved us months of
                downtime and secured our student data beyond industry standards.&rdquo;
              </p>
              <footer className="mt-6 flex items-center gap-3">
                <div className="size-10 rounded-full bg-surface-2" />
                <div>
                  <p className="font-bold text-foreground">Dr. Sarah Jenkins</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
                    Superintendent, Lincoln Education Group
                  </p>
                </div>
              </footer>
            </GlowCard>

            <GlowCard customSize className="relative p-8" as="blockquote">
              <Quote className="absolute right-6 top-5 size-10 text-brand-primary/15" aria-hidden="true" />
              <p className="relative z-10 italic leading-relaxed text-text-muted">
                &ldquo;Modernizing a legacy financial system is high-stakes. The strategy outlined in
                this guide was exactly what we needed to move toward a cloud-native architecture
                without risking our core business data.&rdquo;
              </p>
              <footer className="mt-6 flex items-center gap-3">
                <div className="size-10 rounded-full bg-surface-2" />
                <div>
                  <p className="font-bold text-foreground">Marcus Thorne</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
                    CEO, Thorne Enterprise Logistics
                  </p>
                </div>
              </footer>
            </GlowCard>
          </div>
        </section>

        <section className="mt-20 py-16 text-center">
          <h3 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Ready to lead your organization into the next decade?
          </h3>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-muted">
            Download the strategic roadmap today and start your modernization journey with
            confidence.
          </p>
          <div className="mt-8">
            <ButtonLink
              href="#download-form"
              variant="secondary"
              size="lg"
              className="border-brand-primary/30 text-brand-primary hover:bg-brand-primary/10"
            >
              Get the Free Guide
            </ButtonLink>
          </div>
        </section>

        <GlowCard customSize className="mt-4 p-6 sm:p-8" as="section">
          <h2 className="text-2xl font-semibold text-foreground">Implementation Guidance</h2>
          <div className="mt-4 space-y-4 text-text-muted">{content}</div>
        </GlowCard>

        {relatedResources.length ? (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold text-foreground">Related resources</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {relatedResources.map((relatedResource) => (
                <ResourceCard key={relatedResource.slug} resource={relatedResource} />
              ))}
            </div>
            <p className="mt-6 text-sm text-text-subtle">
              Want to learn more?{" "}
              <Link href="/blog" className="text-brand-primary hover:underline">
                Read our blog
              </Link>{" "}
              or{" "}
              <Link href="/contact" className="text-brand-primary hover:underline">
                talk to FSS directly
              </Link>
              .
            </p>
          </section>
        ) : null}
      </Container>
    </div>
  );
}
