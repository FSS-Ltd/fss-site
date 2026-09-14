import Link from "next/link";

import type { ResourceMeta } from "@/lib/types/resource";

import { ResourceDeliveryPanel } from "@/components/resources/resource-delivery-panel";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type ResourceThankYouPageProps = {
  resource: ResourceMeta;
};

export function ResourceThankYouPage({ resource }: ResourceThankYouPageProps) {
  const resourcePath = "/resources/" + resource.slug;

  return (
    <div className="py-16 sm:py-20 lg:py-24">
      <Container className="max-w-3xl">
        <section
          className="rounded-3xl border border-border-soft/45 bg-surface-1/72 p-8 text-center sm:p-10"
          data-motion-reveal="mask"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
            Thank you
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Request received
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-text-muted">
            {resource.thankYouMessage}
          </p>
          <ResourceDeliveryPanel resource={resource} />
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <ButtonLink href="/resources" variant="primary" magnetic>
              Browse more resources
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Talk to FSS
            </ButtonLink>
          </div>
          <p className="mt-6 text-sm text-text-subtle">
            Want to review this page again?{" "}
            <Link
              href={resourcePath}
              className="text-brand-primary hover:underline"
            >
              Go back to resource
            </Link>
            . You can also browse our{" "}
            <Link href="/blog" className="text-brand-primary hover:underline">
              latest blog articles
            </Link>
            .
          </p>
        </section>
      </Container>
    </div>
  );
}
