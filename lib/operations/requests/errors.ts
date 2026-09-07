import { PortalAccessDenied } from "../auth/types";
import { RequestConflict, RequestValidationError } from "./types";
export function translateRequestError(error: unknown): never {
  if (error && typeof error === "object" && "code" in error) {
    if (error.code === "40001") throw new RequestConflict();
    if (error.code === "42501") throw new PortalAccessDenied();
    if (
      error.code === "P0001" ||
      error.code === "23514" ||
      error.code === "23503"
    )
      throw new RequestValidationError(
        "The request could not be saved. Check its scope, evidence and current workflow state.",
      );
  }
  throw error;
}
