-- Staff-authored client work begins as a visible, assessment-pending request.
create function operations.create_staff_request(
  org uuid,
  payload jsonb,
  ack_target timestamptz,
  calendar text
)
returns uuid
language plpgsql
security definer
set search_path = '' as $$
declare
  result uuid;
  uid uuid := nullif(current_setting('operations.user_id', true), '')::uuid;
  project uuid := (payload ->> 'projectId')::uuid;
begin
  if current_setting('role', true) <> 'operations_founder' then
    raise exception 'Staff authorization is required.' using errcode = '42501';
  end if;
  perform operations.assert_active_staff_membership();
  if uid is null
    or current_setting('operations.actor_id', true) !~ '^[a-f0-9]{64}$'
    or not exists (
      select 1
      from operations.organisations o
      join operations.projects p on p.organisation_id = o.id
      where o.id = org
        and o.lifecycle = 'active'
        and p.id = project
        and p.visibility = 'client'
        and p.status not in ('completed', 'paused')
    ) then
    raise exception 'The selected client project is unavailable.' using errcode = '42501';
  end if;
  if ack_target is null
    or calendar is null
    or ack_target <= clock_timestamp()
    or ack_target > clock_timestamp() + interval '30 days'
    or length(calendar) not between 1 and 200 then
    raise exception 'Invalid acknowledgement target';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(org::text || uid::text || (payload ->> 'idempotencyKey'), 11)
  );
  select id into result
  from operations.requests
  where organisation_id = org
    and created_by = uid
    and idempotency_key = (payload ->> 'idempotencyKey')::uuid;
  if result is not null then
    return result;
  end if;

  insert into operations.requests(
    organisation_id,
    project_id,
    created_by,
    idempotency_key,
    title,
    description,
    type,
    desired_outcome,
    desired_date,
    impact,
    reproduction_steps,
    expected_behaviour,
    actual_behaviour,
    priority,
    acknowledgement_target,
    calendar_version
  )
  values(
    org,
    project,
    uid,
    (payload ->> 'idempotencyKey')::uuid,
    payload ->> 'title',
    payload ->> 'description',
    payload ->> 'type',
    payload ->> 'desiredOutcome',
    (payload ->> 'desiredDate')::date,
    coalesce(payload ->> 'impact', ''),
    coalesce(payload ->> 'reproductionSteps', ''),
    coalesce(payload ->> 'expectedBehaviour', ''),
    coalesce(payload ->> 'actualBehaviour', ''),
    payload ->> 'priority',
    ack_target,
    calendar
  )
  returning id into result;
  return result;
end;
$$;

revoke all on function operations.create_staff_request(uuid, jsonb, timestamptz, text)
  from public, anon, authenticated, service_role, growth_app, operations_portal;
grant execute on function operations.create_staff_request(uuid, jsonb, timestamptz, text)
  to operations_founder;
