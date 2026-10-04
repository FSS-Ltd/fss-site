const FALLBACK_SITE_URL = "https://faithfulsoftware.dev";

type SiteEnvironment = Readonly<Record<string, string | undefined>>;

function normalizeUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return FALLBACK_SITE_URL;
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function getDeploymentContext(
  env: SiteEnvironment = process.env,
): string {
  return env.VERCEL_ENV || env.NODE_ENV || "development";
}

export function isPreviewDeployment(
  env: SiteEnvironment = process.env,
): boolean {
  return getDeploymentContext(env) === "preview";
}

export function resolveSiteUrl(env: SiteEnvironment = process.env): string {
  const configuredUrl = env.NEXT_PUBLIC_SITE_URL;
  const vercelDeploymentUrl = env.VERCEL_URL;

  if (configuredUrl) {
    return normalizeUrl(configuredUrl);
  }

  if (vercelDeploymentUrl) {
    return normalizeUrl(`https://${vercelDeploymentUrl}`);
  }

  return FALLBACK_SITE_URL;
}

export function resolveAllowedSiteOrigins(
  env: SiteEnvironment = process.env,
): readonly string[] {
  const canonicalOrigin = new URL(resolveSiteUrl(env)).origin;
  const previewDeploymentUrls = [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url));

  if (!isPreviewDeployment(env) || previewDeploymentUrls.length === 0) {
    return [canonicalOrigin];
  }

  return [
    ...new Set([
      canonicalOrigin,
      ...previewDeploymentUrls.map(
        (deploymentUrl) => new URL(`https://${deploymentUrl}`).origin,
      ),
    ]),
  ];
}
