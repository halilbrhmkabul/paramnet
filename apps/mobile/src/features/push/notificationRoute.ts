// Templates that ask the recipient to decide on a plan; a withdrawn share no longer exists for them.
const DECIDE_TEMPLATES = new Set(["shareReceived", "shareCountered", "amendmentProposed"]);

export function notificationRoute(agreementId: string, template: string | null) {
	if (template === "shareWithdrawn") {
		return { pathname: "/requests" } as const;
	}
	return {
		pathname: DECIDE_TEMPLATES.has(template ?? "")
			? ("/agreement/[id]/decide" as const)
			: ("/agreement/[id]" as const),
		params: { id: agreementId },
	};
}
