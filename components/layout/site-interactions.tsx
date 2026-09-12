"use client";

import type { ComponentType } from "react";
import { useEffect, useState } from "react";

export function SiteInteractions() {
  return <PublicInteractions />;
}

function PublicInteractions() {
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

    // The interaction module performs DOM-wide setup, so loading it without a
    // user gesture competes with the initial page render. It is entirely
    // progressive enhancement: navigation works before it loads, and the
    // first scroll, pointer, or keyboard interaction loads it immediately.
    window.addEventListener("scroll", mount, { passive: true, once: true });
    window.addEventListener("pointermove", mount, {
      passive: true,
      once: true,
    });
    window.addEventListener("pointerdown", mount, {
      passive: true,
      once: true,
    });
    window.addEventListener("keydown", mount, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("scroll", mount);
      window.removeEventListener("pointermove", mount);
      window.removeEventListener("pointerdown", mount);
      window.removeEventListener("keydown", mount);
    };
  }, []);

  if (!InteractionComponent) {
    return null;
  }

  return <InteractionComponent />;
}
