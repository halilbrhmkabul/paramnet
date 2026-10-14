import { create } from "zustand";

import type { AuthUser } from "@/api/auth/AuthApi";

export type OtpPurpose = "signup" | "reset";

type SessionState = {
	user: AuthUser | null;
	// Phone waiting for OTP between the login and code screens.
	pendingPhone: string | null;
	// Why the code was sent: a new account, or "Şifremi unuttum" (a new PIN follows the code).
	otpPurpose: OtpPurpose;
	// The PIN step is still open: a new account, a PIN reset, or an account from before ADR-046.
	pinRequired: boolean;
	// Invite link opened while signed out; reopened after sign-in. Memory only (never persisted).
	pendingInviteToken: string | null;
	// Plans were already shared with the new account's number: open Talepler once in (spec 5.1 step 6).
	openRequestsAfterOnboarding: boolean;
	setOpenRequestsAfterOnboarding: (value: boolean) => void;
	setPendingInvite: (token: string | null) => void;
	// Profile and notification steps done; only then the tabs open (spec 5.1).
	onboarded: boolean;
	// The stored session has been checked at launch; until then the splash screen stays up.
	restored: boolean;
	finishRestore: (user: AuthUser | null) => void;
	setPendingPhone: (phone: string | null, purpose?: OtpPurpose) => void;
	signIn: (user: AuthUser, options?: { resetPin?: boolean }) => void;
	pinSaved: () => void;
	setUser: (user: AuthUser) => void;
	completeOnboarding: () => void;
	signOut: () => void;
};

const initial = {
	user: null,
	pendingPhone: null,
	otpPurpose: "signup" as OtpPurpose,
	pinRequired: false,
	onboarded: false,
	pendingInviteToken: null,
	openRequestsAfterOnboarding: false,
};

// Persistence lives in the auth adapter (Supabase session in SecureStore, F1-16); the store only mirrors it.
export const useSession = create<SessionState>()((set) => ({
	...initial,
	restored: false,
	finishRestore: (user) => {
		const pinRequired = user !== null && !user.has_pin;
		set({
			user,
			pinRequired,
			onboarded: user?.display_name != null && !pinRequired,
			restored: true,
		});
	},
	setPendingPhone: (pendingPhone, otpPurpose = "signup") => {
		set({ pendingPhone, otpPurpose });
	},
	setOpenRequestsAfterOnboarding: (openRequestsAfterOnboarding) => {
		set({ openRequestsAfterOnboarding });
	},
	setPendingInvite: (pendingInviteToken) => {
		set({ pendingInviteToken });
	},
	signIn: (user, options) => {
		// A returning user with a name and a PIN skips the setup steps.
		const pinRequired = options?.resetPin === true || !user.has_pin;
		set({
			user,
			pendingPhone: null,
			pinRequired,
			onboarded: user.display_name !== null && !pinRequired,
		});
	},
	pinSaved: () => {
		set((state) => ({
			user: state.user === null ? null : { ...state.user, has_pin: true },
			pinRequired: false,
			onboarded: state.user?.display_name != null,
		}));
	},
	setUser: (user) => {
		set({ user });
	},
	completeOnboarding: () => {
		set({ onboarded: true });
	},
	signOut: () => {
		set({ ...initial, restored: true });
	},
}));

export function useIsSignedIn(): boolean {
	return useSession((state) => state.user !== null && state.onboarded);
}

export function resetSession(): void {
	useSession.setState({ ...initial, restored: true });
}
