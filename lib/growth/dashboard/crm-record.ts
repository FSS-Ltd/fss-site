import type { GrowthQueryExecutor } from "../db/types";

export type CrmRecord = {
  prospectId: string;
  prospectVersion: number;
  status: string;
  opportunitySummary: string;
  recommendedOffer: string;
  oneOffMinPence: number;
  oneOffMaxPence: number;
  monthlyPence: number;
  business: {
    version: number;
    legalName: string;
    tradingName: string | null;
    sector: string;
    locality: string;
    countryCode: string;
    websiteUrl: string | null;
  };
  contact: {
    version: number;
    firstName: string | null;
    lastName: string | null;
    roleTitle: string | null;
    email: string;
  } | null;
  engagement: {
    id: string;
    version: number;
    stage: string;
    name: string;
    oneOffValuePence: number;
    monthlyValuePence: number;
    probabilityPercent: number;
    expectedCloseDate: string | null;
  } | null;
};
export async function getCrmRecord(
  db: GrowthQueryExecutor,
  prospectId: string,
): Promise<CrmRecord | null> {
  const [row] = await db<
    {
      prospectId: string;
      prospectVersion: number;
      status: string;
      opportunitySummary: string;
      recommendedOffer: string;
      oneOffMinPence: number;
      oneOffMaxPence: number;
      monthlyPence: number;
      businessVersion: number;
      legalName: string;
      tradingName: string | null;
      sector: string;
      locality: string;
      countryCode: string;
      websiteUrl: string | null;
      contactVersion: number | null;
      firstName: string | null;
      lastName: string | null;
      roleTitle: string | null;
      email: string | null;
      engagementId: string | null;
      engagementVersion: number | null;
      stage: string | null;
      name: string | null;
      oneOffValuePence: number;
      monthlyValuePence: number;
      probabilityPercent: number;
      expectedCloseDate: string | null;
    }[]
  >`select p.id as "prospectId",p.version as "prospectVersion",p.status,p.opportunity_summary as "opportunitySummary",p.recommended_offer as "recommendedOffer",
  p.estimated_one_off_min_pence as "oneOffMinPence",p.estimated_one_off_max_pence as "oneOffMaxPence",p.estimated_monthly_pence as "monthlyPence",
  b.version as "businessVersion",b.legal_name as "legalName",b.trading_name as "tradingName",b.sector,b.locality,b.country_code as "countryCode",b.website_url as "websiteUrl",
  c.version as "contactVersion",c.first_name as "firstName",c.last_name as "lastName",c.role_title as "roleTitle",c.email,
  de.id as "engagementId",de.version as "engagementVersion",de.stage,de.name,coalesce(de.one_off_value_pence,0) as "oneOffValuePence",coalesce(de.monthly_value_pence,0) as "monthlyValuePence",de.probability_percent as "probabilityPercent",de.expected_close_date::text as "expectedCloseDate"
  from growth.prospects p join growth.businesses b on b.id=p.business_id left join growth.contacts c on c.id=p.primary_contact_id left join growth.delivery_engagements de on de.prospect_id=p.id where p.id=${prospectId} limit 1`;
  if (!row) return null;
  return {
    prospectId: row.prospectId,
    prospectVersion: row.prospectVersion,
    status: row.status,
    opportunitySummary: row.opportunitySummary,
    recommendedOffer: row.recommendedOffer,
    oneOffMinPence: row.oneOffMinPence,
    oneOffMaxPence: row.oneOffMaxPence,
    monthlyPence: row.monthlyPence,
    business: {
      version: row.businessVersion,
      legalName: row.legalName,
      tradingName: row.tradingName,
      sector: row.sector,
      locality: row.locality,
      countryCode: row.countryCode,
      websiteUrl: row.websiteUrl,
    },
    contact:
      row.email && row.contactVersion
        ? {
            version: row.contactVersion,
            firstName: row.firstName,
            lastName: row.lastName,
            roleTitle: row.roleTitle,
            email: row.email,
          }
        : null,
    engagement:
      row.engagementId && row.engagementVersion && row.stage && row.name
        ? {
            id: row.engagementId,
            version: row.engagementVersion,
            stage: row.stage,
            name: row.name,
            oneOffValuePence: row.oneOffValuePence,
            monthlyValuePence: row.monthlyValuePence,
            probabilityPercent: row.probabilityPercent,
            expectedCloseDate: row.expectedCloseDate,
          }
        : null,
  };
}
