import { currencies, defaultSettings } from "./lib/currencies";
import { currencyForLocale } from "./lib/locale";
import { normalizeSettings } from "./lib/settings";
import type {
	DisplayMode,
	GetRatesMessage,
	RatesResponse,
	Settings,
} from "./lib/types";

function el<T extends HTMLElement>(id: string): T {
	const node = document.getElementById(id);
	if (!node) throw new Error(`missing #${id}`);
	return node as T;
}

const enabledEl = el<HTMLInputElement>("enabled");
const targetEl = el<HTMLSelectElement>("targetCurrency");
const modeEl = el<HTMLSelectElement>("displayMode");
const abbreviateEl = el<HTMLInputElement>("abbreviateLarge");
const siteField = el<HTMLElement>("siteField");
const siteEl = el<HTMLInputElement>("siteEnabled");
const hostEl = el<HTMLElement>("siteHost");
const rateEl = el<HTMLElement>("rateInfo");
const versionEl = el<HTMLElement>("version");
versionEl.textContent = `v${chrome.runtime.getManifest().version}`;

let settings: Settings = { ...defaultSettings };
let host = "";

function fillCurrencies(selected: string): void {
	const list = currencies.slice().sort((a, b) => a.code.localeCompare(b.code));
	targetEl.replaceChildren();
	for (const c of list) {
		const opt = document.createElement("option");
		opt.value = c.code;
		opt.textContent = `${c.code} · ${c.name}`;
		targetEl.appendChild(opt);
	}
	targetEl.value = list.some((c) => c.code === selected)
		? selected
		: defaultSettings.targetCurrency;
}

function save(patch: Partial<Settings>): void {
	settings = { ...settings, ...patch };
	void chrome.storage.sync.set(patch);
}

function updatedLabel(res: RatesResponse): string {
	if (!res.fetchedAt) return res.date ?? "";
	const d = new Date(res.fetchedAt);
	const locale = navigator.language;
	const sameDay = d.toDateString() === new Date().toDateString();
	return sameDay
		? d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
		: d.toLocaleString(locale, {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});
}

function loadRate(): void {
	const target = targetEl.value;
	rateEl.textContent = "Loading rates…";
	rateEl.title = "";
	const msg: GetRatesMessage = { type: "nomisma:getRates", target };
	chrome.runtime.sendMessage(msg, (res: RatesResponse | undefined) => {
		if (!res?.ok || !res.rates) {
			rateEl.textContent = "Rates unavailable";
			return;
		}
		const when = updatedLabel(res);
		rateEl.textContent = when ? `Exchange rates · ${when}` : "Exchange rates";

		const eur = res.rates.eur;
		if (eur) {
			// A single cross-rate is only a reference, so keep it in the tooltip.
			const value = new Intl.NumberFormat(navigator.language, {
				style: "currency",
				currency: target,
				currencyDisplay: "narrowSymbol",
			}).format(1 / eur);
			rateEl.title = `1 EUR ≈ ${value}`;
		}
	});
}

function applyEnabled(enabled: boolean): void {
	enabledEl.checked = enabled;
	document.body.classList.toggle("off", !enabled);
	const main = document.querySelector<HTMLElement>(".body");
	if (main) main.inert = !enabled;
}

function refreshSite(): void {
	siteField.hidden = !host;
	if (!host) return;
	hostEl.textContent = host;
	siteEl.checked = !settings.excludedHosts.includes(host);
}

chrome.storage.sync.get(null, (raw) => {
	const stored = (raw as Partial<Settings> | null) ?? {};
	settings = normalizeSettings(stored);
	// First run: infer the currency from the browser's locale/region.
	if (!Object.hasOwn(stored, "targetCurrency")) {
		settings.targetCurrency = currencyForLocale(navigator.language);
		void chrome.storage.sync.set({ targetCurrency: settings.targetCurrency });
	}

	fillCurrencies(settings.targetCurrency);
	applyEnabled(settings.enabled !== false);
	modeEl.value = settings.displayMode || "inline";
	abbreviateEl.checked = settings.abbreviateLarge === true;
	loadRate();

	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		try {
			const url = new URL(tabs[0]?.url ?? "");
			host =
				url.protocol === "http:" || url.protocol === "https:"
					? url.hostname
					: "";
		} catch {
			host = "";
		}
		refreshSite();
	});
});

enabledEl.addEventListener("change", () => {
	applyEnabled(enabledEl.checked);
	save({ enabled: enabledEl.checked });
});

targetEl.addEventListener("change", () => {
	save({ targetCurrency: targetEl.value });
	loadRate();
});

modeEl.addEventListener("change", () =>
	save({ displayMode: modeEl.value as DisplayMode }),
);

abbreviateEl.addEventListener("change", () =>
	save({ abbreviateLarge: abbreviateEl.checked }),
);

siteEl.addEventListener("change", () => {
	if (!host) return;
	const set = new Set(settings.excludedHosts);
	if (siteEl.checked) set.delete(host);
	else set.add(host);
	save({ excludedHosts: Array.from(set) });
});
