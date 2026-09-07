import type { NextMiddleware } from "next/server";
type Effect = () => ReturnType<NextMiddleware>;
export function dispatchPortalProxy(
  pathname: string,
  founder: Effect,
  portal: Effect,
): ReturnType<Effect> {
  return pathname === "/growth" || pathname.startsWith("/growth/")
    ? founder()
    : portal();
}
