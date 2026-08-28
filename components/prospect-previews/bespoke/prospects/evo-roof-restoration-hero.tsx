"use client";

import { useEffect, useRef } from "react";

const videoSource =
  "/prospect-previews/bespoke/evo-kent-roofing/roof-restoration-v1.mp4";
const posterSource =
  "/prospect-previews/bespoke/evo-kent-roofing/roof-restoration-v1-poster.jpg";

export function EvoRoofRestorationHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (
      !section ||
      !video ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let frameId = 0;

    const syncVideoToScroll = () => {
      frameId = 0;

      if (!Number.isFinite(video.duration) || video.duration <= 0) return;

      const scrollableDistance = Math.max(
        section.offsetHeight - window.innerHeight,
        1,
      );
      const progress = Math.min(
        Math.max(-section.getBoundingClientRect().top / scrollableDistance, 0),
        1,
      );
      const nextTime = video.duration * progress;

      if (Math.abs(video.currentTime - nextTime) > 0.015) {
        video.currentTime = nextTime;
      }
    };

    const requestSync = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(syncVideoToScroll);
    };

    video.addEventListener("loadedmetadata", requestSync);
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    requestSync();

    return () => {
      video.removeEventListener("loadedmetadata", requestSync);
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <section
      className="text-white"
      data-evo-roof-restoration="true"
      ref={sectionRef}
    >
      <div data-evo-roof-restoration-frame="true">
        <video
          aria-hidden="true"
          data-evo-roof-restoration-video="true"
          muted
          playsInline
          poster={posterSource}
          preload="auto"
          ref={videoRef}
          src={videoSource}
        />
        <div aria-hidden="true" data-evo-roof-restoration-shade="true" />
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
          <span className="text-xl font-black tracking-tight">
            EVO <span className="font-light">KENT ROOFING</span>
          </span>
          <a
            className="rounded-full border border-white/25 px-5 py-2 text-sm font-bold transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4"
            href="#assessment"
          >
            Request assessment
          </a>
        </header>
        <div className="relative z-10 mx-auto flex min-h-[calc(100svh-5rem)] max-w-7xl items-end px-5 pb-16 pt-8 sm:px-8 sm:pb-20">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[.22em] text-sky-200">
              Homes · Businesses · Public buildings
            </p>
            <h1 className="mt-6 text-5xl font-black leading-[.94] tracking-[-.055em] sm:text-7xl">
              See the roof. Understand the work. Plan the visit.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/75">
              Repairs and replacements across Kent, with property, urgency and
              photo context collected before the assessment call.
            </p>
            <p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-sky-100/80">
              Scroll to see the roof rebuilt
            </p>
          </div>
        </div>
        <p className="sr-only">
          A damaged roof is rebuilt layer by layer as the viewpoint moves around
          the house.
        </p>
      </div>
    </section>
  );
}
