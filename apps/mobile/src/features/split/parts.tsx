import { formatTRY } from "@paramnet/shared";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { SplitMember } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { Badge, type BadgeTone } from "@/components/StatusBadge";
import { useAppTheme } from "@/theme/useAppTheme";

// A card of rows with hairlines between them (designs 41–43 ".card .pr").
export function MemberCard({ children, testID }: { children: ReactNode; testID?: string }) {
	const { colors, radius } = useAppTheme();
	return (
		<View
			testID={testID}
			style={{
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderWidth: 1,
				borderRadius: radius.lg,
				overflow: "hidden",
			}}
		>
			{children}
		</View>
	);
}

export function MemberRow({
	member,
	title,
	sub,
	badge,
	amount,
	first,
	highlight,
	children,
}: {
	member: SplitMember;
	title: string;
	sub?: string;
	badge: { label: string; tone: BadgeTone };
	amount?: number;
	first: boolean;
	highlight?: boolean;
	// Actions under the row (approve, confirm).
	children?: ReactNode;
}) {
	const { colors, typography, fonts, spacing } = useAppTheme();
	const testID = `split.member.${member.id}`;
	return (
		<View
			testID={testID}
			style={{
				borderTopWidth: first ? 0 : 1,
				borderTopColor: colors.divider,
				backgroundColor: highlight === true ? colors.primaryTint : "transparent",
				paddingHorizontal: 14,
				paddingVertical: 12,
				gap: 10,
			}}
		>
			<View style={[styles.row, { gap: spacing.md }]}>
				<Avatar name={member.display_name} size={40} />
				<View style={styles.grow}>
					<Text style={[typography.rowTitle, { color: colors.text }]} numberOfLines={1}>
						{title}
					</Text>
					{sub === undefined ? null : (
						<Text
							style={[typography.caption, { fontSize: 12, color: colors.textMuted }]}
							numberOfLines={2}
						>
							{sub}
						</Text>
					)}
				</View>
				<View style={styles.end}>
					{amount === undefined ? null : (
						<Text
							testID={`${testID}.amount`}
							style={{
								fontFamily: fonts.extrabold,
								fontSize: 15,
								color: colors.text,
							}}
						>
							{formatTRY(amount)}
						</Text>
					)}
					<Badge label={badge.label} tone={badge.tone} testID={`${testID}.badge`} />
				</View>
			</View>
			{children}
		</View>
	);
}

export function PairButtons({ children }: { children: ReactNode }) {
	const { spacing } = useAppTheme();
	return <View style={[styles.row, { gap: spacing.sm }]}>{children}</View>;
}

export function InfoNote({ children, testID }: { children: string; testID?: string }) {
	const { colors, typography, radius } = useAppTheme();
	return (
		<View
			testID={testID}
			style={{ backgroundColor: colors.pendingSoft, borderRadius: radius.sm, padding: 14 }}
		>
			<Text style={[typography.caption, { color: colors.pending, lineHeight: 19 }]}>
				{children}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center" },
	grow: { flex: 1, minWidth: 0 },
	end: { alignItems: "flex-end", gap: 4 },
});
