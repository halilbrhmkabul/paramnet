import { Ionicons } from "@expo/vector-icons";
import { formatDateTR, formatDateTimeTR, formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAgreement, useDelivery, useDeliveryStep } from "@/api/hooks";
import type { AgreementDetail, DeliveryState } from "@/api/types";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { fill, tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

type Phase = "waiting" | "reported" | "done";

function phaseOf(d: DeliveryState): Phase {
	return d.confirmed_at !== null ? "done" : d.reported_at !== null ? "reported" : "waiting";
}

function Content({ agreement, delivery }: { agreement: AgreementDetail; delivery: DeliveryState }) {
	const { colors, typography, fonts, spacing, radius } = useAppTheme();
	const step = useDeliveryStep();
	const phase = phaseOf(delivery);
	const name = agreement.counterparty.display_name;
	const amount = formatTRY(agreement.principal_minor);
	const due = agreement.installments.at(-1)?.due_date ?? null;
	const role = delivery.my_role;
	const hero =
		phase === "done"
			? { title: tr.delivery.done, body: tr.delivery.doneBody }
			: role === "creditor"
				? {
						title: fill(
							phase === "waiting"
								? tr.delivery.creditor.waiting
								: tr.delivery.creditor.reported,
							{ name },
						),
						body: fill(
							phase === "waiting"
								? tr.delivery.creditor.waitingBody
								: tr.delivery.creditor.reportedBody,
							{ name, amount },
						),
					}
				: {
						title: fill(
							phase === "waiting"
								? tr.delivery.debtor.waiting
								: tr.delivery.debtor.reported,
							{ name },
						),
						body: fill(
							phase === "waiting"
								? tr.delivery.debtor.waitingBody
								: tr.delivery.debtor.reportedBody,
							{ name, amount },
						),
					};
	const debtorName = role === "debtor" ? tr.request.you : name;
	const steps: { label: string; when: string | null; done: boolean }[] = [
		{ label: tr.delivery.steps.requested, when: null, done: true },
		{ label: tr.delivery.steps.accepted, when: null, done: true },
		{
			label: tr.delivery.steps.reported,
			when: delivery.reported_at,
			done: delivery.reported_at !== null,
		},
		{
			label: fill(tr.delivery.steps.confirmed, { name: debtorName }),
			when: delivery.confirmed_at,
			done: delivery.confirmed_at !== null,
		},
		{ label: tr.delivery.steps.active, when: null, done: phase === "done" },
	];
	const current = steps.findIndex((s) => !s.done);
	const done = phase === "done";
	return (
		<>
			<View
				testID="delivery.hero"
				style={{
					borderRadius: radius.xl,
					padding: 20,
					backgroundColor: done ? colors.heroStage : colors.warningSoft,
					borderWidth: done ? 0 : 1,
					borderColor: colors.warningSoft,
				}}
			>
				<Text
					style={{
						fontFamily: fonts.extrabold,
						fontSize: 13,
						letterSpacing: 0.3,
						color: done ? colors.heroSoft : colors.warning,
					}}
				>
					{tr.delivery.kickers[phase]}
				</Text>
				<Text
					testID="delivery.title"
					style={{
						fontFamily: fonts.extrabold,
						fontSize: 22,
						marginTop: 4,
						color: done ? colors.heroText : colors.warning,
					}}
				>
					{hero.title}
				</Text>
				<Text
					style={[
						typography.callout,
						{ marginTop: 6, color: done ? colors.heroSoft : colors.warning },
					]}
				>
					{hero.body}
				</Text>
			</View>
			<View
				style={{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					borderRadius: radius.lg,
					paddingHorizontal: 16,
					paddingVertical: 10,
				}}
			>
				{steps.map((s, index) => {
					const isCurrent = index === current;
					return (
						<View
							key={s.label}
							testID={`delivery.step.${String(index)}`}
							style={[styles.step, { gap: 12 }]}
						>
							<View
								style={[
									styles.mark,
									{
										backgroundColor: s.done
											? colors.accent
											: isCurrent
												? colors.warningSoft
												: colors.surface,
										borderColor:
											s.done || isCurrent
												? "transparent"
												: colors.borderStrong,
									},
								]}
							>
								{s.done ? (
									<Ionicons name="checkmark" size={16} color={colors.onPrimary} />
								) : (
									<Text
										style={{
											fontFamily: fonts.extrabold,
											fontSize: 12,
											color: isCurrent ? colors.warning : colors.textMuted,
										}}
									>
										{String(index + 1)}
									</Text>
								)}
							</View>
							<Text
								style={{
									flex: 1,
									fontFamily: s.done || isCurrent ? fonts.bold : fonts.semibold,
									fontSize: 14,
									color: isCurrent
										? colors.warning
										: s.done
											? colors.text
											: colors.textMuted,
								}}
							>
								{s.label}
							</Text>
							<Text
								style={[
									typography.caption,
									{ fontSize: 12, color: colors.textMuted },
								]}
							>
								{s.when !== null
									? formatDateTimeTR(s.when)
									: isCurrent
										? tr.delivery.pending
										: ""}
							</Text>
						</View>
					);
				})}
			</View>
			<View
				style={{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderWidth: 1,
					borderRadius: radius.lg,
				}}
			>
				<View style={styles.kv}>
					<Text style={[typography.callout, { color: colors.textMuted }]}>
						{tr.delivery.amount}
					</Text>
					<Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.text }}>
						{amount}
					</Text>
				</View>
				{due === null ? null : (
					<View
						style={[styles.kv, { borderTopWidth: 1, borderTopColor: colors.divider }]}
					>
						<Text style={[typography.callout, { color: colors.textMuted }]}>
							{tr.delivery.due}
						</Text>
						<Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.text }}>
							{formatDateTR(due, "long")}
						</Text>
					</View>
				)}
			</View>
			<View style={{ gap: spacing.sm }}>
				{step.error === null ? null : (
					<Text
						accessibilityLiveRegion="polite"
						style={[typography.caption, { color: colors.overdue }]}
					>
						{messageForError(step.error)}
					</Text>
				)}
				{role === "creditor" && phase === "waiting" ? (
					<>
						<Button
							label={tr.delivery.handOver}
							loading={step.isPending}
							onPress={() => {
								step.mutate({
									id: agreement.id,
									rowVersion: delivery.row_version,
									step: "report",
								});
							}}
							testID="delivery.handOver.button"
						/>
						<Text
							style={[
								typography.caption,
								{ fontSize: 12, color: colors.textMuted, textAlign: "center" },
							]}
						>
							{tr.delivery.handOverHint}
						</Text>
					</>
				) : null}
				{role === "debtor" && phase === "reported" ? (
					<Button
						label={tr.delivery.confirm}
						loading={step.isPending}
						onPress={() => {
							step.mutate({
								id: agreement.id,
								rowVersion: delivery.row_version,
								step: "confirm",
							});
						}}
						testID="delivery.confirm.button"
					/>
				) : null}
				<Button
					label={tr.delivery.back}
					variant="secondary"
					onPress={() => {
						router.back();
					}}
					testID="delivery.back.button"
				/>
			</View>
		</>
	);
}

// Design 17: the money changes hands inside "active"; both sides confirm (ADR-058).
export function DeliveryScreen({ id }: { id: string }) {
	const agreement = useAgreement(id);
	const delivery = useDelivery(id);
	return (
		<Screen testID="delivery.screen" edges={["bottom"]}>
			{agreement.isPending || delivery.isPending ? (
				<LoadingState rows={4} testID="delivery.loading" />
			) : agreement.isError || delivery.isError ? (
				<ErrorState
					message={messageForError(agreement.error ?? delivery.error)}
					onRetry={() => {
						void agreement.refetch();
						void delivery.refetch();
					}}
					testID="delivery.error"
				/>
			) : (
				<Content agreement={agreement.data} delivery={delivery.data} />
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	step: { flexDirection: "row", alignItems: "center", minHeight: 48 },
	mark: {
		width: 28,
		height: 28,
		borderRadius: 14,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
	},
	kv: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 48,
	},
});
