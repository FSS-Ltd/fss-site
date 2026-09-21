"use client";

import { useState, type FormEvent } from "react";
import {
  Notice,
  PageHeader,
  PortalActionLink,
  PortalButton,
  PortalCard,
  PortalField,
} from "@/components/portal/ui";
import type { PortalProfile } from "@/lib/operations/auth/user-profile";
import { hasPortalCapability } from "@/lib/operations/auth/permissions";
import { portalPath } from "@/lib/operations/auth/portal-url";

export function ClientProfilePreferences({
  notificationPreferences,
  organisationId,
  profile,
}: {
  notificationPreferences?: React.ReactNode;
  organisationId: string;
  profile: PortalProfile;
}): React.JSX.Element {
  const canManageProfile = hasPortalCapability(profile.role, "settings.manage");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const displayName = String(
        new FormData(event.currentTarget).get("displayName") ?? "",
      );
      const response = await fetch("/api/portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, organisationId }),
      });
      if (!response.ok) throw new Error();
      setMessage({ text: "Profile saved.", tone: "success" });
    } catch {
      setMessage({
        text: "We could not save your profile. Please try again.",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { href: portalPath("/portal"), label: "Your workspace" },
          { label: "Settings" },
        ]}
        description={`Your profile for ${profile.organisationName}.`}
        eyebrow="Workspace settings"
        title="Settings"
      />
      <Notice tone="info">
        Essential account messages remain enabled for security, access, and
        service updates.
      </Notice>
      <PortalCard title="Your profile">
        <form onSubmit={save} aria-busy={pending}>
          <PortalField label="Your name" required>
            <input
              defaultValue={profile.displayName}
              disabled={pending || !canManageProfile}
              maxLength={200}
              name="displayName"
              readOnly={!canManageProfile}
            />
          </PortalField>
          <PortalField label="Verified email">
            <input defaultValue={profile.email} readOnly type="email" />
          </PortalField>
          <p>Organisation timezone: {profile.timezone}</p>
          {canManageProfile ? (
            <PortalButton loading={pending} type="submit">
              Save profile
            </PortalButton>
          ) : (
            <Notice tone="info">
              Your profile is view-only in this workspace. Ask an organisation
              owner to make a change.
            </Notice>
          )}
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        </form>
      </PortalCard>
      {notificationPreferences ? (
        <PortalCard title="Notifications">{notificationPreferences}</PortalCard>
      ) : null}
      <PortalActionLink
        href={`${portalPath("/portal/settings/team")}?${new URLSearchParams({ organisationId }).toString()}`}
        variant="secondary"
      >
        Manage workspace team
      </PortalActionLink>
    </div>
  );
}
