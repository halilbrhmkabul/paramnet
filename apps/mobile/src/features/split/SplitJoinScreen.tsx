import { Ionicons } from "@expo/vector-icons";
import { formatDateTR, formatTRY } from "@paramnet/shared";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ApiError, messageForError } from "@/api/errors";
import { useRequestSplitJoin, useSplitInvite } from "@/api/hooks";
import type { SplitInvite } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

import { MemberCard } from "./parts";

export function LinkBanner({ code, seat }: { code: string; seat?: string }) {
	const { colors, fonts } = useAppTheme();
	return (
		<View
			testID="splitJoin.banner"
			style={[
				styles.banner,
				{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: 12,
					gap: 8,
				},
			]}
		>
			<Ionicons name="link-outline" size={16} color={colors.accent} />
			<Text
				style={[
					styles.grow,
					{ fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
				]}
			>
				{fill(tr.split.fromLink, { code })}
				{seat === undefined ? "" : ` · ${fill(tr.split.asSeat, { name: seat })}`}
			</Text>
		</View>
	);
}

function Seats({
	code,
	invite,
	via,
}: {
	code: string;
	invite: Extract<SplitInvite, { status: "open" }>;
	via: "link" | "qr";
}) {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const [seat, setSeat] = useState<string | null>(
		invite.seats.length === 1 ? (invite.seats[0]?.id ?? null) : null,
	);
	const join = useRequestSplitJoin();
	const taken = join.error instanceof ApiError && join.error.details?.field === "taken";
	const footer =
		invite.seats.length === 0 ? undefined : (
			<View style={{ gap: spacing.sm }}>
				{join.error === null ? null : (
					<Text
						testID="splitJoin.error.text"
						style={[typography.caption, { color: colors.overdue }]}
					>
						{taken ? tr.split.noSeats : messageForError(join.error)}
					</Text>
				)}
				<Button
					label={tr.split.thisIsMe}
					disabled={seat === null}
					loading={join.isPending}
					onPress={() => {
						if (seat !== null) {
							join.mutate(
								{ code, memberId: seat, via },
								{
									onSuccess: ({ split_id }) => {
										router.replace({
											pathname: "/split/[id]",
											params: { id: split_id },
										});
									},
								},
							);
						}
					}}
					testID="splitJoin.join"
				/>
			</View>
		);
	return (
		<Screen testID="splitJoin.screen" edges={["bottom"]} footer={footer}>
			<LinkBanner code={code} />
			<View style={[styles.center, { gap: 2 }]}>
				<Avatar name={invite.owner_name} size={60} />
				<Text
					style={[
						typography.callout,
						{ color: colors.textMuted, marginTop: 10, textAlign: "center" },
					]}
				>
					{fill(tr.split.addedYou, { name: invite.owner_name })}
				</Text>
				<Text
					style={{
						fontFamily: fonts.extrabold,
						fontSize: 20,
						color: colors.text,
						textAlign: "center",
					}}
				>
					{invite.title}
				</Text>
				<Text
					style={[typography.caption, { color: colors.textMuted, textAlign: "center" }]}
				>
					{fill(tr.split.meta, {
						date: formatDateTR(invite.spent_on, "short"),
						total: formatTRY(invite.total_minor),
						count: String(invite.member_count),
					})}
				</Text>
			</View>
			{invite.seats.length === 0 ? (
				<EmptyState title={tr.split.noSeats} testID="splitJoin.noSeats" />
			) : (
				<View style={{ gap: spacing.sm }}>
					<Text
						accessibilityRole="header"
						style={[typography.headline, { color: colors.text, paddingHorizontal: 4 }]}
					>
						{tr.split.pickSeat}
					</Text>
					<Text
						style={[
							typography.caption,
							{ color: colors.textMuted, paddingHorizontal: 4 },
						]}
					>
						{fill(tr.split.pickSeatHint, { name: invite.owner_name })}
					</Text>
					<MemberCard>
						{invite.seats.map((s, index) => {
							const selected = seat === s.id;
							return (
								<Pressable
									key={s.id}
									testID={`splitJoin.seat.${s.id}`}
									accessibilityRole="radio"
									accessibilityState={{ checked: selected }}
									accessibilityLabel={`${s.display_name}, ${formatTRY(s.share_minor)}`}
									onPress={() => {
										setSeat(s.id);
									}}
									style={[
										styles.seat,
										{
											gap: spacing.md,
											borderTopWidth: index === 0 ? 0 : 1,
											borderTopColor: colors.divider,
											backgroundColor: selected
												? colors.primaryTint
												: "transparent",
										},
									]}
								>
									<Ionicons
										name={selected ? "radio-button-on" : "radio-button-off"}
										size={22}
										color={selected ? colors.accent : colors.borderStrong}
									/>
									<Avatar name={s.display_name} size={38} />
									<Text
										style={[
											styles.grow,
											typography.rowTitle,
											{ color: colors.text },
										]}
									>
										{s.display_name}
									</Text>
									<Text
										style={{
											fontFamily: fonts.extrabold,
											fontSize: 15,
											color: colors.text,
										}}
									>
										{formatTRY(s.share_minor)}
									</Text>
								</Pressable>
							);
						})}
					</MemberCard>
				</View>
			)}
		</Screen>
	);
}

// The QR code and the link open here (deep link /h/<code>, design 43). Once a seat is asked for,
// the split itself is shown.
export function SplitJoinScreen({ code, via }: { code: string; via: "link" | "qr" }) {
	const invite = useSplitInvite(code);
	if (invite.isPending) {
		return (
			<Screen testID="splitJoin.loading.screen">
				<LoadingState testID="splitJoin.loading" />
			</Screen>
		);
	}
	if (invite.isError) {
		return (
			<Screen testID="splitJoin.error.screen">
				<ErrorState
					message={messageForError(invite.error)}
					onRetry={() => {
						void invite.refetch();
					}}
					testID="splitJoin.error"
				/>
			</Screen>
		);
	}
	const data = invite.data;
	if (data.status === "owner" || data.status === "member") {
		return <Redirect href={{ pathname: "/split/[id]", params: { id: data.split_id } }} />;
	}
	if (data.status !== "open") {
		return (
			<Screen testID="splitJoin.closed">
				<EmptyState
					title={data.status === "expired" ? tr.split.expiredInvite : tr.split.notFound}
					testID={`splitJoin.${data.status}`}
				/>
			</Screen>
		);
	}
	return <Seats code={code} invite={data} via={via} />;
}

const styles = StyleSheet.create({
	banner: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderWidth: 1,
	},
	grow: { flex: 1, minWidth: 0 },
	center: { alignItems: "center" },
	seat: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, minHeight: 60 },
});
