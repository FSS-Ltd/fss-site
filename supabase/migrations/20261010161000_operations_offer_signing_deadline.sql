-- A proposal deadline determines when the client may respond. Approval starts
-- a separate 30-day window for the final agreement's signatures.
create or replace function operations.materialize_commercial_offer(target uuid,branch_option text,correlation uuid) returns void language plpgsql security definer set search_path='' as $$
declare f operations.commercial_offers; b operations.commercial_offer_branches; aid uuid:=gen_random_uuid(); l jsonb; n integer:=0;
begin
 select * into strict f from operations.commercial_offers where id=target for update;
 select * into strict b from operations.commercial_offer_branches where offer_id=target and option=branch_option;
 insert into operations.agreements(id,organisation_id,engagement_id,current_revision,created_by) values(aid,f.organisation_id,f.engagement_id,1,b.approved_by);
 insert into operations.agreement_revisions(organisation_id,agreement_id,revision,snapshot,created_by,correlation_id) values(f.organisation_id,aid,1,b.snapshot,b.approved_by,correlation);
 for l in select value from jsonb_array_elements(b.snapshot->'lines') loop
  n:=n+1;
  insert into operations.agreement_lines(organisation_id,agreement_id,revision,line_number,service_code,description,quantity,unit_pence,discount_pence,tax_pence,recurrence_months,start_date,end_date)
  values(f.organisation_id,aid,1,n,l->>'serviceCode',l->>'description',(l->>'quantity')::integer,(l->>'unitPence')::bigint,(l->>'discountPence')::bigint,(l->>'taxPence')::bigint,(l->>'recurrenceMonths')::integer,(l->>'startDate')::date,(l->>'endDate')::date);
 end loop;
 insert into operations.signing_approvals(id,organisation_id,organisation_legal_name,agreement_id,revision,agreement_version,snapshot,source_pdf,source_hash,approval_hash,created_by,correlation_id)
 values(b.approval_id,f.organisation_id,b.organisation_legal_name,aid,1,1,b.snapshot,b.source_pdf,b.source_hash,repeat('0',64),b.approved_by,correlation);
 update operations.signing_approvals set status='approved',approved_at=clock_timestamp(),expires_at=clock_timestamp()+interval '30 days' where id=b.approval_id;
 insert into operations.signing_audit_events(organisation_id,approval_id,actor_id,action,correlation_id) values(f.organisation_id,b.approval_id,b.approved_by,'approved',correlation);
 update operations.commercial_offers set status='selected',selection=case when branch_option in ('cash','revenue_share') then jsonb_build_object('option',branch_option) else selection end,agreement_id=aid,approval_id=b.approval_id,version=version+1 where id=target;
end $$;
