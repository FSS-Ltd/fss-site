import { authorityPages } from "./authority";
import { guidePages } from "./guides";
import { servicePages } from "./services";

export const commercialPages = {
  ...authorityPages,
  ...servicePages,
  ...guidePages,
};
