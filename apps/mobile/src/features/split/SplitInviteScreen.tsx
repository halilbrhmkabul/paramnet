import { Ionicons } from "@expo/vector-icons";
import { formatTRY } from "@paramnet/shared";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useParamnetIdLookup, useSplit, useSplitAction } from "@/api/hooks";
import type { SplitDetail } from "@/api/types";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { QrCode } from "@/components/QrCode";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { idInputState } from "@/features/agreement/ShareScreen";
import { fill, tr } from "@/i18n/tr";
import { clock } from "@/lib/clock";
import { useAppTheme } from "@/theme/useAppTheme";

import { MemberCard, MemberRow, PairButtons } from "./parts";
import { memberBadge, shortLink, splitLink, timeOf } from "./splitModel";

type Tab = "qr" | "link";

function AssignById({ split, onDone }: { split: SplitDetail; onDone: () => void }) {
	const { colors, typography, spacing } = useAppTheme();
	const open = split.members.filter((m) => m.state === "open");
	const [seat, setSeat] = useState(open[0]?.id ?? null);
	const [input, setInput] = useState("");
	const state = idInputState(input);
	const id = typeof state === "object" ? state.id : null;
	const lookup = useParamnetIdLookup(id);
	const found = lookup.data?.status === "found" ? lookup.data : null;
	const action = useSplitAction();
	const seatName = open.find((m) => m.id === seat)?.display_name ?? "";
	return (
		<View style={{ gap: spacing.sm }} testID="splitInvite.assign">
			<View style={[styles.wrap, { gap: spacing.sm }]} accessibilityRole="radiogroup">
				{open.map((m) => (
					<Chip
						key={m.id}
						label={m.display_name}
						selected={seat === m.id}
						role="radio"
						onPress={() => {
							setSeat(m.id);
						}}
						testID={`splitInvite.assign.seat.${m.id}`}
					/>
				))}
			</View>
			<TextField
				label={fill(tr.split.assignTitle, { name: seatName })}
				value={input}
				onChangeText={setInput}
				placeholder={tr.split.idPlaceholder}
				autoCapitalize="characters"
				testID="splitInvite.assign.input"
			/>
			{found === null ? null : (
				<Text style={[typography.caption, { color: colors.accent }]}>
					{fill(tr.split.idFound, { name: found.display_name, id: found.paramnet_id })}
				</Text>
			)}
			{action.error === null ? null : (
				<Text style={[typography.caption, { color: colors.overdue }]}>
					{messageForError(action.error, "paramnetId")}
				</Text>
			)}
			<PairButtons>
				<View style={styles.grow}>
					<Button
						label={tr.split.cancel}
						variant="secondary"
						onPress={onDone}
						testID="splitInvite.assign.cancel"
					/>
				</View>
				<View style={styles.grow}>
					<Button
						label={tr.split.idAdd}
						disabled={found === null || seat === null}
						loading={action.isPending}
						onPress={() => {
							if (found !== null && seat !== null) {
								action.mutate(
									{
										kind: "assign",
										memberId: seat,
										paramnetId: found.paramnet_id,
									},
									{ onSuccess: onDone },
								);
							}
						}}
						testID="splitInvite.assign.add"
					/>
				</View>
			</PairButtons>
		</View>
	);
}

function Panel({ split, tab }: { split: SplitDetail; tab: Tab }) {
	const { colors, fonts, radius, spacing } = useAppTheme();
	const [copied, setCopied] = useState(false);
	const code = split.join_code ?? "";
	const url = splitLink(
		code,
		(path, queryParams) => Linking.createURL(path, { queryParams }),
		tab === "qr",
	);
	const expired =
		split.join_expires_at !== null && new Date(split.join_expires_at) <= clock.now();
	const perPerson = split.members[1]?.share_minor ?? split.total_minor;
	return (
		<View
			testID="splitInvite.panel"
			style={{
				backgroundColor: colors.heroStage,
				borderRadius: radius.xl,
				padding: 20,
				alignItems: "center",
				gap: 14,
			}}
		>
			<View style={styles.center}>
				<Text style={{ fontFamily: fonts.extrabold, fontSize: 16, color: colors.heroText }}>
					{split.title}
				</Text>
				<Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.heroSoft }}>
					{split.mode === "equal"
						? fill(tr.split.perPerson, {
								total: formatTRY(split.total_minor),
								share: formatTRY(perPerson),
							})
						: formatTRY(split.total_minor)}
				</Text>
			</View>
			{expired ? (
				<Text
					style={{
						fontFamily: fonts.semibold,
						fontSize: 13,
						color: colors.heroSoft,
						textAlign: "center",
					}}
				>
					{tr.split.expired}
				</Text>
			) : tab === "qr" ? (
				<>
					<View
						style={{
							backgroundColor: colors.heroCardSurface,
							borderRadius: radius.lg,
							padding: 14,
						}}
					>
						<QrCode
							value={url}
							size={200}
							accessibilityLabel={tr.split.qrLabel}
							testID="splitInvite.qr"
						/>
					</View>
					<Text
						style={{
							fontFamily: fonts.semibold,
							fontSize: 13,
							color: colors.heroSoft,
							textAlign: "center",
						}}
					>
						{tr.split.qrHint}
					</Text>
				</>
			) : (
				<>
					<View
						style={[
							styles.linkBox,
							{
								borderColor: colors.heroLine,
								backgroundColor: colors.heroChip,
								borderRadius: radius.md,
								gap: 10,
							},
						]}
					>
						<Ionicons name="link-outline" size={20} color={colors.heroAccent} />
						<Text
							testID="splitInvite.link"
							selectable
							style={{
								flex: 1,
								fontFamily: fonts.mono,
								fontSize: 14,
								color: colors.heroText,
							}}
							numberOfLines={2}
						>
							{shortLink(url)}
						</Text>
						<Pressable
							testID="splitInvite.copy"
							accessibilityRole="button"
							accessibilityLabel={copied ? tr.split.copied : tr.split.copy}
							onPress={() => {
								void Clipboard.setStringAsync(url).then(() => {
									setCopied(true);
								});
							}}
							style={[
								styles.copy,
								{ backgroundColor: colors.heroAccent, borderRadius: 10 },
							]}
						>
							<Text
								style={{
									fontFamily: fonts.extrabold,
									fontSize: 13,
									color: colors.onHeroAccent,
								}}
							>
								{copied ? tr.split.copied : tr.split.copy}
							</Text>
						</Pressable>
					</View>
					<Pressable
						testID="splitInvite.share"
						accessibilityRole="button"
						accessibilityLabel={tr.split.share}
						onPress={() => {
							void Share.share({
								message: fill(tr.split.shareMessage, { title: split.title, url }),
							});
						}}
						style={[
							styles.shareButton,
							{
								borderColor: colors.heroLine,
								backgroundColor: colors.heroChip,
								borderRadius: radius.sm,
								gap: spacing.sm,
							},
						]}
					>
						<Ionicons name="share-outline" size={18} color={colors.heroText} />
						<Text
							style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.heroText }}
						>
							{tr.split.share}
						</Text>
					</Pressable>
				</>
			)}
			<View style={[styles.row, { gap: 6 }]}>
				<Ionicons name="time-outline" size={14} color={colors.heroMuted} />
				<Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.heroMuted }}>
					{tr.split.validity}
				</Text>
			</View>
		</View>
	);
}

function Content({ split }: { split: SplitDetail }) {
	const { colors, typography, spacing, radius, fonts } = useAppTheme();
	const [tab, setTab] = useState<Tab>("qr");
	const [assigning, setAssigning] = useState(false);
	const action = useSplitAction();
	const joined = split.members.filter(
		(m) => !["open", "requested", "declined"].includes(m.state),
	).length;
	const hasOpen = split.members.some((m) => m.state === "open");
	return (
		<>
			<SegmentedControl
				label={tr.split.inviteTitle}
				hideLabel
				options={[
					{ value: "qr", label: tr.split.tabQr },
					{ value: "link", label: tr.split.tabLink },
				]}
				value={tab}
				onChange={setTab}
				testID="splitInvite.tab"
			/>
			<Panel split={split} tab={tab} />
			<View style={{ gap: spacing.sm }}>
				<View style={[styles.between, { paddingHorizontal: 4 }]}>
					<Text style={[typography.label, { color: colors.textMuted }]}>
						{tr.split.joined}
					</Text>
					<Text
						testID="splitInvite.count"
						style={[typography.label, { color: colors.accent }]}
					>
						{fill(tr.split.joinedCount, {
							count: String(joined),
							total: String(split.members.length),
						})}
					</Text>
				</View>
				<MemberCard testID="splitInvite.members">
					{split.members.map((m, index) => {
						const sub = m.is_owner
							? fill(tr.split.payerShare, { amount: formatTRY(m.share_minor) })
							: m.state === "requested"
								? `${tr.split.wantsToJoin}${m.requested_at === null ? "" : ` · ${timeOf(m.requested_at)}`}`
								: m.state === "open"
									? tr.split.waitingSeat
									: m.joined_via === null
										? undefined
										: tr.split.joinedVia[m.joined_via];
						return (
							<MemberRow
								key={m.id}
								member={m}
								first={index === 0}
								title={
									m.is_owner
										? fill(tr.split.you, { name: m.display_name })
										: m.display_name
								}
								sub={sub}
								badge={
									m.is_owner
										? { label: tr.split.organizer, tone: "pending" }
										: memberBadge(m, true)
								}
							>
								{m.state === "requested" ? (
									<PairButtons>
										<View style={styles.grow}>
											<Button
												label={tr.split.reject}
												variant="secondary"
												disabled={action.isPending}
												onPress={() => {
													action.mutate({
														kind: "reject",
														memberId: m.id,
													});
												}}
												testID={`splitInvite.reject.${m.id}`}
											/>
										</View>
										<View style={styles.grow}>
											<Button
												label={tr.split.approve}
												loading={action.isPending}
												onPress={() => {
													action.mutate({
														kind: "approve",
														memberId: m.id,
													});
												}}
												testID={`splitInvite.approve.${m.id}`}
											/>
										</View>
									</PairButtons>
								) : null}
							</MemberRow>
						);
					})}
				</MemberCard>
				{action.error === null || assigning ? null : (
					<Text style={[typography.caption, { color: colors.overdue }]}>
						{messageForError(action.error)}
					</Text>
				)}
				{!hasOpen ? null : assigning ? (
					<AssignById
						split={split}
						onDone={() => {
							setAssigning(false);
						}}
					/>
				) : (
					<Pressable
						testID="splitInvite.assign.button"
						accessibilityRole="button"
						accessibilityLabel={tr.split.assignId}
						onPress={() => {
							setAssigning(true);
						}}
						style={[
							styles.dashed,
							{
								borderColor: colors.accent,
								borderRadius: radius.sm,
								backgroundColor: colors.surface,
								gap: spacing.sm,
							},
						]}
					>
						<Ionicons name="search-outline" size={16} color={colors.accent} />
						<Text
							style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.accent }}
						>
							{tr.split.assignId}
						</Text>
					</Pressable>
				)}
				<Text
					style={[
						typography.caption,
						{ fontSize: 12, color: colors.textMuted, paddingHorizontal: 4 },
					]}
				>
					{tr.split.webNote}
				</Text>
			</View>
		</>
	);
}

// Design 41 "Kişi ekle": the QR code or link that opens the split, and who has joined.
export function SplitInviteScreen({ id }: { id: string }) {
	const split = useSplit(id);
	const footer = (
		<Button
			label={tr.split.goToSplit}
			onPress={() => {
				router.replace({ pathname: "/split/[id]", params: { id } });
			}}
			testID="splitInvite.done"
		/>
	);
	return (
		<Screen
			testID="splitInvite.screen"
			edges={["bottom"]}
			footer={split.data === undefined ? undefined : footer}
		>
			{split.isPending ? (
				<LoadingState testID="splitInvite.loading" />
			) : split.isError ? (
				<ErrorState
					message={messageForError(split.error)}
					onRetry={() => {
						void split.refetch();
					}}
					testID="splitInvite.error"
				/>
			) : split.data.is_owner ? (
				<Content split={split.data} />
			) : (
				<ErrorState
					message={tr.error.forbidden}
					onRetry={() => {
						router.back();
					}}
					testID="splitInvite.forbidden"
				/>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center" },
	wrap: { flexDirection: "row", flexWrap: "wrap" },
	between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	grow: { flex: 1, minWidth: 0 },
	center: { alignItems: "center", gap: 2 },
	linkBox: {
		width: "100%",
		flexDirection: "row",
		alignItems: "center",
		padding: 14,
		borderWidth: 1,
	},
	copy: { height: 36, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
	shareButton: {
		width: "100%",
		height: 48,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 1,
	},
	dashed: {
		height: 46,
		borderWidth: 1,
		borderStyle: "dashed",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
});
