-- Publication closes the staff working draft in the same transaction as the offer.
alter table operations.agreement_builder_drafts add column published_offer_id uuid references operations.commercial_offers(id);
alter table operations.agreement_builder_drafts drop constraint agreement_builder_drafts_check;
alter table operations.agreement_builder_drafts add constraint agreement_builder_drafts_completion_check check (
  (finalised_at is null and finalised_agreement_id is null and published_offer_id is null)
  or (finalised_at is not null and num_nonnulls(finalised_agreement_id,published_offer_id)=1)
);

create function operations.mark_builder_offer(target_org uuid,draft_id uuid,expected_version integer,offer_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform operations.assert_active_staff_membership();
  if not exists(select 1 from operations.commercial_offers o where o.id=offer_id and o.organisation_id=target_org
    and o.source_draft_id=draft_id and o.source_draft_version=expected_version) then
    raise exception 'Offer publication does not match the working draft' using errcode='40001';
  end if;
  update operations.agreement_builder_drafts set finalised_at=clock_timestamp(),published_offer_id=offer_id
    where id=draft_id and organisation_id=target_org and version=expected_version and finalised_at is null;
  if not found then raise exception 'Agreement draft changed' using errcode='40001'; end if;
end $$;
revoke all on function operations.mark_builder_offer(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role,growth_app,operations_portal,operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
grant execute on function operations.mark_builder_offer(uuid,uuid,integer,uuid) to operations_founder;

-- Working drafts keep their currency snapshot even after client settings change.
create function operations.guard_builder_commercial_terms()
returns trigger language plpgsql set search_path='' as $$
declare retained_currency text;
begin
  if TG_OP='INSERT' then
    select billing_currency into retained_currency from operations.organisations where id=new.organisation_id;
  else
    retained_currency := coalesce(old.content #>> '{agreement,currency}','GBP');
    if old.content ? 'commercialOffer' and new.finalised_agreement_id is not null then
      raise exception 'Publish the commercial offer before finalising its terms' using errcode='40001';
    end if;
  end if;
  if retained_currency not in ('GBP','USD','EUR') or retained_currency is null then
    raise exception 'Client billing currency is unavailable' using errcode='22023';
  end if;
  new.content := jsonb_set(new.content,'{agreement}',coalesce(new.content->'agreement','{}'::jsonb)||jsonb_build_object('currency',retained_currency));
  return new;
end $$;
create trigger agreement_builder_commercial_terms before insert or update on operations.agreement_builder_drafts
for each row execute function operations.guard_builder_commercial_terms();
revoke all on function operations.guard_builder_commercial_terms() from public,anon,authenticated,service_role,growth_app,operations_portal,operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
