import type { IntakeSubmissionPayload } from "@/lib/intake/schema";

export type IntakeSubmissionResult = {
  ok: boolean;
  errorMessage?: string;
};

export async function submitIntake(
  payload: IntakeSubmissionPayload,
): Promise<IntakeSubmissionResult> {
  try {
    const response = await fetch("/api/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as IntakeSubmissionResult;

    if (!response.ok || !result.ok) {
      return {
        ok: false,
        errorMessage: result.errorMessage ?? "We could not submit your idea right now.",
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
