import { notFound } from "next/navigation";

// This site only serves invite links (/i/<token>); there is nothing to see at the root.
export default function Home() {
	notFound();
}
