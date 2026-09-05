"use client";
import { useEffect, useRef } from "react";
export function FinanceAutoMotion({ kind }: { kind: "unfold" | "torque" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = node.getBoundingClientRect();
      node.style.setProperty(
        "--progress",
        String(
          Math.min(
            1,
            Math.max(0, (innerHeight - box.top) / (innerHeight + box.height)),
          ),
        ),
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <div ref={ref} className={`fa-motion fa-motion-${kind}`}>
      <div className="fa-motion-art" aria-hidden="true">
        {kind === "unfold" ? (
          <>
            <i />
            <i />
            <i />
            <i />
            <i />
            <span>Clarity</span>
          </>
        ) : (
          <>
            <div className="fa-dial">
              <i />
              <span>
                Understand
                <br />
                before repair
              </span>
            </div>
            <div className="fa-scan" />
          </>
        )}
      </div>
      <div className="fa-motion-copy">
        <p className="fa-eyebrow">
          {kind === "unfold"
            ? "From information to understanding"
            : "From symptom to solution"}
        </p>
        <h2>
          {kind === "unfold"
            ? "Put the pieces in perspective."
            : "Look closer. Get further."}
        </h2>
        <p>
          {kind === "unfold"
            ? "Reliable records create a clearer picture. A conversation puts that picture into context. Together, they make the next decision easier."
            : "A warning light is the beginning of an investigation. Tell us what changed, and we can agree a diagnostic plan before discussing repairs."}
        </p>
        <a href="#enquire" className="fa-button">
          {kind === "unfold"
            ? "Unfold your next chapter"
            : "Start with a diagnosis"}{" "}
          ↗
        </a>
      </div>
    </div>
  );
}
