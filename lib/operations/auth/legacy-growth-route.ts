import { growthOperationsCutoverEnabled } from "./release-flags";

/** Hide retired founder-only workflow endpoints once Studio owns them. */
export function retiredGrowthOperationsResponse(
  retired: boolean = growthOperationsCutoverEnabled(),
): Response | null {
  if (!retired) return null;
  return new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}
