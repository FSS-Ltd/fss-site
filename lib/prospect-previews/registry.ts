import { ashfordAutoCentreConfig } from "./prospects/ashford-auto-centre/config";
import { ashfordAutoCentreContent } from "./prospects/ashford-auto-centre/content";
import { examplePlumbingConfig } from "./prospects/example-plumbing/config";
import { examplePlumbingContent } from "./prospects/example-plumbing/content";
import type { ProspectPreview } from "./types";

const ashfordAutoCentre = {
  ...ashfordAutoCentreConfig,
  content: ashfordAutoCentreContent,
} satisfies ProspectPreview;

const examplePlumbing = {
  ...examplePlumbingConfig,
  content: examplePlumbingContent,
} satisfies ProspectPreview;

export const prospectPreviews = {
  "ashford-auto-centre": ashfordAutoCentre,
  "example-plumbing": examplePlumbing,
} as const satisfies Record<string, ProspectPreview>;

const previewRegistry: Record<string, ProspectPreview> = prospectPreviews;

export function getProspectPreview(slug: string): ProspectPreview | undefined {
  return previewRegistry[slug];
}

export function getPreviewSlugs(): readonly string[] {
  return Object.keys(prospectPreviews);
}
