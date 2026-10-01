# Chrome Web Store submission

Everything needed to publish Nomisma. Build the upload with:

```bash
bun run zip        # builds dist/ then writes releases/nomisma-<version>.zip
```

Upload `releases/nomisma-1.0.0.zip` at
https://chrome.google.com/webstore/devconsole ($5 one-time developer fee).

## Listing

**Name** (≤ 75)

```
Nomisma: Currency Converter
```

**Summary / short description** (≤ 132)

```
Always see prices in your currency. Nomisma converts prices automatically on any website: shops, marketplaces, everywhere.
```

**Category**: Shopping
**Language**: English

**Detailed description**

```
Always see prices in your currency.

Nomisma scans the page you are on and shows every price in the currency you
choose, right next to the original. It works everywhere prices appear: online
shops, marketplaces, booking sites, and trading-card sites like Cardmarket.

EXAMPLE
  12,34 €  becomes  12,34 € ≈ $13.97

HOW IT WORKS
- Detects prices that carry a currency symbol (€, £, $, ¥, kr, ...) or an ISO
  code (EUR, USD, ...). Plain numbers are never touched, so it stays out of the
  way of everything that is not a price.
- Understands local number formats (1.234,56 and 1,234.56) and 150+ currencies.
- Handles prices inside dropdown menus, price charts, and pages that load
  content as you scroll.
- Two display modes: show both amounts, or replace the price and reveal the
  original when you hover it.
- Optionally abbreviates large amounts (1.2K, 3.4M).
- Picks a sensible starting currency from your browser's language, and you can
  change it any time.

PRIVATE BY DESIGN
- No account, no analytics, no tracking.
- Pages are processed entirely in your browser; their content is never uploaded.
- The only network request is a daily refresh of exchange rates.

Make any marketplace feel like home currency.
```

## Single purpose

```
Nomisma has one purpose: to display the prices on any web page in the user's
chosen currency.
```

## Permission justifications

- **`storage`**: saves the user's preferences (target currency, display mode,
  abbreviation, and per-site exclusions).
- **`<all_urls>` host access**: required because prices can appear on any
  website. Nomisma reads price text on the page and annotates it locally; page
  content is never transmitted.

## Data usage (privacy questionnaire)

- Does the extension collect user data? **No.**
- Sold to third parties? **No.**
- Used for purposes unrelated to the single purpose? **No.**
- Used to determine creditworthiness or for lending? **No.**
- All items can be answered "No"; nothing is collected.

Provide a privacy policy URL if the console asks for one, for example
`https://spiegelhauer.fyi/privacy` (publish `PRIVACY.md` there).

## Screenshots

The console requires at least one 1280x800 (or 640x400) screenshot. Suggested
shots:

1. The popup open over a store page showing converted prices.
2. A product page with `12,34 € ≈ $13.97` style annotations (inline mode).
3. The replace mode with the original revealed on hover.
4. The popup with the currency list open.

## Pre-submission checklist

- [ ] `bun run check` passes (Biome, types, tests).
- [ ] `bun run zip` produces `releases/nomisma-1.0.0.zip`.
- [ ] Manifest: name ≤ 75, description ≤ 132, version bumped.
- [ ] Icons present at 16/32/48/128.
- [ ] Loaded `dist/` in a clean profile, no console errors.
- [ ] Privacy policy published and URL ready.
- [ ] At least one 1280x800 screenshot.
