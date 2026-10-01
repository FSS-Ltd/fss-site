"use client";

import { useRouter } from "next/navigation";
import { EngagementForm } from "./engagement-form";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof EngagementForm>, "onComplete"> & {
  returnBaseHref: string;
};

export function RoutedEngagementForm({
  returnBaseHref,
  ...props
}: Props): React.JSX.Element {
  const router = useRouter();
  return (
    <EngagementForm
      {...props}
      onComplete={({ draftId }) => {
        const destination = new URL(returnBaseHref, window.location.origin);
        destination.searchParams.set("draftId", draftId);
        destination.searchParams.set("step", "scope");
        router.push(`${destination.pathname}${destination.search}`);
      }}
    />
  );
}
