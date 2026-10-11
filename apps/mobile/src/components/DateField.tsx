import DateTimePicker from "@react-native-community/datetimepicker";
import { APP_TIME_ZONE, formatDateTR, type IsoDate } from "@paramnet/shared";
import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "./Button";
import { tr } from "@/i18n/tr";
import { dateForPicker, dayFromPicker } from "@/lib/dates";
import { useAppTheme } from "@/theme/useAppTheme";

export type DateFieldProps = {
	label: string;
	value: IsoDate | null;
	onChange: (value: IsoDate) => void;
	// Shown when value is null, e.g. "Vadesiz" or "Tarih seç".
	emptyText?: string;
	defaultPickerDate: IsoDate;
	error?: string;
	disabled?: boolean;
	testID: string;
};

export function DateField({
	label,
	value,
	onChange,
	emptyText = tr.new.chooseDate,
	defaultPickerDate,
	error,
	disabled = false,
	testID,
}: DateFieldProps) {
	const { colors, typography, radius, spacing, sizes } = useAppTheme();
	const [open, setOpen] = useState(false);
	const shown = value === null ? emptyText : formatDateTR(value, "long");
	const picker = (
		<DateTimePicker
			testID={`${testID}.picker`}
			value={dateForPicker(value ?? defaultPickerDate)}
			mode="date"
			timeZoneName={APP_TIME_ZONE}
			locale="tr-TR"
			display={Platform.OS === "ios" ? "inline" : "default"}
			onValueChange={(_, date) => {
				onChange(dayFromPicker(date));
				if (Platform.OS !== "ios") {
					setOpen(false);
				}
			}}
			onDismiss={() => {
				setOpen(false);
			}}
		/>
	);

	return (
		<View style={{ gap: spacing.xs }}>
			<Text style={[typography.callout, { color: colors.textMuted }]}>{label}</Text>
			<Pressable
				testID={testID}
				accessibilityRole="button"
				accessibilityLabel={`${label}: ${shown}`}
				accessibilityState={{ disabled }}
				disabled={disabled}
				onPress={() => {
					setOpen(true);
				}}
				style={[
					styles.field,
					{
						minHeight: sizes.minTouch,
						borderRadius: radius.sm,
						borderColor: error === undefined ? colors.border : colors.overdue,
						backgroundColor: colors.surface,
						paddingHorizontal: spacing.md,
						opacity: disabled ? 0.5 : 1,
					},
				]}
			>
				<Text
					style={[
						typography.body,
						{ color: value === null ? colors.textMuted : colors.text },
					]}
				>
					{shown}
				</Text>
			</Pressable>
			{error !== undefined ? (
				<Text
					accessibilityLiveRegion="polite"
					style={[typography.caption, { color: colors.overdue }]}
				>
					{error}
				</Text>
			) : null}
			{open && Platform.OS !== "ios" ? picker : null}
			{Platform.OS === "ios" ? (
				<Modal
					visible={open}
					transparent
					animationType="slide"
					onRequestClose={() => {
						setOpen(false);
					}}
				>
					<View style={styles.backdrop}>
						<View
							style={{
								backgroundColor: colors.surfaceRaised,
								borderTopLeftRadius: radius.lg,
								borderTopRightRadius: radius.lg,
								padding: spacing.lg,
								gap: spacing.md,
							}}
						>
							{picker}
							<Button
								label={tr.common.close}
								onPress={() => {
									setOpen(false);
								}}
								testID={`${testID}.done.button`}
							/>
						</View>
					</View>
				</Modal>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	field: {
		justifyContent: "center",
		borderWidth: 1,
	},
	backdrop: {
		flex: 1,
		justifyContent: "flex-end",
		backgroundColor: "rgba(0,0,0,0.4)",
	},
});
