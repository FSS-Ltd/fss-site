"use client";

/// <reference types="react/canary" />

import React from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export const pageTransitionProps = {
  enter: "fss-page-in",
  exit: "fss-page-out",
  default: "none",
} as const;

/** Moves focus to the page body so screen readers hear a navigation cue. */
export function focusMainContent(doc: Pick<Document, "getElementById">) {
  doc.getElementById("main-content")?.focus({ preventScroll: true });
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPathname = React.useRef(pathname);

  React.useLayoutEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    focusMainContent(document);
  }, [pathname]);

  // The App Router bundles a React build that ships <ViewTransition>; any
  // other runtime (unit tests, older React) has none and renders children as
  // they are, so page changes stay instant instead of breaking.
  const ViewTransition: typeof React.ViewTransition | undefined =
    React.ViewTransition;
  if (!ViewTransition) return <>{children}</>;

  // Keying by pathname makes each route an enter/exit pair, so only real page
  // changes animate; in-page updates (forms, refreshes) stay untouched.
  return (
    <ViewTransition key={pathname} {...pageTransitionProps}>
      {children}
    </ViewTransition>
  );
}
