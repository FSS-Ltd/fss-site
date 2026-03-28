import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { leadSubmissionSchema } from "@/lib/forms/lead-capture";
import { processLeadSubmission } from "@/lib/server/lead-submission";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = leadSubmissionSchema.parse(payload);
    const result = await processLeadSubmission(parsed);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          errorMessage: result.errorMessage ?? "Unable to submit right now. Please try again.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      leadId: result.leadId,
      emailWarning: result.emailWarning ?? false,
    });
  } catch (error) {
    console.error("Lead API route validation/orchestration error.", { error });

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          errorMessage: "Invalid submission payload.",
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        errorMessage: "Unable to process your request right now.",
      },
      { status: 500 },
    );
  }
}
