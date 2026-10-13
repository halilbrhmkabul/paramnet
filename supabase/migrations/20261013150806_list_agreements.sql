-- F3-11: every agreement I am party to, as summaries, for the "Borçlarım / Alacaklarım" tab (design 12).
-- The counterparty sees a shared agreement once it left personal mode, as in get_agreement_detail.
create function public.list_agreements() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
	v_uid uuid := private.require_uid();
	v_today date := private.today();
begin
	return (
		select coalesce(jsonb_agg(private.agreement_summary(a, v_uid, v_today) order by a.created_at desc, a.id), '[]'::jsonb)
		from public.agreements a
		where a.creator_id = v_uid or (a.counterparty_profile_id = v_uid and a.status <> 'personal')
	);
end;
$$;

revoke all on function public.list_agreements() from public, anon;
grant execute on function public.list_agreements() to authenticated;
