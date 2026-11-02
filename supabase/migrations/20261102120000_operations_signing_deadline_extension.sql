-- Staff can reopen an expired signing request without changing the retained
-- document. Signatures recorded before the old deadline stay valid because the
-- approval hash is unchanged and the new deadline is later.
alter table operations.signing_audit_events
  drop constraint signing_audit_events_action_check;
alter table operations.signing_audit_events
  add constraint signing_audit_events_action_check
  check (action in (
    'prepared', 'approved', 'signed', 'declined', 'cancelled',
    'superseded', 'completed', 'retry_requested', 'deadline_extended'
  ));
alter table operations.signing_audit_events
  add column previous_expires_at timestamptz,
  add column expires_at timestamptz;

create function operations.extend_agreement_signing(
  target_org uuid, target uuid, new_expiry timestamptz, correlation uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  approval operations.signing_approvals;
  actor text := nullif(current_setting('operations.actor_id', true), '');
begin
  perform operations.assert_active_staff_membership();
  if actor is null or actor !~ '^[a-f0-9]{64}$' or correlation is null then
    raise exception 'Signing extension unavailable.' using errcode = '42501';
  end if;
  perform 1 from operations.agreements a
    join operations.signing_approvals p0 on p0.agreement_id = a.id
    where p0.id = target and p0.organisation_id = target_org
    for update of a;
  select * into approval from operations.signing_approvals
    where id = target and organisation_id = target_org for update;
  if not found or approval.status <> 'approved'
    or approval.expires_at > clock_timestamp()
    or operations.has_pending_signed_execution(approval.agreement_id)
    or not exists (
      select 1 from operations.agreements a
      where a.id = approval.agreement_id and a.organisation_id = target_org
        and a.current_revision = approval.revision and a.status = 'draft'
    ) then
    raise exception 'Signing extension unavailable.' using errcode = 'P0001';
  end if;
  if new_expiry is null or new_expiry <= clock_timestamp()
    or new_expiry > clock_timestamp() + interval '90 days' then
    raise exception 'Deadline must be in the future and within 90 days'
      using errcode = 'P0001';
  end if;
  update operations.signing_approvals set expires_at = new_expiry
    where id = target;
  insert into operations.signing_audit_events
    (organisation_id, approval_id, actor_id, action, correlation_id,
     previous_expires_at, expires_at)
    values (target_org, target, actor, 'deadline_extended', correlation,
      approval.expires_at, new_expiry);
end;
$$;

revoke all on function operations.extend_agreement_signing(uuid, uuid, timestamptz, uuid)
  from public, anon, authenticated, service_role, growth_app,
    operations_founder, operations_portal, operations_signing_worker,
    operations_billing_worker, operations_onboarding_worker;
grant execute on function operations.extend_agreement_signing(uuid, uuid, timestamptz, uuid)
  to operations_founder;
