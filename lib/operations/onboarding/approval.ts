import { createHash } from "node:crypto";
import { z } from "zod";
import {
  welcomeInputSchema,
  approvalTextSchema as text,
  approvalAddressSchema as address,
} from "./approval-schema";
export { welcomeInputSchema } from "./approval-schema";
import type {
  ProposalApprovalSnapshot,
  WelcomeApprovalSnapshot,
} from "./types";
import { renderWelcomePdf, welcomeAccessibleHtml } from "./content/welcome-pdf";
import { welcomeEmail } from "./content/welcome-email";
import { activationEmail } from "./content/activation-email";
import { proposalEmail } from "./content/proposal-email";
export interface PreparedWelcome {
  snapshot: WelcomeApprovalSnapshot;
  pdf: Buffer;
}
export async function prepareWelcome(input: unknown): Promise<PreparedWelcome> {
  const parsed = welcomeInputSchema.parse(input);
  const pdf = await renderWelcomePdf(parsed.content);
  const accessibleHtml = welcomeAccessibleHtml(parsed.content);
  const snapshot: WelcomeApprovalSnapshot = {
    ...parsed,
    accessibleHtml,
    pdfHash: createHash("sha256").update(pdf).digest("hex"),
    welcome: welcomeEmail(parsed.recipient, parsed.content, accessibleHtml),
  };
  return { snapshot, pdf };
}
export function validatePreparedWelcome(prepared: PreparedWelcome): void {
  const { recipient, invoice, content, thankYou } = prepared.snapshot;
  welcomeInputSchema.parse({ recipient, invoice, content, thankYou });
  const html = welcomeAccessibleHtml(content);
  if (
    prepared.snapshot.accessibleHtml !== html ||
    JSON.stringify(prepared.snapshot.welcome) !==
      JSON.stringify(welcomeEmail(recipient, content, html)) ||
    createHash("sha256").update(prepared.pdf).digest("hex") !==
      prepared.snapshot.pdfHash
  )
    throw new Error("Welcome approval no longer matches its preview.");
}
export function prepareProposal(
  input: {
    signingApprovalId: string;
    approvalHash: string;
    revision: number;
    signers: string[];
    access: ProposalApprovalSnapshot["access"];
    portalUrl: string;
    scopeSummary: string;
  },
  welcome: WelcomeApprovalSnapshot,
): ProposalApprovalSnapshot {
  z.uuid().parse(input.signingApprovalId);
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.approvalHash);
  z.number().int().positive().parse(input.revision);
  const signers = z.array(address).min(1).max(20).parse(input.signers);
  if (new Set(signers).size !== signers.length)
    throw new Error("Duplicate designated signers.");
  const access = z
    .array(
      z
        .object({
          email: address,
          role: z.enum(["owner", "contributor", "billing_contact", "viewer"]),
        })
        .strict(),
    )
    .min(1)
    .max(21)
    .parse(input.access);
  if (
    new Set(access.map((a) => a.email)).size !== access.length ||
    signers.some((email) => !access.some((a) => a.email === email)) ||
    !access.some(
      (a) =>
        a.email === welcome.recipient &&
        ["owner", "billing_contact"].includes(a.role),
    )
  )
    throw new Error(
      "Approve each signer's access and billing access for the invoice recipient.",
    );
  const url = new URL(input.portalUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["/agreements", "/portal/agreements"].includes(url.pathname)
  )
    throw new Error("Use the normal HTTPS agreement URL without credentials.");
  text.parse(input.scopeSummary);
  return {
    signingApprovalId: input.signingApprovalId,
    approvalHash: input.approvalHash,
    revision: input.revision,
    signers,
    access,
    portalUrl: url.href,
    activationEmails: access
      .filter(
        ({ email }) => email !== welcome.recipient && !signers.includes(email),
      )
      .map(({ email }) => activationEmail(email, welcome.content)),
    emails: signers.map((to) =>
      proposalEmail(to, welcome.content, input.scopeSummary, url.href),
    ),
  };
}
