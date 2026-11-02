import type { useSignUp } from "@clerk/nextjs";

type InvitationSignUp = Pick<
  ReturnType<typeof useSignUp>["signUp"],
  "create" | "status"
> & {
  finalize: (options: {
    navigate: (context: {
      session: { currentTask?: unknown };
      decorateUrl: (url: string) => string;
    }) => Promise<void>;
  }) => Promise<{ error: unknown }>;
};

const replacedTicketMessage =
  "This invitation was replaced or is no longer valid. Use the most recent email from FSS, or ask your FSS contact for a new invitation.";
const expiredTicketMessage =
  "This invitation has expired. Ask your FSS contact for a new invitation.";

function clerkErrorCode(error: object): string | undefined {
  const errors: unknown = "errors" in error ? error.errors : undefined;
  const first: unknown = Array.isArray(errors) ? errors[0] : error;
  return first &&
    typeof first === "object" &&
    "code" in first &&
    typeof first.code === "string"
    ? first.code
    : undefined;
}

export function clerkErrorMessage(error: unknown, fallback: string): string {
  const code =
    error && typeof error === "object" ? clerkErrorCode(error) : undefined;
  if (code && /ticket|invitation/.test(code))
    return code.includes("expired")
      ? expiredTicketMessage
      : replacedTicketMessage;
  if (error instanceof Error)
    return error.message.includes("@") ? fallback : error.message;
  if (!error || typeof error !== "object") return fallback;
  const errors: unknown = "errors" in error ? error.errors : undefined;
  if (Array.isArray(errors)) {
    const first: unknown = errors[0];
    if (
      first &&
      typeof first === "object" &&
      "message" in first &&
      typeof first.message === "string"
    )
      return first.message.includes("@") ? fallback : first.message;
  }
  return fallback;
}

export function invitationAddressWithoutPersonalDetails(
  path: string,
  query: string,
): string {
  const params = new URLSearchParams(query);
  params.delete("name");
  params.delete("email");
  params.delete("decline_token");
  return params.size ? `${path}?${params}` : path;
}

export async function completeInvitationSignUp({
  signUp,
  ticket,
  name,
  password,
  claim,
  navigate,
}: {
  signUp: InvitationSignUp;
  ticket: string;
  name: string;
  password: string;
  claim: (name: string) => Promise<string>;
  navigate: (url: string) => void;
}): Promise<void> {
  const [firstName, ...rest] = name.trim().split(/\s+/);
  const result = await signUp.create({
    strategy: "ticket",
    ticket,
    password,
    firstName,
    ...(rest.length ? { lastName: rest.join(" ") } : {}),
  });
  if (result.error)
    throw new Error(
      clerkErrorMessage(
        result.error,
        "This invitation could not be accepted. If you already have an account, sign in below.",
      ),
    );
  if (signUp.status !== "complete")
    throw new Error(
      "Your account needs more information before it can be created.",
    );
  let navigationError: unknown;
  const finalized = await signUp.finalize({
    navigate: async ({ session, decorateUrl }) => {
      try {
        if (session?.currentTask)
          throw new Error(
            "Complete the remaining account verification before continuing.",
          );
        navigate(decorateUrl(await claim(name)));
      } catch (error) {
        // Let Clerk finish setting its active session so the user can retry.
        navigationError = error;
      }
    },
  });
  if (navigationError) throw navigationError;
  if (finalized.error)
    throw new Error(
      clerkErrorMessage(
        finalized.error,
        "Your account could not be activated.",
      ),
    );
}
