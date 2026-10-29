import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";

import { AmountInput } from "../AmountInput";
import { AmountText } from "../AmountText";
import { Button } from "../Button";
import { Card } from "../Card";
import { EmptyState } from "../EmptyState";
import { ErrorState } from "../ErrorState";
import { ListItem } from "../ListItem";
import { LoadingState } from "../LoadingState";
import { AgreementStatusBadge, InstallmentStatusBadge } from "../StatusBadge";
import { tr } from "@/i18n/tr";

describe("Button", () => {
	it("calls onPress and exposes role and label", async () => {
		const onPress = jest.fn();
		await render(<Button label="Kaydet" onPress={onPress} testID="t.save.button" />);
		const button = screen.getByTestId("t.save.button");
		expect(button).toHaveAccessibleName("Kaydet");
		expect(screen.getByRole("button")).toBeTruthy();
		await fireEvent.press(button);
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("does not fire while disabled or loading", async () => {
		const onPress = jest.fn();
		await render(
			<>
				<Button label="A" onPress={onPress} disabled testID="a" />
				<Button label="B" onPress={onPress} loading testID="b" />
			</>,
		);
		await fireEvent.press(screen.getByTestId("a"));
		await fireEvent.press(screen.getByTestId("b"));
		expect(onPress).not.toHaveBeenCalled();
		expect(screen.getByTestId("a")).toBeDisabled();
		expect(screen.getByTestId("b")).toBeBusy();
	});
});

describe("AmountText", () => {
	it("formats kuruş with the shared helper", async () => {
		await render(<AmountText minor={1200000} testID="amount" />);
		expect(screen.getByTestId("amount")).toHaveTextContent("12.000,00 TL");
	});
});

describe("AmountInput", () => {
	function Harness({ onValue }: { onValue: (value: number | null) => void }) {
		const [value, setValue] = useState<number | null>(null);
		return (
			<AmountInput
				label="Tutar"
				value={value}
				onChangeValue={(next) => {
					setValue(next);
					onValue(next);
				}}
				testID="form.amount.input"
			/>
		);
	}

	it("keeps kuruş as an integer and shows Turkish grouping", async () => {
		const onValue = jest.fn();
		await render(<Harness onValue={onValue} />);
		const input = screen.getByTestId("form.amount.input");
		await fireEvent.changeText(input, "12000");
		expect(onValue).toHaveBeenLastCalledWith(1200000);
		expect(input).toHaveDisplayValue("12.000");
		await fireEvent.changeText(input, "12.000,5");
		expect(onValue).toHaveBeenLastCalledWith(1200050);
		expect(input).toHaveAccessibleName("Tutar");
	});

	it("shows an error message", async () => {
		await render(
			<AmountInput
				label="Tutar"
				value={null}
				onChangeValue={jest.fn()}
				error="Hata"
				testID="x"
			/>,
		);
		expect(screen.getByText("Hata")).toBeTruthy();
	});
});

describe("Card / ListItem", () => {
	it("Card is pressable only with onPress", async () => {
		const onPress = jest.fn();
		await render(
			<Card testID="card" onPress={onPress} accessibilityLabel="Kart">
				<ListItem title="Ahmet" subtitle="Borç verdim" testID="item" />
			</Card>,
		);
		await fireEvent.press(screen.getByTestId("card"));
		expect(onPress).toHaveBeenCalled();
		expect(screen.getByText("Ahmet")).toBeTruthy();
		expect(screen.getByText("Borç verdim")).toBeTruthy();
	});

	it("ListItem forwards presses", async () => {
		const onPress = jest.fn();
		await render(<ListItem title="Elif" onPress={onPress} testID="item" />);
		await fireEvent.press(screen.getByTestId("item"));
		expect(onPress).toHaveBeenCalled();
	});
});

describe("Status badges", () => {
	it("always pair colour with a Turkish label", async () => {
		await render(
			<>
				<AgreementStatusBadge status="amendment_pending" testID="ag" />
				<InstallmentStatusBadge status="overdue" partial testID="inst" />
			</>,
		);
		expect(screen.getByTestId("ag")).toHaveTextContent(tr.agreement.status.amendment_pending);
		expect(screen.getByTestId("inst")).toHaveTextContent(
			`${tr.installment.status.overdue} · ${tr.installment.partial}`,
		);
	});

	it("an open installment without a due date is not coming up", async () => {
		await render(
			<>
				<InstallmentStatusBadge status="upcoming" partial={false} undated testID="open" />
				<InstallmentStatusBadge status="overdue" partial={false} undated testID="late" />
			</>,
		);
		expect(screen.getByTestId("open")).toHaveTextContent(tr.installment.undated);
		expect(screen.getByTestId("late")).toHaveTextContent(tr.installment.status.overdue);
	});
});

describe("EmptyState / ErrorState / LoadingState", () => {
	it("EmptyState renders an optional action", async () => {
		const onAction = jest.fn();
		await render(
			<EmptyState
				title="Boş"
				body="Açıklama"
				actionLabel="Ekle"
				onAction={onAction}
				testID="empty"
			/>,
		);
		await fireEvent.press(screen.getByTestId("empty.action.button"));
		expect(onAction).toHaveBeenCalled();
	});

	it("ErrorState defaults to the generic message and retries", async () => {
		const onRetry = jest.fn();
		await render(<ErrorState onRetry={onRetry} testID="error" />);
		expect(screen.getByText(tr.error.generic)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("error.retry.button"));
		expect(onRetry).toHaveBeenCalled();
	});

	it("LoadingState is announced", async () => {
		await render(<LoadingState testID="loading" />);
		expect(screen.getByTestId("loading")).toHaveAccessibleName(tr.common.loading);
	});
});
