import { getScrollProgress } from "./motion-values";
import { bindStoryScenes } from "./story-scenes";
import { bindAppJourneys } from "./app-journey-scenes";
import { storyInterval } from "./story-progress";

const revealTransforms = {
  up: "translate3d(0, 32px, 0)",
  left: "translate3d(-56px, 0, 0)",
  right: "translate3d(56px, 0, 0)",
  mask: "translate3d(0, 64px, 0)",
} as const;

type RevealVariant = keyof typeof revealTransforms;

function revealVariant(element: HTMLElement): RevealVariant {
  const value = element.dataset.motionReveal;
  return value && value in revealTransforms ? (value as RevealVariant) : "up";
}

export function bindMotionReveals(scope: ParentNode) {
  const elements = Array.from(
    scope.querySelectorAll<HTMLElement>("[data-motion-reveal]"),
  );
  if (!elements.length || !("IntersectionObserver" in window)) return () => {};
  const animations = new Map<HTMLElement, Animation>();
  let frame = 0;
  const updateMasks = () => {
    frame = 0;
    if (document.hidden) return;
    animations.forEach((animation, element) => {
      const rect = element.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(
          1,
          (window.innerHeight * 0.92 - rect.top) / (window.innerHeight * 0.42),
        ),
      );
      animation.currentTime = progress * 1000;
      if (
        progress === 1 ||
        element.closest("[data-story-ready]") ||
        element.matches(":focus-within") ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        animation.cancel();
        animations.delete(element);
      }
    });
  };
  const scheduleMasks = () => {
    if (!frame) frame = window.requestAnimationFrame(updateMasks);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement))
          return;
        const element = entry.target;
        // Canvas fields and forms keep their own stationary coordinate space.
        if (
          element.querySelector("[data-hero-canvas], form") ||
          element.closest("[data-story-ready]") ||
          element.closest("form")
        ) {
          observer.unobserve(element);
          return;
        }
        const variant = revealVariant(element);
        element.dataset.motionRevealed = "true";
        const animation = element.animate(
          [
            {
              opacity: 0,
              transform:
                variant === "mask" ? "none" : revealTransforms[variant],
              clipPath: variant === "mask" ? "inset(0 0 100% 0)" : "inset(0)",
            },
            {
              opacity: 1,
              transform: variant === "mask" ? "none" : "translate3d(0, 0, 0)",
              clipPath: "inset(0)",
            },
          ],
          {
            duration: variant === "mask" ? 1000 : 760,
            easing: "cubic-bezier(.2,.75,.2,1)",
            fill: "none",
          },
        );
        if (
          variant === "mask" &&
          !element.querySelector("form") &&
          !element.closest("form")
        ) {
          animation.pause();
          animations.set(element, animation);
          scheduleMasks();
        }
        observer.unobserve(element);
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
  );

  elements.forEach((element) => observer.observe(element));
  window.addEventListener("scroll", scheduleMasks, { passive: true });
  window.addEventListener("resize", scheduleMasks);
  document.addEventListener("visibilitychange", scheduleMasks);
  document.addEventListener("focusin", scheduleMasks);
  return () => {
    observer.disconnect();
    window.cancelAnimationFrame(frame);
    animations.forEach((animation) => animation.cancel());
    window.removeEventListener("scroll", scheduleMasks);
    window.removeEventListener("resize", scheduleMasks);
    document.removeEventListener("visibilitychange", scheduleMasks);
    document.removeEventListener("focusin", scheduleMasks);
  };
}

export function bindScrollScenes(scope: ParentNode) {
  const disposeStories = bindStoryScenes(scope);
  const disposeApps = bindAppJourneys(scope);
  const root = scope instanceof HTMLElement ? scope : null;
  const deliveries = Array.from(
    scope.querySelectorAll<HTMLElement>('[data-motion-delivery="cinematic"]'),
  ).map((host) => ({
    host,
    steps: Array.from(
      host.querySelectorAll<HTMLElement>("[data-delivery-step]"),
    ),
  }));
  const cinematicMedia = window.matchMedia(
    "(min-width: 901px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)",
  );
  const parallax = Array.from(
    scope.querySelectorAll<HTMLElement>("[data-motion-parallax]"),
  );
  const progressElements = Array.from(
    scope.querySelectorAll<HTMLElement>(
      "[data-motion-kinetic], [data-motion-wipe], [data-motion-track]",
    ),
  );
  let frame = 0;

  const update = () => {
    frame = 0;
    if (document.hidden) return;
    const viewportHeight = window.innerHeight;
    deliveries.forEach(({ host, steps }) => {
      if (!cinematicMedia.matches) {
        host.removeAttribute("data-delivery-ready");
        return;
      }
      const rect = host.getBoundingClientRect();
      if (
        host.hasAttribute("data-delivery-ready") &&
        (rect.bottom < 0 || rect.top > viewportHeight)
      )
        return;
      const progress = getScrollProgress(
        rect.top,
        host.offsetHeight - viewportHeight,
      );
      host.style.setProperty("--delivery-progress", `${progress}`);
      host.style.setProperty("--delivery-heading-y", `${-36 * progress}px`);
      steps.forEach((step, index) => {
        const entered = storyInterval(
          progress,
          0.03 + index * 0.23,
          0.18 + index * 0.23,
        );
        step.style.setProperty(
          "--delivery-opacity",
          `${0.16 + 0.84 * entered}`,
        );
        step.style.setProperty(
          "--delivery-y",
          `${80 * (1 - entered) - progress * index * 12}px`,
        );
      });
      host.setAttribute("data-delivery-ready", "");
    });

    parallax.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.bottom < -viewportHeight || rect.top > viewportHeight * 2)
        return;
      const depth = Number.parseFloat(element.dataset.motionParallax ?? "0.08");
      const distanceFromCenter =
        rect.top + rect.height / 2 - viewportHeight / 2;
      const normalized = Math.max(
        -1,
        Math.min(1, distanceFromCenter / viewportHeight),
      );
      element.style.setProperty(
        "--motion-parallax",
        `${normalized * -Math.min(Math.abs(depth || 0.08), 0.18) * 180}px`,
      );
    });

    progressElements.forEach((element) => {
      const host =
        element.closest<HTMLElement>("[data-motion-scene]") ?? element;
      const hostRect = host.getBoundingClientRect();
      if (hostRect.bottom < 0 || hostRect.top > viewportHeight) return;
      const distance = Math.max(
        host.offsetHeight - viewportHeight,
        host.offsetHeight * 0.55,
      );
      const progress = getScrollProgress(hostRect.top, distance);
      element.style.setProperty("--motion-progress", progress.toFixed(4));

      if (element.hasAttribute("data-motion-kinetic")) {
        const direction = element.dataset.motionKinetic === "reverse" ? -1 : 1;
        element.style.setProperty(
          "--motion-shift",
          `${(progress - 0.5) * direction * 18}vw`,
        );
      }

      if (element.hasAttribute("data-motion-wipe")) {
        element.style.setProperty(
          "--motion-wipe",
          `${(100 * (1 - Math.max(0, Math.min(1, (viewportHeight - hostRect.top) / (viewportHeight * 0.65))))).toFixed(2)}%`,
        );
      }

      if (element.hasAttribute("data-motion-track")) {
        const travel = Math.max(
          0,
          element.scrollWidth - (element.parentElement?.clientWidth ?? 0),
        );
        element.style.setProperty(
          "--motion-track-x",
          `${(-progress * travel).toFixed(2)}px`,
        );
        element.style.setProperty(
          "--motion-track-y",
          `${((0.5 - progress) * 18).toFixed(2)}px`,
        );
        element.style.setProperty(
          "--motion-track-scale",
          `${(0.965 + progress * 0.035).toFixed(4)}`,
        );
      }
    });
  };

  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", schedule);
  root?.setAttribute("data-motion-enhanced", "true");
  schedule();

  return () => {
    disposeStories();
    disposeApps();
    deliveries.forEach(({ host }) =>
      host.removeAttribute("data-delivery-ready"),
    );
    window.cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    document.removeEventListener("visibilitychange", schedule);
    root?.removeAttribute("data-motion-enhanced");
  };
}
