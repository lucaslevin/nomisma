import { convert, findPrices, formatAmount } from "./lib/detect";
import { hostExcluded, normalizeSettings } from "./lib/settings";
import type {
	GetRatesMessage,
	PriceMatch,
	RatesResponse,
	RateTable,
	Settings,
} from "./lib/types";

const SKIP_SELECTOR =
	"script,style,noscript,template,head,title,textarea,input,code,pre,kbd,samp,svg,math,.cc-wrap";

let settings: Settings | null = null;
let rates: RateTable | null = null;
let ratesTarget: string | null = null;
let active = false;
let observer: MutationObserver | null = null;
const pending = new Set<Node>();
let timer: ReturnType<typeof setTimeout> | null = null;

function applyModeClass(s: Settings): void {
	const cls = document.documentElement.classList;
	cls.remove("cc-mode-inline", "cc-mode-replace");
	cls.add(`cc-mode-${s.displayMode || "inline"}`);
}

function fetchRates(target: string): Promise<RatesResponse | null> {
	return new Promise((resolve) => {
		const msg: GetRatesMessage = { type: "nomisma:getRates", target };
		try {
			chrome.runtime.sendMessage(msg, (res: RatesResponse | undefined) => {
				if (chrome.runtime.lastError || !res) return resolve(null);
				resolve(res.ok ? res : null);
			});
		} catch {
			resolve(null);
		}
	});
}

function nodeAcceptable(node: Text): boolean {
	const parent = node.parentElement;
	if (!parent || parent.isContentEditable) return false;
	if (parent.closest(SKIP_SELECTOR)) return false;
	return /\d/.test(node.nodeValue ?? "");
}

/** Formatted target-currency value, or null when there is nothing to show. */
function converted(code: string, amount: number): string | null {
	if (!settings || !active || !rates || code === settings.targetCurrency) {
		return null;
	}
	const value = convert(amount, code, rates);
	return value === null
		? null
		: formatAmount(
				value,
				settings.targetCurrency,
				settings.locale,
				settings.abbreviateLarge,
			);
}

function makeWrap(match: PriceMatch): HTMLSpanElement {
	const wrap = document.createElement("span");
	wrap.className = "cc-wrap";
	wrap.dataset.ccCode = match.code;
	wrap.dataset.ccAmount = String(match.amount);
	wrap.dataset.ccRaw = match.text;

	const orig = document.createElement("span");
	orig.className = "cc-orig";
	orig.textContent = match.text;

	const conv = document.createElement("span");
	conv.className = "cc-conv";

	wrap.appendChild(orig);
	wrap.appendChild(conv);
	updateConv(wrap);
	return wrap;
}

function updateConv(wrap: HTMLElement): void {
	const conv = wrap.querySelector<HTMLElement>(".cc-conv");
	if (!conv) return;
	const code = wrap.dataset.ccCode ?? "";
	const amount = Number(wrap.dataset.ccAmount);
	wrap.classList.remove("cc-ok", "cc-same", "cc-norate");

	if (!settings || !active || !rates) {
		conv.textContent = "";
		return;
	}
	if (code === settings.targetCurrency) {
		wrap.classList.add("cc-same");
		conv.textContent = "";
		return;
	}
	const value = converted(code, amount);
	if (value === null) {
		wrap.classList.add("cc-norate");
		conv.textContent = "";
		return;
	}
	wrap.classList.add("cc-ok");
	conv.textContent = value;
}

/** Convert every price in a plain-text label (used for <option> text). */
function renderPriceText(text: string): string {
	if (!settings) return text;
	const prices = findPrices(text, {
		overrides: settings.symbolOverrides,
		host: location.hostname,
	});
	if (!prices.length) return text;

	let out = "";
	let cursor = 0;
	for (const p of prices) {
		out += text.slice(cursor, p.index);
		const value = converted(p.code, p.amount);
		if (value === null) out += p.text;
		else
			out +=
				settings.displayMode === "replace" ? value : `${p.text} ≈ ${value}`;
		cursor = p.index + p.length;
	}
	return out + text.slice(cursor);
}

/**
 * Native <option> elements render only text, so we rewrite the label instead
 * of injecting spans. The original is kept in a data attribute for restore.
 */
function processOption(option: HTMLOptionElement): void {
	if (!settings || !active || !rates) return;
	const original = option.dataset.ccOrig ?? option.textContent ?? "";
	if (option.dataset.ccOrig === undefined) option.dataset.ccOrig = original;
	option.dataset.ccOpt = "1";
	const next = renderPriceText(original);
	if (option.textContent !== next) option.textContent = next;
}

function renderAll(): void {
	document.querySelectorAll<HTMLElement>(".cc-wrap").forEach(updateConv);
	document
		.querySelectorAll<HTMLOptionElement>("option[data-cc-opt]")
		.forEach(processOption);
}

function scanTextNode(node: Text): boolean {
	if (!settings) return false;
	const option = node.parentElement?.closest("option");
	if (option) {
		processOption(option as HTMLOptionElement);
		return false;
	}
	const text = node.nodeValue ?? "";
	const prices = findPrices(text, {
		overrides: settings.symbolOverrides,
		host: location.hostname,
	});
	if (!prices.length) return false;

	const frag = document.createDocumentFragment();
	let cursor = 0;
	let changed = false;

	for (const p of prices) {
		if (p.index > cursor)
			frag.appendChild(document.createTextNode(text.slice(cursor, p.index)));
		if (p.code === settings.targetCurrency) {
			frag.appendChild(document.createTextNode(text.substr(p.index, p.length)));
		} else {
			frag.appendChild(makeWrap(p));
			changed = true;
		}
		cursor = p.index + p.length;
	}
	if (cursor < text.length)
		frag.appendChild(document.createTextNode(text.slice(cursor)));
	if (!changed) return false;

	node.parentNode?.replaceChild(frag, node);
	return true;
}

function scanRoot(root: Node): void {
	if (root.nodeType === Node.TEXT_NODE) {
		if (nodeAcceptable(root as Text)) scanTextNode(root as Text);
		return;
	}
	if (
		root.nodeType !== Node.ELEMENT_NODE &&
		root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
	)
		return;

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (n) =>
			nodeAcceptable(n as Text)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT,
	});
	const nodes: Text[] = [];
	for (let n = walker.nextNode(); n; n = walker.nextNode())
		nodes.push(n as Text);
	for (const node of nodes) {
		if (node.isConnected) scanTextNode(node);
	}
}

function flush(): void {
	timer = null;
	const roots = Array.from(pending);
	pending.clear();
	if (!roots.length) return;
	if (observer) observer.disconnect();
	try {
		for (const r of roots) scanRoot(r);
	} finally {
		if (observer) observe();
	}
}

function enqueue(node: Node): void {
	pending.add(node);
	if (!timer) timer = setTimeout(flush, 250);
}

function observe(): void {
	observer ??= new MutationObserver((mutations) => {
		for (const m of mutations) {
			if (m.type === "childList") {
				m.addedNodes.forEach((n) => {
					if (n.nodeType === Node.ELEMENT_NODE) {
						if (!(n as Element).classList.contains("cc-wrap")) enqueue(n);
					} else if (n.nodeType === Node.TEXT_NODE) {
						const p = (n as Text).parentElement;
						if (p && !p.closest(".cc-wrap")) enqueue(n);
					}
				});
			} else if (m.type === "characterData") {
				const p = m.target.parentElement;
				if (p && !p.closest(".cc-wrap")) enqueue(p);
			}
		}
	});
	observer.observe(document.body || document.documentElement, {
		childList: true,
		subtree: true,
		characterData: true,
	});
}

function unwrapAll(): void {
	document.querySelectorAll<HTMLElement>(".cc-wrap").forEach((wrap) => {
		const orig = wrap.querySelector(".cc-orig");
		const text = orig?.textContent ?? wrap.dataset.ccRaw ?? "";
		wrap.replaceWith(document.createTextNode(text));
	});
	document
		.querySelectorAll<HTMLOptionElement>("option[data-cc-opt]")
		.forEach((option) => {
			if (option.dataset.ccOrig !== undefined) {
				option.textContent = option.dataset.ccOrig;
			}
			delete option.dataset.ccOpt;
			delete option.dataset.ccOrig;
		});
}

/** Fetch rates for the target currency unless we already hold them. */
async function loadRates(): Promise<boolean> {
	if (!settings) return false;
	const target = settings.targetCurrency;
	if (rates && ratesTarget === target) return true;
	const res = await fetchRates(target);
	rates = res?.rates ?? null;
	ratesTarget = target;
	return rates !== null;
}

/** Share the current rates with the main-world chart script. */
function broadcastRates(): void {
	if (!settings) return;
	window.postMessage(
		{
			__nomisma: "rates",
			enabled: active && rates !== null,
			target: settings.targetCurrency,
			locale: settings.locale,
			abbreviate: settings.abbreviateLarge,
			rates: rates ?? {},
		},
		"*",
	);
}

window.addEventListener("message", (event: MessageEvent) => {
	if (event.source !== window) return;
	const data = event.data as { __nomisma?: string } | null;
	if (data?.__nomisma === "ready") broadcastRates();
});

async function start(): Promise<void> {
	if (!settings) return;
	applyModeClass(settings);
	if (!(await loadRates())) {
		active = false; // offline / rate unavailable: leave the page untouched
		broadcastRates();
		return;
	}
	active = true;
	scanRoot(document.body || document.documentElement);
	observe();
	broadcastRates();
}

function stop(): void {
	active = false;
	rates = null;
	ratesTarget = null;
	if (observer) {
		observer.disconnect();
		observer = null;
	}
	if (timer) {
		clearTimeout(timer);
		timer = null;
	}
	pending.clear();
	unwrapAll();
	broadcastRates();
}

async function refresh(): Promise<void> {
	stop();
	if (settings?.enabled && !hostExcluded(settings, location.hostname)) {
		await start();
	}
}

async function applySettingsChange(
	changes: Record<string, chrome.storage.StorageChange>,
): Promise<void> {
	if (!settings) return;
	for (const [key, change] of Object.entries(changes)) {
		(settings as unknown as Record<string, unknown>)[key] = change.newValue;
	}
	settings = normalizeSettings(settings);
	const keys = Object.keys(changes);

	// These reshape what is scanned (or whether we run at all): full restart.
	if (
		keys.includes("enabled") ||
		keys.includes("excludedHosts") ||
		keys.includes("symbolOverrides") ||
		keys.includes("targetCurrency")
	) {
		await refresh();
		return;
	}

	if (changes.displayMode) applyModeClass(settings);
	if (!active) {
		await refresh();
		return;
	}

	// Display-only change (mode/abbreviation/locale): re-render in place.
	renderAll();
	broadcastRates();
}

let settingsQueue: Promise<void> = Promise.resolve();
function queueSettingsChange(
	changes: Record<string, chrome.storage.StorageChange>,
): void {
	settingsQueue = settingsQueue.then(
		() => applySettingsChange(changes),
		() => applySettingsChange(changes),
	);
}

chrome.storage.sync.get(null, (raw) => {
	settings = normalizeSettings(raw as Partial<Settings>);
	void refresh();
});

chrome.storage.onChanged.addListener((changes, area) => {
	if (area !== "sync" || !settings) return;
	queueSettingsChange(changes as Record<string, chrome.storage.StorageChange>);
});
