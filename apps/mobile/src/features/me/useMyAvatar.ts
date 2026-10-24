import { useAvatarUrl } from "@/api/hooks";
import type { MyProfile } from "@/api/types";

// The photo's short-lived URL, or null while it loads or when there is none (initials show instead).
export function useMyAvatar(profile: MyProfile | undefined): string | null {
	const url = useAvatarUrl(profile?.avatar_path ?? null);
	return profile?.avatar_path == null ? null : (url.data ?? null);
}
