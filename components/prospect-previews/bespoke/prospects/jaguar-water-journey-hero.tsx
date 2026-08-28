"use client";

import Image from "next/image";
import { ArrowDown } from "lucide-react";
import { useEffect, useRef } from "react";

const videoSource =
  "/prospect-previews/bespoke/jaguar-plumbing/water-journey-scroll-scrub-v1.mp4";
const posterSource =
  "/prospect-previews/bespoke/jaguar-plumbing/water-journey-v1-poster.png";

const copyBeats = [
  {
    eyebrow: "JAGUAR PLUMBING",
    end: 0.31,
    message: "A better response starts before the callout.",
    start: 0.06,
  },
  {
    eyebrow: "PLUMBING · HEATING · DRAINAGE",
    end: 0.62,
    message: "Clear context gets the right help moving.",
    start: 0.37,
  },
  {
    eyebrow: "DARTFORD AND ACROSS KENT",
    end: 0.94,
    message: "From the first drop to the finished detail.",
    start: 0.69,
  },
] as const;

function getCopyBeatStyle(progress: number, start: number, end: number) {
  const transitionProgress = 0.06;
  const entering = Math.min(
    Math.max((progress - start) / transitionProgress, 0),
    1,
  );
  const exiting = Math.min(
    Math.max((end - progress) / transitionProgress, 0),
    1,
  );
  const opacity = Math.min(1 - (1 - entering) ** 3, exiting ** 3);

  return {
    blur: (1 - opacity) * 10,
    opacity,
    scale: 0.97 + opacity * 0.03,
    translateY: entering < 1 ? (1 - opacity) * 28 : -(1 - opacity) * 20,
  };
}

export function JaguarWaterJourneyHero() {
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
    let smoothTime = video.currentTime;

    const syncCopyToScroll = (progress: number) => {
      copyRefs.current.forEach((copy, index) => {
        const beat = copyBeats[index];
        if (!copy || !beat) return;

        const { blur, opacity, scale, translateY } = getCopyBeatStyle(
          progress,
          beat.start,
          beat.end,
        );

        copy.style.filter = blur > 0 ? `blur(${blur.toFixed(2)}px)` : "none";
        copy.style.opacity = opacity.toString();
        copy.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`;
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
      const targetTime = video.duration * progress;

      smoothTime += (targetTime - smoothTime) * 0.2;
      syncCopyToScroll(progress);

      if (Math.abs(video.currentTime - smoothTime) > 0.01) {
        video.currentTime = smoothTime;
      }

      if (Math.abs(targetTime - smoothTime) > 0.005) {
        frameId = window.requestAnimationFrame(syncVideoToScroll);
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
      data-jaguar-water-journey="true"
      ref={sectionRef}
    >
      <div data-jaguar-water-journey-frame="true">
        <video
          aria-hidden="true"
          data-jaguar-water-journey-video="true"
          muted
          playsInline
          poster={posterSource}
          preload="auto"
          ref={videoRef}
          src={videoSource}
        />
        <div aria-hidden="true" data-jaguar-water-journey-shade="true" />
        <header className="relative z-10 mx-auto flex max-w-[88rem] items-center justify-between gap-5 px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
          <div className="rounded-xl bg-white px-3 py-2 sm:px-4">
            <Image
              alt="Jaguar Plumbing"
              height={38}
              priority
              src="/prospect-previews/bespoke/jaguar-plumbing/logo.svg"
              width={213}
            />
          </div>
          <a
            className="hidden items-center gap-2 text-sm font-bold text-white/70 transition hover:text-white sm:inline-flex"
            href="#service-brief"
          >
            Prepare a service brief
            <ArrowDown aria-hidden="true" className="size-4" />
          </a>
        </header>
        <div aria-hidden="true" data-jaguar-water-journey-copy="true">
          {copyBeats.map((beat, index) => (
            <div
              data-jaguar-water-journey-copy-beat="true"
              key={beat.message}
              ref={(copy) => {
                copyRefs.current[index] = copy;
              }}
            >
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff9f32]">
                {beat.eyebrow}
              </p>
              <p className="mt-5 max-w-[11ch] text-[clamp(3.4rem,7.1vw,7rem)] font-semibold leading-[0.88] tracking-[-0.075em]">
                {beat.message}
              </p>
            </div>
          ))}
        </div>
        <a
          className="absolute bottom-7 left-4 z-10 inline-flex min-h-12 items-center gap-3 rounded-full bg-[#f39200] px-5 py-3 text-sm font-extrabold text-[#151515] shadow-[0_20px_55px_-22px_rgba(243,146,0,.9)] transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f39200] sm:bottom-10 sm:left-7 lg:left-10"
          href="#service-brief"
        >
          Start a service brief
          <ArrowDown aria-hidden="true" className="size-4" />
        </a>
        <h1 className="sr-only">Jaguar Plumbing</h1>
        <p className="sr-only">
          An orange liquid jaguar flows through domestic pipes and dissolves
          into running water from a copper tap into a marble basin. Jaguar
          Plumbing provides plumbing, heating and drainage services across Kent.
        </p>
      </div>
    </section>
  );
}
