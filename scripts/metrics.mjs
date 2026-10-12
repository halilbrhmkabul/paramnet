// Simple metrics panel (F3-02, spec 13.1–13.2): `pnpm metrics [days]`.
// Local: reads the URL and service role key from `supabase status`. Remote: set METRICS_SUPABASE_URL and
// METRICS_SERVICE_ROLE_KEY in the shell (never commit them; the key never goes into an app).
import { execFileSync } from "node:child_process";

const days = Number(process.argv[2] ?? 30);
if (!Number.isInteger(days) || days < 0 || days > 365) {
	console.error("Gün sayısı 0–365 arası olmalı: pnpm metrics 30");
	process.exit(1);
}

function localStatus() {
	const out = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], {
		encoding: "utf8",
	});
	const value = (key) => out.match(new RegExp(`^${key}="?([^"\\n]+)"?$`, "m"))?.[1];
	return { url: value("API_URL"), key: value("SERVICE_ROLE_KEY") ?? value("SECRET_KEY") };
}

const target =
	process.env.METRICS_SUPABASE_URL && process.env.METRICS_SERVICE_ROLE_KEY
		? { url: process.env.METRICS_SUPABASE_URL, key: process.env.METRICS_SERVICE_ROLE_KEY }
		: localStatus();
if (!target.url || !target.key) {
	console.error(
		"Supabase adresi veya servis anahtarı bulunamadı (yerelde `pnpm supabase start`).",
	);
	process.exit(1);
}

const response = await fetch(`${target.url}/rest/v1/rpc/get_metrics`, {
	method: "POST",
	headers: {
		apikey: target.key,
		authorization: `Bearer ${target.key}`,
		"content-type": "application/json",
	},
	body: JSON.stringify({ p_days: days }),
});
if (!response.ok) {
	console.error(`get_metrics başarısız: ${response.status} ${await response.text()}`);
	process.exit(1);
}
const m = await response.json();

const pct = (value) => (value === null ? "—" : `%${Math.round(value * 100)}`);
const num = (value) => (value === null ? "—" : String(value));
const duration = (seconds) => {
	if (seconds === null) return "—";
	if (seconds < 3600) return `${Math.round(seconds / 60)} dk`;
	if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} sa`;
	return `${(seconds / 86400).toFixed(1)} gün`;
};

// Targets from spec 13.2 (pilot decision thresholds).
const rows = [
	["Haftalık aktif anlaşma (son 7 gün)", num(m.weekly_active_agreements), "kuzey yıldızı"],
	["Kayıt", num(m.signups), ""],
	["Aktivasyon (ilk anlaşma)", pct(m.activation_rate), "%60+"],
	["Kayıttan ilk anlaşmaya (medyan)", duration(m.median_first_agreement_seconds), "< 90 sn*"],
	["Oluşturulan anlaşma", num(m.agreements_created), ""],
	["Taksitli oran", pct(m.installment_rate), "izlenecek"],
	["Paylaşım oranı", pct(m.share_rate), "%25+"],
	["Davet kabulü", pct(m.invite_acceptance_rate), "%50+"],
	["Kabullerde web payı", pct(m.web_acceptance_share), "izlenecek"],
	["Doğrulanan ödeme oranı", pct(m.verified_payment_rate), "izlenecek"],
	["Tekrar kullanım", pct(m.repeat_rate), "%30+"],
	["D7 tutunma", pct(m.d7_retention), "%30+"],
	["D30 tutunma", pct(m.d30_retention), "%15+"],
	["Gönderilen hatırlatma", num(m.reminders_sent), ""],
	["Açılan bildirim", num(m.reminders_opened), ""],
	[
		"Açılan davet (web / uygulama)",
		`${num(m.invites_opened_web)} / ${num(m.invites_opened_app)}`,
		"",
	],
];

console.log(
	`\nParamnet metrikleri — son ${m.window_days} gün (${new Date(m.generated_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })})\n`,
);
const width = Math.max(...rows.map(([label]) => label.length));
for (const [label, value, target] of rows) {
	console.log(`${label.padEnd(width)}  ${value.padStart(8)}  ${target}`);
}
console.log("\n* Spec hedefi uygulama açılışından ölçülür; burada kayıt anından ölçülüyor.\n");
