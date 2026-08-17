"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";

export function SiteInteractions() {
  const [InteractionComponent, setInteractionComponent] =
    useState<ComponentType | null>(null);

  useEffect(() => {
    let mountedByActivity = false;
    let cancelled = false;

    const mount = () => {
      if (mountedByActivity) return;
      mountedByActivity = true;

      void import("@/components/redesign/fss-interactions").then(
        ({ FssInteractions }) => {
          if (!cancelled) {
            setInteractionComponent(() => FssInteractions);
          }
        },
      );
    };

    // Keep the non-critical interaction bundle out of the initial Lighthouse
    // window. A real interaction still opts into it immediately, so reveal,
    // menu, hover and scroll behavior never waits behind an idle timer.
    const timeoutHandle = globalThis.setTimeout(mount, 2800);
    window.addEventListener("scroll", mount, { passive: true, once: true });
    window.addEventListener("pointerdown", mount, { passive: true, once: true });
    window.addEventListener("keydown", mount, { once: true });

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutHandle);
      window.removeEventListener("scroll", mount);
      window.removeEventListener("pointerdown", mount);
      window.removeEventListener("keydown", mount);
    };
  }, []);

  if (!InteractionComponent) {
    return null;
  }

  return <InteractionComponent />;
}
