import { codes, symbolTldHints, symbolToCode } from "./currencies";
import type { PriceMatch, RateTable } from "./types";

const SP = "[ \\u00A0\\u202F]"; // space-like separators allowed around symbols
const NUM =
	"(?:\\d{1,3}(?:[.,\\u00A0\\u202F'\\u2019]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let matcher: RegExp | null = null;

/** Built once; the currency token set is static. */
function buildMatcher(): RegExp {
	if (matcher) return matcher;
	const syms = Object.keys(symbolToCode)
		.filter((k) => k.length > 0)
		.sort((a, b) => b.length - a.length)
		.map(escapeRe)
		.join("|");
	const SYM = `(?<!\\p{L})(?:${syms})(?!\\p{L})`;
	const CODE = `(?<!\\p{L})(?:${codes.join("|")})(?!\\p{L})`;
	matcher = new RegExp(
		"(?:(?<ps>" +
			SYM +
			")" +
			SP +
			"?(?<pnum>" +
			NUM +
			"))" +
			"|(?:(?<snum>" +
			NUM +
			")" +
			SP +
			"?(?<ss>" +
			SYM +
			"))" +
			"|(?:(?<pc>" +
			CODE +
			")" +
			SP +
			"+(?<cnum>" +
			NUM +
			"))" +
			"|(?:(?<dnum>" +
			NUM +
			")" +
			SP +
			"+(?<sc>" +
			CODE +
			"))",
		"gu",
	);
	return matcher;
}

/**
 * Parse a locale-formatted money amount into a Number.
 * Handles "1,234.56", "1.234,56", "1 234,56", "1'234.56", "12,34", "1234".
 */
export function parseNumber(input: string | null | undefined): number | null {
	if (!input) return null;
	const s = String(input).replace(/[\s\u00A0\u202F'\u2019]/g, "");
	if (!s) return null;

	const hasDot = s.includes(".");
	const hasComma = s.includes(",");
	let decSep: string | null = null;

	if (hasDot && hasComma) {
		decSep = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
	} else if (hasDot || hasComma) {
		const sep = hasDot ? "." : ",";
		const idx = s.lastIndexOf(sep);
		const after = s.length - idx - 1;
		const before = s.slice(0, idx).replace(/[.,]/g, "").length;
		// A single separator followed by exactly 3 digits is almost always a
		// thousands group ("1,234"), unless there is no integer part.
		const looksGrouped = after === 3 && before >= 1 && before <= 3;
		decSep = looksGrouped ? null : sep;
	}

	const last = decSep === null ? -1 : s.lastIndexOf(decSep);
	let out = "";
	for (let i = 0; i < s.length; i++) {
		const ch = s.charAt(i);
		if (ch === "." || ch === ",") {
			if (ch === decSep && i === last) out += ".";
			continue;
		}
		out += ch;
	}
	const n = Number(out);
	return Number.isFinite(n) ? n : null;
}

interface FindPricesOptions {
	symbolMap?: Record<string, string | null>;
	overrides?: Record<string, string>;
	/** Hostname used to disambiguate symbols like `kr` via their TLD. */
	host?: string;
}

function tld(host: string | undefined): string {
	if (!host) return "";
	const parts = host.split(".");
	return (parts[parts.length - 1] ?? "").toLowerCase();
}

function resolveSymbol(
	token: string,
	symbolMap: Record<string, string | null>,
	overrides: Record<string, string>,
	hostTld: string,
): string | null {
	if (Object.hasOwn(overrides, token)) return overrides[token] ?? null;
	const direct = symbolMap[token];
	if (direct) return direct;
	const hints = symbolTldHints[token];
	return hints ? (hints[hostTld] ?? null) : null;
}

/** Find every price in a string of text. */
export function findPrices(
	text: string,
	opts: FindPricesOptions = {},
): PriceMatch[] {
	const symbolMap = opts.symbolMap ?? symbolToCode;
	const overrides = opts.overrides ?? {};
	const hostTld = tld(opts.host);
	const re = buildMatcher();
	re.lastIndex = 0;

	const out: PriceMatch[] = [];
	for (let m = re.exec(text); m !== null; m = re.exec(text)) {
		const g = m.groups ?? {};
		let code: string | null = null;
		let numStr: string | undefined;

		if (g.ps !== undefined) {
			code = resolveSymbol(g.ps, symbolMap, overrides, hostTld);
			numStr = g.pnum;
		} else if (g.ss !== undefined) {
			code = resolveSymbol(g.ss, symbolMap, overrides, hostTld);
			numStr = g.snum;
		} else if (g.pc !== undefined) {
			code = g.pc.toUpperCase();
			numStr = g.cnum;
		} else if (g.sc !== undefined) {
			code = g.sc.toUpperCase();
			numStr = g.dnum;
		}

		if (!code) {
			if (m.index === re.lastIndex) re.lastIndex++;
			continue;
		}
		const amount = parseNumber(numStr);
		if (amount === null) continue;

		out.push({ index: m.index, length: m[0].length, text: m[0], amount, code });
		if (m.index === re.lastIndex) re.lastIndex++; // zero-length safety
	}
	return out;
}

/**
 * Convert an amount from `from` into the base currency of `rates`.
 * `rates` is keyed by lowercase ISO code and means "units per 1 base".
 */
export function convert(
	amount: number,
	from: string,
	rates: RateTable,
): number | null {
	const rate = rates[from.toLowerCase()];
	if (rate === undefined || rate === 0) return null;
	return amount / rate;
}

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(
	key: string,
	locale: string,
	opts: Intl.NumberFormatOptions,
): Intl.NumberFormat | null {
	let f = formatters.get(key);
	if (!f) {
		try {
			f = new Intl.NumberFormat(locale || undefined, opts);
		} catch {
			return null;
		}
		formatters.set(key, f);
	}
	return f;
}

export function formatAmount(
	amount: number | null | undefined,
	code: string,
	locale = "",
	abbreviate = false,
): string {
	if (amount === null || amount === undefined || !Number.isFinite(amount))
		return "";
	const abs = Math.abs(amount);
	const rounded = abs >= 1000 ? amount : Math.round(amount * 100) / 100;
	const compact = abbreviate && abs >= 1000;
	const base = `${locale}|${code}`;
	const formatter =
		getFormatter(`${base}|${compact ? "c" : "f"}`, locale, {
			style: "currency",
			currency: code,
			currencyDisplay: "narrowSymbol",
			...(compact ? { notation: "compact" } : {}),
		}) ??
		getFormatter(`${base}|fallback`, locale, {
			style: "currency",
			currency: code,
		});
	return formatter
		? formatter.format(rounded)
		: `${code} ${rounded.toFixed(2)}`;
}
