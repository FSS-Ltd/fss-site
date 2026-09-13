import { getScrollProgress } from "./motion-values";
import { storyInterval } from "./story-progress";
import { createAppAtoms } from "./app-atoms";
import "./app-journey-motion.css";

export function bindAppJourneys(scope: ParentNode): () => void {
  const journeys = Array.from(
    scope.querySelectorAll<HTMLElement>("[data-motion-app]"),
  ).map((host) => ({
    host,
    canvas: host.querySelector<HTMLCanvasElement>("[data-app-atoms]"),
  }));
  if (!journeys.length) return () => {};
  const media = window.matchMedia(
    "(min-width: 901px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)",
  );
  let frame = 0;
  const renderers = new Map<HTMLElement, ReturnType<typeof createAppAtoms>>();
  const update = () => {
    frame = 0;
    if (document.hidden) return;
    journeys.forEach(({ host, canvas }) => {
      if (!media.matches) {
        host.removeAttribute("data-app-ready");
        return;
      }
      const rect = host.getBoundingClientRect();
      if (
        host.hasAttribute("data-app-ready") &&
        (rect.bottom < 0 || rect.top > window.innerHeight)
      )
        return;
      const progress = getScrollProgress(
        rect.top,
        host.offsetHeight - window.innerHeight,
      );
      const focused = host.querySelector(
        '[data-app-panel="services"] :focus-visible',
      );
      host.style.setProperty(
        "--app-travel",
        `${focused ? 0 : -100 * storyInterval(progress, 0.12, 0.48)}vw`,
      );
      host.style.setProperty(
        "--app-wire",
        `${100 * (1 - storyInterval(progress, 0.18, 0.5))}%`,
      );
      host.style.setProperty(
        "--app-turn",
        `${-18 * (1 - storyInterval(progress, 0.5, 0.92))}deg`,
      );
      if (canvas && !renderers.has(host))
        renderers.set(host, createAppAtoms(canvas, schedule));
      renderers.get(host)?.render(progress);
      host.setAttribute("data-app-ready", "");
    });
  };
  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", schedule);
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", schedule);
  media.addEventListener("change", schedule);
  update();
  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    document.removeEventListener("visibilitychange", schedule);
    document.removeEventListener("focusin", schedule);
    document.removeEventListener("focusout", schedule);
    media.removeEventListener("change", schedule);
    journeys.forEach(({ host }) => host.removeAttribute("data-app-ready"));
    renderers.forEach((renderer) => renderer.dispose());
  };
}
