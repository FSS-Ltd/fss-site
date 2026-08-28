import { FounderAuthorizationError } from "./require-founder";

export async function enforceFounderPrivatePreviewAccess<T>(
  authorizeFounder: () => Promise<T>,
  hidePreview: () => never,
): Promise<T> {
  try {
    return await authorizeFounder();
  } catch (error) {
    if (error instanceof FounderAuthorizationError) {
      hidePreview();
    }

    throw error;
  }
}
