import { LeadCaptureForm } from "@/components/forms/lead-capture-form";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "@/components/ui/section-heading";

export function ContactHero() {
  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <SectionHeading
          eyebrow="Contact"
          title="Plan your integration with the FSS team"
          description="Share your current setup and goals. We will send a practical implementation plan and next steps."
        />
        <div className="rounded-2xl border border-border-strong/70 bg-surface-1/78 p-6 shadow-[inset_0_1px_0_rgba(140,180,220,0.08)]">
          <LeadCaptureForm ctaLabel="Request integration plan" />
        </div>
      </div>
    </Section>
  );
}
