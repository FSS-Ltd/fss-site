export type MotionCapabilities = {
  animateParticles: boolean;
  showParticles: true;
  magnetic: boolean;
  scroll: boolean;
};

type MotionPreferences = {
  reducedMotion: boolean;
  finePointer: boolean;
};

type MagneticGeometry = {
  pointerX: number;
  pointerY: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

type ParticleDensityInput = {
  baseCount: number;
  width: number;
  height: number;
  finePointer: boolean;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function getMotionCapabilities({
  reducedMotion,
  finePointer,
}: MotionPreferences): MotionCapabilities {
  return {
    animateParticles: !reducedMotion,
    showParticles: true,
    magnetic: !reducedMotion && finePointer,
    scroll: !reducedMotion,
  };
}

export function getMagneticOffset({
  pointerX,
  pointerY,
  left,
  top,
  width,
  height,
}: MagneticGeometry) {
  const strength = 0.32;
  const x = (pointerX - (left + width / 2)) * strength;
  const y = (pointerY - (top + height / 2)) * strength;

  return {
    x: clamp(x, -width * 0.1, width * 0.1),
    y: clamp(y, -height * 0.18, height * 0.18),
  };
}

export function getScrollProgress(top: number, distance: number) {
  if (distance <= 0) return 0;
  return clamp(-top / distance, 0, 1);
}

export function getParticleNodeCount({
  baseCount,
  width,
  height,
  finePointer,
}: ParticleDensityInput) {
  const sizeMultiplier = width < 640 ? 0.36 : width < 940 ? 0.62 : 1;
  const pointerMultiplier = finePointer ? 1 : 0.55;
  const areaMultiplier = Math.min(1.2, (width * height) / (1280 * 720));

  return Math.max(
    10,
    Math.round(baseCount * sizeMultiplier * pointerMultiplier * areaMultiplier),
  );
}
