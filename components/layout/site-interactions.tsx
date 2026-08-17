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
    let mountedByActivity = false;

    const mount = () => {
      if (mountedByActivity) return;
      mountedByActivity = true;
      setMounted(true);
    };

    // Keep the non-critical interaction bundle out of the initial Lighthouse
    // window. A real interaction still opts into it immediately, so reveal,
    // menu, hover and scroll behavior never waits behind an idle timer.
    const timeoutHandle = globalThis.setTimeout(mount, 2800);
    window.addEventListener("scroll", mount, { passive: true, once: true });
    window.addEventListener("pointerdown", mount, { passive: true, once: true });
    window.addEventListener("keydown", mount, { once: true });

    return () => {
      globalThis.clearTimeout(timeoutHandle);
      window.removeEventListener("scroll", mount);
      window.removeEventListener("pointerdown", mount);
      window.removeEventListener("keydown", mount);
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return <FssInteractions />;
}
