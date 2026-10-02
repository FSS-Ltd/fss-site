import type { WelcomePackId } from "./welcome-pack-contract";

export const welcomeEmailKinds = [
  "welcome",
  "proposal",
  "activation",
  "thank_you",
] as const;
export type WelcomeEmailKind = (typeof welcomeEmailKinds)[number];
export interface EmailArtwork {
  src: string;
  alt: string;
}

const emailArtwork: Readonly<
  Record<WelcomePackId, Readonly<Record<WelcomeEmailKind, EmailArtwork>>>
> = {
  website_build: {
    welcome: {
      src: "/images/welcome/website-build-welcome-v1.png",
      alt: "Website structure and content planning",
    },
    proposal: {
      src: "/images/welcome/website-build-proposal-v1.png",
      alt: "Website scope, review and approval",
    },
    activation: {
      src: "/images/welcome/website-build-activation-v1.png",
      alt: "Secure access to website reviews and project files",
    },
    thank_you: {
      src: "/images/welcome/website-build-thank-you-v1.png",
      alt: "Website project inputs and the next review",
    },
  },
  website_seo: {
    welcome: {
      src: "/images/welcome/website-seo-welcome-v1.png",
      alt: "Search discovery and website planning",
    },
    proposal: {
      src: "/images/welcome/website-seo-proposal-v1.png",
      alt: "Website and SEO scope mapped to review points",
    },
    activation: {
      src: "/images/welcome/website-seo-activation-v1.png",
      alt: "Authorised access to search and analytics",
    },
    thank_you: {
      src: "/images/welcome/website-seo-thank-you-v1.png",
      alt: "SEO baseline inputs and reporting preparation",
    },
  },
  systems_portal: {
    welcome: {
      src: "/images/welcome/systems-portal-welcome-v1.png",
      alt: "People, roles and connected portal workflows",
    },
    proposal: {
      src: "/images/welcome/systems-portal-proposal-v1.png",
      alt: "Portal requirements, permissions and review",
    },
    activation: {
      src: "/images/welcome/systems-portal-activation-v1.png",
      alt: "Verified identity and approved portal permissions",
    },
    thank_you: {
      src: "/images/welcome/systems-portal-thank-you-v1.png",
      alt: "Portal data preparation and workflow review",
    },
  },
};

export function getEmailArtwork(
  edition: WelcomePackId,
  kind: WelcomeEmailKind,
): EmailArtwork {
  return emailArtwork[edition][kind];
}
