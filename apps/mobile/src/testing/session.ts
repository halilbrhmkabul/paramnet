import { useSession } from "@/features/auth/sessionStore";

export function signInForTest(): void {
	useSession.setState({
		user: { id: "u-test", phone_e164: "+905550000001", display_name: "Test" },
		pendingPhone: null,
		pendingInviteToken: null,
		openRequestsAfterOnboarding: false,
		onboarded: true,
		restored: true,
	});
}
