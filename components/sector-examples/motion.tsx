"use client";

import { useEffect, useRef } from "react";

/** Progressive enhancement: content remains readable without JavaScript. */
export function ExampleMotion({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    let frame = 0;
    const reveal = () => {
      observer?.disconnect();
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        element.removeAttribute("data-waiting");
      });
      if (preference.matches) return;
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.removeAttribute("data-waiting");
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08 },
      );
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        if (element.getBoundingClientRect().top > window.innerHeight)
          element.dataset.waiting = "true";
        observer?.observe(element);
      });
    };
    const sync = () => {
      frame = 0;
      const progress = preference.matches
        ? 0
        : Math.min(
            1,
            Math.max(
              0,
              -root.getBoundingClientRect().top /
                Math.max(root.offsetHeight - window.innerHeight, 1),
            ),
          );
      root.style.setProperty("--page-progress", String(progress));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    reveal();
    sync();
    preference.addEventListener("change", reveal);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      preference.removeEventListener("change", reveal);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  return (
    <div ref={rootRef} className="example-motion">
      <div className="example-reading-progress" aria-hidden="true" />
      {children}
    </div>
  );
}
