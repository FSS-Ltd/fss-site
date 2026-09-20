type Environment = Readonly<Record<string, string | undefined>>;

const runtimeEnvironment: Environment = {
  NODE_ENV: process.env.NODE_ENV,
  OPERATIONS_PORTAL_PREFIX_FREE_ENABLED:
    process.env.OPERATIONS_PORTAL_PREFIX_FREE_ENABLED,
  OPERATIONS_FSS_STUDIO_ENABLED: process.env.OPERATIONS_FSS_STUDIO_ENABLED,
  OPERATIONS_GROWTH_OPERATIONS_CUTOVER_ENABLED:
    process.env.OPERATIONS_GROWTH_OPERATIONS_CUTOVER_ENABLED,
};

function deployedEnvironment(env: Environment): boolean {
  return env.NODE_ENV === "production";
}

/**
 * Keep local development and automated tests on the current routes while
 * requiring an explicit production deployment decision for the new hostname.
 */
export function prefixFreePortalEnabled(
  env: Environment = runtimeEnvironment,
): boolean {
  return (
    !deployedEnvironment(env) ||
    env.OPERATIONS_PORTAL_PREFIX_FREE_ENABLED === "true"
  );
}

/**
 * FSS Studio is separately gated so a portal routing rollout never grants
 * access to staff operations before the founder has completed the staff setup.
 */
export function fssStudioEnabled(
  env: Environment = runtimeEnvironment,
): boolean {
  return (
    !deployedEnvironment(env) || env.OPERATIONS_FSS_STUDIO_ENABLED === "true"
  );
}

/**
 * Retire the legacy Growth Operations pages and endpoints only after Studio
 * itself is available. Turning either flag off restores the legacy surface.
 */
export function growthOperationsCutoverEnabled(
  env: Environment = runtimeEnvironment,
): boolean {
  return (
    fssStudioEnabled(env) &&
    env.OPERATIONS_GROWTH_OPERATIONS_CUTOVER_ENABLED === "true"
  );
}
