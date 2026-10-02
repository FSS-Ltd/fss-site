import { z } from "zod";

export const leadMagnetCaptureSchema = z.object({
  firstName: z.string().trim().min(2, "Please enter your first name."),
  lastName: z.string().trim().min(2, "Please enter your last name."),
  workEmail: z.string().trim().email("Please enter a valid work email."),
  company: z.string().trim().min(2, "Please enter your company name."),
  challenge: z
    .string()
    .max(600, "Please keep this under 600 characters.")
    .optional(),
});

export type LeadMagnetCaptureValues = z.infer<typeof leadMagnetCaptureSchema>;

export const leadSubmissionSchema = leadMagnetCaptureSchema.extend({
  sourceContext: z.string().min(1),
  sourcePath: z.string().min(1),
  resourceSlug: z.string().optional(),
  submissionId: z.string().uuid(),
  newsletterOptIn: z.boolean().optional(),
});

export type LeadCapturePayload = z.infer<typeof leadSubmissionSchema>;

export type LeadCaptureResult = {
  ok: boolean;
  leadId?: string;
  errorMessage?: string;
};

export async function submitLeadCapture(
  payload: LeadCapturePayload,
): Promise<LeadCaptureResult> {
  try {
    const response = await fetch("/api/lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as LeadCaptureResult;

    if (!response.ok || !result.ok) {
      return {
        ok: false,
        errorMessage:
          result.errorMessage ?? "We could not submit your request right now.",
      };
    }

    return result;
  } catch {
    return {
      ok: false,
      errorMessage: "Network error while submitting. Please try again.",
    };
  }
}
