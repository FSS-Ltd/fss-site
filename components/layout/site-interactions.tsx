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
    const frame = window.requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!mounted) {
    return null;
  }

  return <FssInteractions />;
}
