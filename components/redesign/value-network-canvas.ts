import { getParticleNodeCount, getScrollProgress } from "./motion-values";
import {
  buildValueNetwork,
  networkFormation,
  networkPointerOffset,
} from "./value-network";
import {
  heroLabels,
  hubName,
  labelPosition,
  labelPull,
  labelWeb,
  networkStage,
  settledStage,
  storyLabels,
} from "./value-network-labels";

/** Event-driven assembly: no elapsed-time movement and no perpetual frame loop.
 *  A canvas outside a scroll story (the homepage hero) is drawn fully formed and
 *  only answers the pointer; its markup carries a matching static poster. */
export function bindValueNetwork(
  canvas: HTMLCanvasElement,
  baseCount: number,
  finePointer: boolean,
  reducedMotion: boolean,
): () => void {
  const context = canvas.getContext("2d");
  const host = canvas.closest<HTMLElement>("[data-motion-story]");
  if (!context) return () => {};
  // A fixed node count keeps a small canvas from thinning out on phones.
  const fixedCount = Number(canvas.dataset.networkNodes) || 0;
  // A fixed view box ("840x780") is scaled to cover the canvas, exactly as the
  // matching inline poster is, so the hand-over from poster to canvas is unseen.
  const [viewWidth = 0, viewHeight = 0] = (canvas.dataset.networkView ?? "")
    .split("x")
    .map(Number);
  let fit = 0;
  let width = 0;
  let height = 0;
  let frame = 0;
  let pulseTimer = 0;
  let disposed = false;
  let fontFamily = "";
  let pointer: { x: number; y: number } | null = null;
  let network = buildValueNetwork(1, 1, 10);

  const draw = () => {
    frame = 0;
    if (disposed || document.hidden) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    if (width !== rect.width || height !== rect.height) {
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      fontFamily = getComputedStyle(canvas).fontFamily;
      fit = viewWidth ? Math.max(width / viewWidth, height / viewHeight) : 0;
      network = buildValueNetwork(
        viewWidth || width,
        viewHeight || height,
        fixedCount ||
          getParticleNodeCount({ baseCount, width, height, finePointer }),
      );
    }
    const progress =
      reducedMotion || !host
        ? 1
        : getScrollProgress(
            host.getBoundingClientRect().top,
            host.offsetHeight - window.innerHeight,
          );
    const localPointer =
      pointer && !reducedMotion
        ? { x: pointer.x - rect.left, y: pointer.y - rect.top }
        : null;
    const anchorOf = (node: { x: number; y: number }) =>
      fit
        ? {
            x: (width - viewWidth * fit) / 2 + node.x * viewWidth * fit,
            y: (height - viewHeight * fit) / 2 + node.y * viewHeight * fit,
          }
        : { x: node.x * width, y: node.y * height };
    const points = network.nodes.map((node) => {
      const anchor = anchorOf(node);
      const offset = networkPointerOffset(anchor, localPointer);
      return {
        x: anchor.x + offset.x,
        y: anchor.y + offset.y,
        opacity: networkFormation(progress, node),
      };
    });
    context.clearRect(0, 0, width, height);
    context.lineWidth = 0.85 * (fit || 1);
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
      context.arc(
        point.x,
        point.y,
        1.8 * (fit || 1) * point.opacity,
        0,
        Math.PI * 2,
      );
      context.fill();
    });
    // The business as a network: its parts, labelled, joined by one path to FSS.
    // A story draws them only while it is pinned; phones and reduced motion skip it.
    const showLabels = host
      ? host.hasAttribute("data-story-ready")
      : window.innerWidth > 900;
    if (showLabels) {
      const stage =
        host && !reducedMotion ? networkStage(progress) : settledStage;
      const scale = fit || 1;
      const items = (host ? storyLabels : heroLabels).map((item) => {
        const anchor = anchorOf(labelPosition(item, stage.settle));
        const pull = labelPull(anchor, localPointer);
        return {
          name: item.name,
          x: anchor.x + pull.x,
          y: anchor.y + pull.y,
          glow: pull.glow,
          hub: item.name === hubName,
        };
      });
      const link = (a: number, b: number, amount: number) => {
        context.beginPath();
        context.moveTo(items[a].x, items[a].y);
        context.lineTo(
          items[a].x + (items[b].x - items[a].x) * amount,
          items[a].y + (items[b].y - items[a].y) * amount,
        );
        context.stroke();
      };
      context.lineCap = "round";
      context.lineJoin = "round";
      const web = stage.join * (1 - stage.path);
      if (web > 0) {
        context.strokeStyle = `rgba(20,152,158,${0.55 * web})`;
        context.lineWidth = 1.4 * scale;
        labelWeb.forEach(([a, b]) => link(a, b, stage.join));
      }
      if (stage.path > 0) {
        context.strokeStyle = "rgba(166,66,36,.9)";
        context.lineWidth = 2.4 * scale;
        items.slice(0, -1).forEach((_, index) => {
          const done = Math.max(
            0,
            Math.min(1, stage.path * (items.length - 1) - index),
          );
          if (done) link(index, index + 1, done);
        });
      }
      const size = Math.max(12, 12 * scale);
      context.font = `600 ${size}px ${fontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      // FSS is where every path ends: a soft halo marks it as live and central.
      // A static ring always; the pulse ring only where motion is welcome.
      const pulse = (performance.now() % 2800) / 2800;
      items.forEach((item) => {
        const radius = (item.hub ? 17 : 5.5 + 2.5 * item.glow) * scale;
        if (item.hub) {
          context.lineWidth = 2 * scale;
          context.strokeStyle = "rgba(166,66,36,.3)";
          context.beginPath();
          context.arc(item.x, item.y, 23 * scale, 0, Math.PI * 2);
          context.stroke();
          context.strokeStyle = "rgba(166,66,36,.14)";
          context.beginPath();
          context.arc(item.x, item.y, 30 * scale, 0, Math.PI * 2);
          context.stroke();
          if (!reducedMotion && !host) {
            context.strokeStyle = `rgba(166,66,36,${0.4 * (1 - pulse)})`;
            context.beginPath();
            context.arc(
              item.x,
              item.y,
              (21 + 22 * pulse) * scale,
              0,
              Math.PI * 2,
            );
            context.stroke();
          }
        }
        context.beginPath();
        context.arc(item.x, item.y, radius, 0, Math.PI * 2);
        context.fillStyle = item.hub
          ? "#a64224"
          : item.glow
            ? "#a64224"
            : "#fffaf6";
        context.fill();
        context.lineWidth = 2 * scale;
        context.strokeStyle = "#a64224";
        context.stroke();
        if (item.hub) {
          context.fillStyle = "#fff";
          context.fillText(item.name, item.x, item.y + 0.5);
          return;
        }
        // A pale halo keeps the label legible where mesh lines cross it.
        context.lineWidth = 4 * scale;
        context.strokeStyle = "rgba(245,246,247,.92)";
        context.strokeText(item.name, item.x, item.y - radius - size * 0.8);
        context.fillStyle = "#2b2420";
        context.fillText(item.name, item.x, item.y - radius - size * 0.8);
      });
    }
    // Tells the poster beside the canvas that it can step aside.
    canvas.setAttribute("data-ready", "");
    // The hero's halo breathes, so it redraws about 25 times a second while the
    // canvas is on screen; offscreen or hidden, draw() returns before this line.
    if (!host && !reducedMotion && showLabels) {
      window.clearTimeout(pulseTimer);
      pulseTimer = window.setTimeout(schedule, 40);
    }
  };
  const schedule = () => {
    if (!disposed && !frame && !document.hidden)
      frame = window.requestAnimationFrame(draw);
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
    disposed = true;
    window.cancelAnimationFrame(frame);
    frame = 0;
    window.clearTimeout(pulseTimer);
    resizeObserver.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("blur", resetPointer);
    document.documentElement.removeEventListener("pointerleave", resetPointer);
    document.removeEventListener("visibilitychange", schedule);
  };
}
