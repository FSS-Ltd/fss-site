import { GROWTH_LOGIN_PATH } from "./routing";
import { FounderAuthorizationError } from "./require-founder";

type AuthorizeFounder = () => Promise<unknown>;
type RedirectToLogin = (path: typeof GROWTH_LOGIN_PATH) => never;

export async function enforceFounderDashboardAccess(
  authorizeFounder: AuthorizeFounder,
  redirectToLogin: RedirectToLogin,
): Promise<void> {
  try {
    await authorizeFounder();
  } catch (error) {
    if (error instanceof FounderAuthorizationError) {
      redirectToLogin(GROWTH_LOGIN_PATH);
    }

    throw error;
  }
}
