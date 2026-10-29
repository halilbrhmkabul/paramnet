import { Ionicons } from "@expo/vector-icons";
import { formatTRY, SPLIT_MAX_MEMBERS, type IsoDate, type SplitMode } from "@paramnet/shared";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useCreateSplit, useMyProfile, useParamnetIdLookup } from "@/api/hooks";
import { AmountInput } from "@/components/AmountInput";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { DateField } from "@/components/DateField";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { idInputState } from "@/features/agreement/ShareScreen";
import { fill, tr } from "@/i18n/tr";
import { useToday } from "@/lib/clock";
import { pickContact } from "@/lib/contactPicker";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

import { buildSplitInput, computeShares, type DraftPerson } from "./splitModel";

type IconName = keyof typeof Ionicons.glyphMap;
type Adding = null | "id" | "name";

function AddTile({
	label,
	icon,
	onPress,
	testID,
}: {
	label: string;
	icon: IconName;
	onPress: () => void;
	testID: string;
}) {
	const { colors, fonts, radius } = useAppTheme();
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
					borderRadius: radius.md,
					opacity: pressed ? 0.7 : 1,
				},
			]}
		>
			<View style={[styles.tileIcon, { backgroundColor: colors.primarySoft }]}>
				<Ionicons name={icon} size={18} color={colors.primary} />
			</View>
			<Text
				style={{
					fontFamily: fonts.bold,
					fontSize: 12,
					color: colors.primary,
					textAlign: "center",
				}}
			>
				{label}
			</Text>
		</Pressable>
	);
}

function IdAdder({
	taken,
	onAdd,
	onCancel,
}: {
	taken: readonly string[];
	onAdd: (person: { display_name: string; paramnet_id: string }) => void;
	onCancel: () => void;
}) {
	const { colors, typography, spacing } = useAppTheme();
	const [input, setInput] = useState("");
	const state = idInputState(input);
	const id = typeof state === "object" ? state.id : null;
	const lookup = useParamnetIdLookup(id);
	const found = lookup.data?.status === "found" ? lookup.data : null;
	const duplicate = found !== null && taken.includes(found.paramnet_id);
	return (
		<View style={{ gap: spacing.sm }} testID="split.idAdder">
			<TextField
				label={tr.split.idTitle}
				value={input}
				onChangeText={setInput}
				placeholder={tr.split.idPlaceholder}
				autoCapitalize="characters"
				testID="split.id.input"
			/>
			{lookup.data?.status === "not_found" ? (
				<Text style={[typography.caption, { color: colors.overdue }]}>
					{tr.request.notFound}
				</Text>
			) : null}
			{found === null ? null : (
				<Text
					testID="split.id.found"
					style={[typography.caption, { color: colors.accent }]}
				>
					{duplicate
						? tr.split.idDuplicate
						: fill(tr.split.idFound, {
								name: found.display_name,
								id: found.paramnet_id,
							})}
				</Text>
			)}
			<View style={[styles.row, { gap: spacing.sm }]}>
				<View style={styles.grow}>
					<Button
						label={tr.split.cancel}
						variant="secondary"
						onPress={onCancel}
						testID="split.id.cancel"
					/>
				</View>
				<View style={styles.grow}>
					<Button
						label={tr.split.idAdd}
						disabled={found === null || duplicate}
						onPress={() => {
							if (found !== null && !duplicate) {
								onAdd({
									display_name: found.display_name,
									paramnet_id: found.paramnet_id,
								});
							}
						}}
						testID="split.id.add"
					/>
				</View>
			</View>
		</View>
	);
}

function NameAdder({ onAdd, onCancel }: { onAdd: (name: string) => void; onCancel: () => void }) {
	const { colors, typography, spacing } = useAppTheme();
	const [name, setName] = useState("");
	return (
		<View style={{ gap: spacing.sm }} testID="split.nameAdder">
			<TextField
				label={tr.split.nameTitle}
				value={name}
				onChangeText={setName}
				placeholder={tr.split.namePlaceholder}
				maxLength={80}
				testID="split.name.input"
			/>
			<Text style={[typography.caption, { color: colors.textMuted }]}>
				{tr.split.linkHint}
			</Text>
			<View style={[styles.row, { gap: spacing.sm }]}>
				<View style={styles.grow}>
					<Button
						label={tr.split.cancel}
						variant="secondary"
						onPress={onCancel}
						testID="split.name.cancel"
					/>
				</View>
				<View style={styles.grow}>
					<Button
						label={tr.split.nameAdd}
						disabled={name.trim() === ""}
						onPress={() => {
							onAdd(name.trim());
						}}
						testID="split.name.add"
					/>
				</View>
			</View>
		</View>
	);
}

function ShareField({
	mode,
	person,
	label,
	onChange,
	testID,
}: {
	mode: SplitMode;
	person: Pick<DraftPerson, "amount" | "percent">;
	label: string;
	onChange: (patch: Partial<DraftPerson>) => void;
	testID: string;
}) {
	const { colors, fonts, radius } = useAppTheme();
	if (mode === "amount") {
		return (
			<View style={styles.shareField}>
				<AmountInput
					label={label}
					value={person.amount}
					onChangeValue={(amount) => {
						onChange({ amount });
					}}
					testID={testID}
				/>
			</View>
		);
	}
	return (
		<TextInput
			testID={testID}
			accessibilityLabel={label}
			value={person.percent}
			onChangeText={(percent) => {
				onChange({ percent });
			}}
			placeholder={tr.split.percentPlaceholder}
			placeholderTextColor={colors.textMuted}
			keyboardType="decimal-pad"
			style={[
				styles.percent,
				{
					borderColor: colors.borderStrong,
					borderRadius: radius.sm,
					color: colors.text,
					fontFamily: fonts.bold,
					backgroundColor: colors.surface,
				},
			]}
		/>
	);
}

// Design 40 "Hesabı böl": the bill, who is in it and how it is split; shares become loan records
// (ADR-061). The QR code and link open once the split exists (design 41).
export function SplitCreateScreen() {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const today = useToday();
	const me = useMyProfile();
	const [title, setTitle] = useState("");
	const [total, setTotal] = useState<number | null>(null);
	const [spentOn, setSpentOn] = useState<IsoDate>(today);
	const [mode, setMode] = useState<SplitMode>("equal");
	const [mine, setMine] = useState<Pick<DraftPerson, "amount" | "percent">>({
		amount: null,
		percent: "",
	});
	const [people, setPeople] = useState<DraftPerson[]>([]);
	const [adding, setAdding] = useState<Adding>(null);
	const [error, setError] = useState<string | null>(null);
	const key = useRef(newIdempotencyKey());
	// Row keys only; nothing leaves the device with them.
	const nextKey = useRef(0);
	const create = useCreateSplit();

	const myName = me.data?.display_name ?? "";
	const included = people.filter((p) => p.included);
	const result = computeShares(total ?? 0, mode, mine, people);
	const shareOf = (person: DraftPerson) =>
		result.shares?.[included.indexOf(person) + 1] ?? person.amount ?? 0;

	function add(person: Pick<DraftPerson, "display_name" | "paramnet_id">) {
		setPeople((list) => [
			...list,
			{
				...person,
				key: String((nextKey.current += 1)),
				included: true,
				amount: null,
				percent: "",
			},
		]);
		setAdding(null);
	}

	function patch(personKey: string, change: Partial<DraftPerson>) {
		setPeople((list) => list.map((p) => (p.key === personKey ? { ...p, ...change } : p)));
	}

	async function fromContacts() {
		const picked = await pickContact();
		if (picked !== null && picked.display_name !== "") {
			add({ display_name: picked.display_name, paramnet_id: null });
		}
	}

	function submit() {
		if (title.trim() === "") {
			setError(tr.split.needTitle);
			return;
		}
		if (total === null || total <= 0) {
			setError(tr.split.needAmount);
			return;
		}
		if (included.length === 0) {
			setError(tr.split.needPeople);
			return;
		}
		if (result.shares === null) {
			setError(tr.split.needShares);
			return;
		}
		setError(null);
		create.mutate(
			{
				input: buildSplitInput({ title, total, spentOn, mode }, people, result.shares),
				idempotencyKey: key.current,
			},
			{
				onSuccess: ({ split_id }) => {
					router.replace({ pathname: "/split/[id]/invite", params: { id: split_id } });
				},
			},
		);
	}

	const message =
		error ?? (create.error === null ? null : messageForError(create.error, "paramnetId"));
	const canAdd = people.length < SPLIT_MAX_MEMBERS;
	const footer = (
		<View style={{ gap: spacing.sm }}>
			{message === null ? null : (
				<Text
					testID="split.error"
					accessibilityLiveRegion="polite"
					style={[typography.caption, { color: colors.overdue }]}
				>
					{message}
				</Text>
			)}
			<Button
				label={tr.split.create}
				loading={create.isPending}
				onPress={submit}
				testID="split.create.button"
			/>
		</View>
	);

	return (
		<Screen testID="split.create.screen" edges={["bottom"]} footer={footer}>
			<View
				style={{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					borderRadius: radius.lg,
					padding: spacing.lg,
					gap: spacing.md,
				}}
			>
				<TextField
					label={tr.split.titleLabel}
					value={title}
					onChangeText={setTitle}
					placeholder={tr.split.titlePlaceholder}
					maxLength={80}
					testID="split.title.input"
				/>
				<AmountInput
					label={tr.split.amountLabel}
					value={total}
					onChangeValue={setTotal}
					testID="split.amount.input"
				/>
				<View style={[styles.row, { gap: spacing.sm, alignItems: "flex-end" }]}>
					<View
						style={[
							styles.payer,
							{ backgroundColor: colors.surfaceSunken, borderRadius: 10, gap: 6 },
						]}
					>
						<Ionicons name="card-outline" size={14} color={colors.text} />
						<Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.text }}>
							{tr.split.payer}
						</Text>
					</View>
					<View style={styles.grow}>
						<DateField
							label={tr.split.dateLabel}
							value={spentOn}
							onChange={(date) => {
								setSpentOn(date > today ? today : date);
							}}
							defaultPickerDate={today}
							testID="split.date"
						/>
					</View>
				</View>
			</View>

			<View style={{ gap: spacing.sm }}>
				<Text style={[typography.label, { color: colors.textMuted, paddingHorizontal: 4 }]}>
					{tr.split.addPeople}
				</Text>
				<View style={[styles.row, { gap: spacing.sm }]}>
					<AddTile
						label={tr.split.addQr}
						icon="qr-code-outline"
						onPress={() => {
							if (canAdd) setAdding("name");
						}}
						testID="split.add.qr"
					/>
					<AddTile
						label={tr.split.addLink}
						icon="link-outline"
						onPress={() => {
							if (canAdd) setAdding("name");
						}}
						testID="split.add.link"
					/>
					<AddTile
						label={tr.split.addId}
						icon="search-outline"
						onPress={() => {
							if (canAdd) setAdding("id");
						}}
						testID="split.add.id"
					/>
					<AddTile
						label={tr.split.addContact}
						icon="person-outline"
						onPress={() => {
							if (canAdd) void fromContacts();
						}}
						testID="split.add.contact"
					/>
				</View>
				{adding === "id" ? (
					<IdAdder
						taken={people.flatMap((p) =>
							p.paramnet_id === null ? [] : [p.paramnet_id],
						)}
						onAdd={add}
						onCancel={() => {
							setAdding(null);
						}}
					/>
				) : adding === "name" ? (
					<NameAdder
						onAdd={(display_name) => {
							add({ display_name, paramnet_id: null });
						}}
						onCancel={() => {
							setAdding(null);
						}}
					/>
				) : null}
			</View>

			<SegmentedControl
				label={tr.split.howToSplit}
				options={[
					{ value: "equal", label: tr.split.modes.equal },
					{ value: "amount", label: tr.split.modes.amount },
					{ value: "percent", label: tr.split.modes.percent },
				]}
				value={mode}
				onChange={setMode}
				testID="split.mode"
			/>

			<View style={{ gap: spacing.sm }}>
				<Text style={[typography.label, { color: colors.textMuted, paddingHorizontal: 4 }]}>
					{fill(tr.split.participants, { count: String(included.length + 1) })}
				</Text>
				<View
					style={{
						backgroundColor: colors.surface,
						borderColor: colors.border,
						borderWidth: 1,
						borderRadius: radius.lg,
					}}
				>
					<View style={[styles.person, { gap: spacing.md }]} testID="split.person.me">
						<View
							style={[
								styles.check,
								{ backgroundColor: colors.accent, borderColor: colors.accent },
							]}
						>
							<Ionicons name="checkmark" size={14} color={colors.onPrimary} />
						</View>
						<Avatar name={myName === "" ? tr.split.sen : myName} size={40} />
						<View style={styles.grow}>
							<Text style={[typography.rowTitle, { color: colors.text }]}>
								{fill(tr.split.you, { name: myName })}
							</Text>
							<Text
								style={[
									typography.caption,
									{ fontSize: 12, color: colors.textMuted },
								]}
							>
								{tr.split.youSub}
							</Text>
						</View>
						{mode === "equal" ? (
							<Text
								testID="split.share.me"
								style={[
									styles.amount,
									{ fontFamily: fonts.extrabold, color: colors.text },
								]}
							>
								{formatTRY(result.mine)}
							</Text>
						) : (
							<ShareField
								mode={mode}
								person={mine}
								label={fill(
									mode === "amount" ? tr.split.shareLabel : tr.split.percentLabel,
									{
										name: myName,
									},
								)}
								onChange={(change) => {
									setMine((value) => ({ ...value, ...change }));
								}}
								testID="split.share.me.input"
							/>
						)}
					</View>
					{people.map((person) => (
						<View
							key={person.key}
							style={[
								styles.person,
								{
									gap: spacing.md,
									borderTopColor: colors.divider,
									borderTopWidth: 1,
								},
							]}
						>
							<Pressable
								testID={`split.person.${person.display_name}.toggle`}
								accessibilityRole="checkbox"
								accessibilityState={{ checked: person.included }}
								accessibilityLabel={fill(tr.split.include, {
									name: person.display_name,
								})}
								onPress={() => {
									patch(person.key, { included: !person.included });
								}}
								hitSlop={10}
								style={[
									styles.check,
									person.included
										? {
												backgroundColor: colors.accent,
												borderColor: colors.accent,
											}
										: { borderColor: colors.borderStrong },
								]}
							>
								{person.included ? (
									<Ionicons name="checkmark" size={14} color={colors.onPrimary} />
								) : null}
							</Pressable>
							<Avatar name={person.display_name} size={40} />
							<View style={styles.grow}>
								<Text style={[typography.rowTitle, { color: colors.text }]}>
									{person.display_name}
								</Text>
								<Text
									style={[
										typography.caption,
										{ fontSize: 12, color: colors.textMuted },
									]}
								>
									{person.paramnet_id ?? tr.split.viaLink}
								</Text>
							</View>
							{!person.included ? (
								<Pressable
									testID={`split.person.${person.display_name}.remove`}
									accessibilityRole="button"
									accessibilityLabel={fill(tr.split.remove, {
										name: person.display_name,
									})}
									onPress={() => {
										setPeople((list) =>
											list.filter((p) => p.key !== person.key),
										);
									}}
									hitSlop={10}
								>
									<Text
										style={{
											fontFamily: fonts.semibold,
											fontSize: 13,
											color: colors.textMuted,
										}}
									>
										{tr.split.excluded}
									</Text>
								</Pressable>
							) : mode === "equal" ? (
								<Text
									testID={`split.share.${person.display_name}`}
									style={[
										styles.amount,
										{ fontFamily: fonts.extrabold, color: colors.text },
									]}
								>
									{formatTRY(shareOf(person))}
								</Text>
							) : (
								<ShareField
									mode={mode}
									person={person}
									label={fill(
										mode === "amount"
											? tr.split.shareLabel
											: tr.split.percentLabel,
										{
											name: person.display_name,
										},
									)}
									onChange={(change) => {
										patch(person.key, change);
									}}
									testID={`split.share.${person.display_name}.input`}
								/>
							)}
						</View>
					))}
				</View>
			</View>

			<View style={{ gap: spacing.sm }}>
				<View
					style={{
						backgroundColor: colors.primaryTint,
						borderRadius: radius.md,
						paddingHorizontal: spacing.lg,
					}}
				>
					<View style={[styles.sum, { borderBottomColor: colors.divider }]}>
						<Text style={[typography.callout, { color: colors.textMuted }]}>
							{tr.split.mine}
						</Text>
						<Text
							testID="split.mine"
							style={{ fontFamily: fonts.extrabold, color: colors.text }}
						>
							{formatTRY(result.mine)}
						</Text>
					</View>
					<View style={styles.sumLast}>
						<Text style={[typography.callout, { color: colors.textMuted }]}>
							{tr.split.receivable}
						</Text>
						<Text
							testID="split.receivable"
							style={{ fontFamily: fonts.extrabold, color: colors.receivable }}
						>
							{formatTRY(Math.max(0, (total ?? 0) - result.mine))}
						</Text>
					</View>
				</View>
				<Text
					testID="split.note"
					style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}
				>
					{result.note}
				</Text>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row" },
	grow: { flex: 1, minWidth: 0 },
	tile: {
		flex: 1,
		minHeight: 76,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		paddingHorizontal: 4,
	},
	tileIcon: {
		width: 34,
		height: 34,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	payer: {
		flexDirection: "row",
		alignItems: "center",
		height: 36,
		paddingHorizontal: 12,
		marginBottom: 6,
	},
	person: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 14,
		paddingVertical: 10,
		minHeight: 62,
	},
	check: {
		width: 24,
		height: 24,
		borderRadius: 7,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	amount: { fontSize: 15 },
	shareField: { width: 132 },
	percent: {
		width: 72,
		height: 44,
		borderWidth: 1,
		paddingHorizontal: 10,
		fontSize: 15,
		textAlign: "right",
	},
	sum: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingVertical: 11,
		borderBottomWidth: 1,
	},
	sumLast: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 11 },
});
