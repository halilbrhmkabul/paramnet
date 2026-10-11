import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
	title: "Paramnet",
	// spec 11.2: never indexed, also as meta for crawlers that ignore headers.
	robots: { index: false, follow: false },
	referrer: "no-referrer",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="tr">
			<body>
				<main className="page">{children}</main>
			</body>
		</html>
	);
}
