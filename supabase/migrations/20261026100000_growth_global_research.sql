-- Global intake extends research storage only; it does not authorize sending.
alter type growth.corporate_type add value if not exists 'sole_trader';
alter type growth.corporate_type add value if not exists 'partnership';
alter type growth.corporate_type add value if not exists 'nonprofit';
alter type growth.corporate_type add value if not exists 'other';
alter type growth.corporate_type add value if not exists 'unknown';
alter type growth.lawful_basis add value if not exists 'research_only';

alter table growth.businesses
  add column country_code text not null default 'GB'
    check (country_code ~ '^[A-Z]{2}$'),
  drop constraint businesses_county_check,
  alter column county drop not null;

-- Existing registration numbers belong to the original GB-only campaign.
drop index growth.businesses_company_number_unique_idx;
create unique index businesses_country_company_number_unique_idx
  on growth.businesses (country_code, upper(regexp_replace(company_number, '\s+', '', 'g')))
  where company_number is not null;

create index businesses_website_host_idx
  on growth.businesses ((substring(lower(website_url) from '^https?://(?:www\.)?([^/:?#]+)')))
  where website_url is not null;

alter table growth.contacts
  alter column first_name drop not null,
  alter column last_name drop not null;
