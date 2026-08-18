import { z } from "zod";

export const leadMagnetCaptureSchema = z.object({
  firstName: z.string().min(2, "Please enter your first name."),
  lastName: z.string().min(2, "Please enter your last name."),
  workEmail: z.string().email("Please enter a valid work email."),
  company: z.string().min(2, "Please enter your company name."),
  challenge: z.string().max(600, "Please keep this under 600 characters.").optional(),
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

type LeadSubmissionProvider = "netlify" | "api";

const NETLIFY_FORM_NAME = "fss-lead-capture";

function getLeadSubmissionProvider(): LeadSubmissionProvider {
  return (process.env.NEXT_PUBLIC_LEAD_SUBMISSION_PROVIDER as LeadSubmissionProvider) || "api";
}

function toFormUrlEncoded(payload: LeadCapturePayload): string {
  const body = new URLSearchParams();

  body.set("form-name", NETLIFY_FORM_NAME);
  body.set("firstName", payload.firstName);
  body.set("lastName", payload.lastName);
  body.set("workEmail", payload.workEmail);
  body.set("company", payload.company);
  body.set("challenge", payload.challenge ?? "");
  body.set("sourceContext", payload.sourceContext);
  body.set("sourcePath", payload.sourcePath);
  body.set("resourceSlug", payload.resourceSlug ?? "");
  body.set("bot-field", "");

  return body.toString();
}

async function submitViaNetlify(payload: LeadCapturePayload): Promise<LeadCaptureResult> {
  try {
    const response = await fetch("/__forms.html", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: toFormUrlEncoded(payload),
    });

    if (!response.ok) {
      return {
        ok: false,
        errorMessage: "We could not submit your request right now. Please try again.",
      };
    }

    return {
      ok: true,
      leadId: `netlify-${Date.now()}`,
    };
  } catch {
    return {
      ok: false,
      errorMessage: "Network error while submitting. Please try again.",
    };
  }
}

async function submitViaApi(payload: LeadCapturePayload): Promise<LeadCaptureResult> {
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
        errorMessage: result.errorMessage ?? "We could not submit your request right now.",
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

export async function submitLeadCapture(payload: LeadCapturePayload): Promise<LeadCaptureResult> {
  const provider = getLeadSubmissionProvider();

  if (provider === "api") {
    return submitViaApi(payload);
  }

  return submitViaNetlify(payload);
}
