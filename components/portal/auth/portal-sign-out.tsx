"use client";

import { SignOutButton } from "@clerk/nextjs";

export function PortalSignOutButton({
  children,
  className,
  redirectUrl = "/login",
}: {
  children: React.ReactNode;
  className?: string;
  redirectUrl?: string;
}): React.JSX.Element {
  return (
    <SignOutButton redirectUrl={redirectUrl}>
      <button className={className} type="button">
        {children}
      </button>
    </SignOutButton>
  );
}
