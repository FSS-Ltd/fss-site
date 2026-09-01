"use client";

import Image from "next/image";
import { ArrowDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const base = "/prospect-previews/bespoke/stagg-homes";
const posterSource = `${base}/hero-v1.png`;
const videoSource = `${base}/property-walkthrough-scroll-scrub-v1.mp4`;
const minimumSeekDelta = 1 / 48;

const copyBeats = [
  {
    eyebrow: "Independent · owner-led · Kent",
    end: 0.36,
    message: "A move deserves more than a transaction.",
    start: 0,
  },
  {
    eyebrow: "A personal way forward",
    end: 0.7,
    message: "One person. Clear advice. Every step.",
    start: 0.3,
  },
  {
    eyebrow: "Stagg Homes",
    end: 1,
    message: "A considered way home.",
    start: 0.64,
  },
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function getCopyOpacity(progress: number, start: number, end: number): number {
  const fadeDistance = 0.08;
  const entering =
    start === 0 ? 1 : clamp((progress - start) / fadeDistance, 0, 1);
  const exiting = end === 1 ? 1 : clamp((end - progress) / fadeDistance, 0, 1);

  return Math.min(entering, exiting);
}

function shouldEnableScrollLinkedHero(
  prefersReducedMotion: boolean,
  viewportWidth: number,
): boolean {
  return !prefersReducedMotion && viewportWidth >= 768;
}

export function StaggHomesCinematicHero() {
  const copyRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScrollLinked, setIsScrollLinked] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (
      !section ||
      !video ||
      !shouldEnableScrollLinkedHero(prefersReducedMotion, window.innerWidth)
    ) {
      return;
    }

    let frameId = 0;
    let hasMetadata = video.readyState >= HTMLMediaElement.HAVE_METADATA;
    let readyTimer: number | undefined;

    const syncToScroll = () => {
      frameId = 0;
      hasMetadata =
        hasMetadata ||
        (video.readyState >= HTMLMediaElement.HAVE_METADATA &&
          video.duration > 0);
      if (!hasMetadata || !Number.isFinite(video.duration)) return;

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

      copyRefs.current.forEach((copy, index) => {
        const beat = copyBeats[index];
        if (!copy || !beat) return;

        const opacity = getCopyOpacity(progress, beat.start, beat.end);
        copy.style.opacity = opacity.toString();
        copy.style.transform = `translate3d(0, ${(1 - opacity) * 24}px, 0)`;
      });
    };

    const requestSync = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(syncToScroll);
    };

    const handleLoadedMetadata = () => {
      hasMetadata = video.duration > 0;
      setIsScrollLinked(hasMetadata);
      requestSync();
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    if (hasMetadata) {
      readyTimer = window.setTimeout(handleLoadedMetadata, 0);
    }

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      if (readyTimer !== undefined) window.clearTimeout(readyTimer);
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <section
      aria-label="Stagg Homes property journey"
      className={`relative ${isScrollLinked ? "h-[340svh]" : "h-svh"} bg-[#102f3f] text-white`}
      data-stagg-property-journey="true"
      ref={sectionRef}
    >
      <div className="sticky top-0 isolate h-svh overflow-hidden">
        <video
          aria-hidden="true"
          className="absolute inset-0 -z-20 size-full object-cover"
          data-stagg-property-journey-video="true"
          muted
          playsInline
          poster={posterSource}
          preload="auto"
          ref={videoRef}
          src={videoSource}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(10,35,47,.92)_0%,rgba(16,47,63,.66)_42%,rgba(16,47,63,.12)_78%),linear-gradient(0deg,rgba(10,35,47,.72)_0%,transparent_52%)]"
        />

        <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-6 sm:px-8 lg:px-10">
          <Image
            alt="Stagg Homes"
            className="h-auto w-36 brightness-0 invert"
            height={300}
            src={`${base}/logo.png`}
            width={340}
          />
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:border-white/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            href="#valuation"
          >
            Request a valuation
            <ArrowDown aria-hidden="true" className="size-4" />
          </a>
        </header>

        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 mx-auto max-w-7xl px-5 sm:px-8 lg:px-10"
        >
          {copyBeats.map((beat, index) => (
            <div
              className="absolute inset-x-5 top-1/2 max-w-3xl -translate-y-1/2 sm:inset-x-8 lg:inset-x-10"
              key={beat.message}
              ref={(copy) => {
                copyRefs.current[index] = copy;
              }}
              style={{ opacity: index === 0 ? 1 : 0 }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#e8c68f]">
                {beat.eyebrow}
              </p>
              <p className="mt-5 max-w-[13ch] text-[clamp(3.3rem,7vw,7rem)] font-semibold leading-[0.9] tracking-[-0.07em]">
                {beat.message}
              </p>
            </div>
          ))}
        </div>

        <a
          className="absolute bottom-7 left-5 z-20 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#e8c68f] px-5 py-3 text-sm font-extrabold text-[#102f3f] shadow-[0_20px_55px_-22px_rgba(232,198,143,.9)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e8c68f] sm:bottom-10 sm:left-8 lg:left-10"
          href="#valuation"
        >
          Prepare your next step
          <ArrowDown aria-hidden="true" className="size-4" />
        </a>

        <h1 className="sr-only">A move deserves more than a transaction.</h1>
        <p className="sr-only">
          A quiet Kent street leads through the entrance of a considered family
          home and into a warm room overlooking a landscaped garden.
        </p>
      </div>
    </section>
  );
}
