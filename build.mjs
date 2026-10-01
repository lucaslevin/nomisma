import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { build, context } from "esbuild";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const DIST = path.join(ROOT, "dist");
const watch = process.argv.includes("--watch");

const ENTRY = [
	{ in: "src/content.ts", out: "dist/src/content.js" },
	{ in: "src/chart.ts", out: "dist/src/chart.js" },
	{ in: "src/background.ts", out: "dist/src/background.js" },
	{ in: "src/popup.ts", out: "dist/src/popup.js" },
];

/** Files that should exist verbatim in the packaged extension. */
const STATIC = [
	["manifest.json", "dist/manifest.json"],
	["src/content.css", "dist/src/content.css"],
	["src/popup.css", "dist/src/popup.css"],
	["src/popup.html", "dist/src/popup.html"],
];

async function copyStatic() {
	for (const [from, to] of STATIC) {
		await mkdir(path.dirname(path.join(ROOT, to)), { recursive: true });
		await cp(path.join(ROOT, from), path.join(ROOT, to));
	}
	await cp(path.join(ROOT, "icons"), path.join(DIST, "icons"), {
		recursive: true,
	});
}

async function buildExtension() {
	await rm(DIST, { recursive: true, force: true });
	const options = ENTRY.map(({ in: entry, out }) => ({
		entryPoints: [path.join(ROOT, entry)],
		outfile: path.join(ROOT, out),
		bundle: true,
		format: "iife",
		target: "chrome114",
		platform: "browser",
		sourcemap: false,
		logLevel: "info",
	}));

	if (watch) {
		await copyStatic();
		const contexts = await Promise.all(options.map((o) => context(o)));
		await Promise.all(contexts.map((c) => c.watch()));
		console.log(
			"[nomisma] watching extension sources… (static files copied once)",
		);
		return;
	}
	await Promise.all(options.map((o) => build(o)));
	await copyStatic();
	console.log("[nomisma] built → dist/");
}

await buildExtension();
