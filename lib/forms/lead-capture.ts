import { z } from "zod";

export const leadMagnetCaptureSchema = z.object({
  firstName: z.string().min(2, "Please enter your first name."),
  lastName: z.string().min(2, "Please enter your last name."),
  workEmail: z.string().email("Please enter a valid work email."),
  company: z.string().min(2, "Please enter your company name."),
  challenge: z.string().max(600, "Please keep this under 600 characters.").optional(),
});

export type LeadMagnetCaptureValues = z.infer<typeof leadMagnetCaptureSchema>;

export type LeadCapturePayload = LeadMagnetCaptureValues & {
  resourceSlug: string;
};

export type LeadCaptureResult = {
  ok: boolean;
  leadId: string;
};

export async function submitLeadCapture(payload: LeadCapturePayload): Promise<LeadCaptureResult> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    ok: true,
    leadId: `${payload.resourceSlug}-${Date.now()}`,
  };
}
