import { axisLabel, type ChartPayload, tooltipLabel } from "./lib/charttext";

/**
 * Main-world companion to the content script. Charts (Chart.js and similar)
 * draw their axis labels and tooltips onto a canvas, so there is no DOM text
 * to annotate. Instead we hook the chart's label callbacks and rewrite what
 * they return. Runs in the page context so it can reach `window.Chart`.
 */

const MARK = "__nomismaWrapped";

interface Axis {
	ticks?: { callback?: unknown };
}
type AxisSlot = Axis | Axis[];

interface ChartOptions {
	scales?: Record<string, AxisSlot>;
	tooltips?: { callbacks?: { label?: unknown } };
	plugins?: { tooltip?: { callbacks?: { label?: unknown } } };
}
interface ChartLike {
	options?: ChartOptions;
	update?: () => void;
}
interface ChartCtor {
	instances?: Record<string, ChartLike | undefined>;
	getChart?: (canvas: Element) => ChartLike | undefined;
}

type Callback = ((...args: unknown[]) => unknown) & { [MARK]?: boolean };

let payload: ChartPayload | null = null;

function isWrapped(fn: unknown): fn is Callback {
	return typeof fn === "function" && (fn as Callback)[MARK] === true;
}

/** Wrap an axis tick callback so its label is converted. */
function wrapAxis(orig: unknown): unknown {
	if (isWrapped(orig)) return orig;
	const base = typeof orig === "function" ? (orig as Callback) : null;
	const cb = function (
		this: unknown,
		value: unknown,
		index: unknown,
		values: unknown,
	): string {
		const text = base
			? String(base.call(this, value, index, values))
			: String(value);
		return payload ? axisLabel(text, payload, location.hostname) : text;
	} as Callback;
	cb[MARK] = true;
	return cb;
}

/** Wrap a tooltip label callback so it also shows the converted amount. */
function wrapTip(orig: unknown): unknown {
	if (isWrapped(orig)) return orig;
	const base = typeof orig === "function" ? (orig as Callback) : null;
	const cb = function (this: unknown, ...args: unknown[]): string {
		const text = base ? String(base.apply(this, args)) : "";
		return payload ? tooltipLabel(text, payload, location.hostname) : text;
	} as Callback;
	cb[MARK] = true;
	return cb;
}

function patchChart(chart: ChartLike): boolean {
	const opts = chart.options;
	if (!opts) return false;
	let changed = false;

	if (opts.scales) {
		for (const key of Object.keys(opts.scales)) {
			const slot = opts.scales[key];
			if (!slot) continue;
			const axes = Array.isArray(slot) ? slot : [slot];
			for (const axis of axes) {
				if (axis?.ticks && typeof axis.ticks.callback === "function") {
					axis.ticks.callback = wrapAxis(axis.ticks.callback);
					changed = true;
				}
			}
		}
	}

	// Chart.js v2 tooltips, then v3/v4 plugins.
	const legacy = opts.tooltips?.callbacks;
	if (legacy && typeof legacy.label === "function") {
		legacy.label = wrapTip(legacy.label);
		changed = true;
	}
	const modern = opts.plugins?.tooltip?.callbacks;
	if (modern && typeof modern.label === "function") {
		modern.label = wrapTip(modern.label);
		changed = true;
	}
	return changed;
}

function allCharts(): ChartLike[] {
	const Ctor = (window as unknown as { Chart?: ChartCtor }).Chart;
	if (!Ctor) return [];
	const out: ChartLike[] = [];
	if (Ctor.instances) {
		for (const key of Object.keys(Ctor.instances)) {
			const chart = Ctor.instances[key];
			if (chart) out.push(chart);
		}
	}
	if (typeof Ctor.getChart === "function") {
		const getChart = Ctor.getChart.bind(Ctor);
		document.querySelectorAll("canvas").forEach((canvas) => {
			const chart = getChart(canvas);
			if (chart) out.push(chart);
		});
	}
	return out;
}

function applyAll(): void {
	if (!payload) return;
	for (const chart of allCharts()) {
		if (patchChart(chart) && typeof chart.update === "function") {
			try {
				chart.update();
			} catch {
				/* chart may be mid-render */
			}
		}
	}
}

window.addEventListener("message", (event: MessageEvent) => {
	if (event.source !== window) return;
	const data = event.data as {
		__nomisma?: string;
		enabled?: boolean;
		target?: string;
		locale?: string;
		abbreviate?: boolean;
		rates?: Record<string, number>;
	} | null;
	if (!data) return;
	if (
		data.__nomisma !== "rates" ||
		typeof data.rates !== "object" ||
		data.rates === null
	) {
		return;
	}
	payload = {
		enabled: data.enabled === true,
		target: String(data.target ?? ""),
		locale: String(data.locale ?? ""),
		abbreviate: data.abbreviate === true,
		rates: data.rates,
	};
	observe();
	applyAll();
});

let pending: ReturnType<typeof setTimeout> | null = null;
function schedule(): void {
	if (pending) return;
	pending = setTimeout(() => {
		pending = null;
		applyAll();
	}, 300);
}

let observing = false;
/** Watch for charts that are created after load (only once we have rates). */
function observe(): void {
	if (observing || !document.documentElement) return;
	observing = true;
	new MutationObserver(schedule).observe(document.documentElement, {
		childList: true,
		subtree: true,
	});
}

// Ask the isolated script for the current rates.
window.postMessage({ __nomisma: "ready" }, "*");
