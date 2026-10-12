// Pure logic of dispatch-notifications, kept free of Deno APIs so packages/shared can test it with
// Vitest (notifications.contract.test.ts). Texts follow copy-tr.md "Bildirim şablonları": they speak
// for the app, never for the creditor (spec 5.9).

// Reminders carry the installment fields; payment events carry the remaining balance instead.
export type NotificationPayload = {
	agreement_id: string;
	name: string;
	amount_minor: number;
	due_date?: string;
	seq?: number;
	count?: number;
	remaining_minor?: number;
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
	const remaining = formatTRY(p.remaining_minor ?? 0);
	const single = p.count === 1;
	const seq = String(p.seq ?? 0);
	switch (template) {
		case "dueSoon":
			return {
				title: p.name,
				body: `${dayMonth(p.due_date ?? "")} tarihinde ${p.name} için ${amount} ödemen var.`,
			};
		case "dueToday":
			return {
				title: p.name,
				body: single
					? `Bugün ödeme günü: ${amount}.`
					: `Bugün ödeme günü: ${amount} (${seq}/${String(p.count ?? 0)}. taksit).`,
			};
		case "overdue1":
			return {
				title: p.name,
				body: `Dünkü ${amount} ödeme henüz kaydedilmedi. Ödediysen kaydet.`,
			};
		case "overdue7":
			return {
				title: p.name,
				body: single
					? "Ödeme 7 gündür açık görünüyor."
					: `${seq}. taksit 7 gündür açık görünüyor.`,
			};
		// Payment events on a shared agreement (F2-07); the other party's name is in the text.
		case "paymentReported":
			return {
				title: "Paramnet",
				body: `${p.name} ${amount} ödeme yaptığını bildirdi. Aldın mı?`,
			};
		case "paymentConfirmed":
			return {
				title: "Paramnet",
				body: `${p.name} ${amount} ödemeni onayladı. Kalan: ${remaining}.`,
			};
		case "paymentRecorded":
			return {
				title: "Paramnet",
				body: `${p.name} ${amount} ödemeni kaydetti. Kalan: ${remaining}.`,
			};
		case "paymentRejected":
			return {
				title: "Paramnet",
				body: `${p.name} ${amount} ödemeyi almadığını belirtti. Bir sorun varsa birlikte bakabilirsiniz.`,
			};
		// Amendments (F2-08).
		case "amendmentProposed":
			return {
				title: "Paramnet",
				body: `${p.name} planda bir değişiklik önerdi. Göz atar mısın?`,
			};
		case "amendmentAccepted":
			return {
				title: "Paramnet",
				body: `${p.name} değişiklik önerini kabul etti. Yeni plan geçerli.`,
			};
		case "amendmentRejected":
			return {
				title: "Paramnet",
				body: `${p.name} değişiklik önerini kabul etmedi. Mevcut plan geçerli.`,
			};
		// Disputes, mutual cancellation and forgiveness (F2-09).
		case "disputeOpened":
			return {
				title: "Paramnet",
				body: `${p.name} bu anlaşmaya itiraz etti. Gerekçesine göz atabilirsin.`,
			};
		case "disputeResolved":
			return {
				title: "Paramnet",
				body: `${p.name} itirazını geri çekti. Anlaşma yeniden yürürlükte.`,
			};
		case "cancelRequested":
			return {
				title: "Paramnet",
				body: `${p.name} anlaşmayı birlikte iptal etmek istiyor. Göz atar mısın?`,
			};
		case "cancelAccepted":
			return {
				title: "Paramnet",
				body: `${p.name} iptal talebini kabul etti. Anlaşma iptal edildi.`,
			};
		case "cancelRejected":
			return {
				title: "Paramnet",
				body: `${p.name} iptal talebini kabul etmedi. Anlaşma sürüyor.`,
			};
		case "forgiven":
			return {
				title: "Paramnet",
				body:
					p.remaining_minor === 0
						? `${p.name} kalan ${amount} borcunu sildi. Anlaşma kapandı.`
						: `${p.name} borcundan ${amount} indirdi. Kalan: ${remaining}.`,
			};
		default:
			return null;
	}
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
