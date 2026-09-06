import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const developmentScriptSources =
  process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `script-src 'self' 'unsafe-inline'${developmentScriptSources} https://www.googletagmanager.com https://www.google-analytics.com`,
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const hstsHeader = {
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains",
};

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  experimental: {
    // Keep contact controls out of the public landing page's CSS payload.
    cssChunking: false,
  },
  serverExternalPackages: ["pdfkit"],
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return [
      {
        source: "/resources/sdk-integration-readiness-kit/:path*",
        has: [{ type: "host", value: "www.faithfulsoftware.dev" }],
        destination:
          "https://faithfulsoftware.dev/resources/software-project-readiness-kit/:path*",
        permanent: true,
      },
      {
        source: "/resources/technical-content-conversion-playbook/:path*",
        has: [{ type: "host", value: "www.faithfulsoftware.dev" }],
        destination:
          "https://faithfulsoftware.dev/resources/software-investment-framework/:path*",
        permanent: true,
      },
      {
        source: "/resources/sdk-integration-readiness-kit/:path*",
        destination: "/resources/software-project-readiness-kit/:path*",
        permanent: true,
      },
      {
        source: "/resources/technical-content-conversion-playbook/:path*",
        destination: "/resources/software-investment-framework/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.faithfulsoftware.dev" }],
        destination: "https://faithfulsoftware.dev/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/growth/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/resources/:slug/thank-you/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      },
      {
        source: "/preview/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/(.*)",
        has: [
          {
            type: "host",
            value: "(faithfulsoftware.dev|www.faithfulsoftware.dev)",
          },
        ],
        headers: [hstsHeader],
      },
    ];
  },
};

export default nextConfig;
