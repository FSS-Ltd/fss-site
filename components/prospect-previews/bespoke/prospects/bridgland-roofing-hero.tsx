"use client";

import { ArrowDownRight } from "lucide-react";
import { useEffect, useRef } from "react";

const droneVideoSource =
  "/prospect-previews/bespoke/bridgland-roofing/roof-inspection-drone-v1.mp4?v=scrub-v1";
const roofPosterSource =
  "/prospect-previews/bespoke/bridgland-roofing/hero-wide-v1.png";

const analysisPoints = [
  {
    detail: "Slate and tile coverage",
    label: "01 · Slate field",
    positionClass: "bridglandMarkerSlate",
  },
  {
    detail: "Leadwork at a critical junction",
    label: "02 · Leadwork",
    positionClass: "bridglandMarkerLeadwork",
  },
  {
    detail: "Heritage detailing at the roofline",
    label: "03 · Heritage detail",
    positionClass: "bridglandMarkerHeritage",
  },
  {
    detail: "Inspection route from roof to report",
    label: "04 · Assessment",
    positionClass: "bridglandMarkerAssessment",
  },
] as const;

const copyBeats = [
  {
    eyebrow: "Bridgland Roofing · Ashford, Kent",
    message: "Read the roof before you change it.",
    summary:
      "A considered inspection route for heritage roofs, repairs and new installations across Kent and Sussex.",
  },
  {
    eyebrow: "Slate, tile and traditional finishes",
    message: "Materials have a history. Get the detail right.",
    summary:
      "A close look at condition, fit and the materials that belong on the building.",
  },
  {
    eyebrow: "Leadwork and weathering points",
    message: "The quiet junctions do the hardest work.",
    summary:
      "Inspect the places where water changes direction before planning a repair.",
  },
  {
    eyebrow: "Roof assessment to clear next step",
    message: "From aerial view to a useful brief.",
    summary:
      "Share the property and work context, then prepare a focused conversation with Bridgland.",
  },
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function getActiveAnalysisPoint(progress: number): number {
  const clampedProgress = clamp(progress, 0, 1);

  if (clampedProgress < 0.25) return 0;
  if (clampedProgress < 0.5) return 1;
  if (clampedProgress < 0.75) return 2;
  return 3;
}

export function BridglandRoofingHero() {
  const copyRefs = useRef<Array<HTMLDivElement | null>>([]);
  const markerRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId = 0;
    let hasMetadata = video.readyState >= 1 && video.duration > 0;

    const updateVisualState = (progress: number) => {
      const activePoint = getActiveAnalysisPoint(progress);

      copyRefs.current.forEach((copy, index) => {
        if (!copy) return;

        const isActive = index === activePoint;
        copy.style.opacity = isActive ? "1" : "0";
        copy.style.transform = isActive
          ? "translate3d(0, 0, 0)"
          : "translate3d(0, 1.5rem, 0)";
      });

      markerRefs.current.forEach((marker, index) => {
        if (!marker) return;
        marker.dataset.active = index === activePoint ? "true" : "false";
      });
    };

    const syncToScroll = () => {
      frameId = 0;

      if (reducedMotion.matches || window.innerWidth < 768) {
        updateVisualState(0);
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
      hasMetadata =
        hasMetadata || (video.readyState >= 1 && video.duration > 0);

      if (hasMetadata && Number.isFinite(video.duration)) {
        const targetTime = video.duration * progress;
        if (Math.abs(video.currentTime - targetTime) >= 1 / 48) {
          video.currentTime = targetTime;
        }
      }

      updateVisualState(progress);
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
    reducedMotion.addEventListener("change", requestSync);
    requestSync();

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      window.removeEventListener("scroll", requestSync);
      window.removeEventListener("resize", requestSync);
      reducedMotion.removeEventListener("change", requestSync);
      if (frameId !== 0) window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <section
      aria-label="Bridgland Roofing roof inspection"
      className="text-white"
      data-bridgland-drone-journey="true"
      ref={sectionRef}
    >
      <div data-bridgland-drone-frame="true">
        <video
          aria-hidden="true"
          data-bridgland-drone-video="true"
          muted
          playsInline
          poster={roofPosterSource}
          preload="auto"
          ref={videoRef}
          src={droneVideoSource}
        />
        <div aria-hidden="true" data-bridgland-drone-shade="true" />

        <header
          className="bridglandHeroChrome"
          data-bridgland-drone-chrome="true"
        >
          <a className="bridglandBrand" href="#roof-brief">
            <span>
              <strong>Bridgland</strong>
              <small>Roofing · Est. 1989</small>
            </span>
          </a>
          <a className="bridglandHeaderCta" href="#roof-brief">
            Request an assessment
            <ArrowDownRight aria-hidden="true" className="size-4" />
          </a>
        </header>

        <div aria-hidden="true" data-bridgland-analysis-layer="true">
          <div className="bridglandAnalysisHud" data-bridgland-analysis-hud="true">
            <span>Aerial roof scan</span>
            <small>4 inspection targets · scroll synced</small>
          </div>
          <div data-bridgland-analysis-sweep="true" />
          {analysisPoints.map((point, index) => (
            <span
              className={`bridglandAnalysisMarker ${point.positionClass}`}
              data-active={index === 0 ? "true" : "false"}
              data-bridgland-analysis-marker="true"
              key={point.label}
              ref={(marker) => {
                markerRefs.current[index] = marker;
              }}
            >
              <span className="bridglandMarkerDot">
                <span className="bridglandMarkerCore" />
              </span>
              <span className="bridglandMarkerLabel">
                <b>{point.label}</b>
                <small>{point.detail}</small>
              </span>
            </span>
          ))}
        </div>

        <div aria-hidden="true" data-bridgland-drone-copy="true">
          {copyBeats.map((beat, index) => (
            <div
              data-bridgland-drone-copy-beat="true"
              key={beat.message}
              ref={(copy) => {
                copyRefs.current[index] = copy;
              }}
              style={{ opacity: index === 0 ? 1 : 0 }}
            >
              <p className="bridglandEyebrow">{beat.eyebrow}</p>
              <p className="bridglandHeadline">{beat.message}</p>
              <p className="bridglandSummary">{beat.summary}</p>
            </div>
          ))}
        </div>

        <h1 className="sr-only">
          Bridgland Roofing heritage roofing services in Kent and Sussex
        </h1>
        <p className="sr-only">
          A scroll-controlled inspection drone flight shows the slate field,
          leadwork, heritage roof detailing and roof assessment route.
        </p>
      </div>
    </section>
  );
}
