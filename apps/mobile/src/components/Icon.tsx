import { SvgXml } from "react-native-svg";

import type { ColorToken } from "@/theme/tokens";
import { useAppTheme } from "@/theme/useAppTheme";

// The design's own line icons (24×24, round caps), copied path for path so screens match it exactly.
const PATHS = {
	brand: '<path d="M7 20V5h6a4.5 4.5 0 0 1 0 9H7"/><path d="M14 14l4 6"/>',
	back: '<path d="m15 6-6 6 6 6"/>',
	chevronRight: '<path d="m9 6 6 6-6 6"/>',
	chevronDown: '<path d="m6 9 6 6 6-6"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	minus: '<path d="M5 12h14"/>',
	close: '<path d="M6 6l12 12M18 6 6 18"/>',
	more: '<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></g>',
	menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
	home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
	card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
	swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
	calendar:
		'<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
	bell: '<path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
	search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
	arrowUpRight: '<path d="M7 17 17 7M8 7h9v9"/>',
	arrowDownLeft: '<path d="M17 7 7 17M16 17H7V8"/>',
	arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
	request:
		'<path d="M12 3v11M7.5 9.5 12 14l4.5-4.5"/><path d="M4 14v4a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-4"/>',
	lend: '<path d="M12 21V10M7.5 14.5 12 10l4.5 4.5"/><path d="M4 10V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4"/>',
	layers: '<path d="M12 3 3 8l9 5 9-5z"/><path d="m3 13 9 5 9-5"/>',
	user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
	bank: '<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18"/>',
	wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M16 13.5h2"/>',
	check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
	checkDouble: '<path d="m2 12.5 4 4L14 8M10 15.5l1 1L19.5 8"/>',
	checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 10"/>',
	info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
	alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
	exclamation: '<path d="M12 7v6M12 17h.01"/>',
	warning: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
	clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
	shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
	shieldCheck: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
	eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
	eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
	edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
	receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
	transfer: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
	repeat: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4"/>',
	share: '<path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
	copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
	download:
		'<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3"/>',
	undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
	send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
	link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
	lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
	trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
	sliders:
		'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
} as const;

export type IconName = keyof typeof PATHS;

export type IconProps = {
	name: IconName;
	size?: number;
	tone?: ColorToken;
	strokeWidth?: number;
};

// Decorative: the control around it carries the accessibility label.
export function Icon({ name, size = 22, tone = "text", strokeWidth = 1.9 }: IconProps) {
	const { colors } = useAppTheme();
	const color = colors[tone];
	const xml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${String(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
	return (
		<SvgXml
			xml={xml}
			color={color}
			width={size}
			height={size}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		/>
	);
}
