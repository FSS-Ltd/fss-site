import { notFound } from "next/navigation";

import { AshfordAutoCentrePreview } from "./prospects/ashford-auto-centre/ashford-auto-centre-preview";
import { ExamplePlumbingPreview } from "./prospects/example-plumbing/example-plumbing-preview";
import { PreviewViewTracker } from "./preview-view-tracker";
import type { ProspectPreview } from "@/lib/prospect-previews/types";

type ProspectPreviewRendererProps = {
  preview: ProspectPreview;
};

export function ProspectPreviewRenderer({
  preview,
}: ProspectPreviewRendererProps) {
  if (
    preview.slug === "ashford-auto-centre" &&
    preview.industry === "automotive"
  ) {
    return (
      <>
        <PreviewViewTracker prospectSlug={preview.slug} />
        <AshfordAutoCentrePreview preview={preview} />
      </>
    );
  }

  if (preview.slug === "example-plumbing" && preview.industry === "trades") {
    return (
      <>
        <PreviewViewTracker prospectSlug={preview.slug} />
        <ExamplePlumbingPreview preview={preview} />
      </>
    );
  }

  notFound();
}
