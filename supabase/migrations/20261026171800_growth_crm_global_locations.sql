-- Existing research records remain UK records; manual CRM capture supports any country.
alter table growth.businesses add column country_code text not null default 'GB'
  check (country_code ~ '^[A-Z]{2}$');
alter table growth.businesses drop constraint businesses_county_check;
alter table growth.businesses alter column county drop not null;

-- Registration numbers are unique within a country, not across jurisdictions.
drop index growth.businesses_company_number_unique_idx;
create unique index businesses_company_number_unique_idx
  on growth.businesses(country_code, upper(regexp_replace(company_number, '\s+', '', 'g')))
  where company_number is not null;
