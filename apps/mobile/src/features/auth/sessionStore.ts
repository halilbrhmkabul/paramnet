import { create } from "zustand";

import type { AuthUser } from "@/api/auth/AuthApi";

type SessionState = {
	user: AuthUser | null;
	// Phone waiting for OTP between the phone and code screens.
	pendingPhone: string | null;
	// Profile and notification steps done; only then the tabs open (spec 5.1).
	onboarded: boolean;
	setPendingPhone: (phone: string | null) => void;
	signIn: (user: AuthUser) => void;
	setUser: (user: AuthUser) => void;
	completeOnboarding: () => void;
	signOut: () => void;
};

const initial = { user: null, pendingPhone: null, onboarded: false };

// In memory only: the prototype starts signed out after a restart; F1-16 persists the Supabase session.
export const useSession = create<SessionState>()((set) => ({
	...initial,
	setPendingPhone: (pendingPhone) => {
		set({ pendingPhone });
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
		set(initial);
	},
}));

export function useIsSignedIn(): boolean {
	return useSession((state) => state.user !== null && state.onboarded);
}

export function resetSession(): void {
	useSession.setState(initial);
}
