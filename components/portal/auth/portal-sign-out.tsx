"use client";

import { useClerk } from "@clerk/nextjs";

type PortalSignOut = (options?: { redirectUrl?: string }) => Promise<void>;

export async function signOutOfPortal(
  signOut: PortalSignOut,
  redirectUrl: string,
): Promise<void> {
  await signOut({ redirectUrl });
}

export function PortalSignOutButton({
  children,
  className,
  redirectUrl = "/login",
}: {
  children: React.ReactNode;
  className?: string;
  redirectUrl?: string;
}): React.JSX.Element {
  const { signOut } = useClerk();

  return (
    <button
      className={className}
      onClick={() => void signOutOfPortal(signOut, redirectUrl)}
      type="button"
    >
      {children}
    </button>
  );
}
