import { Ionicons } from "@expo/vector-icons";
import { formatDateTR, formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useSplit, useSplitAction } from "@/api/hooks";
import type { SplitDetail, SplitMember } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { fill, tr } from "@/i18n/tr";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

import { InfoNote, MemberCard, MemberRow, PairButtons } from "./parts";
import { barTone, eventText, eventTone, memberBadge, memberSub, timeOf } from "./splitModel";

type IconName = keyof typeof Ionicons.glyphMap;

function subtitle(split: SplitDetail): string {
	return fill(tr.split.subtitle, {
		date: formatDateTR(split.spent_on, "short"),
		name: split.owner_name,
		count: String(split.members.length),
		mode: tr.split.modeLower[split.mode],
	});
}

function ActionTile({
	label,
	icon,
	onPress,
	disabled,
	testID,
}: {
	label: string;
	icon: IconName;
	onPress: () => void;
	disabled?: boolean;
	testID: string;
}) {
	const { colors, fonts, radius } = useAppTheme();
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: disabled === true }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.tile,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: radius.md,
					opacity: disabled === true ? 0.5 : pressed ? 0.7 : 1,
				},
			]}
		>
			<Ionicons name={icon} size={18} color={colors.primary} />
			<Text
				numberOfLines={1}
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

function Summary({ split }: { split: SplitDetail }) {
	const { colors, typography, fonts, radius, spacing } = useAppTheme();
	const paid = split.members.filter((m) => m.state === "paid" || m.state === "payer").length;
	const tone = {
		payer: colors.primary,
		paid: colors.success,
		pending: colors.warningMark,
		unpaid: colors.track,
	};
	return (
		<View
			style={{
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderWidth: 1,
				borderRadius: radius.lg,
				padding: spacing.lg,
			}}
		>
			<Text style={[typography.headline, { color: colors.text }]}>{split.title}</Text>
			<Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
				{subtitle(split)}
			</Text>
			<Text
				testID="split.total"
				style={[typography.amountL, { color: colors.primary, marginTop: 10 }]}
			>
				{formatTRY(split.total_minor)}
			</Text>
			<View style={[styles.between, { marginTop: 14 }]}>
				<Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted }}>
					{tr.split.collected}
				</Text>
				<Text
					testID="split.collected"
					style={{ fontFamily: fonts.extrabold, fontSize: 13, color: colors.text }}
				>
					{fill(tr.split.collectedValue, {
						collected: formatTRY(split.collected_minor),
						total: formatTRY(split.total_minor),
					})}
				</Text>
			</View>
			<View
				accessible
				accessibilityRole="image"
				accessibilityLabel={fill(tr.split.barLabel, {
					count: String(split.members.length),
					paid: String(paid),
				})}
				style={[styles.row, { gap: 4, marginTop: 12 }]}
			>
				{split.members.map((m) => (
					<View
						key={m.id}
						style={[styles.segment, { backgroundColor: tone[barTone(m)] }]}
					/>
				))}
			</View>
			<View style={[styles.row, { flexWrap: "wrap", gap: 12, marginTop: 8 }]}>
				{(
					[
						[tr.split.legend.paid, tone.paid],
						[tr.split.legend.pending, tone.pending],
						[tr.split.legend.unpaid, tone.unpaid],
					] as const
				).map(([label, color]) => (
					<View key={label} style={[styles.row, { gap: 5 }]}>
						<View style={[styles.dot, { backgroundColor: color }]} />
						<Text
							style={{
								fontFamily: fonts.semibold,
								fontSize: 12,
								color: colors.textMuted,
							}}
						>
							{label}
						</Text>
					</View>
				))}
			</View>
		</View>
	);
}

function Activity({ split }: { split: SplitDetail }) {
	const { colors, typography, radius, spacing, fonts } = useAppTheme();
	const tone = { success: colors.success, warning: colors.warningMark, neutral: colors.neutral };
	return (
		<View style={{ gap: spacing.sm }}>
			<Text
				accessibilityRole="header"
				style={[typography.headline, { color: colors.text, paddingHorizontal: 4 }]}
			>
				{tr.split.activity}
			</Text>
			<View
				testID="split.activity"
				style={{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					borderRadius: radius.lg,
					paddingHorizontal: spacing.lg,
					paddingVertical: 6,
				}}
			>
				{split.events.length === 0 ? (
					<Text
						style={[
							typography.caption,
							{ color: colors.textMuted, paddingVertical: 8 },
						]}
					>
						{tr.split.noActivity}
					</Text>
				) : (
					split.events.map((event, index) => (
						<View
							key={`${event.at}-${String(index)}`}
							style={[styles.event, { gap: 10 }]}
						>
							<View
								style={[
									styles.eventDot,
									{ backgroundColor: tone[eventTone(event)] },
								]}
							/>
							<Text
								style={[
									styles.grow,
									{ fontFamily: fonts.medium, fontSize: 13, color: colors.text },
								]}
							>
								{eventText(event)}
							</Text>
							<Text
								style={{
									fontFamily: fonts.semibold,
									fontSize: 12,
									color: colors.textMuted,
								}}
							>
								{timeOf(event.at)}
							</Text>
						</View>
					))
				)}
			</View>
		</View>
	);
}

// Design 42 "Ortak hesap": the payer's view.
function OwnerView({ split }: { split: SplitDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	const action = useSplitAction();
	const [notice, setNotice] = useState<string | null>(null);
	const remindable = split.members.find((m) => m.state === "accepted" || m.state === "invited");
	return (
		<>
			<Summary split={split} />
			<View style={{ gap: spacing.sm }}>
				<Text
					accessibilityRole="header"
					style={[typography.headline, { color: colors.text, paddingHorizontal: 4 }]}
				>
					{tr.split.whoPays}
				</Text>
				<MemberCard testID="split.members">
					{split.members.map((m, index) => {
						const payment = m.reported_payment;
						return (
							<MemberRow
								key={m.id}
								member={m}
								first={index === 0}
								title={m.display_name}
								sub={memberSub(m, split.owner_name)}
								badge={memberBadge(m, true)}
								amount={m.share_minor}
							>
								{m.state === "reported" && payment !== null ? (
									<PairButtons>
										<View style={styles.grow}>
											<Button
												label={tr.split.notReceived}
												variant="secondary"
												disabled={action.isPending}
												onPress={() => {
													action.mutate({
														kind: "rejectPayment",
														paymentId: payment.id,
													});
												}}
												testID={`split.notReceived.${m.id}`}
											/>
										</View>
										<View style={styles.grow}>
											<Button
												label={tr.split.confirmReceived}
												loading={action.isPending}
												onPress={() => {
													action.mutate({
														kind: "confirmPayment",
														paymentId: payment.id,
													});
												}}
												testID={`split.confirm.${m.id}`}
											/>
										</View>
									</PairButtons>
								) : null}
							</MemberRow>
						);
					})}
				</MemberCard>
			</View>
			<View style={[styles.row, { gap: spacing.sm }]}>
				{remindable === undefined ? null : (
					<ActionTile
						label={fill(tr.split.remind, {
							name: remindable.display_name.split(" ")[0] ?? "",
						})}
						icon="notifications-outline"
						disabled={action.isPending}
						onPress={() => {
							action.mutate(
								{ kind: "remind", memberId: remindable.id },
								{
									onSuccess: () => {
										setNotice(tr.split.reminded);
									},
								},
							);
						}}
						testID="split.remind"
					/>
				)}
				<ActionTile
					label={tr.split.addPerson}
					icon="qr-code-outline"
					onPress={() => {
						router.push({ pathname: "/split/[id]/invite", params: { id: split.id } });
					}}
					testID="split.invite"
				/>
			</View>
			{notice === null && action.error === null ? null : (
				<Text
					testID="split.notice"
					accessibilityLiveRegion="polite"
					style={[
						typography.caption,
						{ color: action.error === null ? colors.accent : colors.overdue },
					]}
				>
					{action.error === null ? notice : messageForError(action.error)}
				</Text>
			)}
			<InfoNote>{tr.split.privacy}</InfoNote>
			<Activity split={split} />
		</>
	);
}

type MyState = Exclude<SplitMember["state"], "payer" | "open">;

// Design 43: what the invited person sees, from the link or from their records.
export function MemberView({ split, banner }: { split: SplitDetail; banner?: ReactNode }) {
	const { colors, typography, fonts, radius, spacing } = useAppTheme();
	const me = split.members.find((m) => m.is_me);
	const action = useSplitAction();
	const reportKey = useRef(newIdempotencyKey());
	if (me === undefined || me.state === "payer" || me.state === "open") {
		return (
			<ErrorState
				message={tr.error.notFound}
				onRetry={() => {
					router.back();
				}}
				testID="split.member.error"
			/>
		);
	}
	const state: MyState = me.state;
	const hero = tr.split.hero[state];
	const amber = state === "reported";
	const owed = me.share_minor - me.paid_minor;
	const agreementId = me.agreement_id;
	const openDebt = () => {
		if (agreementId !== null) {
			router.push({ pathname: "/agreement/[id]", params: { id: agreementId } });
		}
	};
	return (
		<>
			{banner}
			<View style={[styles.center, { gap: 2 }]}>
				<Avatar name={split.owner_name} size={60} />
				<Text
					style={[
						typography.callout,
						{ color: colors.textMuted, marginTop: 10, textAlign: "center" },
					]}
				>
					{fill(tr.split.addedYou, { name: split.owner_name })}
				</Text>
				<Text
					style={{
						fontFamily: fonts.extrabold,
						fontSize: 20,
						color: colors.text,
						textAlign: "center",
					}}
				>
					{split.title}
				</Text>
				<Text
					style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}
				>
					{fill(tr.split.meta, {
						date: formatDateTR(split.spent_on, "short"),
						total: formatTRY(split.total_minor),
						count: String(split.members.length),
					})}
				</Text>
			</View>
			<View
				testID="split.hero"
				style={{
					borderRadius: radius.xl,
					paddingVertical: 18,
					paddingHorizontal: 20,
					backgroundColor: amber ? colors.warningTint : colors.heroStage,
					borderWidth: amber ? 1 : 0,
					borderColor: colors.warningBorder,
				}}
			>
				<Text
					style={{
						fontFamily: fonts.extrabold,
						fontSize: 13,
						letterSpacing: 0.3,
						color: amber ? colors.warning : colors.heroText,
					}}
				>
					{hero.kicker}
				</Text>
				<Text
					testID="split.hero.amount"
					style={[
						typography.amountXL,
						{ color: amber ? colors.warning : colors.heroText, marginTop: 2 },
					]}
				>
					{formatTRY(me.share_minor)}
				</Text>
				<Text
					style={{
						fontFamily: fonts.medium,
						fontSize: 13,
						lineHeight: 19,
						marginTop: 4,
						color: amber ? colors.warning : colors.heroSoft,
					}}
				>
					{fill(hero.body, {
						name: split.owner_name,
						amount: formatTRY(me.share_minor),
						title: split.title,
					})}
				</Text>
			</View>
			<View style={{ gap: spacing.sm }}>
				<Text style={[typography.label, { color: colors.textMuted, paddingHorizontal: 4 }]}>
					{tr.split.everyone}
				</Text>
				<MemberCard testID="split.everyone">
					{split.members.map((m, index) => (
						<MemberRow
							key={m.id}
							member={m}
							first={index === 0}
							title={m.is_me ? tr.split.sen : m.display_name}
							badge={
								m.is_me
									? {
											label: tr.split.myTags[state],
											tone: memberBadge(m, false).tone,
										}
									: memberBadge(m, false)
							}
							amount={m.share_minor}
							highlight={m.is_me}
						/>
					))}
				</MemberCard>
			</View>
			{action.error === null ? null : (
				<Text
					testID="split.member.actionError"
					style={[typography.caption, { color: colors.overdue }]}
				>
					{messageForError(action.error)}
				</Text>
			)}
			<View style={{ gap: 10 }}>
				{state === "invited" && agreementId !== null ? (
					<>
						<Button
							label={tr.split.acceptShare}
							loading={action.isPending}
							onPress={() => {
								action.mutate({ kind: "accept", agreementId });
							}}
							testID="split.accept"
						/>
						<Button
							label={tr.split.declineShare}
							variant="danger"
							disabled={action.isPending}
							onPress={() => {
								Alert.alert(tr.split.declineShare, tr.split.declineConfirm, [
									{ text: tr.split.cancel, style: "cancel" },
									{
										text: tr.split.declineShare,
										style: "destructive",
										onPress: () => {
											action.mutate({ kind: "decline", agreementId });
										},
									},
								]);
							}}
							testID="split.decline"
						/>
					</>
				) : state === "accepted" && agreementId !== null ? (
					<>
						<Button
							label={fill(tr.split.report, { amount: formatTRY(owed) })}
							loading={action.isPending}
							onPress={() => {
								action.mutate({
									kind: "report",
									agreementId,
									amountMinor: owed,
									idempotencyKey: reportKey.current,
								});
							}}
							testID="split.report"
						/>
						<Button
							label={tr.split.seeDebts}
							variant="secondary"
							onPress={openDebt}
							testID="split.seeDebts"
						/>
					</>
				) : (
					<>
						<Button
							label={tr.split.done}
							onPress={() => {
								router.back();
							}}
							testID="split.done"
						/>
						{agreementId === null || state === "declined" ? null : (
							<Button
								label={tr.split.seeDebts}
								variant="secondary"
								onPress={openDebt}
								testID="split.seeDebts"
							/>
						)}
					</>
				)}
			</View>
		</>
	);
}

export function SplitScreen({ id }: { id: string }) {
	const split = useSplit(id);
	return (
		<Screen testID="split.screen" edges={["bottom"]}>
			{split.isPending ? (
				<LoadingState testID="split.loading" />
			) : split.isError ? (
				<ErrorState
					message={messageForError(split.error)}
					onRetry={() => {
						void split.refetch();
					}}
					testID="split.error"
				/>
			) : split.data.is_owner ? (
				<OwnerView split={split.data} />
			) : (
				<MemberView split={split.data} />
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center" },
	between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	center: { alignItems: "center" },
	grow: { flex: 1, minWidth: 0 },
	segment: { flex: 1, height: 10, borderRadius: 5 },
	dot: { width: 9, height: 9, borderRadius: 3 },
	tile: {
		flex: 1,
		height: 64,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 5,
		paddingHorizontal: 6,
	},
	event: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8 },
	eventDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
});
