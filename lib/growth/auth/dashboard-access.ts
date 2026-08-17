import { GROWTH_LOGIN_PATH } from "./routing";
import { FounderAuthorizationError } from "./require-founder";

type RedirectToLogin = (path: typeof GROWTH_LOGIN_PATH) => never;

export async function enforceFounderDashboardAccess<T>(
  authorizeFounder: () => Promise<T>,
  redirectToLogin: RedirectToLogin,
): Promise<T> {
  try {
    return await authorizeFounder();
  } catch (error) {
    if (error instanceof FounderAuthorizationError) {
      redirectToLogin(GROWTH_LOGIN_PATH);
    }

    throw error;
  }
}
