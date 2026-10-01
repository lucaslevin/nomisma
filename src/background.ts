import { currencyForLocale } from "./lib/locale";
import type { GetRatesMessage, RatesResponse, RateTable } from "./lib/types";

const PRIMARY = (t: string) =>
	`https://latest.currency-api.pages.dev/v1/currencies/${t}.json`;
const MIRROR = (t: string) =>
	`https://cdn.jsdelivr.net/gh/fawazahmed0/exchange-api@latest/v1/currencies/${t}.json`;

const todayISO = (): string => new Date().toISOString().slice(0, 10);

async function fetchJSON<T>(url: string): Promise<T> {
	const res = await fetch(url, { cache: "no-store" });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return (await res.json()) as T;
}

interface RateRecord {
	target: string;
	date: string;
	rates: RateTable;
	fetchedAt: number;
}

interface RawRateDoc {
	date?: string;
	[code: string]: unknown;
}

const inflight = new Map<string, Promise<RatesResponse>>();

/** Shared so that concurrent callers (e.g. every frame) trigger one fetch. */
export function getRates(targetRaw: string): Promise<RatesResponse> {
	const target = String(targetRaw || "").toLowerCase();
	if (!/^[a-z]{3}$/.test(target)) {
		return Promise.resolve({ ok: false, error: "bad_target" });
	}
	let pending = inflight.get(target);
	if (!pending) {
		pending = doGetRates(target).finally(() => inflight.delete(target));
		inflight.set(target, pending);
	}
	return pending;
}

async function doGetRates(target: string): Promise<RatesResponse> {
	const key = `rates:${target}`;
	const store = (await chrome.storage.local.get(key)) as Record<
		string,
		RateRecord | undefined
	>;
	const cached = store[key];
	const today = todayISO();

	if (cached && cached.date === today) {
		return {
			ok: true,
			target: cached.target,
			date: cached.date,
			fetchedAt: cached.fetchedAt,
			rates: cached.rates,
			source: "cache",
		};
	}

	for (const url of [PRIMARY(target), MIRROR(target)]) {
		try {
			const json = await fetchJSON<RawRateDoc>(url);
			const rates = (json[target] ?? json[target.toUpperCase()]) as
				| RateTable
				| undefined;
			if (!rates || typeof rates !== "object") continue;
			const record: RateRecord = {
				target,
				date: json.date ?? today,
				rates,
				fetchedAt: Date.now(),
			};
			await chrome.storage.local.set({ [key]: record });
			return { ok: true, ...record, source: "network" };
		} catch {
			/* try the next source */
		}
	}

	if (cached) {
		return {
			ok: true,
			target: cached.target,
			date: cached.date,
			fetchedAt: cached.fetchedAt,
			rates: cached.rates,
			source: "stale",
		};
	}
	return { ok: false, error: "rates_unavailable" };
}

chrome.runtime.onMessage.addListener(
	(msg: GetRatesMessage, _sender, sendResponse: (r: RatesResponse) => void) => {
		if (msg && msg.type === "nomisma:getRates") {
			getRates(msg.target)
				.then(sendResponse)
				.catch((e: unknown) => sendResponse({ ok: false, error: String(e) }));
			return true; // async response
		}
		return false;
	},
);

chrome.runtime.onInstalled.addListener((details) => {
	if (details.reason === "install") {
		void chrome.storage.sync.set({
			enabled: true,
			targetCurrency: currencyForLocale(chrome.i18n.getUILanguage()),
			displayMode: "inline",
		});
	}
});
