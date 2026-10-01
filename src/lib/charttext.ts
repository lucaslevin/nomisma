import { convert, findPrices, formatAmount } from "./detect";
import type { RateTable } from "./types";

/** Data the isolated content script shares with the main-world chart script. */
export interface ChartPayload {
	enabled: boolean;
	target: string;
	locale: string;
	abbreviate: boolean;
	rates: RateTable;
}

/** Converted value for the first price in a chart label, or null. */
function converted(
	label: string,
	payload: ChartPayload,
	host: string,
): string | null {
	if (!payload.enabled || !label) return null;
	const match = findPrices(label, { host })[0];
	if (!match || match.code === payload.target) return null;
	const value = convert(match.amount, match.code, payload.rates);
	if (value === null) return null;
	return formatAmount(
		value,
		payload.target,
		payload.locale,
		payload.abbreviate,
	);
}

/** Axis tick label: replace the amount with the converted one. */
export function axisLabel(
	label: string,
	payload: ChartPayload,
	host: string,
): string {
	return converted(label, payload, host) ?? label;
}

/** Tooltip label: keep the original and append the converted amount. */
export function tooltipLabel(
	label: string,
	payload: ChartPayload,
	host: string,
): string {
	const value = converted(label, payload, host);
	return value ? `${label} ≈ ${value}` : label;
}
