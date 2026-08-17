import type { ReactNode } from "react";

import type { IntegrationHealth } from "@/lib/growth/dashboard/view-models";

export type FounderShellIdentity = {
  email: string;
};

export type ShellNavigationProps = {
  founder: FounderShellIdentity;
  integrations: readonly IntegrationHealth[];
  pathname: string;
};

export type GrowthShellFrameProps = ShellNavigationProps & {
  children: ReactNode;
};
