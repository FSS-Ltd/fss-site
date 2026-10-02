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
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://www.googletagmanager.com https://www.google-analytics.com https://img.clerk.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `script-src 'self' 'unsafe-inline'${developmentScriptSources} https://www.googletagmanager.com https://www.google-analytics.com https://clerk.faithfulsoftware.dev https://challenges.cloudflare.com https://*.protect.clerk.com`,
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://clerk.faithfulsoftware.dev https://*.protect.clerk.com:*",
  "worker-src 'self' blob:",
  "frame-src 'self' blob: https://challenges.cloudflare.com https://*.protect.clerk.com",
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

const emailRuntimeTraceFiles = [
  "node_modules/react/**/*",
  "node_modules/react-dom/**/*",
  "node_modules/@react-email/button/**/*",
  "node_modules/@react-email/img/**/*",
];

const nextConfig: NextConfig = {
  // Isolate agreement browser fixtures from an active development server.
  ...(process.env.FSS_AGREEMENT_TESTS_ENABLED === "true"
    ? { distDir: ".next/agreement-tests" }
    : {}),
  // The local screenshot runner uses 127.0.0.1 rather than localhost. This
  // development-only allow-list keeps HMR requests inside the test origin.
  allowedDevOrigins: ["127.0.0.1"],
  ...(process.env.FSS_VISUAL_TESTS_ENABLED === "true"
    ? { devIndicators: false }
    : {}),
  experimental: {
    // Keep contact controls out of the public landing page's CSS payload.
    cssChunking: false,
  },
  serverExternalPackages: ["pdfkit"],
  // Native synchronous email rendering must be retained in server deployments.
  outputFileTracingIncludes: {
    "/api/portal/admin/clients/**/journey": emailRuntimeTraceFiles,
    "/api/growth/operations/clients/**/journey": emailRuntimeTraceFiles,
    "/api/cron/operations-dispatch": emailRuntimeTraceFiles,
  },
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
