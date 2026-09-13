import { getScrollProgress } from "./motion-values";

const revealTransforms = {
  up: "translate3d(0, 32px, 0)",
  left: "translate3d(-56px, 0, 0)",
  right: "translate3d(56px, 0, 0)",
  mask: "translate3d(0, 24px, 0)",
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

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement))
          return;
        const element = entry.target;
        const variant = revealVariant(element);
        element.dataset.motionRevealed = "true";
        element.animate(
          [
            {
              opacity: 0,
              transform: revealTransforms[variant],
              clipPath: variant === "mask" ? "inset(0 0 28% 0)" : "inset(0)",
            },
            {
              opacity: 1,
              transform: "translate3d(0, 0, 0)",
              clipPath: "inset(0)",
            },
          ],
          {
            duration: variant === "mask" ? 900 : 760,
            easing: "cubic-bezier(.2,.75,.2,1)",
            fill: "both",
          },
        );
        observer.unobserve(element);
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
  );

  elements.forEach((element) => observer.observe(element));
  return () => observer.disconnect();
}

export function bindScrollScenes(scope: ParentNode) {
  const root = scope instanceof HTMLElement ? scope : null;
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
          `${Math.max(0, 12 - progress * 12).toFixed(2)}%`,
        );
      }

      if (element.hasAttribute("data-motion-track")) {
        element.style.setProperty(
          "--motion-track-x",
          `${(-progress * 56).toFixed(2)}vw`,
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
    window.cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    document.removeEventListener("visibilitychange", schedule);
    root?.removeAttribute("data-motion-enhanced");
  };
}
