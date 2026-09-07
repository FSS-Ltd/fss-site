import { NextResponse, type NextRequest } from "next/server";
import { resolveSiteUrl } from "../../config/site-url";
import { createPortalAuthClient } from "./client";
import { portalAuthConfigured, readPortalAuthConfig } from "./configuration";
function preventPortalCaching(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export async function refreshPortalSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = preventPortalCaching(NextResponse.next({ request }));
  if (!portalAuthConfigured()) return response;
  try {
    const client = createPortalAuthClient(
      readPortalAuthConfig(),
      {
        getAll: () => request.cookies.getAll(),
        setAll: (updates, headers) => {
          for (const { name, value } of updates)
            request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const [name, value] of Object.entries(headers))
            response.headers.set(name, value);
          for (const { name, value, options } of updates)
            response.cookies.set(name, value, options);
          preventPortalCaching(response);
        },
      },
      resolveSiteUrl(),
    );
    // Refresh only. Every protected page/operation verifies getUser and live membership.
    await client.auth.getClaims();
    return response;
  } catch {
    return preventPortalCaching(
      NextResponse.json(
        { message: "Client portal is temporarily unavailable." },
        { status: 503 },
      ),
    );
  }
}
