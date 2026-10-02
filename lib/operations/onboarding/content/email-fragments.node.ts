import * as nodeModule from "node:module";
import { resolve } from "node:path";
import { organisation } from "../../../seo/organisation";
import { packetAssets, type PacketImageId } from "../packet-editions";
import {
  getEmailArtwork,
  type EmailArtwork,
  type WelcomeEmailKind,
} from "../email-artwork";
import type { WelcomePackId } from "../welcome-pack-contract";

type EmailRuntime = Pick<typeof import("react"), "createElement"> &
  Pick<typeof import("react-dom/server.node"), "renderToStaticMarkup"> &
  Pick<typeof import("@react-email/button"), "Button"> &
  Pick<typeof import("@react-email/img"), "Img">;

// Namespace access preserves Node's resolver: webpack rewrites named createRequire calls.
// Email snapshots need the default Node React runtime, outside the RSC renderer aliases.
const nativeRequire = nodeModule.createRequire(
  resolve(process.cwd(), "package.json"),
);
let runtime: EmailRuntime | undefined;

function emailRuntime(): EmailRuntime {
  if (!runtime) {
    const react: typeof import("react") = nativeRequire("react");
    const renderer: typeof import("react-dom/server.node") = nativeRequire(
      "react-dom/server.node",
    );
    const button: typeof import("@react-email/button") = nativeRequire(
      "@react-email/button",
    );
    const image: typeof import("@react-email/img") =
      nativeRequire("@react-email/img");
    runtime = {
      createElement: react.createElement,
      renderToStaticMarkup: renderer.renderToStaticMarkup,
      Button: button.Button,
      Img: image.Img,
    };
  }
  return runtime;
}

export function emailImageHtml(imageId: PacketImageId): string {
  return imageHtml(packetAssets[imageId]);
}

export function emailArtworkHtml(
  edition: WelcomePackId,
  kind: WelcomeEmailKind,
): string {
  return imageHtml(getEmailArtwork(edition, kind), 280);
}

function imageHtml(asset: EmailArtwork, height = 400): string {
  const { createElement, renderToStaticMarkup, Img } = emailRuntime();
  const url = new URL(asset.src, organisation.url).href;
  return renderToStaticMarkup(
    createElement(Img, {
      src: url,
      alt: asset.alt,
      width: 640,
      height,
      fetchPriority: "low",
      style: {
        display: "block",
        width: "100%",
        maxWidth: "640px",
        height: "auto",
        border: 0,
        color: "#ffffff",
        fontFamily: "Arial,Helvetica,sans-serif",
        fontSize: "16px",
      },
    }),
  );
}

export interface EmailPrimaryAction {
  label: string;
  url: string;
}

export function emailActionHtml(action: EmailPrimaryAction): string {
  const { createElement, renderToStaticMarkup, Button } = emailRuntime();
  return renderToStaticMarkup(
    createElement(
      Button,
      {
        href: action.url,
        style: {
          backgroundColor: "#276b65",
          borderRadius: "6px",
          color: "#ffffff",
          padding: "16px 20px",
          fontSize: "16px",
          fontWeight: 600,
          textDecoration: "none",
          lineHeight: "1.4",
        },
      },
      action.label,
    ),
  );
}
