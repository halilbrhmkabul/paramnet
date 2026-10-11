import { todayInIstanbul, type IsoDate } from "@paramnet/shared";

// One app-wide clock so screens and the mock adapter agree on "today"; tests pin it in jest.setup.
export const clock = {
	now: (): Date => new Date(),
};

export function useToday(): IsoDate {
	return todayInIstanbul(clock.now());
}
