-- Site lead, newsletter consent, and Resend template schema for the
-- Resend Marketing plan. `unique_provider_message` on
-- growth.email_messages (channel, provider_message_id) already covers
-- the plan's `unique_channel_provider_message` requirement from Plan 03.

create type growth.newsletter_subscriber_status as enum (
  'pending',
  'subscribed',
  'unsubscribed',
  'bounced',
  'complained'
);

create type growth.newsletter_issue_status as enum (
  'draft',
  'ready_for_review',
  'approved',
  'scheduled',
  'sending',
  'sent',
  'failed',
  'cancelled'
);

create table growth.inbound_leads (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  submission_type text not null
    check (submission_type in ('site_enquiry', 'resource_request')),
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  work_email text not null
    check (work_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  business_name text not null check (length(trim(business_name)) > 0),
  challenge text,
  source_path text not null check (length(trim(source_path)) > 0),
  source_context text not null check (length(trim(source_context)) > 0),
  resource_slug text,
  newsletter_opt_in boolean not null default false,
  consent_text_version text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inbound_lead_opt_in_requires_consent_version check (
    newsletter_opt_in = false or consent_text_version is not null
  )
);

create unique index unique_inbound_submission
  on growth.inbound_leads (submission_id);

create index inbound_leads_work_email_idx
  on growth.inbound_leads (work_email);

create table growth.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null
    check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  normalised_email text generated always as (lower(trim(email))) stored,
  first_name text,
  business_name text,
  status growth.newsletter_subscriber_status not null default 'pending',
  consent_source text,
  consent_text_version text,
  consent_evidence text,
  consent_ip_hash text,
  consent_user_agent_hash text,
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  resend_contact_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_subscriber_requires_consent_evidence check (
    status <> 'subscribed'
    or (
      consented_at is not null
      and consent_source is not null
      and consent_evidence is not null
    )
  )
);

create unique index unique_newsletter_email
  on growth.newsletter_subscribers (normalised_email);

create index subscribed_newsletter_recipients
  on growth.newsletter_subscribers (normalised_email)
  where status = 'subscribed';

create table growth.newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null check (length(trim(issue_key)) > 0),
  version integer not null default 1 check (version > 0),
  status growth.newsletter_issue_status not null default 'draft',
  subject text not null check (length(trim(subject)) > 0),
  preview_text text not null check (length(trim(preview_text)) > 0),
  html_snapshot text not null check (length(trim(html_snapshot)) > 0),
  text_snapshot text not null check (length(trim(text_snapshot)) > 0),
  email_asset_id uuid references growth.email_assets(id) on delete restrict,
  audience_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(audience_snapshot) = 'object'),
  scheduled_for timestamptz,
  sent_at timestamptz,
  created_by text not null check (length(trim(created_by)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index unique_newsletter_issue_key
  on growth.newsletter_issues (issue_key, version);

-- Newsletter images are not tied to a cold prospect.
alter table growth.email_assets
  alter column prospect_id drop not null;

alter table growth.email_templates
  add column category text
    check (
      category is null
      or category in ('transactional', 'resource-delivery', 'newsletter')
    );

create function growth.reject_scheduled_newsletter_issue_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('scheduled', 'sending', 'sent') and (
    new.subject is distinct from old.subject
    or new.preview_text is distinct from old.preview_text
    or new.html_snapshot is distinct from old.html_snapshot
    or new.text_snapshot is distinct from old.text_snapshot
    or new.email_asset_id is distinct from old.email_asset_id
    or new.audience_snapshot is distinct from old.audience_snapshot
    or new.scheduled_for is distinct from old.scheduled_for
  ) then
    raise exception 'a scheduled newsletter issue is immutable'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger reject_scheduled_newsletter_issue_edit
before update on growth.newsletter_issues
for each row
execute function growth.reject_scheduled_newsletter_issue_edit();

create function growth.reject_stale_newsletter_reconsent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'unsubscribed' and new.status = 'subscribed' and (
    new.consented_at is null
    or (old.consented_at is not null and new.consented_at <= old.consented_at)
  ) then
    raise exception 'resubscribing requires new consent evidence'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger reject_stale_newsletter_reconsent
before update on growth.newsletter_subscribers
for each row
execute function growth.reject_stale_newsletter_reconsent();

revoke all on
  growth.inbound_leads,
  growth.newsletter_subscribers,
  growth.newsletter_issues
from public, anon, authenticated, service_role;

revoke all on function
  growth.reject_scheduled_newsletter_issue_edit(),
  growth.reject_stale_newsletter_reconsent()
from public, anon, authenticated, service_role;

grant usage
  on type growth.newsletter_subscriber_status, growth.newsletter_issue_status
  to growth_app;

grant select, insert, update on
  growth.inbound_leads,
  growth.newsletter_subscribers,
  growth.newsletter_issues
to growth_app;

with resend_templates (
  template_key,
  category,
  subject_template,
  html_template,
  text_template,
  required_fields
) as (
  values
    (
      'site-enquiry-thank-you',
      'transactional',
      'We received your request',
      $html$<p>Hi {{firstName}},</p>
<p>Thank you for telling us about the enquiry process at {{businessName}}.</p>
<p>I will review what you shared and look for the point where the current process creates the most unnecessary work. You will receive a personal response within two working days.</p>
<p>What happens next</p>
<p>1. I read your answers and check the current journey.<br>2. I identify the smallest useful improvement.<br>3. If FSS can help, I will suggest a short conversation with a clear agenda.</p>
<p>There is nothing else you need to prepare. If another detail would help, reply directly to this email.</p>
<p>Jean-Fidele<br>Faithful Software Solutions</p>$html$,
      $text$Hi {{firstName}},

Thank you for telling us about the enquiry process at {{businessName}}.

I will review what you shared and look for the point where the current process creates the most unnecessary work. You will receive a personal response within two working days.

What happens next

1. I read your answers and check the current journey.
2. I identify the smallest useful improvement.
3. If FSS can help, I will suggest a short conversation with a clear agenda.

There is nothing else you need to prepare. If another detail would help, reply directly to this email.

Jean-Fidele
Faithful Software Solutions$text$,
      array['firstName', 'businessName']
    ),
    (
      'resource-delivery',
      'resource-delivery',
      'Your FSS practical guide is ready',
      $html$<p>Hi {{firstName}},</p>
<p>Your copy of {{resourceTitle}} is ready.</p>
<p>This guide is designed to help you find the part of a process that creates repeated work, missing information or avoidable delay. You do not need to change the whole system to make progress. Start with the one handoff that costs the team the most time.</p>
<p>Download your guide:<br>{{resourceUrl}}</p>
<p>As you work through it, write down:</p>
<p>1. where information first enters the process;<br>2. who has to retype, chase or correct it;<br>3. what a cleaner handoff would make possible.</p>
<p>If the guide exposes a problem that needs a practical software decision, reply to this email. I will tell you whether FSS is likely to be useful.</p>
<p>Jean-Fidele<br>Faithful Software Solutions</p>$html$,
      $text$Hi {{firstName}},

Your copy of {{resourceTitle}} is ready.

This guide is designed to help you find the part of a process that creates repeated work, missing information or avoidable delay. You do not need to change the whole system to make progress. Start with the one handoff that costs the team the most time.

Download your guide:
{{resourceUrl}}

As you work through it, write down:

1. where information first enters the process;
2. who has to retype, chase or correct it;
3. what a cleaner handoff would make possible.

If the guide exposes a problem that needs a practical software decision, reply to this email. I will tell you whether FSS is likely to be useful.

Jean-Fidele
Faithful Software Solutions$text$,
      array['firstName', 'resourceTitle', 'resourceUrl']
    ),
    (
      'client-delivery-thank-you',
      'transactional',
      'Thank you for trusting FSS with {{engagementName}}',
      $html$<p>Hi {{firstName}},</p>
<p>Thank you for trusting Faithful Software Solutions with {{engagementName}}.</p>
<p>The handover marks the end of the build, but the useful result is what happens next. Keep the owner clear, review the process while it is still familiar, and tell me early if the system stops matching the way the team works.</p>
<p>Three things are worth keeping:</p>
<p>1. one named owner for the process;<br>2. a short review after the first month;<br>3. a direct route for reporting friction before it becomes a workaround.</p>
<p>You can reply to this email whenever a practical question appears. I would rather help you protect a useful system than let a small problem become repeated work.</p>
<p>If you would like occasional notes on software, automation and better operating systems, you can choose to join FSS Field Notes here:<br>{{newsletterOptInUrl}}</p>
<p>The newsletter is optional. This email has not subscribed you.</p>
<p>Jean-Fidele<br>Faithful Software Solutions</p>$html$,
      $text$Hi {{firstName}},

Thank you for trusting Faithful Software Solutions with {{engagementName}}.

The handover marks the end of the build, but the useful result is what happens next. Keep the owner clear, review the process while it is still familiar, and tell me early if the system stops matching the way the team works.

Three things are worth keeping:

1. one named owner for the process;
2. a short review after the first month;
3. a direct route for reporting friction before it becomes a workaround.

You can reply to this email whenever a practical question appears. I would rather help you protect a useful system than let a small problem become repeated work.

If you would like occasional notes on software, automation and better operating systems, you can choose to join FSS Field Notes here:
{{newsletterOptInUrl}}

The newsletter is optional. This email has not subscribed you.

Jean-Fidele
Faithful Software Solutions$text$,
      array['firstName', 'engagementName', 'newsletterOptInUrl']
    ),
    (
      'newsletter-welcome',
      'newsletter',
      'Welcome to FSS Field Notes',
      $html$<p>Hi {{firstName}},</p>
<p>You are now subscribed to FSS Field Notes.</p>
<p>This is a practical email for founders and teams who need their systems to carry more of the work. Each issue takes one operational problem and explains the smallest useful way to improve it.</p>
<p>You can expect:</p>
<p>1. clear examples of where a process breaks;<br>2. grounded uses of software and automation;<br>3. direct advice on what not to build yet.</p>
<p>The aim is not to add another tool. It is to help you decide where a better system would remove repeated work, protect service quality and give the team a clearer view of what happens next.</p>
<p>If there is one process you want me to examine in a future issue, reply and tell me where it breaks. I read every response.</p>
<p>Jean-Fidele<br>Faithful Software Solutions</p>$html$,
      $text$Hi {{firstName}},

You are now subscribed to FSS Field Notes.

This is a practical email for founders and teams who need their systems to carry more of the work. Each issue takes one operational problem and explains the smallest useful way to improve it.

You can expect:

1. clear examples of where a process breaks;
2. grounded uses of software and automation;
3. direct advice on what not to build yet.

The aim is not to add another tool. It is to help you decide where a better system would remove repeated work, protect service quality and give the team a clearer view of what happens next.

If there is one process you want me to examine in a future issue, reply and tell me where it breaks. I read every response.

Jean-Fidele
Faithful Software Solutions$text$,
      array['firstName']
    ),
    (
      'newsletter-issue',
      'newsletter',
      null,
      $html$<p>Newsletter issue content is composed from typed sections at send time. This row exists for template versioning only.</p>$html$,
      $text$Newsletter issue content is composed from typed sections at send time. This row exists for template versioning only.$text$,
      array[]::text[]
    )
)
insert into growth.email_templates (
  channel,
  template_key,
  version,
  status,
  category,
  subject_template,
  html_template,
  text_template,
  required_fields,
  image_policy,
  checksum
)
select
  'resend',
  template_key,
  '1.0',
  'draft',
  category,
  subject_template,
  html_template,
  text_template,
  required_fields,
  '{"kind":"none"}'::jsonb,
  encode(
    digest(
      convert_to(E'\n' || html_template || E'\n' || text_template, 'UTF8'),
      'sha256'
    ),
    'hex'
  )
from resend_templates;
