import { getMagneticOffset } from "./motion-values";

function isDisabled(element: HTMLElement) {
  return (
    element.matches(":disabled") ||
    element.getAttribute("aria-disabled") === "true"
  );
}

export function bindMagneticControls(scope: ParentNode) {
  const cleanups: Array<() => void> = [];

  scope.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((control) => {
    const label = control.querySelector<HTMLElement>("[data-mag-label]");
    let frame = 0;
    let pointer: PointerEvent | null = null;

    const reset = () => {
      window.cancelAnimationFrame(frame);
      pointer = null;
      control.style.removeProperty("--magnetic-x");
      control.style.removeProperty("--magnetic-y");
      label?.style.removeProperty("--magnetic-label-x");
      label?.style.removeProperty("--magnetic-label-y");
    };

    const render = () => {
      frame = 0;
      if (!pointer || isDisabled(control)) {
        reset();
        return;
      }

      const rect = control.getBoundingClientRect();
      const offset = getMagneticOffset({
        pointerX: pointer.clientX,
        pointerY: pointer.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
      control.style.setProperty("--magnetic-x", `${offset.x}px`);
      control.style.setProperty("--magnetic-y", `${offset.y}px`);
      label?.style.setProperty("--magnetic-label-x", `${offset.x * 0.35}px`);
      label?.style.setProperty("--magnetic-label-y", `${offset.y * 0.35}px`);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer = event;
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    control.addEventListener("pointermove", onPointerMove);
    control.addEventListener("pointerleave", reset);
    control.addEventListener("blur", reset);
    cleanups.push(() => {
      window.cancelAnimationFrame(frame);
      control.removeEventListener("pointermove", onPointerMove);
      control.removeEventListener("pointerleave", reset);
      control.removeEventListener("blur", reset);
      reset();
    });
  });

  return () => cleanups.forEach((cleanup) => cleanup());
}
