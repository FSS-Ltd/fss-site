"use client";

/// <reference types="react/canary" />

import React from "react";
import type { ReactNode } from "react";

/** Gives the index card cover and the article cover one shared name per slug,
 *  so the browser morphs the cover into the article hero on navigation. Only
 *  the shared pair animates; the page boundary keeps its own fade. Runtimes
 *  without <ViewTransition> (tests, older React) render the children as is. */
export function CoverTransition({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const ViewTransition: typeof React.ViewTransition | undefined =
    React.ViewTransition;
  if (!ViewTransition) return <>{children}</>;
  return (
    <ViewTransition
      name={`blog-cover-${slug}`}
      default="none"
      enter="none"
      exit="none"
      share="auto"
    >
      {children}
    </ViewTransition>
  );
}
