import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { intakeSubmissionPayloadSchema } from "@/lib/intake/schema";
import { processIntakeSubmission } from "@/lib/server/intake-submission";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = intakeSubmissionPayloadSchema.parse(payload);
    const result = await processIntakeSubmission(parsed);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          errorMessage: result.errorMessage ?? "Unable to submit right now. Please try again.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Intake API route validation/orchestration error.", { error });

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
