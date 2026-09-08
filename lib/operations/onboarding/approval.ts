import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  ProposalApprovalSnapshot,
  WelcomeApprovalSnapshot,
} from "./types";
import { renderWelcomePdf, welcomeAccessibleHtml } from "./content/welcome-pdf";
import { welcomeEmail } from "./content/welcome-email";
import { proposalEmail } from "./content/proposal-email";
const text = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (s) => !s.includes("\u2014"),
    "Use plain punctuation without em dashes.",
  );
const address = z.email().transform((s) => s.toLowerCase());
export const welcomeInputSchema = z
  .object({
    recipient: address,
    invoice: z
      .object({
        obligationKey: z.string().min(1).max(200),
        accountId: z.string().regex(/^acct_[a-zA-Z0-9]+$/),
        livemode: z.boolean(),
      })
      .strict(),
    content: z
      .object({
        contactFirstName: text.max(100),
        primaryGoal: text,
        outcomeSummary: text,
        senderName: text.max(100),
        organisationName: text.max(200),
        from: address,
        replyTo: address,
        pages: z
          .array(
            z
              .object({
                title: text.max(100),
                paragraphs: z.array(text).min(1).max(8),
              })
              .strict(),
          )
          .min(4)
          .max(6),
      })
      .strict(),
    thankYou: z
      .object({
        subject: text.max(200),
        intro: text,
        nextStep: text,
        requiredAction: text,
      })
      .strict(),
  })
  .strict();
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
    !(url.pathname === "/portal" || url.pathname.startsWith("/portal/"))
  )
    throw new Error("Use a normal HTTPS portal URL without credentials.");
  text.parse(input.scopeSummary);
  return {
    signingApprovalId: input.signingApprovalId,
    approvalHash: input.approvalHash,
    revision: input.revision,
    signers,
    access,
    portalUrl: url.href,
    emails: signers.map((to) =>
      proposalEmail(to, welcome.content, input.scopeSummary, url.href),
    ),
  };
}
