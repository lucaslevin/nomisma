import { expect, test } from "bun:test";
import {
	axisLabel,
	type ChartPayload,
	tooltipLabel,
} from "../src/lib/charttext";

const payload: ChartPayload = {
	enabled: true,
	target: "USD",
	locale: "en-US",
	abbreviate: false,
	rates: { eur: 0.85, usd: 1, jpy: 0.006 },
};

test("axisLabel replaces the amount with the converted one", () => {
	// 20 / 0.85 = 23.53
	expect(axisLabel("20.00 €", payload, "cardmarket.com")).toMatch(/23\.53/);
});

test("axisLabel leaves non-prices and target-currency labels alone", () => {
	expect(axisLabel("Sep 30", payload, "x.com")).toBe("Sep 30");
	expect(axisLabel("20.00 $", payload, "x.com")).toBe("20.00 $");
});

test("tooltipLabel appends the converted amount", () => {
	expect(tooltipLabel("22.85 €", payload, "x.com")).toMatch(/22\.85 € ≈/);
});

test("disabled payload leaves labels unchanged", () => {
	expect(axisLabel("20.00 €", { ...payload, enabled: false }, "x.com")).toBe(
		"20.00 €",
	);
});

test("unknown source currency is left unchanged", () => {
	expect(axisLabel("20.00 CHF", payload, "x.com")).toBe("20.00 CHF");
});
