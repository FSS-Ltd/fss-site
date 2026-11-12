"use client";

import { useEffect, useRef } from "react";

/** Once the page has scrolled, the header it sits on gets a soft shadow, and on
 *  desktop a blurred tinted backdrop, so content passing under it reads as
 *  behind it instead of being cut off. Phones keep the opaque header: a live
 *  blur over the hero canvas costs frames on a throttled phone. Inline styles
 *  keep this out of the shared stylesheet. */
export function HeaderScrollState() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = marker.current?.parentElement;
    if (!header) return;
    const desktop = matchMedia("(min-width: 901px)");
    const update = () => {
      const scrolled = window.scrollY > 8;
      const blur = scrolled && desktop.matches;
      header.style.boxShadow = scrolled
        ? "0 10px 28px -18px rgb(33 27 23 / 0.45)"
        : "";
      header.style.backgroundColor = blur ? "rgb(242 243 245 / 0.8)" : "";
      header.style.backdropFilter = blur ? "blur(14px) saturate(1.2)" : "";
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return <span ref={marker} hidden />;
}
