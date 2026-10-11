export type AuthUser = { id: string; phone_e164: string; display_name: string | null };

// Faz 1 uses the mock; F1-16 swaps in Supabase phone OTP behind the same interface.
export interface AuthApi {
	requestOtp(phone: string): Promise<{ resend_after_s: number }>;
	verifyOtp(phone: string, code: string): Promise<AuthUser>;
	updateProfile(displayName: string): Promise<AuthUser>;
	signOut(): Promise<void>;
	// Session kept on the device from an earlier launch, or null.
	restore(): Promise<AuthUser | null>;
	registerPushToken(token: string, platform: "ios" | "android"): Promise<void>;
	unregisterPushToken(token: string): Promise<void>;
}
