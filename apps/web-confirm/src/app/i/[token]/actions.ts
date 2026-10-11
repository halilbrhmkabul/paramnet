"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { counterFromForm } from "@/lib/counter";
import { CSRF_COOKIE, CSRF_FIELD, sameToken } from "@/lib/csrf";
import { field } from "@/lib/form";
import { decide, inviteDetails, sendCode, verifyCode } from "@/lib/functions";

const PHONE_COOKIE = "pn_phone";
const SESSION_COOKIE = "pn_session";
const RESULT_COOKIE = "pn_result";

// Cookies live only under this invite's path, are HttpOnly and strictly same-site (spec / security.md).
function cookieOptions(token: string, maxAge: number) {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict" as const,
		path: `/i/${token}`,
		maxAge,
	};
}

function back(token: string, error?: string, options: { counter?: boolean } = {}): never {
	const query = new URLSearchParams();
	if (options.counter === true) {
		query.set("counter", "1");
	}
	if (error !== undefined) {
		query.set("e", error);
	}
	const search = query.toString();
	redirect(`/i/${encodeURIComponent(token)}${search === "" ? "" : `?${search}`}`);
}

async function checkCsrf(token: string, form: FormData): Promise<void> {
	const store = await cookies();
	if (!sameToken(store.get(CSRF_COOKIE)?.value, field(form, CSRF_FIELD))) {
		back(token, "csrf");
	}
}

export async function sendCodeAction(token: string, form: FormData): Promise<void> {
	await checkCsrf(token, form);
	const phone = field(form, "phone");
	const result = await sendCode(token, phone, field(form, "cf-turnstile-response"));
	if (!result.ok) {
		back(token, result.error);
	}
	(await cookies()).set(PHONE_COOKIE, phone, cookieOptions(token, 10 * 60));
	back(token);
}

export async function changeNumberAction(token: string, form: FormData): Promise<void> {
	await checkCsrf(token, form);
	(await cookies()).delete({ name: PHONE_COOKIE, path: `/i/${token}` });
	back(token);
}

export async function verifyCodeAction(token: string, form: FormData): Promise<void> {
	await checkCsrf(token, form);
	const store = await cookies();
	const result = await verifyCode(
		token,
		store.get(PHONE_COOKIE)?.value ?? "",
		field(form, "code"),
	);
	if (!result.ok) {
		back(token, result.error);
	}
	store.set(SESSION_COOKIE, result.data.session, cookieOptions(token, 15 * 60));
	store.delete({ name: PHONE_COOKIE, path: `/i/${token}` });
	back(token);
}

export async function decideAction(token: string, form: FormData): Promise<void> {
	await checkCsrf(token, form);
	const store = await cookies();
	const session = store.get(SESSION_COOKIE)?.value ?? "";
	const decision = field(form, "decision");
	const version = Number(form.get("version"));
	const termsHash = field(form, "terms_hash");

	let counterTerms: unknown;
	if (decision === "counter") {
		const current = await inviteDetails(session);
		if (!current.ok) {
			back(token, current.error);
		}
		const { principal_minor, down_payment_minor, notes } = current.data.details;
		const counter = counterFromForm({ principal_minor, down_payment_minor, notes }, form);
		if (!counter.ok) {
			back(token, counter.error, { counter: true });
		}
		counterTerms = counter.terms;
	}

	const result = await decide(session, {
		version,
		terms_hash: termsHash,
		decision,
		counter_terms: counterTerms,
	});
	if (!result.ok) {
		back(token, result.error);
	}
	store.delete({ name: SESSION_COOKIE, path: `/i/${token}` });
	store.set(RESULT_COOKIE, decision, cookieOptions(token, 60 * 60));
	back(token);
}
