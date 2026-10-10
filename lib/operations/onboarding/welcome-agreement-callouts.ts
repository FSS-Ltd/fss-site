import { z } from "zod";
import type { WelcomePackContent } from "./welcome-pack-contract";

export const welcomeSummarySchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !value.includes("\u2014"), "Use plain punctuation.");

export type WelcomeAgreementCallouts = Readonly<{
  scopeSummary: string;
  responsibilitiesSummary: string;
}>;

export function prefillWelcomeSummary(value: string): string {
  const firstParagraph = value
    .split(/\n\s*\n/)
    .find((part) => part.trim())
    ?.trim();
  return firstParagraph &&
    welcomeSummarySchema.safeParse(firstParagraph).success
    ? firstParagraph
    : "";
}

export function withWelcomeAgreementCallouts(
  content: WelcomePackContent,
  callouts: WelcomeAgreementCallouts,
): WelcomePackContent {
  const scope = welcomeSummarySchema.parse(callouts.scopeSummary);
  const responsibilities = welcomeSummarySchema.parse(
    callouts.responsibilitiesSummary,
  );
  return {
    ...content,
    guide: content.guide.map((page) => ({
      ...page,
      paragraphs:
        page.sectionId === "project"
          ? [...page.paragraphs, `Proposed scope in brief: ${scope}`]
          : page.sectionId === "responsibilities"
            ? [
                ...page.paragraphs,
                `Your part in the proposed work: ${responsibilities}`,
              ]
            : page.paragraphs,
    })),
  };
}
