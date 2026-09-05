export type ExampleTheme =
  | "roof"
  | "estate"
  | "auto"
  | "accounts"
  | "plumbing"
  | "electrical"
  | "hospitality"
  | "landscape"
  | "supplies"
  | "equipment";
export type ExampleApproach =
  | "Cinematic experience"
  | "Search & authority"
  | "Editorial brand"
  | "Booking first";
export type SectorExample = {
  slug: string;
  name: string;
  sector: string;
  description: string;
  outcome: string;
  theme: ExampleTheme;
  approach: ExampleApproach;
  image: string;
};
