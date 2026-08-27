import {
  type ProspectPreviewComposition,
  validateProspectPreviewComposition,
} from "./types";

export function getCompositionExportName(slug: string): string {
  const parts = slug.split("-");
  const [first, ...rest] = parts;
  if (!first) throw new TypeError("Prospect preview slug cannot be empty.");

  return `${first}${rest.map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`).join("")}Composition`;
}

export function serializeGeneratedComposition(
  value: ProspectPreviewComposition,
): string {
  const composition = validateProspectPreviewComposition(value);
  const identifier = getCompositionExportName(composition.slug);

  return [
    'import type { ProspectPreviewComposition } from "../types";',
    "",
    `export const ${identifier} = ${JSON.stringify(composition, null, 2)} as const satisfies ProspectPreviewComposition;`,
    "",
  ].join("\n");
}
