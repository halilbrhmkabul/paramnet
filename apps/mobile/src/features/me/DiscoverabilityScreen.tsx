import { formatDateTR, todayInIstanbul } from "@paramnet/shared";
import { useState } from "react";
import { Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useMyProfile, useRegenerateParamnetId, useSetIdDiscoverable } from "@/api/hooks";
import type { MyProfile } from "@/api/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { fill, tr } from "@/i18n/tr";
import { clock } from "@/lib/clock";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

type Mode = "everyone" | "nobody";

const MODES = [
	{ value: "everyone", label: tr.discoverability.everyone },
	{ value: "nobody", label: tr.discoverability.nobody },
] as const;

function DiscoverabilityBody({ profile }: { profile: MyProfile }) {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const online = useIsOnline();
	const setDiscoverable = useSetIdDiscoverable();
	const regenerate = useRegenerateParamnetId();
	const [confirming, setConfirming] = useState(false);
	const mode: Mode = profile.id_discoverable ? "everyone" : "nobody";
	const nextAt = new Date(profile.can_regenerate_at);
	const canRegenerate = nextAt.getTime() <= clock.now().getTime();

	return (
		<>
			<Text style={[typography.body, { color: colors.text }]}>
				{tr.discoverability.intro}
			</Text>
			<SegmentedControl
				label={tr.discoverability.title}
				hideLabel
				options={MODES}
				value={mode}
				onChange={(next) => {
					if (next !== mode && online) {
						setDiscoverable.mutate(next === "everyone");
					}
				}}
				testID="discoverability.mode"
			/>
			<Text style={[typography.callout, { color: colors.textMuted }]}>
				{mode === "everyone"
					? tr.discoverability.everyoneBody
					: tr.discoverability.nobodyBody}
			</Text>
			{setDiscoverable.isError ? (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.callout, { color: colors.overdue }]}
				>
					{messageForError(setDiscoverable.error)}
				</Text>
			) : null}

			<Card style={{ gap: spacing.md }}>
				<Text style={[typography.label, { color: colors.textMuted }]}>
					{tr.discoverability.currentId}
				</Text>
				<Text
					testID="discoverability.id.text"
					selectable
					style={{
						fontFamily: fonts.mono,
						fontSize: 22,
						lineHeight: 28,
						letterSpacing: 1.2,
						color: colors.primary,
					}}
				>
					{profile.paramnet_id}
				</Text>
				{regenerate.isSuccess ? (
					<Text
						testID="discoverability.done.text"
						accessibilityLiveRegion="polite"
						style={[typography.callout, { color: colors.success }]}
					>
						{fill(tr.discoverability.done, { id: profile.paramnet_id })}
					</Text>
				) : null}
				<Text style={[typography.callout, { color: colors.textMuted }]}>
					{tr.discoverability.newIdBody}
				</Text>
				{canRegenerate ? null : (
					<Text
						testID="discoverability.newIdAfter.text"
						style={[typography.caption, { color: colors.textMuted }]}
					>
						{fill(tr.discoverability.newIdAfter, {
							date: formatDateTR(todayInIstanbul(nextAt), "long"),
						})}
					</Text>
				)}
				{confirming ? (
					<View style={{ gap: spacing.sm }}>
						<Text style={[typography.callout, { color: colors.text }]}>
							{fill(tr.discoverability.confirmBody, { id: profile.paramnet_id })}
						</Text>
						<Button
							label={tr.discoverability.confirm}
							variant="danger"
							loading={regenerate.isPending}
							disabled={!online}
							onPress={() => {
								regenerate.mutate(undefined, {
									onSettled: () => {
										setConfirming(false);
									},
								});
							}}
							testID="discoverability.confirm.button"
						/>
						<Button
							label={tr.common.cancel}
							variant="ghost"
							onPress={() => {
								setConfirming(false);
							}}
							testID="discoverability.cancel.button"
						/>
					</View>
				) : (
					<Button
						label={tr.discoverability.newId}
						variant="secondary"
						disabled={!canRegenerate || !online}
						onPress={() => {
							setConfirming(true);
						}}
						testID="discoverability.newId.button"
					/>
				)}
				{regenerate.isError ? (
					<Text
						accessibilityLiveRegion="polite"
						style={[typography.callout, { color: colors.overdue }]}
					>
						{messageForError(regenerate.error)}
					</Text>
				) : null}
			</Card>
			{online ? null : (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.error.offline}
				</Text>
			)}
		</>
	);
}

// Profil > "ID ile bulunabilirlik" (ADR-050): Herkes / Kimse, and a new random ID once every 30 days.
export function DiscoverabilityScreen() {
	const profile = useMyProfile();
	return (
		<Screen testID="discoverability.screen" edges={["bottom"]}>
			{profile.isPending ? (
				<LoadingState testID="discoverability.loading" />
			) : profile.isError ? (
				<ErrorState
					message={messageForError(profile.error)}
					onRetry={() => {
						void profile.refetch();
					}}
					testID="discoverability.error"
				/>
			) : (
				<DiscoverabilityBody profile={profile.data} />
			)}
		</Screen>
	);
}
