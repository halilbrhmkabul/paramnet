-- ADR-059: design 24 lets the owner mark installments whose date has passed as already paid while saving
-- the plan. The record and those payments are one transaction, so a failure leaves no half-paid record.

create function public.create_agreement_with_paid(input jsonb, p_paid_count int, idem_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_result jsonb;
	v_id uuid;
	v_row public.installments;
	v_version int;
begin
	if p_paid_count is null or p_paid_count < 0 then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'paid_count';
	end if;

	v_result := public.create_agreement(input, idem_key);
	-- A replay already holds its payments; recording them again would pay the plan twice.
	if (v_result ->> 'replayed')::boolean then
		return v_result;
	end if;
	v_id := (v_result ->> 'agreement_id')::uuid;

	if p_paid_count > (select count(*) from public.installments where agreement_id = v_id) then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'paid_count';
	end if;

	-- Payments are allocated FIFO, so "the first n are paid" is the only shape that matches the rows.
	for v_row in
		select * from public.installments where agreement_id = v_id order by seq limit p_paid_count
	loop
		if v_row.due_date is null or v_row.due_date > private.today() then
			raise exception using message = 'validation_error', errcode = 'P0001', detail = 'paid_not_due';
		end if;
		select row_version into v_version from public.agreements where id = v_id;
		perform public.record_payment(
			v_id,
			jsonb_build_object('amount_minor', v_row.amount_minor, 'method', 'cash', 'note', null, 'paid_on', v_row.due_date),
			v_version,
			gen_random_uuid()
		);
	end loop;

	return v_result;
end;
$$;

revoke all on function public.create_agreement_with_paid(jsonb, int, uuid) from public, anon;
grant execute on function public.create_agreement_with_paid(jsonb, int, uuid) to authenticated;
