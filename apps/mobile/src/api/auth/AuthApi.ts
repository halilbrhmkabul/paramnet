// has_pin false: an account from before ADR-046; it sets a PIN after the next SMS sign-in.
export type AuthUser = {
	id: string;
	phone_e164: string;
	display_name: string | null;
	has_pin: boolean;
};

// Requests already waiting for the number when the profile is created (F2-10, spec 5.1 step 6).
export type ProfileResult = AuthUser & { pending_requests: number };

// Faz 1 uses the mock; F1-16 swaps in Supabase phone OTP behind the same interface.
export interface AuthApi {
	requestOtp(phone: string): Promise<{ resend_after_s: number }>;
	verifyOtp(phone: string, code: string): Promise<AuthUser>;
	// ADR-046 / ADR-049: phone + 6-digit PIN through the pin-login edge function (server-side lock).
	signInWithPin(phone: string, pin: string): Promise<AuthUser>;
	// Sets or replaces the signed-in account's PIN (pin-set edge function).
	setPin(pin: string): Promise<void>;
	updateProfile(displayName: string): Promise<ProfileResult>;
	signOut(): Promise<void>;
	// F3-03: erases the account on the server (delete-account edge function) and ends the session.
	deleteAccount(): Promise<void>;
	// Session kept on the device from an earlier launch, or null.
	restore(): Promise<AuthUser | null>;
	registerPushToken(token: string, platform: "ios" | "android"): Promise<void>;
	unregisterPushToken(token: string): Promise<void>;
}
