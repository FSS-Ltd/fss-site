"use client";
import { useEffect, useRef } from "react";

export function ScrollStory({ kind }: { kind: "water" | "light" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = element.getBoundingClientRect();
      const progress = Math.min(
        1,
        Math.max(
          0,
          (window.innerHeight - box.top) / (window.innerHeight + box.height),
        ),
      );
      element.style.setProperty("--journey", String(progress));
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
    };
  }, []);
  return (
    <div ref={ref} className={`trade-story trade-story-${kind}`}>
      <div className="trade-story-diagram" aria-hidden="true">
        <svg viewBox="0 0 600 200" fill="none">
          <path d="M0 100H170V40H330V160H450V100H600" />
          <path
            className="trade-story-current"
            d="M0 100H170V40H330V160H450V100H600"
            pathLength="1"
          />
        </svg>
      </div>
      <div className="trade-story-captions">
        <p>
          <span>01 / Understand</span>
          {kind === "water" ? "Follow the source." : "See the whole circuit."}
        </p>
        <p>
          <span>02 / Resolve</span>
          {kind === "water" ? "Restore the balance." : "Connect the details."}
        </p>
        <p>
          <span>03 / Enjoy</span>
          {kind === "water"
            ? "Return to everyday life."
            : "Make room for living."}
        </p>
      </div>
    </div>
  );
}
