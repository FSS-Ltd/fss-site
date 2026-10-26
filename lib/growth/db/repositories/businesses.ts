import type { GrowthQueryExecutor } from "../types";

export type CorporateStatus = "active" | "inactive" | "uncertain";

export type BusinessIdentity = {
  id: string;
  legalName: string;
  companyNumber: string | null;
  corporateStatus: CorporateStatus;
  version: number;
};

export async function findBusinessIdentityByCompanyNumber(
  db: GrowthQueryExecutor,
  companyNumber: string,
  countryCode = "GB",
): Promise<BusinessIdentity | null> {
  const normalisedCompanyNumber = companyNumber
    .replace(/\s+/g, "")
    .toUpperCase();
  const rows = await db<BusinessIdentity[]>`
    select
      b.id,
      b.legal_name as "legalName",
      b.company_number as "companyNumber",
      b.corporate_status as "corporateStatus",
      b.version
    from growth.businesses b
    where b.country_code = ${countryCode.trim().toUpperCase()} and upper(regexp_replace(b.company_number, '\s+', '', 'g')) = ${normalisedCompanyNumber}
    limit 1
  `;

  return rows[0] ?? null;
}
