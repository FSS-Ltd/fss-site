"use client";

import { useEffect, useRef } from "react";

const videoSource =
  "/prospect-previews/bespoke/evo-kent-roofing/roof-restoration-scroll-scrub-v1.mp4";
const posterSource =
  "/prospect-previews/bespoke/evo-kent-roofing/roof-restoration-v1-poster.jpg";

const copyBeats = [
  {
    eyebrow: "EVO KENT ROOFING",
    end: 0.33,
    message: "Kent roofing specialists",
    start: 0.13,
  },
  {
    eyebrow: "WHAT WE STAND FOR",
    end: 0.59,
    message: "Clear assessments. Straight advice.",
    start: 0.39,
  },
  {
    eyebrow: "FROM FIRST TILE TO FINISH",
    end: 0.85,
    message: "Careful workmanship. Roofs built to last.",
    start: 0.65,
  },
] as const;

function getCopyBeatStyle(progress: number, start: number, end: number) {
  const transitionProgress = 0.05;
  const opacity = Math.min(
    Math.max((progress - start) / transitionProgress, 0),
    Math.max((end - progress) / transitionProgress, 0),
    1,
  );

  return {
    opacity,
    translateY: (1 - opacity) * 24,
  };
}

export function EvoRoofRestorationHero() {
  const copyRefs = useRef<Array<HTMLDivElement | null>>([]);
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

    const syncCopyToScroll = (progress: number) => {
      copyRefs.current.forEach((copy, index) => {
        const beat = copyBeats[index];
        if (!copy || !beat) return;

        const { opacity, translateY } = getCopyBeatStyle(
          progress,
          beat.start,
          beat.end,
        );

        copy.style.opacity = opacity.toString();
        copy.style.transform = `translate3d(0, ${translateY}px, 0)`;
      });
    };

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

      syncCopyToScroll(progress);

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
        <div aria-hidden="true" data-evo-roof-restoration-copy="true">
          {copyBeats.map((beat, index) => (
            <div
              data-evo-roof-restoration-copy-beat="true"
              key={beat.message}
              ref={(copy) => {
                copyRefs.current[index] = copy;
              }}
            >
              <p className="text-xs font-black uppercase tracking-[.22em] text-sky-200">
                {beat.eyebrow}
              </p>
              <p className="mt-5 text-5xl font-black leading-[.94] tracking-[-.055em] sm:text-7xl">
                {beat.message}
              </p>
            </div>
          ))}
        </div>
        <h1 className="sr-only">EVO Kent Roofing</h1>
        <p className="sr-only">
          A damaged roof is rebuilt layer by layer as the viewpoint moves around
          the house. Evo Kent Roofing stands for clear assessments, straight
          advice, careful workmanship and roofs built to last.
        </p>
      </div>
    </section>
  );
}
