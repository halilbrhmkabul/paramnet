import { adjustmentDelta, formatSignedTRY } from "@paramnet/shared";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import { useAccounts, useAdjustBalance } from "@/api/hooks";
import type { Account } from "@/api/types";
import { AmountInput } from "@/components/AmountInput";
import { AmountText } from "@/components/AmountText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Checkbox } from "@/components/Checkbox";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { fill, tr } from "@/i18n/tr";
import { newIdempotencyKey } from "@/lib/ids";
import { useAppTheme } from "@/theme/useAppTheme";

import { AccountIcon } from "./parts";

function AdjustForm({ account }: { account: Account }) {
	const { colors, typography, spacing } = useAppTheme();
	const [target, setTarget] = useState<number | null>(null);
	const [negative, setNegative] = useState(account.balance_minor < 0);
	const key = useRef(newIdempotencyKey());
	const adjust = useAdjustBalance();
	const targetMinor = target === null ? null : negative ? -target : target;
	const delta = targetMinor === null ? null : adjustmentDelta(account.balance_minor, targetMinor);

	return (
		<Screen
			testID="adjust.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.adjust.submit}
					loading={adjust.isPending}
					disabled={targetMinor === null}
					onPress={() => {
						if (targetMinor === null) {
							return;
						}
						adjust.mutate(
							{ id: account.id, targetMinor, idempotencyKey: key.current },
							{
								onSuccess: () => {
									router.back();
								},
							},
						);
					}}
					testID="adjust.submit.button"
				/>
			}
		>
			<Text style={[typography.callout, { color: colors.textMuted }]}>{tr.adjust.body}</Text>
			<Card>
				<View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
					<AccountIcon kind={account.kind} />
					<View style={{ flex: 1 }}>
						<Text style={[typography.rowTitle, { color: colors.text }]}>
							{account.name}
						</Text>
						<Text style={[typography.caption, { color: colors.textMuted }]}>
							{tr.adjust.current}
						</Text>
					</View>
					<AmountText
						minor={account.balance_minor}
						variant="rowTitle"
						testID="adjust.current.amount"
					/>
				</View>
			</Card>
			<View style={{ gap: spacing.xs }}>
				<AmountInput
					label={tr.adjust.target}
					value={target}
					onChangeValue={setTarget}
					testID="adjust.target.input"
				/>
				<Checkbox
					label={tr.accountForm.negative}
					checked={negative}
					onChange={setNegative}
					testID="adjust.negative.checkbox"
				/>
			</View>
			{delta === null ? null : (
				<Text
					testID="adjust.difference.text"
					style={[typography.rowTitle, { color: colors.text }]}
				>
					{fill(tr.adjust.difference, {
						amount: formatSignedTRY(
							delta,
							delta < 0 ? "minus" : delta > 0 ? "plus" : "none",
						),
					})}
				</Text>
			)}
			{adjust.error === null ? null : (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.caption, { color: colors.overdue }]}
				>
					{messageForError(adjust.error)}
				</Text>
			)}
		</Screen>
	);
}

// "Bakiye düzelt" (design 29): the user types the real balance; the difference is recorded.
export function AdjustBalanceScreen({ id }: { id: string }) {
	const accounts = useAccounts();
	if (accounts.isPending) {
		return (
			<Screen testID="adjust.screen" edges={["bottom"]}>
				<LoadingState rows={3} testID="adjust.loading" />
			</Screen>
		);
	}
	const account = accounts.data?.accounts.find((a) => a.id === id);
	if (account === undefined) {
		return (
			<Screen testID="adjust.screen" edges={["bottom"]}>
				<ErrorState
					message={accounts.isError ? messageForError(accounts.error) : tr.error.notFound}
					onRetry={() => {
						void accounts.refetch();
					}}
					testID="adjust.error"
				/>
			</Screen>
		);
	}
	return <AdjustForm account={account} />;
}
