# AGENTS.md

Guidance for agents working in this repo. See [README.md](README.md) for the
user-facing overview and [STORE.md](STORE.md) / [PRIVACY.md](PRIVACY.md) for
Chrome Web Store submission material.

## What this is

Nomisma is a Chrome Manifest V3 extension that converts prices on any web page
into the user's chosen currency. TypeScript, bundled with esbuild, run with Bun.
No runtime dependencies; the only network request is a daily exchange-rate fetch.

The extension package is loaded from **`dist/`**, not the repo root. After any
change, run `bun run build` and reload the unpacked extension.

## Commands

```bash
bun install
bun run build        # esbuild bundle + copy static files -> dist/
bun run dev          # rebuild on change
bun run typecheck    # tsc --noEmit (TypeScript 7 beta, tsc = Go binary)
bun test             # bun:test unit tests
bun run check        # biome + typecheck + tests  <- run before finishing
bun run lint         # biome check (lint + format + import order)
bun run format       # biome check --write
bun run zip          # build + releases/nomisma-<version>.zip
bun run icons        # regenerate icons/ (python3, no extra deps)
bun run screenshots  # render store images -> screenshots/
```

Always finish a task by running `bun run check`. It must be clean before you
report done.

## Architecture

Three bundled entry points, plus a pure library:

| Path | Role |
| --- | --- |
| `src/content.ts` | Isolated-world content script: walks text nodes, annotates prices, handles `<option>` labels, MutationObserver, settings reconcile, bridge to the chart script. |
| `src/chart.ts` | MAIN-world content script (`world: "MAIN"`): hooks Chart.js v2/v3/v4 axis + tooltip label callbacks. |
| `src/background.ts` | Service worker: fetches and caches daily rates. |
| `src/popup.ts` + `popup.html` + `popup.css` | Settings UI. |
| `src/lib/*` | Pure, DOM-free, unit-tested modules. This is where logic belongs. |

`src/lib` boundaries:

- `detect.ts` — price regex, `parseNumber`, `convert`, `formatAmount` (cached `Intl.NumberFormat`).
- `currencies.ts` — currency list, `symbolToCode`, `symbolTldHints`, `defaultSettings`.
- `locale.ts` — `currencyForLocale` (browser language -> starting currency).
- `settings.ts` — settings normalization.
- `charttext.ts` — pure chart label conversion (`axisLabel`, `tooltipLabel`).
- `types.ts` — shared types.

Rule: **put logic in `src/lib`, keep the entry points thin.** DOM code is not
unit-tested; pure modules are.

Build layout is declared in `build.mjs` (`ENTRY` + `STATIC`). A new entry or a
new static file must be added there to reach `dist/`. `tools/package.mjs` zips
**everything** in `dist/`, so never place scratch files there.

## Conventions

- Biome, defaults: **tabs**, **double quotes**, organize imports on. `dist/` is
  excluded. Match the existing style; do not reformat unrelated code.
- TypeScript strict, plus `noUncheckedIndexedAccess`, `noUnusedLocals`,
  `noUnusedParameters`, `verbatimModuleSyntax` (use `import type`).
- **No comments unless they earn their place** — explain *why*, not *what*.
- Terminology in UI copy: "prices", "your currency", "any website", "this site".
  **Never use em dashes.**
- Currency scope is deliberate: 159 fiat currencies. Do **not** add crypto,
  metals (`XAU`/`XAG`/`XPD`/`XPT`), or legacy/obsolete codes (removed: `CUC`,
  `HRK`, `SLL`).

## Gotchas

- **Loading:** the unpacked extension loads from `dist/`. Stale `dist/` is the
  usual cause of "my change did nothing".
- **Two content scripts:** `content.js` runs in the isolated world, `chart.js`
  in `MAIN`. They communicate via the page bridge in `content.ts`.
- **Don't touch bare numbers.** A price must carry a currency symbol or ISO
  code; that guard is what prevents false positives.
- **Chart.js is the only canvas chart supported.** Other canvas chart libs are
  out of scope (documented limitation).
- **Screenshots:** `bun run screenshots` renders mockups in a throwaway headless
  browser with **no extension loaded** (the live content script would
  double-convert the mockups' own annotations). Output must be 1280x800 (or the
  promo sizes) as 24-bit PNG with no alpha; `scripts/screenshots.mjs` verifies
  this and fails otherwise. Mockup markup lives in `scripts/mockups.mjs` and
  reuses the real `src/popup.css` (scoped) and `icons/icon128.png`.
- **Version bump:** update `manifest.json` and `package.json` together, then
  `bun run zip`.
- **Chrome Web Store copy must stay consistent** across `STORE.md`,
  `PRIVACY.md`, `manifest.json` description (<=132 chars), and the listing fields.

## Definition of done

1. `bun run check` passes (biome, tsc, tests).
2. New pure logic has tests under `test/`.
3. `bun run build` succeeds and `dist/` reflects the change.
4. Store copy/manifest/version updated together when relevant.
