"use client";

import { useEffect, useRef } from "react";

const videoSource =
  "/prospect-previews/bespoke/evo-kent-roofing/roof-restoration-scroll-scrub-v1.mp4";
const posterSource =
  "/prospect-previews/bespoke/evo-kent-roofing/roof-restoration-v1-poster.jpg";

type RoofBuildScrollHeroProps = {
  accentClassName: string;
  assessmentHref: string;
  assessmentLabel: string;
  businessName: string;
  eyebrow: string;
  heading: string;
  summary: string;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function RoofBuildScrollHero({
  accentClassName,
  assessmentHref,
  assessmentLabel,
  businessName,
  eyebrow,
  heading,
  summary,
}: RoofBuildScrollHeroProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    const copy = copyRef.current;
    if (!section || !video || !copy) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;

    const syncToScroll = () => {
      frameId = 0;

      if (reducedMotion.matches || window.innerWidth < 768) {
        video.style.transform = "scale(1)";
        copy.dataset.roofBuildActiveBeat = "0";
        copy.style.setProperty("--roof-build-progress", "0");
        return;
      }

      if (!Number.isFinite(video.duration) || video.duration <= 0) return;

      const scrollableDistance = Math.max(
        section.offsetHeight - window.innerHeight,
        1,
      );
      const progress = clamp(
        -section.getBoundingClientRect().top / scrollableDistance,
        0,
        1,
      );
      const nextTime = video.duration * progress;

      if (Math.abs(video.currentTime - nextTime) > 1 / 48) {
        video.currentTime = nextTime;
      }

      video.style.transform = `scale(${(1 + progress * 0.04).toFixed(4)})`;
      copy.dataset.roofBuildActiveBeat = String(
        progress < 0.34 ? 0 : progress < 0.68 ? 1 : 2,
      );
      copy.style.setProperty("--roof-build-progress", progress.toFixed(4));
    };

    const requestSync = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(syncToScroll);
    };

    video.addEventListener("loadedmetadata", requestSync);
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    reducedMotion.addEventListener("change", requestSync);
    requestSync();

    return () => {
      video.removeEventListener("loadedmetadata", requestSync);
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      reducedMotion.removeEventListener("change", requestSync);
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <section
      aria-labelledby="roof-build-heading"
      className="text-white"
      data-roof-build-scroll="true"
      ref={sectionRef}
    >
      <div data-roof-build-scroll-frame="true">
        <video
          aria-hidden="true"
          data-roof-build-scroll-video="true"
          muted
          playsInline
          poster={posterSource}
          preload="metadata"
          ref={videoRef}
          src={videoSource}
        />
        <div aria-hidden="true" data-roof-build-scroll-shade="true" />
        <div
          className="relative z-10 mx-auto flex min-h-[78svh] max-w-7xl items-end px-5 pb-16 pt-20 sm:px-8 sm:pb-24"
          data-roof-build-active-beat="0"
          data-roof-build-scroll-copy="true"
          ref={copyRef}
        >
          <div className="max-w-3xl" data-prospect-hero-copy="true">
            <p
              className={`text-xs font-black uppercase tracking-[.24em] ${accentClassName}`}
            >
              {eyebrow}
            </p>
            <h1
              className="mt-6 text-5xl font-black leading-[.92] tracking-[-.065em] sm:text-7xl lg:text-[6.4rem]"
              id="roof-build-heading"
            >
              {heading}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/78">
              {summary}
            </p>
            <a
              className="mt-9 inline-flex border-b-2 border-white/85 pb-2 font-bold transition hover:border-white hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4"
              href={assessmentHref}
            >
              {assessmentLabel}
            </a>
            <div
              aria-hidden="true"
              className="mt-10 max-w-md"
              data-roof-build-scroll-progress="true"
            >
              <div data-roof-build-scroll-progress-track="true">
                <span data-roof-build-scroll-progress-fill="true" />
              </div>
              <div
                className="mt-5 grid gap-3 text-sm font-semibold sm:grid-cols-3"
                data-roof-build-scroll-beats="true"
              >
                <p data-roof-build-scroll-beat="0">Survey focus</p>
                <p data-roof-build-scroll-beat="1">Build sequence</p>
                <p data-roof-build-scroll-beat="2">Assessment ready</p>
              </div>
            </div>
          </div>
        </div>
        <p className="sr-only">
          {businessName}: a roof is rebuilt layer by layer as you scroll.
          Reduced-motion and mobile visitors see the supporting poster image
          instead.
        </p>
      </div>
    </section>
  );
}
