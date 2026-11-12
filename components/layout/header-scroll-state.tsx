"use client";

import { useEffect, useRef } from "react";

const SCROLLED_STYLE = {
  backgroundColor: "rgb(242 243 245 / 0.8)",
  backdropFilter: "blur(14px) saturate(1.2)",
  boxShadow: "0 10px 28px -18px rgb(33 27 23 / 0.45)",
} as const;

/** Once the page has scrolled, the header it sits on gets a blurred, tinted
 *  backdrop and a soft shadow, so content passing under it reads as behind it
 *  instead of being cut off. Inline styles keep this out of the shared
 *  stylesheet; the header's own transition is not touched. */
export function HeaderScrollState() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = marker.current?.parentElement;
    if (!header) return;
    const update = () => {
      const scrolled = window.scrollY > 8;
      for (const [key, value] of Object.entries(SCROLLED_STYLE)) {
        header.style.setProperty(
          key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
          scrolled ? value : "",
        );
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return <span ref={marker} hidden />;
}
