import { z } from "zod";
import {
  packetPageMetadataShape,
  validatePacketPages,
} from "./packet-metadata";
import { onboardingTaskDefinitionSchema } from "./workspace-schema";

export const welcomePackIds = [
  "website_build",
  "website_seo",
  "systems_portal",
] as const;
export type WelcomePackId = (typeof welcomePackIds)[number];

const copy = z
  .string()
  .trim()
  .min(1)
  .max(6_000)
  .refine(
    (value) => !value.includes("\u2014"),
    "Use plain punctuation without em dashes.",
  )
  .refine(
    (value) =>
      [...value.matchAll(/{{([^{}]+)}}/g)].every((match) =>
        [
          "client_name",
          "contact_first_name",
          "agreement_goal",
          "agreement_scope",
          "sender_name",
        ].includes(match[1] ?? ""),
      ),
    "Use only supported client detail placeholders.",
  );

export const welcomePackContentSchema = z
  .strictObject({
    rendererVersion: z.literal(2).optional(),
    edition: z.enum(welcomePackIds).optional(),
    emailSubject: copy.max(160),
    emailBody: copy,
    guide: z
      .array(
        z.strictObject({
          title: copy.max(100),
          ...packetPageMetadataShape,
          paragraphs: z.array(copy.max(2_000)).min(1).max(8),
        }),
      )
      .min(1)
      .max(9),
    thankYou: z.strictObject({
      subject: copy.max(200),
      intro: copy.max(2_000),
      nextStep: copy.max(2_000),
      requiredAction: copy.max(2_000),
    }),
    tasks: z
      .array(onboardingTaskDefinitionSchema)
      .min(1)
      .max(30)
      .superRefine((tasks, context) => {
        for (const [index, task] of tasks.entries()) {
          if (
            /{{[^{}]+}}/.test(task.title) ||
            /{{[^{}]+}}/.test(task.instructions)
          ) {
            context.addIssue({
              code: "custom",
              path: [index],
              message:
                "Checklist tasks use fixed client instructions without template placeholders.",
            });
          }
        }
      }),
  })
  .superRefine((value, context) => {
    validatePacketPages(
      { ...value, pages: value.guide },
      context,
      [5, 5],
      "guide",
    );
  });

export type WelcomePackContent = z.infer<typeof welcomePackContentSchema>;
export type WelcomePackVersion = Readonly<{
  content: WelcomePackContent;
  id: string;
  version: number;
  publishedAt: string;
}>;
export type WelcomePack = Readonly<{
  id: WelcomePackId;
  title: string;
  draftVersion: number;
  publishedVersion: number;
  content: WelcomePackContent;
  versions: readonly WelcomePackVersion[];
}>;
