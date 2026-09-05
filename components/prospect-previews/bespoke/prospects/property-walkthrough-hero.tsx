"use client";

import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const assetBase = "/prospect-previews/bespoke/stagg-homes";
const posterSource = `${assetBase}/hero-v1.png`;
const videoSource = `${assetBase}/property-walkthrough-scroll-scrub-v1.mp4`;
const minimumSeekDelta = 1 / 48;

type PropertyWalkthroughBeat = {
  description: string;
  eyebrow: string;
  heading: string;
};

type PropertyWalkthroughHeroProps = {
  accentClassName: string;
  actionHref: string;
  actionLabel: string;
  description: string;
  eyebrow: string;
  heading: string;
  journeyBeats: readonly [PropertyWalkthroughBeat, PropertyWalkthroughBeat];
  placeLabel: string;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function canUseScrollLinkedVideo(
  prefersReducedMotion: boolean,
  viewportWidth: number,
  readyState: number,
): boolean {
  return !prefersReducedMotion && viewportWidth >= 768 && readyState >= 1;
}

function getCopyOpacity(progress: number, start: number, end: number): number {
  const fadeDistance = 0.08;
  const entering =
    start === 0 ? 1 : clamp((progress - start) / fadeDistance, 0, 1);
  const exiting = end === 1 ? 1 : clamp((end - progress) / fadeDistance, 0, 1);

  return Math.min(entering, exiting);
}

/**
 * A shared, scroll-synchronised property reveal. It is deliberately limited to
 * estate and lettings concepts, where the walk through explains the service.
 */
export function PropertyWalkthroughHero({
  accentClassName,
  actionHref,
  actionLabel,
  description,
  eyebrow,
  heading,
  journeyBeats,
  placeLabel,
}: PropertyWalkthroughHeroProps) {
  const copyRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScrollLinked, setIsScrollLinked] = useState(false);
  const copyBeats = [
    { description, eyebrow, heading },
    ...journeyBeats,
  ] as const;

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;
    let isActive = false;

    const syncCopyToProgress = (progress: number) => {
      copyRefs.current.forEach((copy, index) => {
        if (!copy) return;

        const start = index * 0.3;
        const end = index === 2 ? 1 : start + 0.4;
        const opacity = getCopyOpacity(progress, start, end);

        copy.style.opacity = opacity.toFixed(3);
        copy.style.transform = `translate3d(0, ${(1 - opacity) * 24}px, 0)`;
      });
    };

    const updateCapability = () => {
      isActive = canUseScrollLinkedVideo(
        reducedMotion.matches,
        window.innerWidth,
        video.readyState,
      );
      setIsScrollLinked(isActive);

      if (!isActive) {
        video.style.transform = "scale(1)";
        syncCopyToProgress(0);
      }
    };

    const syncToScroll = () => {
      frameId = 0;
      if (
        !isActive ||
        !Number.isFinite(video.duration) ||
        video.duration <= 0
      ) {
        return;
      }

      const scrollableDistance = Math.max(
        section.offsetHeight - window.innerHeight,
        1,
      );
      const progress = clamp(
        -section.getBoundingClientRect().top / scrollableDistance,
        0,
        1,
      );
      const targetTime = video.duration * progress;

      if (Math.abs(video.currentTime - targetTime) >= minimumSeekDelta) {
        video.currentTime = targetTime;
      }

      video.style.transform = `scale(${(1 + progress * 0.025).toFixed(4)})`;
      syncCopyToProgress(progress);
    };

    const requestSync = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(syncToScroll);
    };

    const refresh = () => {
      updateCapability();
      requestSync();
    };

    video.addEventListener("loadedmetadata", refresh);
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", refresh);
    reducedMotion.addEventListener("change", refresh);
    refresh();

    return () => {
      video.removeEventListener("loadedmetadata", refresh);
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", refresh);
      reducedMotion.removeEventListener("change", refresh);
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <section
      aria-labelledby="property-walkthrough-heading"
      className={`relative ${isScrollLinked ? "h-[300svh]" : "h-svh"} text-white`}
      data-property-walkthrough="true"
      ref={sectionRef}
    >
      <div className="sticky top-0 isolate h-svh overflow-hidden bg-slate-950">
        <video
          aria-hidden="true"
          className="absolute inset-0 -z-20 size-full object-cover"
          data-property-walkthrough-video="true"
          muted
          playsInline
          poster={posterSource}
          preload="metadata"
          ref={videoRef}
          src={videoSource}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(7,16,25,.9)_0%,rgba(7,16,25,.59)_43%,rgba(7,16,25,.14)_78%),linear-gradient(0deg,rgba(7,16,25,.72)_0%,transparent_56%)]"
        />

        <div className="relative z-10 mx-auto flex h-svh max-w-7xl items-end px-5 pb-20 pt-28 sm:px-8 sm:pb-24 lg:px-10">
          <div className="relative h-[28rem] w-full max-w-3xl sm:h-[31rem]">
            {copyBeats.map((beat, index) => (
              <div
                aria-hidden={index > 0 || undefined}
                className={`absolute inset-x-0 bottom-0 max-w-3xl ${index === 0 ? "" : "translate-y-6 opacity-0"}`}
                data-property-walkthrough-copy-beat="true"
                data-prospect-hero-copy={index === 0 ? "true" : undefined}
                key={beat.heading}
                ref={(copy) => {
                  copyRefs.current[index] = copy;
                }}
              >
                <p
                  className={`text-xs font-black uppercase tracking-[.24em] ${accentClassName}`}
                >
                  {beat.eyebrow}
                </p>
                {index === 0 ? (
                  <h1
                    className="mt-6 max-w-[13ch] text-5xl font-semibold leading-[.9] tracking-[-.065em] sm:text-7xl lg:text-[6.4rem]"
                    id="property-walkthrough-heading"
                  >
                    {beat.heading}
                  </h1>
                ) : (
                  <p className="mt-6 max-w-[13ch] text-5xl font-semibold leading-[.9] tracking-[-.065em] sm:text-7xl lg:text-[6.4rem]">
                    {beat.heading}
                  </p>
                )}
                <p className="mt-7 max-w-xl text-lg leading-8 text-white/78">
                  {beat.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <span className="absolute bottom-7 right-5 z-10 rounded-full border border-white/30 bg-black/20 px-4 py-2 text-xs font-bold text-white/90 backdrop-blur sm:bottom-10 sm:right-8 lg:right-10">
          {placeLabel}
        </span>
        <a
          className="absolute bottom-7 left-5 z-20 inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:bottom-10 sm:left-8 lg:left-10"
          href={actionHref}
        >
          {actionLabel}
          <ArrowDown aria-hidden="true" className="size-4" />
        </a>
        <p className="sr-only">
          A property walk through is linked to page scroll on larger screens.
          Visitors who prefer reduced motion see a still image instead.
        </p>
      </div>
    </section>
  );
}
