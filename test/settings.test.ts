import { expect, test } from "bun:test";
import { normalizeSettings } from "../src/lib/settings";
import type { Settings } from "../src/lib/types";

test("normalizeSettings falls back to inline for a fresh install", () => {
	expect(normalizeSettings(undefined).displayMode).toBe("inline");
});

test("normalizeSettings migrates legacy 'hover' to 'replace'", () => {
	const legacy = { displayMode: "hover" } as unknown as Partial<Settings>;
	expect(normalizeSettings(legacy).displayMode).toBe("replace");
});

test("normalizeSettings keeps valid modes", () => {
	expect(normalizeSettings({ displayMode: "replace" }).displayMode).toBe(
		"replace",
	);
	expect(normalizeSettings({ displayMode: "inline" }).displayMode).toBe(
		"inline",
	);
});
