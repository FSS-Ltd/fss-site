"use client";

/// <reference types="react/canary" />

import * as React from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

// The App Router bundles a React build that ships <ViewTransition>; any other
// runtime (unit tests, older React) gets undefined here and renders children
// as they are, so page changes stay instant instead of breaking.
const ViewTransition: typeof React.ViewTransition | undefined =
  React.ViewTransition;

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (!ViewTransition) return <>{children}</>;

  // Keying by pathname makes each route an enter/exit pair, so only real page
  // changes animate; in-page updates (forms, refreshes) stay untouched.
  return (
    <ViewTransition
      key={pathname}
      enter="fss-page-in"
      exit="fss-page-out"
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
