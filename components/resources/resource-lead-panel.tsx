import type { ResourceMeta } from "@/lib/types/resource";

import { LeadMagnetCaptureForm } from "@/components/forms/lead-magnet-capture-form";
import { getDeliveryPromise } from "@/lib/resource-delivery";

type ResourceLeadPanelProps = {
  resource: ResourceMeta;
};

export function ResourceLeadPanel({ resource }: ResourceLeadPanelProps) {
  const redirectPath = "/resources/" + resource.slug + "/thank-you";
  const deliveryPromise = getDeliveryPromise(resource);

  return (
    <aside className="relative rounded-2xl border border-border-soft/45 bg-surface-1/72 p-6 shadow-2xl">
      <div className="pointer-events-none absolute -inset-4 rounded-full bg-brand-primary/8 blur-3xl" />
      <div className="relative space-y-1">
        <h2 className="text-xl font-bold text-foreground">Download for Free</h2>
        <p className="text-sm text-text-muted">{deliveryPromise}</p>
      </div>
      <div className="relative mt-5">
        <LeadMagnetCaptureForm
          resourceSlug={resource.slug}
          sourceContext={"resource:" + resource.slug}
          ctaLabel={resource.ctaLabel}
          redirectPath={redirectPath}
        />
      </div>
      <p className="relative mt-4 text-center text-[11px] text-text-subtle">
        By downloading, you agree to receive strategic updates. Unsubscribe anytime.
      </p>
    </aside>
  );
}
