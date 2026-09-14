import { createHash } from "node:crypto";
import { z } from "zod";
import { resolveSiteUrl } from "@/lib/config/site-url";
import { readGrowthServerEnv, requireResendEnv } from "@/lib/growth/config/env";
import { createResendClient } from "@/lib/growth/integrations/resend/client";
import type {
  ResendGateway,
  ResendMessage,
} from "@/lib/growth/integrations/resend/client";

type FounderInvitationConfig = {
  ownerEmail: string;
  from: string;
  replyTo: string;
};

export async function sendFounderInvitation(
  input: FounderInvitationConfig,
  loginUrl: string,
  reviewReference: string,
  gateway: ResendGateway,
): Promise<void> {
  const config = z
    .strictObject({
      ownerEmail: z.string().trim().email().max(254),
      from: z.string().trim().min(1),
      replyTo: z.string().trim().min(1),
    })
    .parse(input);
  const url = new URL(z.url().parse(loginUrl));
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/growth/login" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Founder invitation URL is invalid.");
  }
  const review = z.string().trim().min(1).max(200).parse(reviewReference);
  const message: ResendMessage = {
    idempotencyKey: createHash("sha256")
      .update(`founder-access:${config.ownerEmail.toLowerCase()}:${review}`)
      .digest("hex"),
    category: "founder-access",
    from: config.from,
    to: config.ownerEmail.toLowerCase(),
    replyTo: config.replyTo,
    subject: "Your FSS founder workspace invitation",
    html: `<p>Your founder workspace is ready.</p><p><a href="${url.href}">Open the founder workspace</a></p><p>This link still requires the authorised, verified FSS Google account.</p>`,
    text: `Your founder workspace is ready.\n\nOpen the founder workspace: ${url.href}\n\nThis link still requires the authorised, verified FSS Google account.`,
  };
  await gateway.send(message);
}

export async function sendConfiguredFounderInvitation(
  reviewReference: string,
): Promise<void> {
  const env = readGrowthServerEnv();
  const resend = requireResendEnv(env);
  const loginUrl = new URL("/growth/login", resolveSiteUrl()).href;
  await sendFounderInvitation(
    {
      ownerEmail: env.ownerEmail,
      from: resend.from,
      replyTo: resend.replyTo,
    },
    loginUrl,
    reviewReference,
    createResendClient(resend.apiKey),
  );
}
