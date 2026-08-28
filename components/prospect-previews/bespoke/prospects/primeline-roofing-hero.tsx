"use client";

import Image from "next/image";
import { ArrowRight, BadgeCheck, Phone, ShieldCheck, Star } from "lucide-react";
import { useEffect, useRef } from "react";

const dayHeroImage =
  "/prospect-previews/bespoke/primeline-roofing/hero-day-v1.webp";
const nightHeroImage =
  "/prospect-previews/bespoke/primeline-roofing/hero-night-v1.webp";
const logoImage =
  "/prospect-previews/bespoke/primeline-roofing/primeline-logo.png";

const copyBeats = [
  {
    eyebrow: "Premium roofing across Kent",
    end: 0.28,
    message: "A roof worth looking up at.",
    start: -0.06,
    summary:
      "New roofs, repairs and flat roofing shaped around Medway homes, with the finish doing the selling.",
  },
  {
    eyebrow: "20 years of roofing craft",
    end: 0.52,
    message: "Straight advice before the scaffold.",
    start: 0.3,
    summary:
      "Free written quotations and site visits give customers a clear route before work begins.",
  },
  {
    eyebrow: "Fully insured and independently approved",
    end: 0.76,
    message: "Confidence built into every detail.",
    start: 0.54,
    summary:
      "Approval signals from TrustATrader, Checkatrade, Rated People, Google Guaranteed and the Confederation of Roofing Contractors support the proof story.",
  },
  {
    eyebrow: "Repair. Replace. Protect.",
    end: 1.12,
    message: "From first photo to final ridge.",
    start: 0.78,
    summary:
      "The enquiry route captures the work, property, urgency and roof images before Primeline arrives.",
  },
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function smoothStep(value: number): number {
  const nextValue = clamp(value, 0, 1);
  return nextValue * nextValue * (3 - 2 * nextValue);
}

function getCopyBeatStyle(progress: number, start: number, end: number) {
  const transitionProgress = 0.04;
  const entranceProgress = clamp((progress - start) / transitionProgress, 0, 1);
  const exitProgress = clamp((end - progress) / transitionProgress, 0, 1);
  const entranceOpacity = 1 - (1 - entranceProgress) ** 3;
  const exitOpacity = exitProgress ** 3;
  const opacity = Math.min(entranceOpacity, exitOpacity);
  const isEntering = entranceProgress < 1;

  return {
    blur: (1 - opacity) * 10,
    opacity,
    scale: 0.965 + opacity * 0.035,
    translateY: isEntering ? (1 - opacity) * 34 : -(1 - opacity) * 28,
  };
}

function getNightOpacity(progress: number): number {
  return smoothStep((progress - 0.12) / 0.68);
}

export function PrimelineRoofingHero() {
  const copyRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;

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
        copy.style.transform = `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`;
      });
    };

    const syncHeroToScroll = () => {
      frameId = 0;

      if (reducedMotion.matches) {
        section.style.setProperty("--primeline-night-opacity", "0");
        syncCopyToScroll(0.1);
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

      section.style.setProperty(
        "--primeline-night-opacity",
        getNightOpacity(progress).toFixed(3),
      );
      section.style.setProperty(
        "--primeline-ambient-shift",
        progress.toFixed(3),
      );
      syncCopyToScroll(progress);
    };

    const requestSync = () => {
      if (frameId !== 0) return;
      frameId = window.requestAnimationFrame(syncHeroToScroll);
    };

    const handleMotionPreference = () => requestSync();

    window.addEventListener("scroll", requestSync, { passive: true });
    window.addEventListener("resize", requestSync);
    reducedMotion.addEventListener("change", handleMotionPreference);
    requestSync();

    return () => {
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <section
      aria-label="Primeline Roofing premium roof transformation"
      data-primeline-hero="true"
      ref={sectionRef}
    >
      <div data-primeline-hero-frame="true">
        <div aria-hidden="true" data-primeline-hero-scene="true">
          <Image
            alt=""
            data-primeline-hero-day="true"
            fill
            preload
            sizes="100vw"
            src={dayHeroImage}
          />
          <Image
            alt=""
            data-primeline-hero-night="true"
            fill
            sizes="100vw"
            src={nightHeroImage}
          />
          <div data-primeline-hero-wash="true" />
          <div data-primeline-hero-grain="true" />
        </div>

        <header className="primelineHeroChrome" data-primeline-hero-chrome>
          <a aria-label="Primeline Roofing home" className="primelineLogo" href="#">
            <Image
              alt="Primeline Roofing & Building Ltd"
              height={450}
              src={logoImage}
              width={450}
            />
          </a>
          <nav aria-label="Primeline actions" className="primelineHeroActions">
            <a className="primelineTextLink" href="#services">
              Services
            </a>
            <a className="primelineHeaderCta" href="tel:01634776801">
              <Phone aria-hidden="true" className="size-4" />
              <span>01634 776801</span>
            </a>
          </nav>
        </header>

        <div data-primeline-hero-copy="true">
          <div className="primelineProofPill">
            <Star aria-hidden="true" className="size-4" />
            <span>5.0 Google rating</span>
          </div>
          <div aria-hidden="true" className="primelineCopyStack">
            {copyBeats.map((beat, index) => (
              <div
                data-primeline-copy-beat="true"
                key={beat.message}
                ref={(copy) => {
                  copyRefs.current[index] = copy;
                }}
              >
                <p className="primelineEyebrow">{beat.eyebrow}</p>
                <p className="primelineHeadline">{beat.message}</p>
                <p className="primelineSummary">{beat.summary}</p>
              </div>
            ))}
          </div>
          <div className="primelineHeroCtas">
            <a className="primelinePrimaryCta" href="#visit">
              <span>Arrange a free quote</span>
              <ArrowRight aria-hidden="true" className="size-5" />
            </a>
            <a className="primelineSecondaryCta" href="#proof">
              <ShieldCheck aria-hidden="true" className="size-5" />
              <span>View proof</span>
            </a>
          </div>
        </div>

        <aside aria-label="Primeline proof points" className="primelineProofDock">
          <div>
            <BadgeCheck aria-hidden="true" className="size-5" />
            <span>TrustATrader 4.97</span>
          </div>
          <div>
            <ShieldCheck aria-hidden="true" className="size-5" />
            <span>Insurance backed guarantee</span>
          </div>
        </aside>

        <h1 className="sr-only">
          Primeline Roofing & Building Ltd premium roofing across Kent
        </h1>
        <p className="sr-only">
          Primeline Roofing provides new roofs, roof repairs, flat roofing,
          free written quotations, insured work and independent approval signals
          across Chatham, Medway and Kent.
        </p>
      </div>
    </section>
  );
}
