-- A client-visible, non-sequential reference supports safe follow-up without
-- disclosing provider identifiers or a record count.
alter table operations.offer_enquiries add column reference text;

update operations.offer_enquiries
set reference = 'FSS-ENQ-' || upper(replace(id::text, '-', ''))
where reference is null;

alter table operations.offer_enquiries
  alter column reference set not null,
  add constraint offer_enquiries_reference_key unique (reference),
  add constraint offer_enquiries_reference_format check (
    reference ~ '^FSS-ENQ-[A-F0-9]{32}$'
  );

create or replace function operations.create_offer_enquiry(
  org uuid,
  offer uuid,
  request_key uuid,
  enquiry_interest text,
  enquiry_context jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  result uuid;
  new_id uuid;
  uid uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
begin
  if current_setting('role', true) <> 'operations_portal'
    or not operations.portal_has_membership(org, array['owner','contributor'])
  then
    raise exception 'Portal access is unavailable.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from operations.offers o where o.id = offer and o.status = 'published'
  ) then
    raise exception 'Offer unavailable.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(org::text || uid::text || request_key::text, 13)
  );
  select id into result
  from operations.offer_enquiries
  where organisation_id = org and created_by = uid and idempotency_key = request_key;
  if result is not null then return result; end if;

  new_id := gen_random_uuid();
  insert into operations.offer_enquiries (
    id,
    organisation_id,
    offer_id,
    created_by,
    idempotency_key,
    interest,
    context,
    reference
  ) values (
    new_id,
    org,
    offer,
    uid,
    request_key,
    enquiry_interest,
    enquiry_context,
    'FSS-ENQ-' || upper(replace(new_id::text, '-', ''))
  ) returning id into result;
  return result;
end;
$$;

revoke all on function operations.create_offer_enquiry(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated, service_role, growth_app, operations_founder;
grant execute on function operations.create_offer_enquiry(uuid, uuid, uuid, text, jsonb)
  to operations_portal;
