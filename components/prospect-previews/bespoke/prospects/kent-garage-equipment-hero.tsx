"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type SceneState = "past" | "active" | "future";

type WorkshopScene = {
  eyebrow: string;
  image: string;
  label: string;
  summary: string;
  title: string;
};

const workshopScenes: readonly WorkshopScene[] = [
  {
    label: "MOT bays",
    eyebrow: "01 / 04 · Design and installation",
    title: "Built around the work your workshop needs to do.",
    summary:
      "From the first layout to a commissioned MOT bay, Kent Garage Equipment turns practical constraints into a workshop ready for the work ahead.",
    image:
      "/prospect-previews/bespoke/kent-garage-equipment/mot-installation-v2.webp",
  },
  {
    label: "Vehicle lifts",
    eyebrow: "02 / 04 · Lifting equipment",
    title: "The right lift changes the pace of every job.",
    summary:
      "Two-post, four-post and specialist lifting systems are specified for the vehicles, bays and daily throughput your team manages.",
    image:
      "/prospect-previews/bespoke/kent-garage-equipment/vehicle-lifts-v2.webp",
  },
  {
    label: "Garage cabinets",
    eyebrow: "03 / 04 · Workshop storage",
    title: "A place for every tool. A clearer place to work.",
    summary:
      "Hardworking cabinets and benches bring order to the busiest parts of a workshop without compromising strength or access.",
    image:
      "/prospect-previews/bespoke/kent-garage-equipment/garage-cabinets-v2.webp",
  },
  {
    label: "Alignment stations",
    eyebrow: "04 / 04 · Diagnostic precision",
    title: "Precision equipment, fitted for the next job.",
    summary:
      "Wheel alignment and diagnostic stations give technicians a dependable setup for accurate work and a more capable service offer.",
    image:
      "/prospect-previews/bespoke/kent-garage-equipment/alignment-station-v2.webp",
  },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function getSceneState(index: number, activeIndex: number): SceneState {
  if (index === activeIndex) return "active";
  return index < activeIndex ? "past" : "future";
}

export function KentGarageEquipmentHero() {
  const trackRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateActiveScene = () => {
      if (reducedMotion.matches) return;

      const scrollableDistance = Math.max(
        track.offsetHeight - window.innerHeight,
        1,
      );
      const progress = clamp(
        -track.getBoundingClientRect().top / scrollableDistance,
        0,
        1,
      );
      const nextIndex = Math.min(
        workshopScenes.length - 1,
        Math.round(progress * (workshopScenes.length - 1)),
      );

      setActiveIndex((currentIndex) =>
        currentIndex === nextIndex ? currentIndex : nextIndex,
      );
    };

    const handleMotionPreference = () => {
      if (reducedMotion.matches) {
        setActiveIndex(0);
        return;
      }
      updateActiveScene();
    };

    updateActiveScene();
    window.addEventListener("scroll", updateActiveScene, { passive: true });
    window.addEventListener("resize", updateActiveScene);
    reducedMotion.addEventListener("change", handleMotionPreference);

    return () => {
      window.removeEventListener("scroll", updateActiveScene);
      window.removeEventListener("resize", updateActiveScene);
      reducedMotion.removeEventListener("change", handleMotionPreference);
    };
  }, []);

  const moveToScene = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;

    setActiveIndex(index);

    const targetProgress = index / (workshopScenes.length - 1);
    const targetTop =
      window.scrollY +
      track.getBoundingClientRect().top +
      (track.offsetHeight - window.innerHeight) * targetProgress;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    window.scrollTo({
      top: targetTop,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, []);

  return (
    <section
      aria-label="Kent Garage Equipment workshop expertise"
      className="kgeTrack"
      data-kge-scroll-hero="true"
      ref={trackRef}
    >
      <div className="kgeViewport">
        <div className="kgeBrandBar">
          <Image
            alt="Kent Garage Equipment"
            className="kgeLogo"
            height={86}
            src="/prospect-previews/bespoke/kent-garage-equipment/kge-logo-v1.png"
            width={157}
          />
          <div className="kgeBrandActions">
            <a className="kgeHeaderCta" href="#project">
              Plan a project
            </a>
            <p className="kgeBrandStatus">Private concept</p>
          </div>
        </div>

        <div aria-hidden="true" className="kgeSceneLayer">
          {workshopScenes.map((scene, index) => (
            <div
              className="kgeScene"
              data-state={getSceneState(index, activeIndex)}
              key={scene.label}
            >
              <Image
                alt=""
                fill
                loading={index === 0 ? "eager" : "lazy"}
                preload={index === 0}
                sizes="100vw"
                src={scene.image}
              />
            </div>
          ))}
          <div className="kgeImageWash" />
          <div className="kgeImageGrain" />
        </div>

        <div className="kgeCopyLayer">
          <p className="kgeKicker">Designed. Supplied. Installed.</p>
          <div className="kgeCopyStack">
            {workshopScenes.map((scene, index) => {
              const Heading = index === 0 ? "h1" : "h2";

              return (
                <article
                  aria-hidden={activeIndex !== index}
                  className="kgeCopyScene"
                  data-state={getSceneState(index, activeIndex)}
                  key={scene.label}
                >
                  <p className="kgeEyebrow">{scene.eyebrow}</p>
                  <Heading>{scene.title}</Heading>
                  <p className="kgeSummary">{scene.summary}</p>
                </article>
              );
            })}
          </div>
        </div>

        <nav
          aria-label="Workshop equipment scenes"
          className="kgeSceneNavigation"
        >
          <ol>
            {workshopScenes.map((scene, index) => (
              <li key={scene.label}>
                <button
                  aria-current={activeIndex === index ? "step" : undefined}
                  aria-label={`Show ${scene.label}`}
                  data-active={activeIndex === index}
                  onClick={() => moveToScene(index)}
                  type="button"
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{scene.label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <p className="kgeScrollPrompt">
          <span aria-hidden="true" /> Scroll to explore
        </p>
      </div>
    </section>
  );
}
