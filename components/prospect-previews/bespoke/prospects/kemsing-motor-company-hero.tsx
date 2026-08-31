"use client";

import Image from "next/image";
import { ArrowDown } from "lucide-react";
import { useEffect, useRef } from "react";

const videoSource =
  "/prospect-previews/bespoke/kemsing-motor-company/vehicle-reassembly-scroll-scrub-v1.mp4";
const minimumSeekDelta = 1 / 48;
const posterSource =
  "/prospect-previews/bespoke/kemsing-motor-company/vehicle-assembled-v1.png";

const copyBeats = [
  {
    eyebrow: "Precision, reassembled",
    end: 0.36,
    message: "Every detail has a place.",
    start: 0,
  },
  {
    eyebrow: "Kemsing Motor Company",
    end: 0.7,
    message: "MOT, diagnostics, service or repair.",
    start: 0.3,
  },
  {
    eyebrow: "A clearer workshop request",
    end: 1,
    message: "Start with the vehicle. Finish with confidence.",
    start: 0.64,
  },
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function shouldEnableScrollLinkedHero(
  prefersReducedMotion: boolean,
  viewportWidth: number,
): boolean {
  return !prefersReducedMotion && viewportWidth >= 768;
}

export function getCopyOpacity(
  progress: number,
  start: number,
  end: number,
): number {
  const fadeDistance = 0.08;
  const entering =
    start === 0 ? 1 : clamp((progress - start) / fadeDistance, 0, 1);
  const exiting = end === 1 ? 1 : clamp((end - progress) / fadeDistance, 0, 1);

  return Math.min(entering, exiting);
}

export function KemsingMotorCompanyHero() {
  const copyRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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
    let hasMetadata = video.readyState >= 1 && video.duration > 0;

    const syncToScroll = () => {
      frameId = 0;
      hasMetadata =
        hasMetadata || (video.readyState >= 1 && video.duration > 0);
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
      requestSync();
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    if (hasMetadata) requestSync();

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <section
      aria-label="Kemsing Motor Company vehicle assembly"
      className="relative min-h-svh bg-[#070b12] text-white"
      data-kemsing-vehicle-journey="true"
      ref={sectionRef}
    >
      <div
        className="relative isolate min-h-svh overflow-hidden"
        data-kemsing-vehicle-journey-frame="true"
      >
        <video
          aria-hidden="true"
          className="absolute inset-0 -z-20 size-full object-cover"
          data-kemsing-vehicle-journey-video="true"
          muted
          playsInline
          poster={posterSource}
          preload="auto"
          ref={videoRef}
          src={videoSource}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,9,16,.92)_0%,rgba(5,9,16,.62)_42%,rgba(5,9,16,.12)_78%),linear-gradient(0deg,rgba(5,9,16,.74)_0%,transparent_45%)]"
          data-kemsing-vehicle-journey-shade="true"
        />

        <header className="relative z-20 mx-auto flex max-w-[88rem] items-start justify-between gap-5 px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
          <Image
            alt="Kemsing Motor Company"
            className="h-auto w-[115px]"
            height={130}
            src="/prospect-previews/bespoke/kemsing-motor-company/kemsing-motor-company-logo-v1.webp"
            unoptimized
            width={230}
          />
          <a
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 bg-black/20 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:border-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            href="#vehicle-request"
          >
            Prepare your vehicle request
            <ArrowDown aria-hidden="true" className="size-4" />
          </a>
        </header>

        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 mx-auto max-w-[88rem] px-4 sm:px-7 lg:px-10"
          data-kemsing-vehicle-journey-copy="true"
        >
          {copyBeats.map((beat, index) => (
            <div
              className="absolute inset-x-4 top-1/2 max-w-3xl -translate-y-1/2 sm:inset-x-7 lg:inset-x-10"
              data-kemsing-vehicle-journey-copy-beat="true"
              key={beat.message}
              ref={(copy) => {
                copyRefs.current[index] = copy;
              }}
              style={{ opacity: index === 0 ? 1 : 0 }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#e4a44a]">
                {beat.eyebrow}
              </p>
              <p className="mt-5 max-w-[12ch] text-[clamp(3.3rem,7vw,7rem)] font-semibold leading-[0.9] tracking-[-0.07em]">
                {beat.message}
              </p>
            </div>
          ))}
        </div>

        <a
          className="absolute bottom-7 left-4 z-20 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#e4a44a] px-5 py-3 text-sm font-extrabold text-[#080b11] shadow-[0_20px_55px_-22px_rgba(228,164,74,.9)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#e4a44a] sm:bottom-10 sm:left-7 lg:left-10"
          href="#vehicle-request"
        >
          Start with your registration
          <ArrowDown aria-hidden="true" className="size-4" />
        </a>

        <h1 className="sr-only">Kemsing Motor Company</h1>
        <p className="sr-only">
          A graphite-blue hatchback reassembles inside a dark workshop. Kemsing
          Motor Company provides MOT, diagnostics, servicing and vehicle repair
          routes in Kemsing.
        </p>
      </div>
    </section>
  );
}
