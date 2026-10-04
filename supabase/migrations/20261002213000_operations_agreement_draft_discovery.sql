-- Discover staff working drafts without granting direct access to their contents.
-- Reuses the existing organisation/updated_at/id index and changes no saved data.
create function operations.list_agreement_builder_drafts(
  target_organisation uuid,
  page_number integer default 1
)
returns table(id uuid, title text, step text, version integer, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = '' as $$
begin
  perform operations.assert_active_staff_membership();
  if target_organisation is null or page_number is null
    or page_number < 1 or page_number > 10000 then
    raise exception 'Agreement draft page is invalid.' using errcode = '22023';
  end if;

  return query
    select draft.id, nullif(btrim(draft.content #>> '{agreement,title}'), ''),
      draft.step, draft.version, draft.updated_at
    from operations.agreement_builder_drafts as draft
    where draft.organisation_id = target_organisation
      and draft.finalised_at is null
    order by draft.updated_at desc, draft.id
    limit 26 offset (page_number - 1) * 25;
end;
$$;

revoke all on function operations.list_agreement_builder_drafts(uuid, integer)
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_billing_worker, operations_signing_worker, operations_onboarding_worker;
grant execute on function operations.list_agreement_builder_drafts(uuid, integer)
  to operations_founder;
