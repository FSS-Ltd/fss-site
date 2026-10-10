-- Preserve issued and signed history. Only an untouched draft can be removed.
alter table operations.agreements drop constraint agreements_status_check;
alter table operations.agreements add constraint agreements_status_check
 check(status in ('draft','withdrawn','signed'));
alter table operations.agreements add column archived_at timestamptz;
alter table operations.agreements add column archived_by text;
alter table operations.agreements add constraint agreements_archive_check
 check((archived_at is null and archived_by is null) or
       (status='signed' and archived_at is not null and archived_by ~ '^[a-f0-9]{64}$'));

alter table operations.audit_events drop constraint audit_events_action_check;
alter table operations.audit_events add constraint audit_events_action_check check(action in (
 'organisation.created','engagement.linked','agreement.revised','agreement.signed','service.activated',
 'contact.created','invite.issued','invite.revoked','invite.claimed','invite.dismissed','membership.revoked',
 'project.created','project.updated','milestone.created','milestone.updated','document.created','document.updated',
 'billing.billing_customers.created','billing.billing_schedules.created','billing.billing_commands.created',
 'billing.invoices.created','billing.billing_amendment_previews.created',
 'onboarding.retry_requested','onboarding.template_published','onboarding.journey_draft_saved',
 'onboarding.booking_confirmed','onboarding.client_profile_completed','onboarding.journey_draft_discarded',
 'agreement.draft_saved','agreement.draft_finalised','organisation.currency_changed',
 'agreement.notification_resent',
 'agreement.deleted','agreement.withdrawn','agreement.archived','agreement.restored'
));

create function operations.change_agreement_lifecycle(
 target_org uuid,target uuid,expected integer,action text,correlation uuid
) returns void language plpgsql security definer set search_path='' as $$
declare a operations.agreements; actor text:=nullif(current_setting('operations.actor_id',true),'');
 p operations.signing_approvals;
begin
 perform operations.assert_active_staff_membership();
 if actor is null or actor !~ '^[a-f0-9]{64}$' or correlation is null then
  raise exception 'Agreement action unavailable' using errcode='42501'; end if;
 select * into a from operations.agreements where organisation_id=target_org and id=target for update;
 if not found or a.version is distinct from expected then
  raise exception 'Agreement changed' using errcode='P0001'; end if;
 if action='delete' then
  if a.status<>'draft' or exists(select 1 from operations.signing_approvals where agreement_id=target)
   or exists(select 1 from operations.signature_evidence where organisation_id=target_org and agreement_id=target)
   or exists(select 1 from operations.billing_schedules where organisation_id=target_org and agreement_id=target)
   or exists(select 1 from operations.service_instances where organisation_id=target_org and agreement_id=target)
   or exists(select 1 from operations.onboarding_journeys where organisation_id=target_org and agreement_id=target)
   or exists(select 1 from operations.onboarding_journey_drafts where organisation_id=target_org and agreement_id=target)
   or exists(select 1 from operations.commercial_offers where organisation_id=target_org and agreement_id=target)
   or exists(select 1 from operations.projects where organisation_id=target_org and agreement_id=target)
   or exists(select 1 from operations.requests where organisation_id=target_org and agreement_id=target)
   or exists(select 1 from operations.retention_actions where organisation_id=target_org and agreement_id=target)
  then raise exception 'Agreement has dependent records' using errcode='P0001'; end if;
  update operations.agreement_builder_drafts
   set finalised_at=null,finalised_agreement_id=null,version=version+1,updated_at=clock_timestamp()
   where organisation_id=target_org and finalised_agreement_id=target;
  delete from operations.agreement_lines where organisation_id=target_org and agreement_id=target;
  delete from operations.agreement_revisions where organisation_id=target_org and agreement_id=target;
  delete from operations.agreements where organisation_id=target_org and id=target;
 elsif action='withdraw' then
  if a.status<>'draft' or not exists(select 1 from operations.signing_approvals where agreement_id=target)
    or exists(select 1 from operations.signing_approvals p0 where p0.agreement_id=target
      and p0.status='approved' and
      (select count(*) from operations.signing_signatures s where s.approval_id=p0.id)=jsonb_array_length(p0.snapshot->'signatories'))
  then raise exception 'Agreement cannot be withdrawn' using errcode='P0001'; end if;
  for p in select * from operations.signing_approvals where agreement_id=target and status in ('prepared','approved') loop
   perform operations.cancel_agreement_signing(target_org,p.id,correlation);
  end loop;
  update operations.agreements set status='withdrawn',version=version+1 where id=target;
 elsif action='archive' then
  if a.status<>'signed' or a.archived_at is not null then raise exception 'Agreement cannot be archived' using errcode='P0001'; end if;
  update operations.agreements set archived_at=clock_timestamp(),archived_by=actor,version=version+1 where id=target;
 elsif action='restore' then
  if a.status<>'signed' or a.archived_at is null then raise exception 'Agreement cannot be restored' using errcode='P0001'; end if;
  update operations.agreements set archived_at=null,archived_by=null,version=version+1 where id=target;
 else raise exception 'Agreement action unavailable' using errcode='P0001'; end if;
 insert into operations.audit_events(organisation_id,actor_id,action,entity_id,review_reference,correlation_id,entity_version)
 values(target_org,actor,'agreement.'||case action when 'delete' then 'deleted' when 'withdraw' then 'withdrawn'
  when 'archive' then 'archived' else 'restored' end,target,'agreement-lifecycle',correlation,expected);
end $$;
revoke all on function operations.change_agreement_lifecycle(uuid,uuid,integer,text,uuid)
 from public,anon,authenticated,service_role,growth_app,operations_founder,operations_portal,
 operations_signing_worker,operations_billing_worker,operations_onboarding_worker;
grant execute on function operations.change_agreement_lifecycle(uuid,uuid,integer,text,uuid) to operations_founder;
