"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const FssInteractions = dynamic(
  () =>
    import("@/components/redesign/fss-interactions").then(
      (mod) => mod.FssInteractions,
    ),
  {
    ssr: false,
    loading: () => null,
  },
);

export function SiteInteractions() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | undefined;

    const mount = () => {
      setMounted(true);
    };

    if ("requestIdleCallback" in window) {
      idleHandle = window.requestIdleCallback(mount, { timeout: 1400 });
    } else {
      timeoutHandle = globalThis.setTimeout(mount, 900);
    }

    return () => {
      if (idleHandle !== undefined) {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== undefined) {
        globalThis.clearTimeout(timeoutHandle);
      }
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return <FssInteractions />;
}
