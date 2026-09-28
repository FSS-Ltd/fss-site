create table operations.welcome_packs (
  id text primary key check (id in ('website_build', 'website_seo', 'systems_portal')),
  title text not null check (length(trim(title)) between 1 and 160),
  draft_content jsonb not null check (jsonb_typeof(draft_content) = 'object'),
  draft_version integer not null check (draft_version > 0),
  published_version integer not null default 0 check (published_version >= 0 and published_version <= draft_version),
  updated_by text not null check (updated_by ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz not null default clock_timestamp()
);
create table operations.welcome_pack_versions (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null references operations.welcome_packs(id) on delete restrict,
  version integer not null check (version > 0),
  title text not null check (length(trim(title)) between 1 and 160),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  published_by text not null check (published_by ~ '^[a-f0-9]{64}$'),
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  published_at timestamptz not null default clock_timestamp(),
  unique (pack_id, version)
);
create table operations.welcome_pack_audit_events (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null references operations.welcome_packs(id) on delete restrict,
  version_id uuid references operations.welcome_pack_versions(id) on delete restrict,
  actor_id text not null check (actor_id ~ '^[a-f0-9]{64}$'),
  action text not null check (action in ('draft_saved', 'version_published', 'applied_to_client')),
  organisation_id uuid references operations.organisations(id) on delete restrict,
  review_reference text not null check (length(trim(review_reference)) between 1 and 200),
  correlation_id uuid not null,
  occurred_at timestamptz not null default clock_timestamp(),
  check ((action = 'applied_to_client' and organisation_id is not null) or (action <> 'applied_to_client' and organisation_id is null))
);
alter table operations.onboarding_template_versions
  add column source_welcome_pack_version_id uuid
    references operations.welcome_pack_versions(id) on delete restrict;

alter table operations.welcome_packs enable row level security;
alter table operations.welcome_packs force row level security;
alter table operations.welcome_pack_versions enable row level security;
alter table operations.welcome_pack_versions force row level security;
alter table operations.welcome_pack_audit_events enable row level security;
alter table operations.welcome_pack_audit_events force row level security;
revoke all on operations.welcome_packs, operations.welcome_pack_versions,
  operations.welcome_pack_audit_events
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_founder, operations_billing_worker, operations_signing_worker,
    operations_onboarding_worker;
grant select, insert, update on operations.welcome_packs to operations_founder;
grant select, insert on operations.welcome_pack_versions to operations_founder;
grant select, insert on operations.welcome_pack_audit_events to operations_founder;
create policy founder_welcome_pack_access on operations.welcome_packs
  for all to operations_founder
  using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$')
  with check (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy founder_welcome_pack_version_read on operations.welcome_pack_versions
  for select to operations_founder
  using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy founder_welcome_pack_version_create on operations.welcome_pack_versions
  for insert to operations_founder
  with check (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy founder_welcome_pack_audit_read on operations.welcome_pack_audit_events
  for select to operations_founder
  using (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');
create policy founder_welcome_pack_audit_create on operations.welcome_pack_audit_events
  for insert to operations_founder
  with check (current_setting('operations.actor_id', true) ~ '^[a-f0-9]{64}$');

create function operations.reject_welcome_pack_version_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Published welcome pack versions are immutable.' using errcode = '55000';
end;
$$;
revoke all on function operations.reject_welcome_pack_version_change()
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_founder, operations_billing_worker, operations_signing_worker,
    operations_onboarding_worker;
create trigger welcome_pack_versions_immutable
  before update or delete on operations.welcome_pack_versions
  for each row execute function operations.reject_welcome_pack_version_change();

create function operations.apply_welcome_pack_to_client(
  target_organisation uuid,
  target_pack_version uuid,
  target_template uuid,
  target_review_reference text
)
returns table (template_id uuid, template_version_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  actor text := operations.assert_onboarding_founder();
  pack_version operations.welcome_pack_versions;
  template_version operations.onboarding_template_versions;
begin
  if length(trim(coalesce(target_review_reference, ''))) not between 1 and 200 then
    raise exception 'Pack application review reference is invalid.' using errcode = '22023';
  end if;
  if not exists (select 1 from operations.organisations o
    where o.id = target_organisation and o.lifecycle = 'active') then
    raise exception 'Client organisation is unavailable.' using errcode = '23503';
  end if;
  select * into strict pack_version from operations.welcome_pack_versions v
    where v.id = target_pack_version;
  perform operations.assert_onboarding_template_content(
    jsonb_build_object('tasks', pack_version.content -> 'tasks')
  );
  insert into operations.onboarding_templates(
    id, organisation_id, title, draft_content, draft_version, published_version, created_by
  ) values (
    target_template, target_organisation, pack_version.title,
    jsonb_build_object('tasks', pack_version.content -> 'tasks'), 1, 1, actor
  );
  insert into operations.onboarding_template_versions(
    template_id, organisation_id, version, title, content, published_by,
    source_welcome_pack_version_id
  ) values (
    target_template, target_organisation, 1, pack_version.title,
    jsonb_build_object('tasks', pack_version.content -> 'tasks'), actor, pack_version.id
  ) returning * into template_version;
  insert into operations.welcome_pack_audit_events(
    pack_id, version_id, actor_id, action, organisation_id, review_reference, correlation_id
  ) values (
    pack_version.pack_id, pack_version.id, actor, 'applied_to_client',
    target_organisation, trim(target_review_reference),
    nullif(current_setting('operations.correlation_id', true), '')::uuid
  );
  template_id := target_template;
  template_version_id := template_version.id;
  return next;
end;
$$;
revoke all on function operations.apply_welcome_pack_to_client(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role, growth_app, operations_portal,
    operations_founder, operations_billing_worker, operations_signing_worker,
    operations_onboarding_worker;
grant execute on function operations.apply_welcome_pack_to_client(uuid, uuid, uuid, text)
  to operations_founder;

insert into operations.welcome_packs(id, title, draft_content, draft_version, published_version, updated_by)
values
('website_build', 'Standard website build', $pack$
{"emailSubject":"Your website project: next steps","emailBody":"Hello {{contact_first_name}},\n\nWe are ready to shape {{client_name}}’s website around {{agreement_goal}}. The agreed scope is {{agreement_scope}}.\n\nWe will begin with discovery, confirm the content and design direction, then build and review the site with you before launch. Please gather the approved copy and brand assets listed in your agreement.\n\nWe will confirm dates and dependencies with you directly. Your next step is to review the agreement and prepare the requested materials.\n\n{{sender_name}}\nFaithful Software Solutions","guide":[{"title":"Your priorities","paragraphs":["We will use the goals in your agreement to guide the website work for {{client_name}}.","The agreed outcome is {{agreement_goal}}."]},{"title":"The website plan","paragraphs":["We begin with discovery and structure, then confirm the design direction before development.","The agreed scope is {{agreement_scope}}. Changes will be discussed before work is added."]},{"title":"What we need from you","paragraphs":["Prepare approved copy, brand assets, and access listed in your agreement.","Share credentials only through the secure route agreed with your FSS contact."]},{"title":"How we work together","paragraphs":["We will share progress and ask for feedback at agreed review points.","Your FSS contact will explain decisions, dependencies, and requested changes."]},{"title":"Your next steps","paragraphs":["Review and sign the agreement, then share the requested materials through the agreed channel.","We will confirm kickoff and first delivery dates when the required inputs are ready."]}],"thankYou":{"subject":"Your website project is ready to begin","intro":"Thank you for confirming the agreed website work for {{client_name}}.","nextStep":"We will confirm kickoff and delivery dates after the agreed prerequisites are complete.","requiredAction":"Please provide the approved content and assets listed in your agreement."},"tasks":[{"id":"10000000-0000-4000-8000-000000000001","title":"Confirm your project contact","instructions":"Check your workspace contact details and tell your FSS contact if they need updating.","kind":"profile","ownerRole":"owner","required":true,"dependsOnTaskId":null,"dueRule":"activation","evidenceRule":"profile_saved","bookingUrl":null},{"id":"10000000-0000-4000-8000-000000000002","title":"Review the agreed website scope","instructions":"Review the agreement and confirm that the website scope and responsibilities are clear.","kind":"acknowledgement","ownerRole":"owner","required":true,"dependsOnTaskId":"10000000-0000-4000-8000-000000000001","dueRule":"signature","evidenceRule":"acknowledged","bookingUrl":null},{"id":"10000000-0000-4000-8000-000000000003","title":"Prepare approved content and assets","instructions":"Gather materials listed in the agreement and share them using the secure method confirmed by your FSS contact.","kind":"custom","ownerRole":"owner","required":true,"dependsOnTaskId":"10000000-0000-4000-8000-000000000002","dueRule":"previous_task","evidenceRule":"staff_confirmed","bookingUrl":null}]}
$pack$::jsonb, 1, 1, repeat('a', 64)),
('website_seo', 'Website with ongoing SEO support', $pack$
{"emailSubject":"Your website and ongoing SEO: next steps","emailBody":"Hello {{contact_first_name}},\n\nWe are ready to begin {{client_name}}’s website and ongoing SEO. The goals are {{agreement_goal}} and the agreed scope is {{agreement_scope}}.\n\nWe will confirm the website direction and SEO starting point, then agree the access and reporting needed for ongoing work. Prepare the approved content and authorised search or analytics access listed in your agreement.\n\nWe will confirm review points, reporting cadence, and dates with you directly. Your next step is to review the agreement and prepare the requested materials.\n\n{{sender_name}}\nFaithful Software Solutions","guide":[{"title":"Your priorities","paragraphs":["The website and SEO work will support the goals recorded in your agreement: {{agreement_goal}}.","The agreed scope is {{agreement_scope}}."]},{"title":"The website plan","paragraphs":["We will confirm the website structure and content before development, then review it with you before launch.","Your FSS contact will confirm the project schedule and approval points."]},{"title":"The SEO starting point","paragraphs":["We will establish an agreed baseline using the search and analytics access listed in your agreement.","Ongoing work and reporting will follow the service scope and cadence agreed with you."]},{"title":"What we need from you","paragraphs":["Prepare approved copy, brand assets, and authorised search or analytics access where included in your agreement.","Do not send passwords by email. Use the secure access method confirmed by your FSS contact."]},{"title":"Your next steps","paragraphs":["Review and sign the agreement, then provide the requested materials and access through the agreed secure route.","We will confirm kickoff, review points, and reporting schedule after prerequisites are ready."]}],"thankYou":{"subject":"Your website and SEO work is ready to begin","intro":"Thank you for confirming the website and ongoing SEO scope for {{client_name}}.","nextStep":"We will confirm kickoff and reporting arrangements after the agreed prerequisites are complete.","requiredAction":"Prepare the approved content and authorised access listed in your agreement."},"tasks":[{"id":"20000000-0000-4000-8000-000000000001","title":"Confirm your project contact","instructions":"Check your workspace contact details and tell your FSS contact if they need updating.","kind":"profile","ownerRole":"owner","required":true,"dependsOnTaskId":null,"dueRule":"activation","evidenceRule":"profile_saved","bookingUrl":null},{"id":"20000000-0000-4000-8000-000000000002","title":"Review website and SEO scope","instructions":"Review the agreement and confirm the website, ongoing SEO, and responsibilities are clear.","kind":"acknowledgement","ownerRole":"owner","required":true,"dependsOnTaskId":"20000000-0000-4000-8000-000000000001","dueRule":"signature","evidenceRule":"acknowledged","bookingUrl":null},{"id":"20000000-0000-4000-8000-000000000003","title":"Prepare approved content and access","instructions":"Prepare the content and authorised search or analytics access listed in the agreement. Use the secure sharing method confirmed by FSS.","kind":"custom","ownerRole":"owner","required":true,"dependsOnTaskId":"20000000-0000-4000-8000-000000000002","dueRule":"previous_task","evidenceRule":"staff_confirmed","bookingUrl":null}]}
$pack$::jsonb, 1, 1, repeat('a', 64)),
('systems_portal', 'Full systems portal', $pack$
{"emailSubject":"Your systems portal project: next steps","emailBody":"Hello {{contact_first_name}},\n\nWe are ready to plan {{client_name}}’s systems portal around {{agreement_goal}}. The agreed scope is {{agreement_scope}}.\n\nWe will confirm user roles, data, integrations, and review stages before implementation. Identify the people who will review the work and prepare access or sample data listed in your agreement.\n\nWe will confirm the staged plan and dates with you directly. Your next step is to review the agreement and identify your project stakeholders.\n\n{{sender_name}}\nFaithful Software Solutions","guide":[{"title":"Your priorities","paragraphs":["We will use the goals in your agreement to shape the systems portal for {{client_name}}.","The agreed outcome is {{agreement_goal}}."]},{"title":"The portal plan","paragraphs":["We will confirm user roles, data needs, and integrations before building.","The agreed scope is {{agreement_scope}}. Changes will be discussed before they are added."]},{"title":"Review stages","paragraphs":["Work will move through agreed stages with review points for the people you nominate.","We will confirm responsibilities and acceptance criteria before each stage begins."]},{"title":"What we need from you","paragraphs":["Identify project stakeholders and prepare authorised access or sample data listed in your agreement.","Share credentials only through the secure route agreed with your FSS contact."]},{"title":"Your next steps","paragraphs":["Review and sign the agreement, then confirm stakeholders and requested materials.","We will agree kickoff and stage dates after required decisions and access are ready."]}],"thankYou":{"subject":"Your systems portal project is ready to begin","intro":"Thank you for confirming the systems portal scope for {{client_name}}.","nextStep":"We will confirm kickoff and the staged review plan after prerequisites are complete.","requiredAction":"Identify project stakeholders and prepare the access or sample data listed in your agreement."},"tasks":[{"id":"30000000-0000-4000-8000-000000000001","title":"Confirm your project contact","instructions":"Check your workspace contact details and tell your FSS contact if they need updating.","kind":"profile","ownerRole":"owner","required":true,"dependsOnTaskId":null,"dueRule":"activation","evidenceRule":"profile_saved","bookingUrl":null},{"id":"30000000-0000-4000-8000-000000000002","title":"Confirm portal stakeholders","instructions":"Identify the people who will confirm roles, review staged work, and accept the agreed outcome.","kind":"acknowledgement","ownerRole":"owner","required":true,"dependsOnTaskId":"30000000-0000-4000-8000-000000000001","dueRule":"signature","evidenceRule":"acknowledged","bookingUrl":null},{"id":"30000000-0000-4000-8000-000000000003","title":"Prepare agreed system inputs","instructions":"Prepare access or sample data listed in the agreement. Use the secure sharing method confirmed by FSS.","kind":"custom","ownerRole":"owner","required":true,"dependsOnTaskId":"30000000-0000-4000-8000-000000000002","dueRule":"previous_task","evidenceRule":"staff_confirmed","bookingUrl":null}]}
$pack$::jsonb, 1, 1, repeat('a', 64));

insert into operations.welcome_pack_versions(pack_id, version, title, content, published_by, review_reference)
select id, 1, title, draft_content, repeat('a', 64), 'Initial approved FSS welcome pack'
from operations.welcome_packs;
