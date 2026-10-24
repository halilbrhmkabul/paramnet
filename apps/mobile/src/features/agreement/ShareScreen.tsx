import {
	PARAMNET_ID_ALPHABET,
	PARAMNET_ID_LENGTH,
	formatPhoneTR,
	normalizeParamnetId,
	normalizePhoneTR,
} from "@paramnet/shared";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Share, Text, View } from "react-native";

import { messageForError } from "@/api/errors";
import {
	useAgreement,
	useParamnetIdLookup,
	useShareAgreement,
	useShareAgreementById,
} from "@/api/hooks";
import type { AgreementDetail } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { Screen } from "@/components/Screen";
import { ScreenTitle } from "@/components/ScreenTitle";
import { SegmentedControl } from "@/components/SegmentedControl";
import { TextField } from "@/components/TextField";
import { useSession } from "@/features/auth/sessionStore";
import { fill, tr } from "@/i18n/tr";
import { inviteLink } from "@/lib/inviteLink";
import { useIsOnline } from "@/lib/network";
import { useAppTheme } from "@/theme/useAppTheme";

type Mode = "phone" | "id";

const MODES = [
	{ value: "phone", label: tr.share.modePhone },
	{ value: "id", label: tr.share.modeId },
] as const;

const CODE_CHARS = new RegExp(`^[${PARAMNET_ID_ALPHABET}]*$`);

// "partial" while typing: a lookup is spent only on a complete ID (hourly limit, ADR-050).
export function idInputState(input: string): "empty" | "partial" | "invalid" | { id: string } {
	const id = normalizeParamnetId(input);
	if (id !== null) {
		return { id };
	}
	let code = input.replace(/[\s-]/g, "").toUpperCase();
	if (code === "") {
		return "empty";
	}
	if (code.startsWith("PN")) {
		code = code.slice(2);
	}
	return CODE_CHARS.test(code) && code.length < PARAMNET_ID_LENGTH ? "partial" : "invalid";
}

function IdShare({ agreement }: { agreement: AgreementDetail }) {
	const { colors, typography, spacing } = useAppTheme();
	const online = useIsOnline();
	const [input, setInput] = useState("");
	const state = idInputState(input);
	const id = typeof state === "object" ? state.id : null;
	const lookup = useParamnetIdLookup(id);
	const share = useShareAgreementById();
	const found = lookup.data?.status === "found" ? lookup.data : null;

	if (share.data?.status === "shared") {
		return (
			<Screen
				testID="share.screen"
				edges={["bottom"]}
				footer={
					<Button
						label={tr.share.done}
						onPress={() => {
							router.back();
						}}
						testID="share.done.button"
					/>
				}
			>
				<ScreenTitle>{tr.share.title}</ScreenTitle>
				<Card>
					<Text
						testID="share.idShared.text"
						accessibilityLiveRegion="polite"
						style={[typography.body, { color: colors.text }]}
					>
						{fill(tr.share.idShared, { name: share.data.display_name })}
					</Text>
				</Card>
			</Screen>
		);
	}

	// After a share attempt its answer wins: the ID may have changed hands since the lookup.
	const status = share.data?.status ?? lookup.data?.status;
	const problem =
		state === "invalid" || status === "invalid"
			? tr.share.idInvalid
			: status === "self"
				? tr.share.idSelf
				: status === "not_found"
					? tr.share.idNotFound
					: lookup.isError
						? messageForError(lookup.error, "paramnetId")
						: undefined;

	return (
		<>
			<TextField
				label={tr.share.idLabel}
				value={input}
				onChangeText={(text) => {
					setInput(text);
					share.reset();
				}}
				autoCapitalize="characters"
				autoComplete="off"
				placeholder={tr.share.idPlaceholder}
				maxLength={12}
				error={problem}
				helper={tr.share.idHelper}
				testID="share.id.input"
			/>
			{lookup.isFetching ? (
				<View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
					<ActivityIndicator size="small" color={colors.textMuted} />
					<Text style={[typography.caption, { color: colors.textMuted }]}>
						{tr.share.idChecking}
					</Text>
				</View>
			) : null}
			{found === null ? null : (
				<Card
					testID="share.id.result"
					style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
				>
					<Avatar name={found.display_name} size={44} />
					<View style={{ flex: 1 }}>
						<Text style={[typography.rowTitle, { color: colors.text }]}>
							{found.display_name}
						</Text>
						<Text style={[typography.caption, { color: colors.textMuted }]}>
							{tr.share.idFoundHint}
						</Text>
					</View>
				</Card>
			)}
			{share.isError ? (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.callout, { color: colors.overdue }]}
				>
					{messageForError(share.error, "paramnetId")}
				</Text>
			) : null}
			{online ? null : (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.error.offline}
				</Text>
			)}
			<Button
				label={tr.share.send}
				disabled={found === null || !online}
				loading={share.isPending}
				onPress={() => {
					if (found === null) {
						return;
					}
					share.mutate({
						id: agreement.id,
						paramnetId: found.paramnet_id,
						rowVersion: agreement.row_version,
					});
				}}
				testID="share.send.button"
			/>
		</>
	);
}

function ShareForm({ agreement }: { agreement: AgreementDetail }) {
	const [mode, setMode] = useState<Mode>("phone");
	const modeControl = (
		<SegmentedControl
			label={tr.share.to}
			hideLabel
			options={MODES}
			value={mode}
			onChange={setMode}
			testID="share.mode"
		/>
	);
	if (mode === "id") {
		return (
			<Screen testID="share.screen" edges={["bottom"]}>
				<ScreenTitle>{tr.share.title}</ScreenTitle>
				{modeControl}
				<IdShare agreement={agreement} />
			</Screen>
		);
	}
	return <PhoneShare agreement={agreement} modeControl={modeControl} />;
}

function PhoneShare({
	agreement,
	modeControl,
}: {
	agreement: AgreementDetail;
	modeControl: ReactNode;
}) {
	const { colors, typography } = useAppTheme();
	const myName = useSession((state) => state.user?.display_name ?? "");
	const online = useIsOnline();
	const share = useShareAgreement();
	const [phone, setPhone] = useState(
		agreement.counterparty.phone_e164 === null
			? ""
			: formatPhoneTR(agreement.counterparty.phone_e164),
	);
	const normalized = normalizePhoneTR(phone);
	const previewMessage = fill(tr.share.message, { name: myName, link: "…" });
	const [linkError, setLinkError] = useState(false);

	return (
		<Screen
			testID="share.screen"
			edges={["bottom"]}
			footer={
				<Button
					label={tr.share.send}
					disabled={normalized === null || !online}
					loading={share.isPending}
					onPress={() => {
						if (normalized === null) {
							return;
						}
						share.mutate(
							{
								id: agreement.id,
								phone: normalized,
								rowVersion: agreement.row_version,
							},
							{
								onSuccess: ({ token }) => {
									const link = inviteLink(token);
									if (link === null) {
										setLinkError(true);
										return;
									}
									// The plain token exists only here (ADR-026); the system share sheet sends it.
									void Share.share({
										message: fill(tr.share.message, { name: myName, link }),
									}).finally(() => {
										router.back();
									});
								},
							},
						);
					}}
					testID="share.send.button"
				/>
			}
		>
			<ScreenTitle>{tr.share.title}</ScreenTitle>
			{modeControl}
			<TextField
				label={tr.share.phoneLabel}
				value={phone}
				onChangeText={setPhone}
				keyboardType="phone-pad"
				helper={agreement.counterparty.display_name}
				error={phone !== "" && normalized === null ? tr.phone.errorInvalid : undefined}
				testID="share.phone.input"
			/>
			{normalized === null && phone === "" ? (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.share.needPhone}
				</Text>
			) : null}
			<Card>
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.share.preview}
				</Text>
				<Text testID="share.message.text" style={[typography.body, { color: colors.text }]}>
					{previewMessage}
				</Text>
			</Card>
			{share.isError ? (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.callout, { color: colors.overdue }]}
				>
					{messageForError(share.error)}
				</Text>
			) : null}
			{linkError ? (
				<Text style={[typography.callout, { color: colors.overdue }]}>
					{tr.share.noLink}
				</Text>
			) : null}
			{online ? null : (
				<Text style={[typography.caption, { color: colors.textMuted }]}>
					{tr.error.offline}
				</Text>
			)}
			<Button
				label={tr.share.seeAsCounterparty}
				variant="ghost"
				onPress={() => {
					router.push({
						pathname: "/agreement/[id]/invite-preview",
						params: { id: agreement.id },
					});
				}}
				testID="share.preview.button"
			/>
		</Screen>
	);
}

// S13: creates the invite (share_agreement) and hands the link to the system share sheet.
export function ShareScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const agreement = useAgreement(id);
	if (agreement.isPending) {
		return (
			<Screen testID="share.screen" edges={["bottom"]}>
				<LoadingState testID="share.loading" />
			</Screen>
		);
	}
	if (agreement.isError) {
		return (
			<Screen testID="share.screen" edges={["bottom"]}>
				<ErrorState
					message={messageForError(agreement.error)}
					onRetry={() => {
						void agreement.refetch();
					}}
					testID="share.error"
				/>
			</Screen>
		);
	}
	return <ShareForm agreement={agreement.data} />;
}
