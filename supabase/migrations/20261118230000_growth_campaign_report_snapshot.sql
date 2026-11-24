begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Founder reviews remain unchanged. Scheduled reports have system provenance,
-- never a fabricated founder identity or founder review timestamp.
alter table growth.experiment_reviews
  alter column reviewed_by drop not null,
  alter column reviewed_at drop not null,
  add column generation_kind text not null default 'founder_review',
  add column report_job_id uuid references growth.outreach_jobs(id) on delete restrict,
  add column anchor_reservation_id uuid references growth.outreach_reservations(id) on delete restrict,
  add column anchor_revision integer,
  add column report_cutoff timestamptz,
  add column generated_at timestamptz,
  add column supersedes_id uuid references growth.experiment_reviews(id) on delete restrict,
  add constraint experiment_review_generation_shape check ((
    (generation_kind = 'founder_review' and reviewed_by is not null and reviewed_at is not null
      and report_job_id is null and anchor_reservation_id is null and anchor_revision is null
      and report_cutoff is null and generated_at is null and supersedes_id is null)
    or
    (generation_kind = 'scheduled_report' and reviewed_by is null and reviewed_at is null
      and report_job_id is not null and anchor_reservation_id is not null and anchor_revision > 0
      and report_cutoff is not null and generated_at is not null)
  ) is true);
create unique index experiment_reviews_job_anchor_idx on growth.experiment_reviews(report_job_id,anchor_revision)
  where generation_kind = 'scheduled_report';

create function growth.protect_experiment_review_snapshot() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.generation_kind = 'scheduled_report' then
    raise exception 'scheduled report snapshots are immutable';
  end if;
  return new;
end $$;
create trigger protect_experiment_review_snapshot before update on growth.experiment_reviews
  for each row execute function growth.protect_experiment_review_snapshot();
commit;
