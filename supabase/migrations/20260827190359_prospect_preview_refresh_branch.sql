alter table growth.prospect_previews
  drop constraint prospect_previews_generation_branch,
  add constraint prospect_previews_generation_branch check (
    generation_branch is null
    or generation_branch ~ '^generated/prospect-previews/[0-9]{4}-[0-9]{2}-[0-9]{2}(-[a-z0-9]+)*$'
  );
