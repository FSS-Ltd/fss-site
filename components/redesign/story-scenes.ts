import { getScrollProgress } from "./motion-values";
import { storyChapter, storyInterval } from "./story-progress";
import "./cinematic-motion.css";

const storyMedia =
  "(min-width: 901px) and (min-height: 650px) and (prefers-reduced-motion: no-preference)";

export function bindStoryScenes(scope: ParentNode): () => void {
  const stories = Array.from(
    scope.querySelectorAll<HTMLElement>("[data-motion-story]"),
  ).map((host) => ({
    host,
    chapters: Array.from(
      host.querySelectorAll<HTMLElement>("[data-story-chapter]"),
    ),
    device: host.querySelector<HTMLElement>("[data-story-device]"),
  }));
  if (!stories.length) return () => {};
  const media = window.matchMedia(storyMedia);
  let frame = 0;

  const update = () => {
    frame = 0;
    if (document.hidden) return;
    stories.forEach(({ host, chapters, device }) => {
      if (!media.matches) {
        host.removeAttribute("data-story-ready");
        return;
      }
      const rect = host.getBoundingClientRect();
      const progress = getScrollProgress(
        rect.top,
        host.offsetHeight - window.innerHeight,
      );
      if (
        host.hasAttribute("data-story-ready") &&
        (rect.bottom < 0 || rect.top > window.innerHeight)
      )
        return;
      chapters.forEach((chapter, index) => {
        const state = storyChapter(progress, index, chapters.length);
        chapter.style.setProperty(
          "--chapter-opacity",
          state.opacity.toFixed(4),
        );
        chapter.style.setProperty("--chapter-y", `${state.y.toFixed(2)}px`);
        chapter.style.setProperty(
          "--chapter-mask",
          `${state.mask.toFixed(2)}%`,
        );
      });
      host.style.setProperty("--story-progress", progress.toFixed(4));
      if (!device) {
        host.setAttribute("data-story-ready", "");
        return;
      }
      const finish = storyInterval(progress, 0.56, 0.9);
      host.style.setProperty(
        "--wire-mask",
        `${100 * (1 - storyInterval(progress, 0.05, 0.3))}%`,
      );
      host.style.setProperty("--device-y", `${-22 * (1 - finish)}deg`);
      host.style.setProperty("--device-x", `${12 * (1 - finish)}deg`);
      host.style.setProperty("--visual-y", `${35 * (1 - finish)}px`);
      ["a", "b", "c", "d"].forEach((letter, index) => {
        const amount = storyInterval(
          progress,
          0.56 + index * 0.025,
          0.82 + index * 0.025,
        );
        host.style.setProperty(`--finish-${letter}`, `${amount * 100}%`);
      });
      const width = device?.offsetWidth ?? 0;
      host.style.setProperty("--particle-x", `${finish * width}px`);
      host.style.setProperty(
        "--particle-opacity",
        `${Math.sin(finish * Math.PI)}`,
      );
      host.setAttribute("data-story-ready", "");
    });
  };
  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  document.addEventListener("visibilitychange", schedule);
  media.addEventListener("change", schedule);
  update();
  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    document.removeEventListener("visibilitychange", schedule);
    media.removeEventListener("change", schedule);
    stories.forEach(({ host }) => host.removeAttribute("data-story-ready"));
  };
}
