const FALLBACK_SITE_URL = "https://faithfulsoftwaresolutions.co.uk";

function normalizeUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return FALLBACK_SITE_URL;
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function getDeploymentContext(env: NodeJS.ProcessEnv = process.env): string {
  return env.CONTEXT || env.NODE_ENV || "development";
}

export function isPreviewDeployment(env: NodeJS.ProcessEnv = process.env): boolean {
  const context = getDeploymentContext(env);
  return context === "deploy-preview" || context === "branch-deploy";
}

export function resolveSiteUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configuredUrl = env.NEXT_PUBLIC_SITE_URL;
  const netlifyPreviewUrl = env.DEPLOY_PRIME_URL;
  const netlifySiteUrl = env.URL;

  if (configuredUrl) {
    return normalizeUrl(configuredUrl);
  }

  if (netlifyPreviewUrl) {
    return normalizeUrl(netlifyPreviewUrl);
  }

  if (netlifySiteUrl) {
    return normalizeUrl(netlifySiteUrl);
  }

  return FALLBACK_SITE_URL;
}
