import type { ResourceMeta } from "@/lib/types/resource";

type ResourceBenefitsProps = {
  resource: ResourceMeta;
};

export function ResourceBenefits({ resource }: ResourceBenefitsProps) {
  return (
    <section className="rounded-2xl border border-border-soft/45 bg-surface-1/72 p-6">
      <h2 className="text-2xl font-semibold text-foreground">What you will get</h2>
      <ul className="mt-4 space-y-3">
        {resource.benefits.map((benefit) => (
          <li key={benefit} className="rounded-xl border border-border-soft/40 bg-surface-2/60 px-4 py-3 text-sm text-text-muted">
            {benefit}
          </li>
        ))}
      </ul>
    </section>
  );
}
