import { getParticleNodeCount, getScrollProgress } from "./motion-values";
import {
  buildValueNetwork,
  networkFormation,
  networkPointerOffset,
} from "./value-network";

/** Event-driven assembly: no elapsed-time movement and no perpetual frame loop. */
export function bindValueNetwork(
  canvas: HTMLCanvasElement,
  baseCount: number,
  finePointer: boolean,
  reducedMotion: boolean,
): () => void {
  const context = canvas.getContext("2d");
  const host = canvas.closest<HTMLElement>("[data-motion-story]");
  if (!context || !host) return () => {};
  let width = 0;
  let height = 0;
  let frame = 0;
  let pointer: { x: number; y: number } | null = null;
  let network = buildValueNetwork(1, 1, 10);

  const draw = () => {
    frame = 0;
    if (document.hidden) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    if (width !== rect.width || height !== rect.height) {
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      network = buildValueNetwork(
        width,
        height,
        getParticleNodeCount({ baseCount, width, height, finePointer }),
      );
    }
    const progress = reducedMotion
      ? 1
      : getScrollProgress(
          host.getBoundingClientRect().top,
          host.offsetHeight - window.innerHeight,
        );
    const localPointer =
      pointer && !reducedMotion
        ? { x: pointer.x - rect.left, y: pointer.y - rect.top }
        : null;
    const points = network.nodes.map((node) => {
      const anchor = { x: node.x * width, y: node.y * height };
      const offset = networkPointerOffset(anchor, localPointer);
      return {
        x: anchor.x + offset.x,
        y: anchor.y + offset.y,
        opacity: networkFormation(progress, node),
      };
    });
    context.clearRect(0, 0, width, height);
    context.lineWidth = 0.85;
    network.edges.forEach(([a, b]) => {
      const firstNode = network.nodes[a];
      const secondNode = network.nodes[b];
      const first = points[a];
      const second = points[b];
      const amount = Math.min(
        networkFormation(progress, firstNode, true),
        networkFormation(progress, secondNode, true),
      );
      if (!amount) return;
      // Draw outward from the earlier (bottom-left) anchor, then retain the edge.
      const [start, end] =
        firstNode.x - firstNode.y < secondNode.x - secondNode.y
          ? [first, second]
          : [second, first];
      context.strokeStyle = `rgba(20,152,158,${0.28 * amount})`;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(
        start.x + (end.x - start.x) * amount,
        start.y + (end.y - start.y) * amount,
      );
      context.stroke();
    });
    points.forEach((point) => {
      if (!point.opacity) return;
      context.fillStyle = `rgba(166,66,36,${0.6 * point.opacity})`;
      context.beginPath();
      context.arc(point.x, point.y, 1.8 * point.opacity, 0, Math.PI * 2);
      context.fill();
    });
  };
  const schedule = () => {
    if (!frame && !document.hidden) frame = window.requestAnimationFrame(draw);
  };
  const move = (event: PointerEvent) => {
    if (!finePointer || reducedMotion || event.pointerType === "touch") return;
    pointer = { x: event.clientX, y: event.clientY };
    schedule();
  };
  const resetPointer = () => {
    pointer = null;
    schedule();
  };
  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(canvas);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("blur", resetPointer);
  document.documentElement.addEventListener("pointerleave", resetPointer);
  document.addEventListener("visibilitychange", schedule);
  schedule();
  return () => {
    window.cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("blur", resetPointer);
    document.documentElement.removeEventListener("pointerleave", resetPointer);
    document.removeEventListener("visibilitychange", schedule);
  };
}
