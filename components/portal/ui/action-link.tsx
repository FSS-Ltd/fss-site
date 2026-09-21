import type { AnchorHTMLAttributes } from "react";
import { portalButtonClassName, type PortalButtonVariant } from "./button";

export type PortalActionLinkProps = Readonly<
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: PortalButtonVariant;
  }
>;

/**
 * An anchor that shares the Portal button treatment while retaining native
 * link semantics for routes and retained downloads.
 */
export function PortalActionLink({
  children,
  className,
  variant = "primary",
  ...props
}: PortalActionLinkProps): React.JSX.Element {
  return (
    <a {...props} className={portalButtonClassName(variant, className)}>
      {children}
    </a>
  );
}
