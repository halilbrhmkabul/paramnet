import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { RowGroup } from "@/components/RowGroup";
import { Screen } from "@/components/Screen";
import { useNewDraft } from "@/features/new/draftStore";
import type { NewType } from "@/features/new/formModel";
import { tr } from "@/i18n/tr";
import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

import type { FormKind } from "./TransactionFormScreen";

type IconName = keyof typeof Ionicons.glyphMap;

const MONEY: { kind: FormKind; label: string; icon: IconName; tone: [ColorToken, ColorToken] }[] = [
	{
		kind: "income",
		label: tr.action.income,
		icon: "arrow-up-outline",
		tone: ["success", "successSoft"],
	},
	{
		kind: "expense",
		label: tr.action.expense,
		icon: "receipt-outline",
		tone: ["overdue", "overdueSoft"],
	},
	{
		kind: "transfer",
		label: tr.action.transfer,
		icon: "swap-horizontal",
		tone: ["pending", "pendingSoft"],
	},
];

function Tile({
	label,
	icon,
	tone,
	onPress,
	testID,
}: {
	label: string;
	icon: IconName;
	tone: [ColorToken, ColorToken];
	onPress: () => void;
	testID: string;
}) {
	const { colors, fonts } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
			style={({ pressed }) => [
				styles.tile,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					opacity: pressed ? 0.7 : 1,
				},
			]}
		>
			<View style={[styles.tileIcon, { backgroundColor: colors[tone[1]] }]}>
				<Ionicons name={icon} size={22} color={colors[tone[0]]} />
			</View>
			<Text
				style={{
					fontFamily: fonts.bold,
					fontSize: 13,
					color: colors.text,
					textAlign: "center",
				}}
			>
				{label}
			</Text>
		</Pressable>
	);
}

// Design 21 ".row": an icon tile, the title and a line under it.
function HintRow({
	title,
	hint,
	icon,
	tone,
	onPress,
	testID,
}: {
	title: string;
	hint: string;
	icon: IconName;
	tone: [ColorToken, ColorToken];
	onPress: () => void;
	testID: string;
}) {
	const { colors, typography, spacing } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={`${title}, ${hint}`}
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				{ gap: spacing.md, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 },
			]}
		>
			<View style={[styles.rowIcon, { backgroundColor: colors[tone[1]] }]}>
				<Ionicons name={icon} size={20} color={colors[tone[0]]} />
			</View>
			<View style={styles.grow}>
				<Text style={[typography.rowTitle, { color: colors.text }]}>{title}</Text>
				<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
					{hint}
				</Text>
			</View>
		</Pressable>
	);
}

// Design 21. Rows for modules that are not built yet (Para iste, Hesap böl, Ödeme kaydet)
// stay hidden until their tasks (ADR-053).
export function ActionCenterScreen() {
	const { colors, typography, spacing } = useAppTheme();
	const start = useNewDraft((state) => state.start);
	const openNew = (type: NewType) => {
		start(type);
		router.push("/new/form");
	};
	return (
		<Screen testID="action.screen">
			<View style={{ gap: spacing.xs }}>
				<Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
					{tr.action.title}
				</Text>
				<Text style={[typography.callout, { color: colors.textMuted }]}>
					{tr.action.subtitle}
				</Text>
			</View>
			<View style={{ gap: spacing.sm }}>
				<Text
					style={[
						typography.label,
						{ color: colors.textMuted, paddingHorizontal: spacing.xs },
					]}
				>
					{tr.action.money}
				</Text>
				<View style={[styles.tiles, { gap: spacing.sm }]}>
					{MONEY.map((item) => (
						<Tile
							key={item.kind}
							label={item.label}
							icon={item.icon}
							tone={item.tone}
							onPress={() => {
								router.push({
									pathname: "/transaction/new",
									params: { kind: item.kind },
								});
							}}
							testID={`action.${item.kind}`}
						/>
					))}
				</View>
			</View>
			<RowGroup label={tr.action.debts}>
				<HintRow
					title={tr.action.borrow}
					hint={tr.action.borrowHint}
					icon="arrow-down-outline"
					tone={["neutral", "neutralSoft"]}
					onPress={() => {
						openNew("borrowed");
					}}
					testID="action.borrow"
				/>
				<HintRow
					title={tr.action.lend}
					hint={tr.action.lendHint}
					icon="arrow-up-outline"
					tone={["pending", "pendingSoft"]}
					onPress={() => {
						openNew("lent");
					}}
					testID="action.lend"
				/>
			</RowGroup>
			<RowGroup label={tr.action.plans}>
				<HintRow
					title={tr.action.installment}
					hint={tr.action.installmentHint}
					icon="layers-outline"
					tone={["warning", "warningSoft"]}
					onPress={() => {
						// Bought or sold on instalments: the type picker asks which (F4-09 brings design 23).
						router.push("/new");
					}}
					testID="action.installment"
				/>
				<HintRow
					title={tr.action.recurring}
					hint={tr.action.recurringHint}
					icon="repeat-outline"
					tone={["neutral", "neutralSoft"]}
					onPress={() => {
						router.push("/recurring");
					}}
					testID="action.recurring"
				/>
				<HintRow
					title={tr.action.loan}
					hint={tr.action.loanHint}
					icon="business-outline"
					tone={["primary", "primarySoft"]}
					onPress={() => {
						router.push("/loans/new");
					}}
					testID="action.loan"
				/>
			</RowGroup>
		</Screen>
	);
}

const styles = StyleSheet.create({
	tiles: { flexDirection: "row" },
	tile: {
		flex: 1,
		alignItems: "center",
		gap: 8,
		paddingTop: 14,
		paddingBottom: 12,
		paddingHorizontal: 4,
		borderRadius: 18,
		borderWidth: 1,
		minHeight: 96,
	},
	row: { flexDirection: "row", alignItems: "center", minHeight: 64, paddingVertical: 10 },
	rowIcon: {
		width: 40,
		height: 40,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
	},
	grow: { flex: 1, minWidth: 0 },
	tileIcon: {
		width: 44,
		height: 44,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
	},
});
