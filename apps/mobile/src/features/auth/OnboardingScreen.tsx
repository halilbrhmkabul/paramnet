import { formatTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { initials } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { fill, tr } from "@/i18n/tr";
import { palette, type ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

// The illustrations are pictures of the light design in both themes (design 31).
const LIGHT = palette.light;
type Tone = readonly [ColorToken, ColorToken];
const BLUE: Tone = ["pendingSoft", "pending"];
const GREEN: Tone = ["successSoft", "success"];
const PURPLE: Tone = ["neutralSoft", "neutral"];
const AMBER: Tone = ["warningSoft", "warning"];
const ROSE: Tone = ["overdueSoft", "overdue"];

const copy = tr.onboarding.sample;

function MiniRow({
	badge,
	tone,
	square = false,
	title,
	subtitle,
	amount,
	positive = false,
}: {
	badge?: string;
	tone: Tone;
	square?: boolean;
	title: string;
	subtitle: string;
	amount: string;
	positive?: boolean;
}) {
	const { colors, typography } = useAppTheme();
	return (
		<View style={[styles.mini, { backgroundColor: colors.heroCardSurface }]}>
			<View
				style={[
					styles.badge,
					{ borderRadius: square ? 10 : 18, backgroundColor: LIGHT[tone[0]] },
				]}
			>
				<Text style={[typography.label, { color: LIGHT[tone[1]] }]}>
					{badge ?? initials(title)}
				</Text>
			</View>
			<View style={styles.miniText}>
				<Text
					numberOfLines={1}
					style={[typography.rowTitle, { color: colors.heroCardText }]}
				>
					{title}
				</Text>
				<Text numberOfLines={1} style={[typography.badge, { color: colors.heroCardMuted }]}>
					{subtitle}
				</Text>
			</View>
			<Text
				style={[
					typography.rowTitle,
					{
						color: positive ? LIGHT.success : colors.heroCardText,
						fontVariant: ["tabular-nums"],
					},
				]}
			>
				{amount}
			</Text>
		</View>
	);
}

function Pill({ label, tone }: { label: string; tone: Tone }) {
	const { typography } = useAppTheme();
	return (
		<Text
			style={[
				typography.micro,
				styles.pill,
				{ backgroundColor: LIGHT[tone[0]], color: LIGHT[tone[1]] },
			]}
		>
			{label}
		</Text>
	);
}

function SlideCash() {
	const { colors, typography } = useAppTheme();
	return (
		<View style={styles.slide}>
			<Text style={[typography.label, { color: colors.heroAccent }]}>{copy.cash}</Text>
			<Text
				style={[
					typography.amountXL,
					{ color: colors.heroText, marginBottom: 8, fontVariant: ["tabular-nums"] },
				]}
			>
				{formatTRY(2_834_000)}
			</Text>
			<MiniRow
				tone={BLUE}
				square
				title={copy.salary}
				subtitle={copy.bank}
				amount={formatTRY(1_924_000)}
			/>
			<MiniRow
				tone={GREEN}
				square
				title={copy.wallet}
				subtitle={copy.onHand}
				amount={formatTRY(260_000)}
			/>
			<MiniRow
				tone={PURPLE}
				square
				title={copy.savings}
				subtitle={copy.term}
				amount={formatTRY(650_000)}
			/>
		</View>
	);
}

function SlideDebts() {
	const { colors, typography } = useAppTheme();
	return (
		<View style={[styles.slide, { gap: 12 }]}>
			<MiniRow
				tone={BLUE}
				title={copy.personA}
				subtitle={copy.borrowRequest}
				amount={formatTRY(200_000)}
			/>
			<View style={styles.pills}>
				<Pill label={copy.accepted} tone={GREEN} />
				<Pill label={copy.deliveryPending} tone={AMBER} />
			</View>
			<MiniRow
				tone={ROSE}
				title={copy.personB}
				subtitle={copy.paymentReported}
				amount={`+${formatTRY(150_000)}`}
				positive
			/>
			<View style={styles.pills}>
				<Text
					style={[
						typography.label,
						styles.fakeButton,
						{ backgroundColor: colors.heroChip, color: colors.heroText },
					]}
				>
					{copy.notReceived}
				</Text>
				<Text
					style={[
						typography.label,
						styles.fakeButton,
						{ backgroundColor: colors.heroAccent, color: colors.onHeroAccent },
					]}
				>
					{copy.receivedConfirm}
				</Text>
			</View>
		</View>
	);
}

function SlideCalendar() {
	const { colors, typography } = useAppTheme();
	return (
		<View style={styles.slide}>
			<MiniRow
				badge="14"
				tone={AMBER}
				square
				title={copy.statement}
				subtitle={fill(copy.daysLeft, { days: "2" })}
				amount={formatTRY(425_000)}
			/>
			<MiniRow
				badge="15"
				tone={AMBER}
				square
				title={copy.furniture}
				subtitle={fill(copy.daysLeft, { days: "3" })}
				amount={formatTRY(333_333)}
			/>
			<MiniRow
				badge="28"
				tone={PURPLE}
				square
				title={copy.loan}
				subtitle={fill(copy.daysLeft, { days: "16" })}
				amount={formatTRY(738_640)}
			/>
			<Text
				style={[
					typography.label,
					{ color: colors.heroAccent, textAlign: "center", marginTop: 4 },
				]}
			>
				{copy.reminder}
			</Text>
		</View>
	);
}

const SLIDES = [SlideCash, SlideDebts, SlideCalendar] as const;

// Design 31: three intro slides after "Hesap oluştur"; skip and the last button open sign-up.
export function OnboardingScreen() {
	const { colors, typography, spacing } = useAppTheme();
	const [index, setIndex] = useState(0);
	const slides = tr.onboarding.slides;
	const slide = slides[index] ?? slides[0];
	const isLast = index === slides.length - 1;
	const Illustration = SLIDES[index] ?? SlideCash;
	const position = fill(tr.onboarding.position, {
		current: String(index + 1),
		total: String(slides.length),
	});

	function openSignUp() {
		router.replace({ pathname: "/login", params: { mode: "signup" } });
	}

	return (
		<Screen
			testID="onboarding.screen"
			edges={["top", "bottom"]}
			footer={
				<View style={{ gap: 20 }}>
					<View
						testID="onboarding.dots"
						accessibilityRole="image"
						accessibilityLabel={position}
						style={styles.dots}
					>
						{slides.map((item, i) => (
							<View
								key={item.title}
								style={[
									styles.dot,
									{
										width: i === index ? 24 : 8,
										backgroundColor:
											i === index ? colors.primary : colors.borderStrong,
									},
								]}
							/>
						))}
					</View>
					<Button
						label={isLast ? tr.onboarding.start : tr.onboarding.next}
						onPress={() => {
							if (isLast) {
								openSignUp();
							} else {
								setIndex(index + 1);
							}
						}}
						testID="onboarding.next.button"
					/>
				</View>
			}
		>
			<View style={styles.header}>
				<Text style={[typography.label, { color: colors.textMuted }]}>{position}</Text>
				<Pressable
					testID="onboarding.skip.button"
					accessibilityRole="button"
					accessibilityLabel={tr.onboarding.skip}
					onPress={openSignUp}
					hitSlop={8}
					style={styles.skip}
				>
					<Text style={[typography.rowTitle, { color: colors.accent }]}>
						{tr.onboarding.skip}
					</Text>
				</Pressable>
			</View>
			<View
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				style={[styles.stage, { backgroundColor: colors.heroStage }]}
			>
				<Illustration />
			</View>
			<View style={{ gap: 10, paddingHorizontal: spacing.sm }}>
				<Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
					{slide.title}
				</Text>
				<Text style={[typography.callout, { color: colors.textMuted, lineHeight: 22 }]}>
					{slide.body}
				</Text>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		minHeight: 44,
	},
	skip: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "flex-end" },
	stage: {
		height: 380,
		borderRadius: 28,
		padding: 24,
		justifyContent: "center",
		overflow: "hidden",
	},
	slide: { gap: 10, width: "100%" },
	mini: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		borderRadius: 16,
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	badge: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
	miniText: { flex: 1, minWidth: 0 },
	pills: { flexDirection: "row", justifyContent: "center", gap: 8 },
	pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
	fakeButton: {
		flex: 1,
		textAlign: "center",
		paddingVertical: 11,
		borderRadius: 12,
		overflow: "hidden",
	},
	dots: { flexDirection: "row", alignSelf: "center", gap: 6 },
	dot: { height: 8, borderRadius: 4 },
});
