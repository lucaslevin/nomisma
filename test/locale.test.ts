import { expect, test } from "bun:test";
import { currencyForLocale } from "../src/lib/locale";

test("currencyForLocale picks the currency from the region", () => {
	expect(currencyForLocale("en-US")).toBe("USD");
	expect(currencyForLocale("en-GB")).toBe("GBP");
	expect(currencyForLocale("de-DE")).toBe("EUR");
	expect(currencyForLocale("da-DK")).toBe("DKK");
	expect(currencyForLocale("sv-SE")).toBe("SEK");
	expect(currencyForLocale("nb-NO")).toBe("NOK");
	expect(currencyForLocale("ja-JP")).toBe("JPY");
	expect(currencyForLocale("de-AT")).toBe("EUR");
	expect(currencyForLocale("en-CA")).toBe("CAD");
	expect(currencyForLocale("pt-BR")).toBe("BRL");
});

test("currencyForLocale accepts underscores and casing", () => {
	expect(currencyForLocale("en_US")).toBe("USD");
	expect(currencyForLocale("DA-dk")).toBe("DKK");
});

test("currencyForLocale falls back to language, then default", () => {
	expect(currencyForLocale("de")).toBe("EUR");
	expect(currencyForLocale("en")).toBe("USD");
	expect(currencyForLocale("xx-YY")).toBe("USD");
	expect(currencyForLocale("")).toBe("USD");
});
