import { create } from "zustand";

import type { AuthUser } from "@/api/auth/AuthApi";

type SessionState = {
	user: AuthUser | null;
	// Phone waiting for OTP between the phone and code screens.
	pendingPhone: string | null;
	// Invite link opened while signed out; reopened after sign-in. Memory only (never persisted).
	pendingInviteToken: string | null;
	setPendingInvite: (token: string | null) => void;
	// Profile and notification steps done; only then the tabs open (spec 5.1).
	onboarded: boolean;
	// The stored session has been checked at launch; until then the splash screen stays up.
	restored: boolean;
	finishRestore: (user: AuthUser | null) => void;
	setPendingPhone: (phone: string | null) => void;
	signIn: (user: AuthUser) => void;
	setUser: (user: AuthUser) => void;
	completeOnboarding: () => void;
	signOut: () => void;
};

const initial = { user: null, pendingPhone: null, onboarded: false, pendingInviteToken: null };

// Persistence lives in the auth adapter (Supabase session in SecureStore, F1-16); the store only mirrors it.
export const useSession = create<SessionState>()((set) => ({
	...initial,
	restored: false,
	finishRestore: (user) => {
		set({ user, onboarded: user?.display_name != null, restored: true });
	},
	setPendingPhone: (pendingPhone) => {
		set({ pendingPhone });
	},
	setPendingInvite: (pendingInviteToken) => {
		set({ pendingInviteToken });
	},
	signIn: (user) => {
		// A returning user with a name skips the profile steps.
		set({ user, pendingPhone: null, onboarded: user.display_name !== null });
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
