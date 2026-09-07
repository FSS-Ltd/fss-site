export type ActivationEvidence = {
  effectiveDate: string;
  assetsReady: boolean;
  deposit: {
    amountPence: string;
    verifiedDate: string;
    reference: string;
  } | null;
};
export type ServiceInstance = {
  lineNumber: number;
  effectiveDate: string;
  endDate: string | null;
  status: "active";
};
