import type { ResourceMeta } from "@/lib/types/resource";

import { LeadMagnetCaptureForm } from "@/components/forms/lead-magnet-capture-form";

type ResourceLeadPanelProps = {
  resource: ResourceMeta;
};

export function ResourceLeadPanel({ resource }: ResourceLeadPanelProps) {
  const redirectPath = "/resources/" + resource.slug + "/thank-you";

  return (
    <aside className="rounded-2xl border border-border-soft/45 bg-surface-1/72 p-6">
      <h2 className="text-2xl font-semibold text-foreground">Get this resource</h2>
      <p className="mt-2 text-sm text-text-muted">
        Complete the form and our team will follow up with delivery details.
      </p>
      <div className="mt-5">
        <LeadMagnetCaptureForm
          resourceSlug={resource.slug}
          ctaLabel={resource.ctaLabel}
          redirectPath={redirectPath}
        />
      </div>
    </aside>
  );
}
