"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";

const assetBase = "/prospect-previews/bespoke/hollis-motors";

const galleryFrames = [
  "dealership-gallery-01.webp",
  "dealership-gallery-02.webp",
  "dealership-gallery-03.webp",
  "dealership-gallery-04.webp",
] as const;

const sellingPoints = ["Used cars", "Part exchange", "Finance", "Onsite workshop"] as const;

const copyBeats = [
  {
    eyebrow: "Used cars in Dover",
    isTagline: false,
    message: "Find the right car.",
    summary: "A considered used-car route from the same team that can look after what comes next.",
  },
  {
    eyebrow: "Part exchange and finance",
    isTagline: false,
    message: "Move on with a plan.",
    summary: "Bring your current car, your next car and your finance questions into one clear conversation.",
  },
  {
    eyebrow: "Onsite workshop",
    isTagline: false,
    message: "Keep your car in shape.",
    summary: "MOT, servicing and repairs stay close to the people who helped you choose your car.",
  },
  {
    eyebrow: "Hollis Motors · Dover",
    isTagline: true,
    message: "Hollis Motors. There’s nowhere better.",
    summary: "Used cars and vehicle care from one established Dover team.",
  },
] as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getFrameOpacities(progress: number) {
  const finalFrame = galleryFrames.length - 1;
  const galleryPosition = clamp(progress, 0, 1) * finalFrame;
  const activeFrame = Math.min(Math.floor(galleryPosition), finalFrame);
  const followingFrame = Math.min(activeFrame + 1, finalFrame);
  const blend = galleryPosition - activeFrame;

  return galleryFrames.map((_, index) => {
    if (index === activeFrame) {
      return 1 - blend;
    }

    if (index === followingFrame) {
      return blend;
    }

    return 0;
  });
}

function getCopyBeatOpacities(progress: number) {
  const activeCopyBeat = Math.min(
    Math.floor(clamp(progress, 0, 1) * copyBeats.length),
    copyBeats.length - 1,
  );

  return copyBeats.map((_, index) => (index === activeCopyBeat ? 1 : 0));
}

export function HollisMotorsHero() {
  const copyBeatRefs = useRef<Array<HTMLDivElement | null>>([]);
  const galleryRef = useRef<HTMLElement>(null);
  const galleryFrameRefs = useRef<Array<HTMLImageElement | null>>([]);

  useEffect(() => {
    const gallery = galleryRef.current;

    if (!gallery) {
      return;
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame: number | undefined;

    const syncOpacity = (
      elements: readonly (HTMLElement | null)[],
      property: "--hollis-copy-opacity" | "--hollis-gallery-opacity",
      opacities: readonly number[],
    ) => {
      elements.forEach((element, index) => {
        element?.style.setProperty(property, String(opacities[index] ?? 0));
      });
    };

    const updateGallery = () => {
      animationFrame = undefined;

      const progress = reducedMotionQuery.matches
        ? 0
        : clamp(
            -gallery.getBoundingClientRect().top /
              Math.max(gallery.offsetHeight - window.innerHeight, 1),
            0,
            1,
          );

      syncOpacity(
        galleryFrameRefs.current,
        "--hollis-gallery-opacity",
        getFrameOpacities(progress),
      );
      syncOpacity(
        copyBeatRefs.current,
        "--hollis-copy-opacity",
        getCopyBeatOpacities(progress),
      );
    };

    const scheduleGalleryUpdate = () => {
      if (animationFrame === undefined) {
        animationFrame = window.requestAnimationFrame(updateGallery);
      }
    };

    window.addEventListener("scroll", scheduleGalleryUpdate, { passive: true });
    window.addEventListener("resize", scheduleGalleryUpdate);
    reducedMotionQuery.addEventListener("change", scheduleGalleryUpdate);
    scheduleGalleryUpdate();

    return () => {
      window.removeEventListener("scroll", scheduleGalleryUpdate);
      window.removeEventListener("resize", scheduleGalleryUpdate);
      reducedMotionQuery.removeEventListener("change", scheduleGalleryUpdate);

      if (animationFrame !== undefined) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <section
      aria-label="Hollis Motors dealership introduction"
      data-hollis-scroll-gallery="true"
      data-hollis-showroom-gallery="true"
      id="top"
      ref={galleryRef}
    >
      <div data-hollis-showroom-frame="true">
        {galleryFrames.map((frame, index) => (
          <Image
            alt=""
            aria-hidden="true"
            className="hollisGalleryFrame"
            data-hollis-gallery-frame="true"
            fill
            key={frame}
            loading={index === 0 ? undefined : "eager"}
            preload={index === 0}
            ref={(element) => {
              galleryFrameRefs.current[index] = element;
            }}
            sizes="100vw"
            src={`${assetBase}/${frame}`}
          />
        ))}
        <div aria-hidden="true" data-hollis-gallery-shade="true" />

        <header className="hollisHeroChrome">
          <a aria-label="Hollis Motors concept home" className="hollisBrand" href="#top">
            <Image alt="Hollis Motors, established 1965" height={95} src={`${assetBase}/logo.png`} width={120} />
          </a>
          <nav aria-label="Hollis Motors concept navigation" className="hollisHeroNavigation">
            <a href="#collection">Why Hollis</a>
            <a className="hollisHeaderCta" href="#vehicle">
              Start with your vehicle
            </a>
          </nav>
        </header>

        <div className="hollisHeroCopy">
          <div aria-hidden="true" className="hollisCopyStack">
            {copyBeats.map((beat, index) => (
              <div
                data-hollis-copy-beat="true"
                key={beat.message}
                ref={(element) => {
                  copyBeatRefs.current[index] = element;
                }}
              >
                <p className="hollisEyebrow">{beat.eyebrow}</p>
                <p
                  className="hollisHeroHeadline"
                  data-hollis-copy-tagline={beat.isTagline ? "true" : undefined}
                >
                  {beat.message}
                </p>
                <p className="hollisHeroSummary">{beat.summary}</p>
              </div>
            ))}
          </div>
          <div className="hollisHeroCtas">
            <a className="hollisPrimaryCta" href="#vehicle">
              Browse the collection
              <ArrowRight aria-hidden="true" className="size-5" />
            </a>
            <a className="hollisSecondaryCta" href="#collection">
              <ArrowDown aria-hidden="true" className="size-5" />
              See how Hollis can help
            </a>
          </div>
        </div>

        <h1 className="sr-only">Hollis Motors in Dover</h1>
        <p className="sr-only">
          Hollis Motors provides used cars, part exchange, finance, MOT,
          servicing and repair support through its onsite workshop. Hollis
          Motors. There’s nowhere better.
        </p>

        <aside aria-label="Hollis Motors selling points" className="hollisProofDock">
          {sellingPoints.map((point, index) => (
            <div key={point}>
              <span>0{index + 1}</span>
              <strong>{point}</strong>
            </div>
          ))}
        </aside>

        <div aria-hidden="true" className="hollisGalleryCounter">
          <span>Curated dealership gallery</span>
          <div>
            {galleryFrames.map((frame, index) => (
              <i key={frame}>{String(index + 1).padStart(2, "0")}</i>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
