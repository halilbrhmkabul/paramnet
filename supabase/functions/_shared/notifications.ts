// Pure logic of dispatch-notifications, kept free of Deno APIs so packages/shared can test it with
// Vitest (notifications.contract.test.ts). Texts follow copy-tr.md "Bildirim şablonları": they speak
// for the app, never for the creditor (spec 5.9).

export type NotificationPayload = {
	agreement_id: string;
	name: string;
	amount_minor: number;
	due_date: string;
	seq: number;
	count: number;
};

export type ClaimedNotification = {
	id: number;
	template: string;
	payload: NotificationPayload;
	attempts: number;
	tokens: string[];
};

export type PushMessage = {
	to: string;
	title: string;
	body: string;
	data: { agreement_id: string };
	sound: "default";
};

export type PushTicket = { status: "ok" | "error"; details?: { error?: string } };

export type NotificationResult = {
	id: number;
	status: "sent" | "retry" | "failed";
	invalid_tokens: string[];
};

const MONTHS = [
	"Ocak",
	"Şubat",
	"Mart",
	"Nisan",
	"Mayıs",
	"Haziran",
	"Temmuz",
	"Ağustos",
	"Eylül",
	"Ekim",
	"Kasım",
	"Aralık",
];

// Same output as packages/shared formatTRY (ADR-010); the contract test compares them.
export function formatTRY(minor: number): string {
	const sign = minor < 0 ? "-" : "";
	const digits = String(Math.abs(minor)).padStart(3, "0");
	const lira = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
	return `${sign}${lira},${digits.slice(-2)} TL`;
}

function dayMonth(isoDay: string): string {
	const month = MONTHS[Number(isoDay.slice(5, 7)) - 1] ?? "";
	return `${String(Number(isoDay.slice(8, 10)))} ${month}`;
}

export function render(
	template: string,
	p: NotificationPayload,
): { title: string; body: string } | null {
	const amount = formatTRY(p.amount_minor);
	const single = p.count === 1;
	let body: string;
	switch (template) {
		case "dueSoon":
			body = `${dayMonth(p.due_date)} tarihinde ${p.name} için ${amount} ödemen var.`;
			break;
		case "dueToday":
			body = single
				? `Bugün ödeme günü: ${amount}.`
				: `Bugün ödeme günü: ${amount} (${String(p.seq)}/${String(p.count)}. taksit).`;
			break;
		case "overdue1":
			body = `Dünkü ${amount} ödeme henüz kaydedilmedi. Ödediysen kaydet.`;
			break;
		case "overdue7":
			body = single
				? "Ödeme 7 gündür açık görünüyor."
				: `${String(p.seq)}. taksit 7 gündür açık görünüyor.`;
			break;
		default:
			return null;
	}
	return { title: p.name, body };
}

// One Expo message per device token; owners[i] is the outbox row of messages[i].
export function buildMessages(rows: ClaimedNotification[]): {
	messages: PushMessage[];
	owners: number[];
} {
	const messages: PushMessage[] = [];
	const owners: number[] = [];
	for (const row of rows) {
		const text = render(row.template, row.payload);
		if (text === null) {
			continue;
		}
		for (const token of row.tokens) {
			messages.push({
				to: token,
				...text,
				data: { agreement_id: row.payload.agreement_id },
				sound: "default",
			});
			owners.push(row.id);
		}
	}
	return { messages, owners };
}

// A row is done when at least one device accepted it or every token is gone; otherwise it is retried.
export function interpretTickets(
	rows: ClaimedNotification[],
	owners: number[],
	tickets: PushTicket[],
): NotificationResult[] {
	return rows.map((row) => {
		if (render(row.template, row.payload) === null) {
			return { id: row.id, status: "failed", invalid_tokens: [] };
		}
		const indexes = owners.flatMap((owner, i) => (owner === row.id ? [i] : []));
		const invalid = indexes
			.filter((i) => tickets[i]?.details?.error === "DeviceNotRegistered")
			.map((i) => row.tokens[indexes.indexOf(i)] ?? "");
		const delivered = indexes.some((i) => tickets[i]?.status === "ok");
		const allInvalid = invalid.length === indexes.length;
		return {
			id: row.id,
			status: delivered || allInvalid ? "sent" : "retry",
			invalid_tokens: invalid,
		};
	});
}
