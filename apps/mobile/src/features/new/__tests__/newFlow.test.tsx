import { fireEvent, renderRouter, screen, waitFor, within } from "expo-router/testing-library";

import { resetNewDraft } from "../draftStore";
import { tr } from "@/i18n/tr";
import { appRoutes } from "@/testing/appRoutes";
import { signInForTest } from "@/testing/session";

jest.mock("@/lib/contactPicker", () => ({
	pickContact: jest.fn(() =>
		Promise.resolve({ display_name: "Ahmet Yılmaz", phone_e164: "+905551112233" }),
	),
}));

jest.mock("@/lib/ids", () => {
	let n = 0;
	return {
		newIdempotencyKey: () => {
			n += 1;
			return `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
		},
	};
});

beforeEach(() => {
	signInForTest();
	resetNewDraft();
});

async function openForm(type: string) {
	await renderRouter(appRoutes, { initialUrl: "/new" });
	await fireEvent.press(screen.getByTestId(`new.type.${type}`));
	expect(screen.getByTestId("newForm.screen")).toBeTruthy();
}

describe("new record flow (S08–S10)", () => {
	it("furniture example: 28.000 / 8.000 down / 5 monthly from 10 Nov 2026 previews and saves", async () => {
		await openForm("boughtInstallment");

		await fireEvent.press(screen.getByTestId("newForm.contact.picker"));
		await fireEvent.press(screen.getByTestId("contactPicker.manual.button"));
		await fireEvent.changeText(
			screen.getByTestId("contactPicker.manualName.input"),
			"Kaya Mobilya",
		);
		await fireEvent.press(screen.getByTestId("contactPicker.manualSave.button"));
		expect(screen.getByTestId("newForm.contact.picker")).toHaveTextContent("Kaya Mobilya");

		await fireEvent.changeText(screen.getByTestId("newForm.title.input"), "Mobilya");
		await fireEvent.changeText(screen.getByTestId("newForm.amount.input"), "28000");
		await fireEvent.changeText(screen.getByTestId("newForm.downPayment.input"), "8000");
		await fireEvent.changeText(screen.getByTestId("newForm.count.input"), "5");
		await fireEvent.press(screen.getByTestId("newForm.dueDate"));
		await fireEvent.changeText(screen.getByTestId("newForm.dueDate.picker"), "2026-11-10");
		expect(screen.getByTestId("newForm.dueDate")).toHaveTextContent("10 Kasım 2026");

		await fireEvent.press(screen.getByTestId("newForm.submit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("plan.screen")).toBeTruthy();
		});

		expect(screen.getByTestId("plan.total.text")).toHaveTextContent("28.000,00 TL");
		expect(screen.getByTestId("plan.downPayment.text")).toHaveTextContent("8.000,00 TL");
		expect(screen.getByTestId("plan.remaining.text")).toHaveTextContent("20.000,00 TL");
		const expectedDates = [
			"10 Kasım 2026",
			"10 Aralık 2026",
			"10 Ocak 2027",
			"10 Şubat 2027",
			"10 Mart 2027",
		];
		expectedDates.forEach((date, i) => {
			const row = screen.getByTestId(`plan.row.${String(i + 1)}`);
			expect(within(row).getByTestId(`plan.row.${String(i + 1)}.date`)).toHaveTextContent(
				date,
			);
			expect(
				within(row).getByTestId(`plan.row.${String(i + 1)}.amount.input`),
			).toHaveDisplayValue("4.000");
		});

		await fireEvent.changeText(screen.getByTestId("plan.row.5.amount.input"), "3000");
		expect(screen.getByTestId("plan.mismatch.text")).toHaveTextContent(
			"Taksitlerin toplamı kalan tutara eşit olmalı. Fark: -1.000,00 TL",
		);
		expect(screen.getByTestId("plan.save.button")).toBeDisabled();

		await fireEvent.press(screen.getByTestId("plan.resetEqual.button"));
		expect(screen.queryByTestId("plan.mismatch.text")).toBeNull();
		await fireEvent.press(screen.getByTestId("plan.save.button"));

		await waitFor(() => {
			expect(screen.getByTestId("agreement.title.text")).toHaveTextContent("Mobilya");
		});
		expect(screen.getByTestId("agreement.outstanding.text")).toHaveTextContent("20.000,00 TL");
		expect(screen.getByTestId("agreement.status.badge")).toHaveTextContent(
			tr.agreement.status.personal,
		);
	});

	it("shows Turkish validation messages for an empty form", async () => {
		await openForm("boughtInstallment");
		await fireEvent.press(screen.getByTestId("newForm.submit.button"));
		await waitFor(() => {
			expect(screen.getByText(tr.form.contactRequired)).toBeTruthy();
		});
		expect(screen.getByText(tr.form.required)).toBeTruthy();
		expect(screen.getByText(tr.form.amountRequired)).toBeTruthy();
	});

	it("rejects a down payment that is not below the total", async () => {
		await openForm("soldInstallment");
		await fireEvent.press(screen.getByTestId("newForm.contact.picker"));
		await fireEvent.press(screen.getByTestId("contactPicker.fromPhone.button"));
		await waitFor(() => {
			expect(screen.getByTestId("newForm.contact.picker")).toHaveTextContent("Ahmet Yılmaz");
		});
		await fireEvent.changeText(screen.getByTestId("newForm.title.input"), "Bisiklet");
		await fireEvent.changeText(screen.getByTestId("newForm.amount.input"), "1000");
		await fireEvent.changeText(screen.getByTestId("newForm.downPayment.input"), "1000");
		await fireEvent.press(screen.getByTestId("newForm.submit.button"));
		await waitFor(() => {
			expect(screen.getByText(tr.form.downPaymentTooLarge)).toBeTruthy();
		});
	});

	it("a one-off loan without a due date saves as a single open-ended installment", async () => {
		await openForm("lent");
		await fireEvent.press(screen.getByTestId("newForm.contact.picker"));
		await waitFor(() => {
			expect(screen.getByText("Elif Kaya")).toBeTruthy();
		});
		await fireEvent.press(screen.getByText("Elif Kaya"));
		expect(screen.getByTestId("newForm.startedOn")).toHaveTextContent("11 Ekim 2026");
		await fireEvent.changeText(screen.getByTestId("newForm.amount.input"), "2500");
		await fireEvent.press(screen.getByTestId("newForm.noDueDate.checkbox"));
		expect(screen.getByTestId("newForm.dueDate")).toHaveTextContent(tr.new.noDueDate);
		await fireEvent.press(screen.getByTestId("newForm.submit.button"));
		await waitFor(() => {
			expect(screen.getByTestId("plan.row.1.date")).toHaveTextContent(tr.plan.noDueDate);
		});
		await fireEvent.press(screen.getByTestId("plan.save.button"));
		await waitFor(() => {
			expect(screen.getByTestId("agreement.title.text")).toHaveTextContent(tr.new.loanTitle);
		});
		expect(screen.getByTestId("agreement.startedOn.text")).toHaveTextContent("11 Ekim 2026");
	});
});
