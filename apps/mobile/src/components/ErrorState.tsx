import { EmptyState } from "./EmptyState";
import { tr } from "@/i18n/tr";

export type ErrorStateProps = {
	message?: string;
	onRetry: () => void;
	testID: string;
};

export function ErrorState({ message = tr.error.generic, onRetry, testID }: ErrorStateProps) {
	return (
		<EmptyState
			title={message}
			actionLabel={tr.common.retry}
			onAction={onRetry}
			actionTestID={`${testID}.retry.button`}
			testID={testID}
		/>
	);
}
