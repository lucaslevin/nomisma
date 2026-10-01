#!/usr/bin/env node
/**
 * Generate the Chrome Web Store images: five 1280x800 screenshots, the
 * 440x280 small promo tile, and the 1400x560 marquee tile.
 *
 *   bun run screenshots
 *
 * The mockups (scripts/mockups.mjs) are rendered in a throwaway headless
 * Brave instance that has NO extension loaded, so the live content script
 * cannot double-convert the mockup's own annotations. Outputs are written to
 * screenshots/, at exact size, as 24-bit PNGs with no alpha channel.
 */
import { execFileSync, spawn } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mockups } from "./mockups.mjs";

const ROOT = path.resolve(
	path.dirname(new URL(import.meta.url).pathname),
	"..",
);
const OUT = path.join(ROOT, "screenshots");

const BROWSERS = [
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
	"/Applications/Chromium.app/Contents/MacOS/Chromium",
	"/usr/bin/google-chrome",
	"/usr/bin/chromium",
];

function findBrowser() {
	for (const p of BROWSERS) {
		try {
			readFileSync(p);
			return p;
		} catch {}
	}
	// fall back to PATH lookup
	for (const bin of ["google-chrome", "chromium", "chrome", "brave-browser"]) {
		try {
			const which = execFileSync("which", [bin], { encoding: "utf8" }).trim();
			if (which) return which;
		} catch {}
	}
	throw new Error(
		"No Chrome/Chromium/Brave browser found. Install one to render assets.",
	);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect(wsUrl) {
	return new Promise((res, rej) => {
		const ws = new WebSocket(wsUrl);
		let id = 0;
		const pending = new Map();
		ws.onopen = () =>
			res({
				send(method, params = {}) {
					const i = ++id;
					ws.send(JSON.stringify({ id: i, method, params }));
					return new Promise((r, j) => pending.set(i, { r, j }));
				},
				close: () => ws.close(),
			});
		ws.onerror = rej;
		ws.onmessage = (e) => {
			const msg = JSON.parse(e.data);
			if (msg.id && pending.has(msg.id)) {
				const { r, j } = pending.get(msg.id);
				pending.delete(msg.id);
				msg.error ? j(new Error(JSON.stringify(msg.error))) : r(msg.result);
			}
		};
	});
}

async function newPage(port, url) {
	const r = await fetch(
		`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,
		{ method: "PUT" },
	);
	return r.json();
}

/** Chromium needs RGB (color type 2) PNGs; the canvas path yields RGBA. */
function assertRgbPng(file, width, height) {
	const buf = readFileSync(file);
	if (buf.readUInt32BE(16) !== width || buf.readUInt32BE(20) !== height) {
		throw new Error(`${path.basename(file)}: wrong size`);
	}
	const colorType = buf[25];
	if (colorType !== 2) {
		throw new Error(
			`${path.basename(file)}: color type ${colorType}, expected 2 (RGB)`,
		);
	}
	return { width, height, bytes: buf.length };
}

const browser = findBrowser();
const port = 9527;
const profile = mkdtempSync(path.join(tmpdir(), "nomisma-shots-"));
const child = spawn(
	browser,
	[
		`--user-data-dir=${profile}`,
		`--remote-debugging-port=${port}`,
		"--headless=new",
		"--no-first-run",
		"--no-default-browser-check",
		"--hide-scrollbars",
		"--force-device-scale-factor=1",
		"about:blank",
	],
	{ stdio: "ignore" },
);

mkdirSync(OUT, { recursive: true });
const written = [];

try {
	const deadline = Date.now() + 15000;
	let ready = false;
	while (Date.now() < deadline) {
		try {
			const r = await fetch(`http://127.0.0.1:${port}/json/version`);
			if (r.ok) {
				ready = true;
				break;
			}
		} catch {}
		await sleep(250);
	}
	if (!ready) throw new Error("Browser did not expose a debug port.");

	for (const name of Object.keys(mockups)) {
		const { width, height, html } = mockups[name];
		const htmlPath = path.join(profile, `${name}.html`);
		writeFileSync(htmlPath, html);

		const page = await newPage(port, `file://${htmlPath}`);
		const cdp = await connect(page.webSocketDebuggerUrl);
		await cdp.send("Page.enable");
		await cdp.send("Runtime.enable");

		// Render at 2x where the GPU can manage it; large blurred tiles stall
		// at 2x, so fall back to 1x for those.
		const scale = width * height > 1_000_000 ? 1 : 2;
		await cdp.send("Emulation.setDeviceMetricsOverride", {
			width,
			height,
			deviceScaleFactor: scale,
			mobile: false,
		});
		await sleep(2500);

		const shot = await cdp.send("Page.captureScreenshot", {
			format: "png",
			clip: { x: 0, y: 0, width, height, scale },
		});
		const raw = path.join(profile, `_raw_${name}.png`);
		writeFileSync(raw, Buffer.from(shot.data, "base64"));

		const file = path.join(OUT, `${name}.png`);
		if (scale === 1) {
			writeFileSync(file, readFileSync(raw));
		} else {
			execFileSync(
				"sips",
				["-z", String(height), String(width), raw, "--out", file],
				{
					stdio: "ignore",
				},
			);
		}
		const info = assertRgbPng(file, width, height);
		written.push({ name, ...info });
		cdp.close();
		await fetch(`http://127.0.0.1:${port}/json/close/${page.id}`);
		console.log(
			`[nomisma] ${name.padEnd(8)} ${info.width}x${info.height}  ${(info.bytes / 1024).toFixed(0)} KB`,
		);
	}
} finally {
	child.kill("SIGKILL");
	rmSync(profile, { recursive: true, force: true });
}

console.log(`\n[nomisma] wrote ${written.length} images → screenshots/`);
