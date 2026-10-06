type InvitationContext = Readonly<{
  ticket: string;
  name: string;
  email: string;
  clerkStatus: string | null;
  declineToken?: string | null;
}>;

export async function switchInvitationAccount(
  activationPath: string,
  invitation: InvitationContext,
  signOut: (afterSignOut: () => void) => Promise<void>,
  reload: (url: string) => void,
): Promise<void> {
  if (!["/activate", "/portal/activate"].includes(activationPath))
    throw new Error("The invitation could not be reopened.");
  const query = new URLSearchParams({ __clerk_ticket: invitation.ticket });
  if (invitation.name) query.set("name", invitation.name);
  if (invitation.email) query.set("email", invitation.email);
  if (invitation.clerkStatus)
    query.set("__clerk_status", invitation.clerkStatus);
  if (invitation.declineToken)
    query.set("decline_token", invitation.declineToken);
  // Suppress Clerk's same-route SPA navigation, which keeps pending form state.
  await signOut(() => undefined);
  reload(`${activationPath}?${query}`);
}
