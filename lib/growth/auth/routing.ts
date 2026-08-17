export const GROWTH_HOME_PATH = "/growth" as const;
export const GROWTH_LOGIN_PATH = "/growth/login" as const;
export const GROWTH_CALLBACK_COOKIE = "growth.callback_path" as const;
export const GROWTH_COOKIE_PATH = "/growth" as const;

const MAX_CALLBACK_PATH_LENGTH = 1_024;

type SearchParamValue = string | string[] | undefined;
type GrowthCallbackCookieStore = {
  delete(options: {
    name: typeof GROWTH_CALLBACK_COOKIE;
    path: typeof GROWTH_COOKIE_PATH;
  }): unknown;
};

export function deleteGrowthCallbackCookie(
  cookieStore: GrowthCallbackCookieStore,
): void {
  cookieStore.delete({
    name: GROWTH_CALLBACK_COOKIE,
    path: GROWTH_COOKIE_PATH,
  });
}

export function isGrowthLoginPath(pathname: string): boolean {
  return pathname === GROWTH_LOGIN_PATH || pathname === `${GROWTH_LOGIN_PATH}/`;
}

export function resolveGrowthCallbackPath(value: SearchParamValue): string {
  if (
    typeof value !== "string" ||
    value.length > MAX_CALLBACK_PATH_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return GROWTH_HOME_PATH;
  }

  try {
    const baseUrl = new URL("https://growth.invalid");
    const callbackUrl = new URL(value, baseUrl);
    const isGrowthPath =
      callbackUrl.pathname === GROWTH_HOME_PATH ||
      callbackUrl.pathname.startsWith(`${GROWTH_HOME_PATH}/`);

    if (
      callbackUrl.origin !== baseUrl.origin ||
      !isGrowthPath ||
      isGrowthLoginPath(callbackUrl.pathname)
    ) {
      return GROWTH_HOME_PATH;
    }

    return `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`;
  } catch {
    return GROWTH_HOME_PATH;
  }
}
