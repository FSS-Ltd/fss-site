import { readResendOutreachRuntime } from "@/lib/growth/campaigns/resend-account-runtime";
import { createResendAdverseEventHandler } from "@/lib/growth/campaigns/resend-adverse-event";
import { createResendConfirmation } from "@/lib/growth/campaigns/resend-confirmation";
import { getGrowthDb } from "@/lib/growth/db/client";
import { createResendOutreachWebhookHandler } from "./handler";
import { resolveResendOutreachConnection } from "./account";

export const runtime = "nodejs";

const handler = createResendOutreachWebhookHandler({
  readConfiguration: () => {
    const runtime = readResendOutreachRuntime();
    return runtime?.webhookSecret
      ? { binding: runtime.binding, webhookSecret: runtime.webhookSecret }
      : null;
  },
  resolveConnection: (binding) =>
    resolveResendOutreachConnection(getGrowthDb(), binding),
  confirm: (config, connectionId, rawBody, headers) =>
    createResendConfirmation(getGrowthDb(), {
      connectionId,
      binding: config.binding,
      webhookSecret: config.webhookSecret,
    })(rawBody, headers),
  adverse: (config, connectionId, rawBody, headers) =>
    createResendAdverseEventHandler(getGrowthDb(), {
      connectionId,
      binding: config.binding,
      webhookSecret: config.webhookSecret,
    })(rawBody, headers),
  reportUnexpectedError: (error) => {
    console.error("Outreach delivery webhook failed.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  },
});

export async function POST(request: Request): Promise<Response> {
  return handler(request);
}
