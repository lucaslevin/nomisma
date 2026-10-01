import { defaultSettings } from "./currencies";
import type { Settings } from "./types";

/** Merge stored (possibly stale/partial) values over defaults. */
export function normalizeSettings(
	raw: Partial<Settings> | undefined,
): Settings {
	const s: Settings = { ...defaultSettings, ...(raw ?? {}) };
	s.excludedHosts = Array.isArray(s.excludedHosts) ? s.excludedHosts : [];
	s.symbolOverrides = s.symbolOverrides ?? {};
	// "hover" was merged into "replace"; anything unknown falls back.
	const stored = (raw as { displayMode?: unknown } | undefined)?.displayMode;
	s.displayMode =
		stored === "hover" || stored === "replace"
			? "replace"
			: stored === "inline"
				? "inline"
				: defaultSettings.displayMode;
	return s;
}

export function hostExcluded(settings: Settings, hostname: string): boolean {
	return settings.excludedHosts.includes(hostname);
}
