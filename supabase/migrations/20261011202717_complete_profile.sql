-- F1-16: profile creation after phone OTP sign-in, with the KVKK and terms consent (spec 5.1 steps 3–4).
-- The number comes from auth.users (verified by OTP), never from the client.

create function public.complete_profile(p_display_name text, p_kvkk_version text, p_terms_version text)
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

	return jsonb_build_object('id', v_profile.id, 'display_name', v_profile.display_name, 'phone_e164', v_profile.phone_e164);
end;
$$;

revoke all on function public.complete_profile(text, text, text) from public, anon;
grant execute on function public.complete_profile(text, text, text) to authenticated;
