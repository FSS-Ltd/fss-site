import { LeadMagnetCaptureForm } from "@/components/forms/lead-magnet-capture-form";

type LeadCaptureFormProps = {
  ctaLabel?: string;
};

export function LeadCaptureForm({ ctaLabel = "Request demo" }: LeadCaptureFormProps) {
  return (
    <LeadMagnetCaptureForm
      resourceSlug="contact-request"
      sourceContext="contact-page"
      ctaLabel={ctaLabel}
    />
  );
}
