import { NextResponse } from "next/server";
import { z } from "zod";

import { leadMagnetCaptureSchema } from "@/lib/forms/lead-capture";

const leadApiSchema = leadMagnetCaptureSchema.extend({
  sourceContext: z.string().min(1),
  sourcePath: z.string().min(1),
  resourceSlug: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = leadApiSchema.parse(payload);

    // Placeholder for future provider integrations (CRM, email, webhook).
    return NextResponse.json({
      ok: true,
      leadId: `api-${parsed.resourceSlug ?? "general"}-${Date.now()}`,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        errorMessage: "Invalid lead submission payload.",
      },
      { status: 400 },
    );
  }
}
