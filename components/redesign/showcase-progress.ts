export type ShowcaseScrollState = {
  activeFeatureIndex: number;
  phoneProgress: number;
  progress: number;
};

export type ShowcaseLayoutState = {
  mobileShowcase: boolean;
  mobileVisualDisplay: "block" | "none";
  sectionMinHeight: "";
  spacerHeight: "0" | "90vh";
  stageDisplay: "block" | "none";
  stageGridTemplateColumns: "1fr" | "1fr 1fr";
  stickyHeight: "100svh" | "auto";
  stickyPosition: "sticky" | "static";
};

const MOBILE_SHOWCASE_BREAKPOINT = 940;
const PHONE_REVEAL_START = 0.18;
const PHONE_REVEAL_END = 0.68;

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;

  return Math.min(1, Math.max(0, value));
}

function getPhoneProgress(progress: number): number {
  const revealRange = PHONE_REVEAL_END - PHONE_REVEAL_START;

  return clampProgress((progress - PHONE_REVEAL_START) / revealRange);
}

function getActiveFeatureIndex(progress: number, featureCount: number): number {
  if (featureCount <= 0) return -1;

  return Math.min(featureCount - 1, Math.floor(progress * featureCount));
}

export function getShowcaseScrollState(
  rawProgress: number,
  featureCount: number,
): ShowcaseScrollState {
  const progress = clampProgress(rawProgress);

  return {
    activeFeatureIndex: getActiveFeatureIndex(progress, featureCount),
    phoneProgress: getPhoneProgress(progress),
    progress,
  };
}

export function getShowcaseLayoutState(
  viewportWidth: number,
): ShowcaseLayoutState {
  const mobileShowcase = viewportWidth < MOBILE_SHOWCASE_BREAKPOINT;

  return {
    mobileShowcase,
    mobileVisualDisplay: mobileShowcase ? "block" : "none",
    sectionMinHeight: "",
    spacerHeight: mobileShowcase ? "0" : "90vh",
    stageDisplay: mobileShowcase ? "none" : "block",
    stageGridTemplateColumns: mobileShowcase ? "1fr" : "1fr 1fr",
    stickyHeight: mobileShowcase ? "auto" : "100svh",
    stickyPosition: mobileShowcase ? "static" : "sticky",
  };
}
