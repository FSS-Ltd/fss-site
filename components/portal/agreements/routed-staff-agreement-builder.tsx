"use client";

import { useRouter } from "next/navigation";
import {
  StaffAgreementBuilder,
  type AgreementEngagementChoice,
} from "./staff-agreement-builder";
import type { AgreementBuilderDraft } from "@/lib/operations/agreements/builder-draft-service";

export function RoutedStaffAgreementBuilder(
  props: Readonly<{
    agreementListHref: string;
    baseHref: string;
    commandEndpoint: string;
    engagementHref: string;
    engagements: readonly AgreementEngagementChoice[];
    initialDraft: AgreementBuilderDraft | null;
    organisationName: string;
  }>,
): React.JSX.Element {
  const router = useRouter();

  return (
    <StaffAgreementBuilder
      {...props}
      onNavigate={(href) => router.push(href)}
    />
  );
}
