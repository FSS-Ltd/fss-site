"use client";

import { useEffect, useRef } from "react";

import { trackPreviewEvent } from "@/lib/prospect-previews/analytics";

type PreviewViewTrackerProps = {
  prospectSlug: string;
};

export function PreviewViewTracker({ prospectSlug }: PreviewViewTrackerProps) {
  const trackedSlugs = useRef(new Set<string>());

  useEffect(() => {
    if (trackedSlugs.current.has(prospectSlug)) return;

    trackPreviewEvent({ prospectSlug, event: "preview_viewed" });
    trackedSlugs.current.add(prospectSlug);
  }, [prospectSlug]);

  return null;
}
