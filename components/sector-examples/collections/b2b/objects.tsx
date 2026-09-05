"use client";

import { useEffect, useRef } from "react";

export function SupplyObjects() {
  return (
    <div
      className="b2b-supply-objects"
      aria-label="Illustration of paper, notebooks and office stationery"
      role="img"
    >
      <div className="b2b-paper">
        <span>
          A4
          <br />
          THE EVERYDAY
          <br />
          ESSENTIAL
        </span>
      </div>
      <div className="b2b-notebook">
        <span>
          Ideas
          <br />
          start
          <br />
          here.
        </span>
      </div>
      <div className="b2b-pencil" />
      <div className="b2b-tape" />
      <span className="b2b-object-caption">
        A considered collection of everyday tools.
      </span>
    </div>
  );
}

export function LiftDrawing() {
  return (
    <div
      className="b2b-lift"
      role="img"
      aria-label="Concept drawing of a two post workshop lift, not a technical specification"
    >
      <div className="b2b-lift-grid" />
      <div className="b2b-lift-post b2b-lift-left" />
      <div className="b2b-lift-post b2b-lift-right" />
      <div className="b2b-lift-car" />
      <div className="b2b-lift-arm" />
      <span className="b2b-lift-dimension">THE SPACE TO DO MORE</span>
      <span className="b2b-lift-note">
        Concept illustration / Site assessment required
      </span>
    </div>
  );
}

export function ScrollStory({ equipment = false }: { equipment?: boolean }) {
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
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const progress = Math.max(
          0,
          Math.min(
            1,
            (window.innerHeight - rect.top) /
              (window.innerHeight + rect.height),
          ),
        );
        element.style.setProperty("--b2b-scroll", String(progress));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div ref={ref} className="b2b-scroll-story">
      {equipment ? <LiftDrawing /> : <SupplyObjects />}
    </div>
  );
}
