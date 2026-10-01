import { z } from "zod";

export const packetSectionIds = [
  "welcome",
  "project",
  "services",
  "process",
  "timeline",
  "responsibilities",
  "deliverables",
  "communication",
  "next_steps",
] as const;
export const packetLayouts = [
  "image_top",
  "image_left",
  "image_right",
  "process",
  "timeline",
] as const;
export const packetImageIds = [
  "human_craft",
  "workflow",
  "mission_systems",
  "community_portal",
] as const;
export type PacketSectionId = (typeof packetSectionIds)[number];
export type PacketLayout = (typeof packetLayouts)[number];
export type PacketImageId = (typeof packetImageIds)[number];

export const packetAssets: Readonly<
  Record<PacketImageId, { src: string; alt: string }>
> = {
  human_craft: {
    src: "/images/editorial/about-human-craft-v1.webp",
    alt: "Thoughtful work and human craft",
  },
  workflow: {
    src: "/images/editorial/services-workflow-v1.webp",
    alt: "Connected steps in a delivery workflow",
  },
  mission_systems: {
    src: "/images/editorial/home-mission-systems-v1.webp",
    alt: "Purposeful systems for everyday work",
  },
  community_portal: {
    src: "/images/editorial/community-app-concept-v1.webp",
    alt: "A connected client portal",
  },
};
export const packetPageMetadataShape = {
  sectionId: z.enum(packetSectionIds).optional(),
  layout: z.enum(packetLayouts).optional(),
  imageId: z.enum(packetImageIds).optional(),
};

export function validatePacketPages(
  value: {
    rendererVersion?: 2;
    edition?: string;
    pages: {
      sectionId?: PacketSectionId;
      layout?: PacketLayout;
      imageId?: PacketImageId;
    }[];
  },
  context: z.RefinementCtx,
  legacyRange: readonly [number, number],
  pagesPath: "pages" | "guide" = "pages",
): void {
  if (value.rendererVersion !== 2) {
    if (
      value.pages.length < legacyRange[0] ||
      value.pages.length > legacyRange[1]
    ) {
      context.addIssue({
        code: "custom",
        path: [pagesPath],
        message: `Legacy welcome guides require ${legacyRange[0]}–${legacyRange[1]} sections.`,
      });
    }
    if (
      value.edition ||
      value.pages.some((page) => page.sectionId || page.layout || page.imageId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Packet metadata requires renderer version 2.",
      });
    }
    return;
  }
  if (!value.edition)
    context.addIssue({
      code: "custom",
      path: ["edition"],
      message: "Select a packet edition.",
    });
  if (value.pages.length !== 9)
    context.addIssue({
      code: "custom",
      path: [pagesPath],
      message: "Designed welcome packets require nine sections plus the cover.",
    });
  value.pages.forEach((page, index) => {
    if (
      page.sectionId !== packetSectionIds[index] ||
      !page.layout ||
      !page.imageId
    ) {
      context.addIssue({
        code: "custom",
        path: [pagesPath, index],
        message:
          "Use the ordered packet section, layout and approved image metadata.",
      });
    }
  });
}
