import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { ApiError } from "@/api/errors";
import { useSession } from "@/features/auth/sessionStore";
import { tr } from "@/i18n/tr";
import { pickAvatar } from "@/lib/avatarImage";
import { appRoutes } from "@/testing/appRoutes";
import { createTestProfileApi, provideTestProfileApi } from "@/testing/providers";
import { signInForTest } from "@/testing/session";

const pickAvatarMock = jest.mocked(pickAvatar);

beforeEach(() => {
	signInForTest();
	pickAvatarMock.mockReset();
	pickAvatarMock.mockResolvedValue(null);
});

async function openEdit() {
	await renderRouter(appRoutes, { initialUrl: "/me/edit" });
	await waitFor(() => {
		expect(screen.getByTestId("editProfile.firstName.input")).toBeTruthy();
	});
}

describe("Profili düzenle (35)", () => {
	it("fills the form; the phone is read-only and the ID has no 'cannot change' tag", async () => {
		provideTestProfileApi(
			createTestProfileApi({ profile: { first_name: "Deniz", last_name: "Yılmaz" } }),
		);
		await openEdit();
		expect(screen.getByTestId("editProfile.firstName.input")).toHaveDisplayValue("Deniz");
		expect(screen.getByTestId("editProfile.lastName.input")).toHaveDisplayValue("Yılmaz");
		expect(screen.getByTestId("editProfile.username.input")).toHaveDisplayValue("test");
		expect(screen.getByTestId("editProfile.phone.text")).toHaveTextContent("+90 555 000 00 01");
		expect(screen.getByText(tr.editProfile.phoneVerified)).toBeTruthy();
		expect(screen.getByTestId("editProfile.paramnetId.text")).toHaveTextContent("PN-48K7QZ");
		expect(screen.queryByText("Değiştirilemez")).toBeNull();
		expect(screen.queryByText("E-posta")).toBeNull();
	});

	it("checks the username while typing", async () => {
		jest.useFakeTimers();
		try {
			await openEdit();
			await fireEvent.changeText(screen.getByTestId("editProfile.username.input"), "ab");
			expect(screen.getByText(tr.editProfile.usernameLength)).toBeTruthy();

			await fireEvent.changeText(screen.getByTestId("editProfile.username.input"), "ahmet");
			await act(async () => {
				await jest.advanceTimersByTimeAsync(600);
			});
			await waitFor(() => {
				expect(screen.getByTestId("editProfile.username.status")).toHaveTextContent(
					tr.editProfile.usernameTaken,
					{ exact: false },
				);
			});
			expect(screen.getByTestId("editProfile.save.button")).toBeDisabled();

			await fireEvent.changeText(
				screen.getByTestId("editProfile.username.input"),
				"@Deniz.Y",
			);
			await act(async () => {
				await jest.advanceTimersByTimeAsync(600);
			});
			await waitFor(() => {
				expect(screen.getByTestId("editProfile.username.status")).toHaveTextContent(
					tr.editProfile.usernameAvailable,
					{ exact: false },
				);
			});
			expect(screen.getByTestId("editProfile.save.button")).toBeEnabled();
		} finally {
			jest.useRealTimers();
		}
	});

	it("saves and updates the name everywhere", async () => {
		const api = createTestProfileApi();
		const update = jest.spyOn(api, "updateProfile");
		provideTestProfileApi(api);
		await openEdit();
		await fireEvent.changeText(screen.getByTestId("editProfile.firstName.input"), "Ayşe Nur");
		await fireEvent.changeText(screen.getByTestId("editProfile.lastName.input"), "Kaya");
		await fireEvent.press(screen.getByTestId("editProfile.save.button"));
		await waitFor(() => {
			expect(update).toHaveBeenCalledWith({
				first_name: "Ayşe Nur",
				last_name: "Kaya",
				username: "test",
			});
		});
		await waitFor(() => {
			expect(useSession.getState().user?.display_name).toBe("Ayşe Nur Kaya");
		});
	});

	it("needs a first name", async () => {
		await openEdit();
		await fireEvent.changeText(screen.getByTestId("editProfile.firstName.input"), "  ");
		expect(screen.getByText(tr.editProfile.firstNameRequired)).toBeTruthy();
		expect(screen.getByTestId("editProfile.save.button")).toBeDisabled();
	});

	it("shows a taken username from the server", async () => {
		const api = createTestProfileApi();
		jest.spyOn(api, "updateProfile").mockRejectedValue(new ApiError("username_taken"));
		provideTestProfileApi(api);
		await openEdit();
		await fireEvent.press(screen.getByTestId("editProfile.save.button"));
		await waitFor(() => {
			expect(screen.getByText(tr.error.usernameTaken)).toBeTruthy();
		});
	});

	it("takes a photo, uploads it and can remove it", async () => {
		const api = createTestProfileApi();
		const upload = jest.spyOn(api, "uploadAvatar");
		const remove = jest.spyOn(api, "removeAvatar");
		provideTestProfileApi(api);
		pickAvatarMock.mockResolvedValue({ uri: "file:///avatar.jpg" });
		await openEdit();
		expect(screen.queryByTestId("editProfile.removePhoto.button")).toBeNull();
		await fireEvent.press(screen.getByTestId("editProfile.takePhoto.button"));
		await waitFor(() => {
			expect(upload).toHaveBeenCalledWith("file:///avatar.jpg");
		});
		expect(pickAvatarMock).toHaveBeenCalledWith("camera");
		// The photo is decorative (hidden from screen readers); the name is written next to it.
		await waitFor(() => {
			expect(
				screen.getByTestId("editProfile.photo.image", { includeHiddenElements: true }),
			).toBeTruthy();
		});
		await fireEvent.press(screen.getByTestId("editProfile.removePhoto.button"));
		await waitFor(() => {
			expect(remove).toHaveBeenCalledTimes(1);
		});
		await waitFor(() => {
			expect(
				screen.queryByTestId("editProfile.photo.image", { includeHiddenElements: true }),
			).toBeNull();
		});
	});

	it("explains a refused camera permission", async () => {
		pickAvatarMock.mockResolvedValue({ denied: true });
		await openEdit();
		await fireEvent.press(screen.getByTestId("editProfile.takePhoto.button"));
		await waitFor(() => {
			expect(screen.getByText(tr.editProfile.cameraDenied)).toBeTruthy();
		});
	});

	it("picks from the gallery", async () => {
		await openEdit();
		await fireEvent.press(screen.getByTestId("editProfile.fromGallery.button"));
		await waitFor(() => {
			expect(pickAvatarMock).toHaveBeenCalledWith("library");
		});
	});
});
