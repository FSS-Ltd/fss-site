export type BillingEnvironment = Readonly<Record<string, string | undefined>>;

export type BillingMode = "test" | "live";

export type BillingConfiguration =
  | { enabled: false }
  | {
      enabled: true;
      provider: "stripe";
      mode: BillingMode;
      accountId: string;
      secretKey: string;
    };
