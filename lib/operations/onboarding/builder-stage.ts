export const journeyBuilderStages = [
  "setup",
  "content",
  "access",
  "schedule",
  "activate",
] as const;

export type JourneyBuilderStage = (typeof journeyBuilderStages)[number];

export function isJourneyBuilderStage(
  value: string | undefined,
): value is JourneyBuilderStage {
  return journeyBuilderStages.some((stage) => stage === value);
}
