# Nomisma

**Always see prices in your currency.** Nomisma scans any website for prices and
shows each one in your chosen currency right next to the original,
`12,34 € ≈ $13.97`, like auto-translate, but for prices.

A light Chrome extension (Manifest V3) written in TypeScript, bundled with
esbuild. Cardmarket is a prime target, but it works everywhere.

## Why

I collect Magic cards and buy a lot on [Cardmarket](https://www.cardmarket.com/),
which prices everything in euros. Every time I compared a card against a US
listing I was doing the same mental arithmetic, over and over, and I could not
find a converter that did it well. The ones I tried either replaced the price so
I lost the original, missed half the page, or ignored the price-history charts
entirely.

So I built the one I wanted. Nomisma keeps the original price and drops the
conversion next to it, works on the whole page including dropdowns and
Chart.js price charts, and does all of it locally with no account and no
tracking. It started as a tool for card shopping, but nothing in it is
card-specific: if a site shows prices, it works.

```
nomisma/
  manifest.json          extension manifest (copied into dist/)
  build.mjs              esbuild bundle + static copy
  biome.json             Biome config (defaults)
  tsconfig.json          TypeScript 7 config
  src/
    lib/
      charttext.ts       chart label conversion (pure, tested)
      currencies.ts      currency list + symbol conventions
      detect.ts          price regex, number parser, convert + format (pure, tested)
      locale.ts          locale/region -> currency inference
      settings.ts        settings normalization
      types.ts           shared types
    content.ts           TreeWalker scan, inline annotations, MutationObserver
    chart.ts             main-world script hooking Chart.js label callbacks
    content.css          annotation styling (inline / replace)
    background.ts        service worker: fetches + caches daily rates
    popup.html/.ts/.css  settings UI
  icons/                 generated PNGs
  tools/make-icons.py
  test/detect.test.ts
```

## Build

Requires [Bun](https://bun.sh) and Node 24+ (for `tsc` via Bun). Python 3 is
only needed to regenerate icons.

```bash
bun install
bun run build        # → dist/
bun run dev          # rebuild on change
bun run lint         # biome check (lint + format + imports)
bun run format       # biome check --write
bun run typecheck    # tsc --noEmit (TypeScript 7)
bun test             # unit tests
bun run check        # biome + typecheck + tests
bun run zip          # build + package releases/nomisma-<version>.zip
bun run icons        # regenerate icons (no deps beyond python3)
```

## Install (unpacked)

1. `bun install && bun run build`
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. **Load unpacked** → select the **`dist/`** folder
5. Pin Nomisma, then pick your currency in the toolbar popup

Chrome will warn that it can read and change data on all sites; that is the
cost of running globally. Use the popup's **This site** toggle to silence it
anywhere.

## How it works

- A content script walks the page's text nodes and finds prices that carry a
  currency marker: a symbol (`€ £ $ ¥ ₩ ₹ …`, `C$ A$ HK$ R$ …`) or an ISO code
  (`USD`, `EUR`, …). **Bare numbers are never touched**; that is the main
  guard against false positives.
- Number formats from any locale are parsed (`1.234,56`, `1,234.56`,
  `1 234,56`, `1'234.56`).
- The original price stays in the DOM; the converted value is a sibling span
  so the page's own scripts keep working. Form fields are never modified.
- `MutationObserver` handles dynamic and single-page sites; work is debounced
  and batched.
- Prices inside native `<select>` dropdowns are handled too: since `<option>`
  renders text only, the label is rewritten in place (the original is restored
  when conversion is off).
- Price charts drawn on a canvas (Chart.js) are handled by a small main-world
  script that hooks the chart's axis and tooltip label callbacks, so the axis
  and hover values are shown converted.
- The service worker fetches rates from
  [currency-api](https://latest.currency-api.pages.dev/) (free, no key, daily),
  cached for the day, with a jsDelivr mirror as fallback. Base currency = your
  target, so converting any `X` is `amount ÷ rate[X]`.

Module boundaries: `src/lib` is pure and DOM-free (unit-tested); `content.ts`,
`background.ts`, and `popup.ts` are the three bundled entry points.

## Display modes

| Mode | Result |
| --- | --- |
| Inline (default) | `12,34 € ≈ $13.97` |
| Replace | `$13.97`; hover the value to reveal `12,34 €` in place |

## Settings

Stored in `chrome.storage.sync`: `enabled`, `targetCurrency`, `displayMode`,
`abbreviateLarge`, `locale`, `symbolOverrides`, `excludedHosts`.

On first run the target currency is inferred from your browser's locale/region
(e.g. `de-DE` → EUR, `en-GB` → GBP, `da-DK` → DKK); no location permission is
requested. Change it any time in the popup.

`abbreviateLarge` renders converted prices of 1000 or more in compact form
(`$1.2K`, `$3.4M`); off by default.

Symbol overrides pin ambiguous markers, e.g. treat every `$` as CAD or every
`¥` as CNY (defaults: `$` → USD, `¥` → JPY). Currencies that are genuinely
ambiguous on their own (`kr`, `R`, `Rs`) are skipped unless an ISO code
accompanies them.

## Known limitations

- Prices shown as images/sprites are not detected.
- Prices drawn to a canvas by charting libraries other than Chart.js are not
  detected.
- Prices split across sibling elements are skipped in v1.
- Copying a converted price copies the annotation too (the DOM is intentionally
  left intact so the site keeps functioning).

## Publishing

`bun run zip` builds `dist/` and packages `releases/nomisma-<version>.zip` for
the Chrome Web Store. The privacy policy is in [PRIVACY.md](PRIVACY.md).

## Privacy

The only network request is the single daily rate fetch. Nothing about the
pages you visit, or you, is collected, stored remotely, or sent anywhere.

## License

[MIT](LICENSE) © Lucas Spiegelhauer Levin
