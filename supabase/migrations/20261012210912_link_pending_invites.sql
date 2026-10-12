-- F2-10: an account created for a number that already has invites (spec 5.1 step 6, 10.4
-- "link-pending-invites"). Runs inside complete_profile: the number comes from auth.users (verified
-- by OTP), so no separate edge function or secret is needed (ADR-035).

-- Links what was shared with this number before the account existed:
-- - plans the number accepted or countered on the web (the web cannot link an account that does not exist),
-- - contacts other users saved with this number.
-- Open invites need no link: decision_actor already matches them by number, and the decision links.
-- A rejected plan ("Bu plan bana ait değil") stays unlinked, as the web decision left it.
create function private.link_pending_invites(p_uid uuid, p_phone text) returns void
language sql
set search_path = ''
as $$
	update public.agreements a
	set counterparty_profile_id = p_uid
	where a.counterparty_profile_id is null
		and a.creator_id <> p_uid
		and a.status not in ('personal', 'pending', 'rejected')
		and exists (
			select 1 from public.invites i
			where i.agreement_id = a.id and i.status = 'consumed' and i.target_phone_e164 = p_phone
		);
	update public.contacts
	set linked_profile_id = p_uid
	where phone_e164 = p_phone and linked_profile_id is null and owner_id <> p_uid;
$$;

create or replace function public.complete_profile(p_display_name text, p_kvkk_version text, p_terms_version text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_uid uuid := auth.uid();
	v_phone text;
	v_name text;
	v_profile public.profiles;
begin
	if v_uid is null then
		raise exception 'not_authenticated' using errcode = '28000';
	end if;
	v_name := private.check_text(to_jsonb(p_display_name), 80, true);
	if coalesce(char_length(p_kvkk_version), 0) not between 1 and 20
		or coalesce(char_length(p_terms_version), 0) not between 1 and 20 then
		raise exception using message = 'validation_error', errcode = 'P0001', detail = 'consent_version';
	end if;

	-- GoTrue stores the number without "+".
	select '+' || phone into v_phone from auth.users where id = v_uid;
	if v_phone is null then
		raise exception using message = 'forbidden', errcode = 'P0001', detail = 'phone_not_verified';
	end if;

	insert into public.profiles (id, display_name, phone_e164)
	values (v_uid, v_name, v_phone)
	on conflict (id) do update set display_name = excluded.display_name
	returning * into v_profile;

	insert into public.consents (user_id, document, version) values
		(v_uid, 'kvkk', p_kvkk_version),
		(v_uid, 'terms', p_terms_version)
	on conflict do nothing;

	-- Idempotent, so a repeated call (name change) is harmless.
	perform private.link_pending_invites(v_uid, v_phone);

	return jsonb_build_object(
		'id', v_profile.id, 'display_name', v_profile.display_name, 'phone_e164', v_profile.phone_e164,
		-- The app opens Talepler after onboarding when something is waiting (spec 5.1 step 6).
		'pending_requests', jsonb_array_length(public.list_requests())
	);
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.can_view_agreement(uuid) to authenticated;
