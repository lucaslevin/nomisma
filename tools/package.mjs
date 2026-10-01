#!/usr/bin/env node
/**
 * Package the built extension (dist/) into releases/nomisma-<version>.zip,
 * ready to upload to the Chrome Web Store. Assumes `bun run build` has run.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(
	path.dirname(new URL(import.meta.url).pathname),
	"..",
);
const dist = path.join(root, "dist");
const outDir = path.join(root, "releases");

if (!existsSync(path.join(dist, "manifest.json"))) {
	console.error("dist/manifest.json not found. Run `bun run build` first.");
	process.exit(1);
}

const { version } = JSON.parse(
	readFileSync(path.join(root, "package.json"), "utf8"),
);
const out = path.join(outDir, `nomisma-${version}.zip`);

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// -r recursive, -X strips extra file attributes for a clean archive.
execFileSync("zip", ["-r", "-X", out, "."], { cwd: dist, stdio: "inherit" });
console.log(`[nomisma] packaged → ${path.relative(root, out)}`);
