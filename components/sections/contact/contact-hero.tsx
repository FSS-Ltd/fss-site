import { LeadCaptureForm } from "@/components/forms/lead-capture-form";
import { GlowCard } from "@/components/ui/spotlight-card";
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
        <GlowCard customSize className="p-6">
          <LeadCaptureForm ctaLabel="Request integration plan" />
        </GlowCard>
      </div>
    </Section>
  );
}
