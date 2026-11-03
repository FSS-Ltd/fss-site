-- Staff may price editable drafts in a supported currency. Published evidence stays fixed.
create or replace function operations.guard_builder_commercial_terms()
returns trigger language plpgsql set search_path='' as $$
declare selected_currency text;
begin
  selected_currency := new.content #>> '{agreement,currency}';
  if TG_OP='INSERT' then
    if selected_currency is null then
      select billing_currency into selected_currency
        from operations.organisations where id=new.organisation_id;
    end if;
  else
    selected_currency := coalesce(selected_currency,old.content #>> '{agreement,currency}','GBP');
    if old.finalised_at is not null
      and selected_currency is distinct from old.content #>> '{agreement,currency}' then
      raise exception 'Published draft currency cannot change' using errcode='40001';
    end if;
    if old.content ? 'commercialOffer' and new.finalised_agreement_id is not null then
      raise exception 'Publish the commercial offer before finalising its terms' using errcode='40001';
    end if;
  end if;
  if selected_currency not in ('GBP','USD','EUR') or selected_currency is null then
    raise exception 'Choose GBP, USD or EUR' using errcode='22023';
  end if;
  new.content := jsonb_set(new.content,'{agreement}',coalesce(new.content->'agreement','{}'::jsonb)||jsonb_build_object('currency',selected_currency));
  return new;
end $$;
