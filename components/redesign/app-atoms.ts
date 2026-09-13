import { getAppAtomProgress } from "./app-journey-progress";
import { storyInterval } from "./story-progress";

type Atom = { x: number; y: number; color: string; dx: number; dy: number };

/** A separate, scroll-only particle field. The hero particle engine is untouched. */
export function createAppAtoms(
  canvas: HTMLCanvasElement,
  schedule: () => void,
) {
  const context = canvas.getContext("2d");
  const phone = canvas.parentElement;
  const source = new window.Image();
  const atoms: Atom[] = [];
  let requested = false;
  let disposed = false;

  source.onload = () => {
    if (disposed || !context) return;
    const sample = document.createElement("canvas");
    sample.width = 360;
    sample.height = 630;
    const sampleContext = sample.getContext("2d", { willReadFrequently: true });
    if (!sampleContext) return;
    sampleContext.drawImage(source, 0, 0, 360, 630);
    const pixels = sampleContext.getImageData(0, 0, 360, 630).data;
    for (let y = 4; y < 630; y += 8) {
      for (let x = 4; x < 360; x += 8) {
        const offset = (y * 360 + x) * 4;
        const index = atoms.length;
        atoms.push({
          x,
          y,
          color: `rgb(${pixels[offset]} ${pixels[offset + 1]} ${pixels[offset + 2]})`,
          dx: Math.sin(index * 2.399) * 140,
          dy: Math.cos(index * 1.713) * 120,
        });
      }
    }
    canvas.width = 960;
    canvas.height = 1500;
    context.setTransform(2, 0, 0, 2, 0, 0);
    phone?.setAttribute("data-atoms-ready", "");
    schedule();
  };

  return {
    render(progress: number) {
      if (!context) return;
      if (!requested) {
        requested = true;
        source.src = canvas.dataset.appSource ?? "";
      }
      if (!atoms.length) return;
      const resolution = storyInterval(progress, 0.84, 0.98);
      phone?.style.setProperty("--app-resolution", `${resolution}`);
      context.clearRect(0, 0, 480, 750);
      if (resolution === 1) return;
      atoms.forEach((atom, index) => {
        const formed = getAppAtomProgress(progress, index);
        if (formed === 0) return;
        context.globalAlpha = formed * (1 - resolution);
        context.fillStyle = atom.color;
        context.beginPath();
        context.arc(
          atom.x + 60 + atom.dx * (1 - formed),
          atom.y + 60 + atom.dy * (1 - formed),
          0.6 + formed * 3.1,
          0,
          Math.PI * 2,
        );
        context.fill();
      });
      context.globalAlpha = 1;
    },
    dispose() {
      disposed = true;
      source.onload = null;
      phone?.removeAttribute("data-atoms-ready");
      phone?.style.removeProperty("--app-resolution");
      context?.clearRect(0, 0, 480, 750);
    },
  };
}
