alter table growth.research_runs
  drop constraint research_run_target_positive;

alter table growth.research_runs
  add constraint research_run_target_positive check (
    target_count > 0 or (
      target_count = 0
      and verified_key_id is not null
      and length(btrim(verified_key_id)) > 0
      and signed_body_sha256 is not null
      and signed_body_sha256 ~ '^[a-f0-9]{64}$'
    )
  );
