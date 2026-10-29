import { Pressable, Text, View } from "react-native";
import type { FieldErrors, Resolver } from "react-hook-form";

import { validateForm, type NewFormValues, type NewType } from "./formModel";
import { tr } from "@/i18n/tr";
import { useAppTheme } from "@/theme/useAppTheme";

// react-hook-form owns the state; the rules (including the plan rules) come from formModel / @paramnet/shared.
export function resolverFor(type: NewType): Resolver<NewFormValues> {
	return (values) => {
		const codes = validateForm(type, values);
		const entries = Object.entries(codes);
		if (entries.length === 0) {
			return { values, errors: {} };
		}
		const errors: FieldErrors<NewFormValues> = {};
		for (const [field, code] of entries) {
			errors[field as keyof NewFormValues] = { type: "validate", message: code };
		}
		return { values: {}, errors };
	};
}

// The chosen person or merchant, opened as a sheet (S09); shared by the loan and installment forms.
export function ContactField({
	label,
	value,
	error,
	onPress,
}: {
	label: string;
	value: string | null;
	error?: string;
	onPress: () => void;
}) {
	const { colors, typography, radius, spacing, sizes } = useAppTheme();
	return (
		<View style={{ gap: spacing.xs }}>
			<Text style={[typography.label, { color: colors.textMuted }]}>{label}</Text>
			<Pressable
				testID="newForm.contact.picker"
				accessibilityRole="button"
				accessibilityLabel={`${label}: ${value ?? tr.new.choosePerson}`}
				onPress={onPress}
				style={{
					minHeight: sizes.buttonPrimary,
					justifyContent: "center",
					borderWidth: 1,
					borderRadius: radius.sm,
					borderColor: error === undefined ? colors.borderStrong : colors.overdue,
					backgroundColor: colors.surface,
					paddingHorizontal: spacing.md,
				}}
			>
				<Text
					numberOfLines={1}
					style={[
						typography.body,
						{ color: value === null ? colors.textMuted : colors.text },
					]}
				>
					{value ?? tr.new.choosePerson}
				</Text>
			</Pressable>
			{error !== undefined ? (
				<Text style={[typography.caption, { color: colors.overdue }]}>{error}</Text>
			) : null}
		</View>
	);
}
