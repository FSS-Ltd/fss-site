import { compileMDX } from "next-mdx-remote/rsc";
import Link from "next/link";

import type { ResourceItem, ResourceMeta } from "@/lib/types/resource";

import { ResourceBenefits } from "@/components/resources/resource-benefits";
import { ResourceCard } from "@/components/resources/resource-card";
import { resourceMdxComponents } from "@/components/resources/resource-mdx-components";
import { ResourceLeadPanel } from "@/components/resources/resource-lead-panel";
import { Container } from "@/components/ui/container";

type ResourceDetailPageProps = {
  resource: ResourceItem;
  relatedResources: ResourceMeta[];
};

export async function ResourceDetailPage({ resource, relatedResources }: ResourceDetailPageProps) {
  const { content } = await compileMDX({
    source: resource.body,
    components: resourceMdxComponents,
  });

  return (
    <div className="py-14 sm:py-20 lg:py-24">
      <Container>
        <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
              {resource.meta.category} • {resource.meta.format}
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {resource.meta.title}
            </h1>
            <p className="text-lg leading-8 text-text-muted">{resource.meta.fullDescription}</p>
            <ResourceBenefits resource={resource.meta} />
          </div>
          <ResourceLeadPanel resource={resource.meta} />
        </section>

        <section className="mt-12 rounded-2xl border border-border-soft/45 bg-surface-1/72 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-foreground">Implementation guidance</h2>
          <div className="mt-4 space-y-4 text-text-muted">{content}</div>
        </section>

        <section className="mt-12 rounded-2xl border border-border-soft/40 bg-surface-1/68 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-foreground">Trusted by product and engineering teams</h2>
          <p className="mt-3 max-w-2xl text-sm text-text-muted">
            FSS resources are built from real rollout playbooks and customer onboarding engagements. They are designed
            to reduce implementation uncertainty and help teams move from planning to execution quickly.
          </p>
          <p className="mt-3 text-sm text-text-subtle">
            Looking for more context? Read implementation guidance in our{" "}
            <Link href="/blog" className="text-brand-primary hover:underline">
              blog
            </Link>{" "}
            or{" "}
            <Link href="/contact" className="text-brand-primary hover:underline">
              talk to FSS
            </Link>
            .
          </p>
        </section>

        {relatedResources.length ? (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold text-foreground">Related resources</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {relatedResources.map((relatedResource) => (
                <ResourceCard key={relatedResource.slug} resource={relatedResource} />
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </div>
  );
}
