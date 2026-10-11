// FormData values may be files; these forms only ever send text.
export function field(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === "string" ? value : "";
}
