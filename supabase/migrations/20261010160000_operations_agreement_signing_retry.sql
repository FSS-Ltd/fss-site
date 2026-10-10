-- Staff may requeue a fully signed request whose final document has not yet
-- been retained. The worker remains the only role allowed to complete it.
alter table operations.signing_approvals
  add column completion_failure_code text
  check (completion_failure_code in ('document_processing_failed'));
grant update(completion_failure_code) on operations.signing_approvals
  to operations_signing_worker;
alter table operations.signing_audit_events
  drop constraint signing_audit_events_action_check;
alter table operations.signing_audit_events
  add constraint signing_audit_events_action_check
  check (action in (
    'prepared', 'approved', 'signed', 'declined', 'cancelled',
    'superseded', 'completed', 'retry_requested'
  ));

create function operations.retry_agreement_signing(
  target_org uuid, target uuid, correlation uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  approval operations.signing_approvals;
  actor text := nullif(current_setting('operations.actor_id', true), '');
begin
  perform operations.assert_active_staff_membership();
  if actor is null or actor !~ '^[a-f0-9]{64}$' or correlation is null then
    raise exception 'Signing retry unavailable.' using errcode = '42501';
  end if;
  select * into approval from operations.signing_approvals
    where id = target and organisation_id = target_org for update;
  if not found or approval.status <> 'approved'
    or (select count(*) from operations.signing_signatures
        where approval_id = target) <> jsonb_array_length(approval.snapshot -> 'signatories')
    or not exists (
      select 1 from operations.agreements a
      where a.id = approval.agreement_id and a.organisation_id = target_org
        and a.current_revision = approval.revision and a.status = 'draft'
    ) then
    raise exception 'Signing retry unavailable.' using errcode = 'P0001';
  end if;
  update operations.signing_approvals
    set completion_next_attempt_at = clock_timestamp(),
        completion_failure_code = null
    where id = target;
  insert into operations.signing_audit_events
    (organisation_id, approval_id, actor_id, action, correlation_id)
    values (target_org, target, actor, 'retry_requested', correlation);
end;
$$;

revoke all on function operations.retry_agreement_signing(uuid, uuid, uuid)
  from public, anon, authenticated, service_role, growth_app,
    operations_founder, operations_portal, operations_signing_worker,
    operations_billing_worker, operations_onboarding_worker;
grant execute on function operations.retry_agreement_signing(uuid, uuid, uuid)
  to operations_founder;
