import { Ionicons } from "@expo/vector-icons";
import { ACCOUNT_KINDS, accountInputSchema, type AccountKind } from "@paramnet/shared";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAccounts, useArchiveAccount, useCreateAccount, useUpdateAccount } from "@/api/hooks";
import type { Account } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/Checkbox";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { fill, tr } from "@/i18n/tr";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

import { ACCOUNT_LOOK, ConfirmSheet } from "./parts";

// Design ".sw": the "Toplam Nakit'e dahil et" toggle.
export function Toggle({
	label,
	hint,
	value,
	onChange,
	testID,
}: {
	label: string;
	hint: string;
	value: boolean;
	onChange: (value: boolean) => void;
	testID: string;
}) {
	const { colors, typography, radius, spacing } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="switch"
			accessibilityLabel={label}
			accessibilityHint={hint}
			accessibilityState={{ checked: value }}
			onPress={() => {
				onChange(!value);
			}}
			style={[
				styles.toggleRow,
				{
					gap: spacing.md,
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: radius.md,
				},
			]}
		>
			<View style={styles.grow}>
				<Text style={[typography.rowTitle, { color: colors.text }]}>{label}</Text>
				<Text style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}>
					{hint}
				</Text>
			</View>
			<View
				style={[
					styles.track,
					{
						backgroundColor: value ? colors.primary : colors.borderStrong,
						alignItems: value ? "flex-end" : "flex-start",
					},
				]}
			>
				<View style={[styles.knob, { backgroundColor: colors.surface }]} />
			</View>
		</Pressable>
	);
}

function TypeTile({
	kind,
	selected,
	onPress,
}: {
	kind: AccountKind;
	selected: boolean;
	onPress: () => void;
}) {
	const { colors, fonts, radius } = useAppTheme();
	const { icon, tone } = ACCOUNT_LOOK[kind];
	const label = tr.accounts.kinds[kind];
	return (
		<Pressable
			testID={`accountForm.type.${kind}`}
			accessibilityRole="radio"
			accessibilityLabel={label}
			accessibilityState={{ checked: selected }}
			onPress={onPress}
			style={[
				styles.type,
				{
					borderRadius: radius.md,
					borderColor: selected ? colors.accent : colors.border,
					borderWidth: selected ? 2 : 1,
					backgroundColor: colors.surface,
				},
			]}
		>
			<View style={[styles.typeIcon, { backgroundColor: colors[tone[1]] }]}>
				<Ionicons name={icon} size={18} color={colors[tone[0]]} />
			</View>
			<Text style={{ fontFamily: fonts.extrabold, fontSize: 14, color: colors.text }}>
				{label}
			</Text>
		</Pressable>
	);
}

function AccountForm({ account }: { account: Account | null }) {
	const { colors, typography, spacing } = useAppTheme();
	const [kind, setKind] = useState<AccountKind>(account?.kind ?? "bank");
	const [name, setName] = useState(account?.name ?? "");
	const [bank, setBank] = useState(account?.bank_name ?? "");
	const [opening, setOpening] = useState<number | null>(
		account === null ? null : Math.abs(account.opening_balance_minor),
	);
	const [negative, setNegative] = useState((account?.opening_balance_minor ?? 0) < 0);
	const [include, setInclude] = useState(account?.include_in_total ?? true);
	const [nameError, setNameError] = useState<string | undefined>();
	const [archiveOpen, setArchiveOpen] = useState(false);
	// Same key on a retry after a dropped connection: the server returns the first result (BR-11).
	const key = useRef(newIdempotencyKey());
	const create = useCreateAccount();
	const update = useUpdateAccount();
	const archive = useArchiveAccount();
	const saving = create.isPending || update.isPending;
	const error = create.error ?? update.error ?? archive.error;
	const hasBank = kind === "bank" || kind === "savings";

	function submit() {
		const amount = opening ?? 0;
		const parsed = accountInputSchema.safeParse({
			kind,
			name,
			bank_name: hasBank ? bank : null,
			opening_balance_minor: negative ? -amount : amount,
			include_in_total: include,
		});
		if (!parsed.success) {
			const issue = parsed.error.issues.find((i) => i.path[0] === "name");
			setNameError(
				issue?.message === "too_long"
					? tr.accountForm.tooLong
					: tr.accountForm.nameRequired,
			);
			return;
		}
		setNameError(undefined);
		const done = () => {
			router.back();
		};
		if (account === null) {
			create.mutate({ input: parsed.data, idempotencyKey: key.current }, { onSuccess: done });
		} else {
			update.mutate(
				{ id: account.id, input: parsed.data, rowVersion: account.row_version },
				{ onSuccess: done },
			);
		}
	}

	return (
		<Screen
			testID="accountForm.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={account === null ? tr.accountForm.submitNew : tr.accountForm.submitEdit}
					loading={saving}
					onPress={submit}
					testID="accountForm.submit.button"
				/>
			}
		>
			<View style={{ gap: spacing.sm }}>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{tr.accountForm.type}
				</Text>
				<View accessibilityRole="radiogroup" style={[styles.types, { gap: 10 }]}>
					{ACCOUNT_KINDS.map((option) => (
						<TypeTile
							key={option}
							kind={option}
							selected={option === kind}
							onPress={() => {
								setKind(option);
							}}
						/>
					))}
				</View>
			</View>
			<TextField
				label={tr.accountForm.name}
				value={name}
				onChangeText={setName}
				placeholder={tr.accountForm.placeholders[kind]}
				maxLength={60}
				error={nameError}
				testID="accountForm.name.input"
			/>
			{hasBank ? (
				<TextField
					label={tr.accountForm.bank}
					value={bank}
					onChangeText={setBank}
					placeholder={tr.accountForm.bankPlaceholder}
					helper={tr.accountForm.bankHint}
					maxLength={40}
					testID="accountForm.bank.input"
				/>
			) : null}
			<View style={{ gap: spacing.xs }}>
				<AmountInput
					label={tr.accountForm.opening}
					value={opening}
					onChangeValue={setOpening}
					helper={tr.accountForm.openingHint}
					testID="accountForm.opening.input"
				/>
				<Checkbox
					label={tr.accountForm.negative}
					checked={negative}
					onChange={setNegative}
					testID="accountForm.negative.checkbox"
				/>
			</View>
			<Toggle
				label={tr.accountForm.include}
				hint={tr.accountForm.includeHint}
				value={include}
				onChange={setInclude}
				testID="accountForm.include.switch"
			/>
			{error === null ? null : (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.caption, { color: colors.overdue }]}
				>
					{messageForError(error)}
				</Text>
			)}
			{account === null ? null : (
				<Button
					label={tr.accountForm.archive}
					variant="ghost"
					onPress={() => {
						setArchiveOpen(true);
					}}
					testID="accountForm.archive.button"
				/>
			)}
			{account === null ? null : (
				<ConfirmSheet
					visible={archiveOpen}
					title={tr.accountForm.archiveTitle}
					body={fill(tr.accountForm.archiveBody, { name: account.name })}
					confirmLabel={tr.accountForm.archiveConfirm}
					busy={archive.isPending}
					onCancel={() => {
						setArchiveOpen(false);
					}}
					onConfirm={() => {
						archive.mutate(
							{ id: account.id, rowVersion: account.row_version },
							{
								onSuccess: () => {
									setArchiveOpen(false);
									router.back();
								},
								onError: () => {
									setArchiveOpen(false);
								},
							},
						);
					}}
					testID="accountForm.archive.sheet"
				/>
			)}
		</Screen>
	);
}

// Design 33 (new) and its edit mode.
export function AccountFormScreen({ id }: { id: string | null }) {
	const accounts = useAccounts();
	if (id === null) {
		return <AccountForm account={null} />;
	}
	if (accounts.isPending) {
		return (
			<Screen testID="accountForm.screen" edges={["bottom"]}>
				<LoadingState rows={4} testID="accountForm.loading" />
			</Screen>
		);
	}
	const account = accounts.data?.accounts.find((a) => a.id === id);
	if (account === undefined) {
		return (
			<Screen testID="accountForm.screen" edges={["bottom"]}>
				<ErrorState
					message={accounts.isError ? messageForError(accounts.error) : tr.error.notFound}
					onRetry={() => {
						void accounts.refetch();
					}}
					testID="accountForm.error"
				/>
			</Screen>
		);
	}
	return <AccountForm account={account} />;
}

const styles = StyleSheet.create({
	grow: { flex: 1 },
	types: { flexDirection: "row", flexWrap: "wrap" },
	type: { width: "48%", flexGrow: 1, minHeight: 84, padding: 12, gap: 8 },
	typeIcon: {
		width: 34,
		height: 34,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	toggleRow: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		paddingHorizontal: 16,
		paddingVertical: 14,
		minHeight: 64,
	},
	track: { width: 50, height: 30, borderRadius: 15, padding: 3, justifyContent: "center" },
	knob: { width: 24, height: 24, borderRadius: 12 },
});
