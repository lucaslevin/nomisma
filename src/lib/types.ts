export type DisplayMode = "inline" | "replace";

export interface Settings {
	enabled: boolean;
	targetCurrency: string;
	locale: string;
	displayMode: DisplayMode;
	/** Render amounts >= 1000 in compact form (1.2K, 3.4M). */
	abbreviateLarge: boolean;
	/** Ambiguous symbol -> ISO code overrides, e.g. { "$": "CAD" }. */
	symbolOverrides: Record<string, string>;
	excludedHosts: string[];
}

export interface Currency {
	code: string;
	name: string;
}

/** keyed by lowercase ISO code: units of that currency per 1 base unit. */
export type RateTable = Record<string, number>;

export interface RatesResponse {
	ok: boolean;
	target?: string;
	date?: string;
	/** Epoch ms when these rates were fetched. */
	fetchedAt?: number;
	source?: "cache" | "network" | "stale";
	rates?: RateTable;
	error?: string;
}

export interface PriceMatch {
	index: number;
	length: number;
	text: string;
	amount: number;
	code: string;
}

export interface GetRatesMessage {
	type: "nomisma:getRates";
	target: string;
}
