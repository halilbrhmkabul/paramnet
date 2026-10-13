import { formatDateTR, formatTRY } from "@paramnet/shared";
import { cookies, headers } from "next/headers";

import { changeNumberAction, decideAction, sendCodeAction, verifyCodeAction } from "./actions";
import { Turnstile } from "./Turnstile";
import { CSRF_COOKIE, CSRF_FIELD } from "@/lib/csrf";
import { copy, errorText, fill } from "@/lib/copy";
import { inviteDetails, openInvite, type InviteDetails } from "@/lib/functions";

type Props = {
	params: Promise<{ token: string }>;
	searchParams: Promise<{ e?: string; counter?: string }>;
};

function Csrf({ value }: { value: string }) {
	return <input type="hidden" name={CSRF_FIELD} value={value} />;
}

function ErrorLine({ code }: { code: string | undefined }) {
	const message = errorText(code);
	return message === undefined ? null : (
		<p className="error" role="alert" data-testid="error">
			{message}
		</p>
	);
}

function Invalid({ locked }: { locked: boolean }) {
	return (
		<section data-testid="invalid">
			<h1>{copy.invalidTitle}</h1>
			<p className="muted">{locked ? copy.lockedBody : copy.invalidBody}</p>
		</section>
	);
}

function Result({ decision }: { decision: string }) {
	const title =
		decision === "accept"
			? copy.acceptedTitle
			: decision === "counter"
				? copy.counteredTitle
				: copy.rejectedTitle;
	return (
		<section data-testid="result" className="card">
			<h1 className="success">{title}</h1>
			{decision === "reject" ? null : <p className="muted">{copy.appCta}</p>}
		</section>
	);
}

// W03: the plan from the invitee's side, with the three decisions (and the counter form).
function Decision({
	token,
	csrf,
	details,
	counter,
	error,
}: {
	token: string;
	csrf: string;
	details: InviteDetails;
	counter: boolean;
	error: string | undefined;
}) {
	const remaining = details.principal_minor - details.down_payment_minor;
	const decide = decideAction.bind(null, token);
	const hidden = (
		<>
			<Csrf value={csrf} />
			<input type="hidden" name="version" value={String(details.version)} />
			<input type="hidden" name="terms_hash" value={details.terms_hash} />
		</>
	);
	return (
		<section data-testid="decision" className="page" style={{ padding: 0 }}>
			<h1>{fill(copy.title, { name: details.creator_name })}</h1>
			<div className="card">
				<strong>{details.title}</strong>
				<p className="muted" data-testid="role">
					{details.my_role === "debtor" ? copy.youOwe : copy.owesYou}
				</p>
				<div className="row">
					<span>{copy.total}</span>
					<span className="amount" data-testid="total">
						{formatTRY(details.principal_minor)}
					</span>
				</div>
				{details.down_payment_minor > 0 ? (
					<div className="row">
						<span>{copy.downPayment}</span>
						<span className="amount">{formatTRY(details.down_payment_minor)}</span>
					</div>
				) : null}
				<div className="row">
					<span>{copy.remaining}</span>
					<span className="amount">{formatTRY(remaining)}</span>
				</div>
				{details.notes === null ? null : (
					<p className="muted">
						{copy.notes}: {details.notes}
					</p>
				)}
			</div>

			<ErrorLine code={error} />

			{counter ? (
				<form action={decide} className="card" data-testid="counter-form">
					<strong>{copy.counterTitle}</strong>
					<p className="muted">{copy.counterHelper}</p>
					{hidden}
					<input type="hidden" name="decision" value="counter" />
					<input type="hidden" name="rows" value={String(details.plan.length)} />
					{details.plan.map((row) => (
						<div key={row.seq} className="row">
							<label>
								{fill(copy.installment, { seq: String(row.seq) })} · {copy.dueDate}
								<input
									type="date"
									name={`due_date.${String(row.seq)}`}
									defaultValue={row.due_date ?? ""}
								/>
							</label>
							<label>
								{copy.amount}
								<input
									name={`amount.${String(row.seq)}`}
									inputMode="decimal"
									defaultValue={formatTRY(row.amount_minor).replace(/^₺/, "")}
								/>
							</label>
						</div>
					))}
					<button type="submit" data-testid="counter-send">
						{copy.counterSend}
					</button>
					<a href={`/i/${token}`}>{copy.cancel}</a>
				</form>
			) : (
				<>
					<div className="card">
						<strong>{copy.plan}</strong>
						{details.plan.map((row) => (
							<div
								key={row.seq}
								className="row"
								data-testid={`plan-row-${String(row.seq)}`}
							>
								<span>
									{fill(copy.installment, { seq: String(row.seq) })} ·{" "}
									{row.due_date === null
										? copy.noDueDate
										: formatDateTR(row.due_date, "long")}
								</span>
								<span className="amount">{formatTRY(row.amount_minor)}</span>
							</div>
						))}
					</div>
					{details.payments.length === 0 ? null : (
						<div className="card">
							<strong>{copy.earlierPayments}</strong>
							<p className="muted">{copy.earlierPaymentsNote}</p>
							{details.payments.map((payment, index) => (
								<div key={index} className="row">
									<span>{formatDateTR(payment.paid_on, "long")}</span>
									<span className="amount">
										{formatTRY(payment.amount_minor)}
									</span>
								</div>
							))}
						</div>
					)}
					<form action={decide}>
						{hidden}
						<button type="submit" name="decision" value="accept" data-testid="accept">
							{copy.accept}
						</button>
					</form>
					<a href={`/i/${token}?counter=1`} data-testid="counter">
						{copy.counter}
					</a>
					<form action={decide}>
						{hidden}
						<button
							type="submit"
							name="decision"
							value="reject"
							className="ghost"
							data-testid="reject"
						>
							{copy.reject}
						</button>
					</form>
				</>
			)}
		</section>
	);
}

export default async function InvitePage({ params, searchParams }: Props) {
	const { token } = await params;
	const { e: error, counter } = await searchParams;
	const store = await cookies();
	const csrf = store.get(CSRF_COOKIE)?.value ?? "";
	const nonce = (await headers()).get("x-nonce") ?? undefined;

	const decided = store.get("pn_result")?.value;
	if (decided !== undefined) {
		return <Result decision={decided} />;
	}

	// GET only reads (spec 11.2): opening this page never changes the invite.
	const opened = await openInvite(token);
	if (!opened.ok || opened.data.status !== "active") {
		return <Invalid locked={opened.ok && opened.data.status === "locked"} />;
	}

	const session = store.get("pn_session")?.value;
	if (session !== undefined) {
		const current = await inviteDetails(session);
		if (current.ok) {
			return (
				<Decision
					token={token}
					csrf={csrf}
					details={current.data.details}
					counter={counter === "1"}
					error={error}
				/>
			);
		}
	}

	const phone = store.get("pn_phone")?.value;
	if (phone !== undefined) {
		return (
			<section data-testid="code">
				<h1>{copy.codeTitle}</h1>
				<p className="muted">{fill(copy.codeHelper, { phone })}</p>
				<ErrorLine code={error} />
				<form action={verifyCodeAction.bind(null, token)}>
					<Csrf value={csrf} />
					<label>
						{copy.codeLabel}
						<input
							name="code"
							inputMode="numeric"
							autoComplete="one-time-code"
							maxLength={6}
							required
							data-testid="code-input"
						/>
					</label>
					<button type="submit" data-testid="verify">
						{copy.verify}
					</button>
				</form>
				<form action={changeNumberAction.bind(null, token)}>
					<Csrf value={csrf} />
					<button type="submit" className="ghost">
						{copy.changeNumber}
					</button>
				</form>
			</section>
		);
	}

	// W01: only the creator's name before the number is verified (spec 5.4).
	return (
		<section data-testid="open">
			<h1>{fill(copy.title, { name: opened.data.creator_name ?? "" })}</h1>
			<p className="muted">{copy.intro}</p>
			<ErrorLine code={error} />
			<form action={sendCodeAction.bind(null, token)}>
				<Csrf value={csrf} />
				<label>
					{copy.phoneLabel}
					<input
						name="phone"
						type="tel"
						inputMode="tel"
						autoComplete="tel"
						placeholder={copy.phonePlaceholder}
						required
						data-testid="phone-input"
					/>
				</label>
				<Turnstile nonce={nonce} />
				<button type="submit" data-testid="send-code">
					{copy.sendCode}
				</button>
			</form>
			<p className="muted">{copy.safety}</p>
		</section>
	);
}
