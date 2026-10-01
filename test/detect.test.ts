import { expect, test } from "bun:test";
import {
	convert,
	findPrices,
	formatAmount,
	parseNumber,
} from "../src/lib/detect";

test("parseNumber handles locale formats", () => {
	expect(parseNumber("1,234.56")).toBe(1234.56);
	expect(parseNumber("1.234,56")).toBe(1234.56);
	expect(parseNumber("1 234,56")).toBe(1234.56);
	expect(parseNumber("1'234.56")).toBe(1234.56);
	expect(parseNumber("12,34")).toBe(12.34);
	expect(parseNumber("1,234")).toBe(1234);
	expect(parseNumber("1234")).toBe(1234);
	expect(parseNumber("0,99")).toBe(0.99);
	expect(parseNumber("")).toBeNull();
});

test("findPrices detects symbols in both positions", () => {
	const eur = findPrices("12,34 €");
	expect(eur.length).toBe(1);
	expect(eur[0]?.code).toBe("EUR");
	expect(eur[0]?.amount).toBe(12.34);

	expect(findPrices("$12.34")[0]?.code).toBe("USD");
	expect(findPrices("£9.99")[0]?.code).toBe("GBP");
});

test("findPrices detects ISO codes on either side", () => {
	expect(findPrices("USD 5")[0]?.code).toBe("USD");
	expect(findPrices("5 GBP")[0]?.code).toBe("GBP");
	expect(findPrices("1.234,56 EUR")[0]?.amount).toBe(1234.56);
});

test("findPrices resolves multi-char dollar symbols", () => {
	expect(findPrices("C$20")[0]?.code).toBe("CAD");
	expect(findPrices("R$20")[0]?.code).toBe("BRL");
	expect(findPrices("HK$20")[0]?.code).toBe("HKD");
});

test("findPrices skips ambiguous symbols without an ISO code", () => {
	expect(findPrices("kr 100")).toEqual([]);
	expect(findPrices("R 100")).toEqual([]);
	expect(findPrices("100 SEK")[0]?.code).toBe("SEK");
});

test("findPrices resolves ambiguous symbols from the site TLD", () => {
	expect(findPrices("449,95 kr", { host: "www.kelz0r.dk" })[0]?.code).toBe(
		"DKK",
	);
	expect(findPrices("449,95 kr", { host: "www.kelz0r.dk" })[0]?.amount).toBe(
		449.95,
	);
	expect(findPrices("100 kr", { host: "shop.se" })[0]?.code).toBe("SEK");
	expect(findPrices("100 kr", { host: "shop.no" })[0]?.code).toBe("NOK");
	expect(findPrices("1.200 kr", { host: "anything.dk" })[0]?.amount).toBe(1200);
	// no hint available -> still skipped
	expect(findPrices("100 kr", { host: "example.com" })).toEqual([]);
});

test("findPrices ignores bare numbers", () => {
	expect(findPrices("there are 42 items")).toEqual([]);
});

test("ISO codes need a separator, so word-like codes are not prices", () => {
	expect(findPrices("TRY3 NEXT")).toEqual([]);
	expect(findPrices("5GBP")).toEqual([]);
	expect(findPrices("USD 5")[0]?.code).toBe("USD");
	expect(findPrices("5 GBP")[0]?.code).toBe("GBP");
	expect(findPrices("12,34 EUR")[0]?.code).toBe("EUR");
});

test("findPrices honours symbol overrides", () => {
	expect(findPrices("¥1,000", { overrides: { "¥": "CNY" } })[0]?.code).toBe(
		"CNY",
	);
});

test("convert divides by the source rate (base = target)", () => {
	const rates = { eur: 0.85, usd: 1 };
	expect(convert(85, "EUR", rates)).toBe(100);
	expect(convert(10, "USD", rates)).toBe(10);
	expect(convert(10, "JPY", rates)).toBeNull();
});

test("formatAmount renders a currency string", () => {
	expect(formatAmount(13.97, "USD", "en-US")).toMatch(/13\.97/);
});

test("formatAmount abbreviates large amounts when enabled", () => {
	expect(formatAmount(1234, "USD", "en-US", true)).toMatch(/1\.2K/);
	expect(formatAmount(1_234_567, "USD", "en-US", true)).toMatch(/1\.2M/);
	expect(formatAmount(999, "USD", "en-US", true)).toMatch(/999/);
	expect(formatAmount(1234, "USD", "en-US", false)).toMatch(/1,234/);
});
