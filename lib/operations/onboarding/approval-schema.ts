import { z } from "zod";
import {
  packetPageMetadataShape,
  validatePacketPages,
} from "./packet-metadata";
import { welcomePackIds } from "./welcome-pack-contract";

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
        rendererVersion: z.literal(2).optional(),
        edition: z.enum(welcomePackIds).optional(),
        settingsRevision: z.number().int().nonnegative().optional(),
        responseExpectationHours: z.number().int().min(1).max(168).optional(),
        timezone: text.max(100).optional(),
        contactFirstName: text.max(100),
        primaryGoal: text,
        outcomeSummary: text,
        senderName: text.max(160),
        organisationName: text.max(200),
        clientOrganisationName: text.max(200).optional(),
        welcomePackVersionId: z.uuid().optional(),
        emailSubject: text.max(160).optional(),
        emailBody: text.max(6_000).optional(),
        from: address,
        replyTo: address,
        pages: z
          .array(
            z
              .object({
                title: text.max(100),
                ...packetPageMetadataShape,
                paragraphs: z.array(text).min(1).max(8),
              })
              .strict(),
          )
          .min(1)
          .max(9),
      })
      .strict()
      .superRefine((value, context) => {
        validatePacketPages(value, context, [4, 6]);
        if (value.rendererVersion !== 2 && value.senderName.length > 100)
          context.addIssue({
            code: "custom",
            path: ["senderName"],
            message: "Legacy sender names must contain at most 100 characters.",
          });
      }),
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
export { text as approvalTextSchema, address as approvalAddressSchema };
