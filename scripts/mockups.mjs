/**
 * Build the HTML mockups used for store screenshots and promo tiles.
 *
 * Each mockup is a self-contained page drawn at the exact pixel size the
 * Chrome Web Store expects, so it can be rendered deterministically in a
 * headless browser and captured. The popup UI reuses the real popup.css
 * (scoped) and the real icon, so every asset stays on-brand.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(
	path.dirname(new URL(import.meta.url).pathname),
	"..",
);

const popupCssRaw = readFileSync(path.join(ROOT, "src/popup.css"), "utf8");
const iconB64 = readFileSync(path.join(ROOT, "icons/icon128.png")).toString(
	"base64",
);
const ICON = `data:image/png;base64,${iconB64}`;

/** The full currency picker, taken from the source of truth. */
const options = (() => {
	const src = readFileSync(path.join(ROOT, "src/lib/currencies.ts"), "utf8");
	const re = /\{ code: "([A-Z]{3})", name: "([^"]+)" \}/g;
	const out = [];
	for (let m = re.exec(src); m; m = re.exec(src)) {
		out.push(
			`<option value="${m[1]}"${m[1] === "USD" ? " selected" : ""}>${m[1]} · ${m[2]}</option>`,
		);
	}
	return out.join("\n");
})();

/** Scope every popup.css rule under `.nm-popup` so it cannot leak out. */
function scopeCss(css, root = ".nm-popup") {
	css = css.replace(
		/:root\s*\{([\s\S]*?)\}/,
		(_m, body) => `${root} {${body}}`,
	);
	let out = "";
	let i = 0;
	while (i < css.length) {
		const brace = css.indexOf("{", i);
		if (brace === -1) {
			out += css.slice(i);
			break;
		}
		const selector = css.slice(i, brace).trim();
		const end = css.indexOf("}", brace);
		const block = css.slice(brace, end + 1);
		if (selector.startsWith("@")) out += `${selector} ${block}\n`;
		else if (selector.length) {
			out += `${selector
				.split(",")
				.map((s) => `${root} ${s.trim()}`)
				.join(", ")} ${block}\n`;
		}
		i = end + 1;
	}
	return out;
}
const popupCss = scopeCss(popupCssRaw);

const POPUP = (mode = "inline") => `
  <div class="nm-popup">
    <header class="head">
      <div class="brand"><div>
        <div class="title-row"><h1>Nomisma</h1><span class="version">v1.0.0</span></div>
        <p class="tag">Every price, in your currency</p>
      </div></div>
      <label class="switch"><input type="checkbox" checked /><span class="slider"></span></label>
    </header>
    <main class="body">
      <label class="field"><span class="label">Show prices in</span><select>${options}</select></label>
      <label class="field"><span class="label">Display</span><select>
        <option${mode === "inline" ? " selected" : ""}>Inline: show both</option>
        <option${mode === "replace" ? " selected" : ""}>Replace: hover for original</option>
      </select></label>
      <div class="field"><span class="label">Large amounts</span>
        <label class="row"><span class="row-label">Abbreviate over 1,000 (1.2K, 3.4M)</span>
          <span class="switch sm"><input type="checkbox" ${mode === "abbrev" ? "checked" : ""} /><span class="slider"></span></span>
        </label>
      </div>
    </main>
    <footer class="foot">
      <span class="rate">Exchange rates · 22:23</span>
      <span class="foot-links"><a class="tip" href="#">☕ Tip</a><a class="credit" href="#">© spiegelhauer.fyi</a></span>
    </footer>
  </div>`;

const SCREENSHOT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1280px; height: 800px; overflow: hidden; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    background:
      radial-gradient(1200px 600px at 78% -10%, #1b2030 0%, transparent 60%),
      radial-gradient(900px 500px at -10% 110%, #171a22 0%, transparent 55%),
      #0b0d12;
    color: #f5f6f8; -webkit-font-smoothing: antialiased;
  }
  .scene { position: relative; width: 1280px; height: 800px; }

  .headline { position: absolute; top: 58px; left: 72px; width: 900px; z-index: 40; }
  .eyebrow { font-size: 13px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #7b87e0; margin: 0 0 12px; }
  .headline h2 { margin: 0; font-size: 40px; line-height: 1.1; letter-spacing: -0.025em; font-weight: 700; }
  .headline p { margin: 13px 0 0; font-size: 16.5px; line-height: 1.45; color: #a7adba; font-weight: 400; max-width: 640px; }

  .panel {
    position: absolute; border-radius: 16px; overflow: hidden;
    background: #fff; box-shadow: 0 30px 80px rgba(0,0,0,.55), 0 8px 24px rgba(0,0,0,.4);
    border: 1px solid rgba(255,255,255,.08); z-index: 20;
  }
  .nm-popup { z-index: 30; }
  .panel .bar { height: 40px; display: flex; align-items: center; gap: 12px; padding: 0 14px; background: #f7f8fa; border-bottom: 1px solid #e9ebef; }
  .panel .dots { display: flex; gap: 7px; }
  .panel .dots i { width: 11px; height: 11px; border-radius: 50%; display: block; }
  .panel .dots i:nth-child(1){ background:#ff5f57;} .panel .dots i:nth-child(2){background:#febc2e;} .panel .dots i:nth-child(3){background:#28c840;}
  .panel .url { height: 26px; flex: 1; background: #eef0f4; border-radius: 7px; display:flex; align-items:center; padding: 0 10px; color:#6b7280; font-size: 12px; }
  .panel .content { background: #fff; }

  .cc-wrap { white-space: nowrap; }
  .cc-conv { font-size: 0.9em; opacity: 0.7; color: inherit; white-space: nowrap; }
  .cc-mode-inline .cc-conv:not(:empty)::before { content: " ≈ "; opacity: 0.6; }

  ${popupCss}
`;

const SHOP_CSS = `
  .shop { padding: 22px 26px; }
  .shop h3 { margin: 0 0 16px; font-size: 17px; color:#14161a; letter-spacing: -0.01em; }
  .shop .row-item { display: flex; align-items: center; gap: 14px; padding: 13px 0; border-bottom: 1px solid #eef0f3; }
  .ri-thumb { width: 44px; height: 44px; border-radius: 8px; background: linear-gradient(135deg,#e3e8f0,#cfd6e2); flex: none; }
  .ri-name { flex: 1; color:#1a1d23; font-size: 14.5px; font-weight: 500; }
  .ri-price { color:#14161a; font-weight: 700; font-size: 15.5px; }
`;

function shopGrid(rows) {
	return rows
		.map(
			([name, eur, usd]) => `
      <div class="row-item">
        <div class="ri-thumb"></div>
        <div class="ri-name">${name}</div>
        <div class="ri-price"><span class="cc-wrap cc-mode-inline cc-ok"><span class="cc-orig">${eur} €</span><span class="cc-conv">${usd} $</span></span></div>
      </div>`,
		)
		.join("");
}

const screenshotShots = {
	hero: `
    <div class="scene">
      <div class="headline">
        <p class="eyebrow">Nomisma</p>
        <h2>Every price, in your currency.</h2>
        <p>Prices on any website, converted automatically: shops, marketplaces, booking sites, everywhere.</p>
      </div>
      <div class="panel" style="top:250px; left:72px; width:770px;">
        <div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">shop.example.com</div></div>
        <div class="content shop" style="height:470px;">${shopGrid([
					["Mechanical Keyboard K86", "49,90", "52,41"],
					["Wireless Mouse Pro", "24,50", "25,73"],
					['27" 4K Monitor', "279,00", "293,04"],
					["USB-C Hub 7-in-1", "39,99", "42,00"],
					["Noise-Cancelling Headphones", "129,00", "135,49"],
				])}</div>
      </div>
      ${POPUP("inline").replace('class="nm-popup"', 'class="nm-popup" style="position:absolute;top:250px;right:72px"')}
    </div>`,

	inline: `
    <div class="scene">
      <div class="headline">
        <p class="eyebrow">Inline mode</p>
        <h2>See both prices at a glance.</h2>
        <p>The original stays put and your currency appears right next to it.</p>
      </div>
      <div class="panel" style="top:250px; left:72px; width:1136px;">
        <div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">shop.example.com / peripherals</div></div>
        <div class="content shop" style="height:478px;">
          <h3>Peripherals</h3>
          ${shopGrid([
						["Mechanical Keyboard K86", "49,90", "52,41"],
						["Wireless Mouse Pro", "24,50", "25,73"],
						['27" 4K Monitor', "279,00", "293,04"],
						["USB-C Hub 7-in-1", "39,99", "42,00"],
						["Noise-Cancelling Headphones", "129,00", "135,49"],
						["Portable SSD 1TB", "89,99", "94,52"],
						["Desk Lamp LED", "34,90", "36,66"],
					])}
        </div>
      </div>
    </div>`,

	replace: `
    <div class="scene">
      <div class="headline">
        <p class="eyebrow">Replace mode</p>
        <h2>Clean numbers. Original on hover.</h2>
        <p>Keep pages tidy by replacing prices. Hover any price to reveal the original.</p>
      </div>
      <div class="panel" style="top:250px; left:72px; width:760px;">
        <div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">shop.example.com / peripherals</div></div>
        <div class="content shop" style="height:478px;">
          <h3>Peripherals</h3>
          ${[
						["Mechanical Keyboard K86", "52,41 $", "49,90 €"],
						["Wireless Mouse Pro", "25,73 $", "24,50 €"],
						['27" 4K Monitor', "293,04 $", "279,00 €"],
						["USB-C Hub 7-in-1", "42,00 $", "39,99 €"],
						["Noise-Cancelling Headphones", "135,49 $", "129,00 €"],
					]
						.map(
							([name, usd, eur], i) => `
            <div class="row-item">
              <div class="ri-thumb"></div>
              <div class="ri-name">${name}</div>
              <div class="ri-price">${i === 1 ? `<span style="color:#8a909c;font-weight:600">${eur}</span>` : usd}</div>
            </div>`,
						)
						.join("")}
        </div>
      </div>
      ${POPUP("replace").replace('class="nm-popup"', 'class="nm-popup" style="position:absolute;top:250px;right:72px"')}
    </div>`,

	abbrev: `
    <div class="scene">
      <div class="headline">
        <p class="eyebrow">Large amounts</p>
        <h2>Big numbers, kept readable.</h2>
        <p>Optionally abbreviate thousands and millions: 1.2K, 3.4M.</p>
      </div>
      <div class="panel" style="top:250px; left:72px; width:760px;">
        <div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">shop.example.com / high-end</div></div>
        <div class="content shop" style="height:470px;">${shopGrid([
					["Studio Camera Body", "1.299,00", "1.4K"],
					["Cinema Lens 24-70mm", "2.450,00", "2.6K"],
					["Drone Pro Kit", "3.999,00", "4.2K"],
					["Workstation Laptop", "4.799,00", "5.0K"],
					["Reference Monitor", "1.149,00", "1.2K"],
				])}</div>
      </div>
      ${POPUP("abbrev").replace('class="nm-popup"', 'class="nm-popup" style="position:absolute;top:250px;right:72px"')}
    </div>`,

	chart: `
    <div class="scene">
      <div class="headline">
        <p class="eyebrow">Works everywhere</p>
        <h2>Even in charts and dropdowns.</h2>
        <p>Nomisma converts prices in price-history charts, menus, and content that loads as you scroll.</p>
      </div>
      <div class="panel" style="top:250px; left:72px; width:760px;">
        <div class="bar"><div class="dots"><i></i><i></i><i></i></div><div class="url">cardmarket.com / price trend</div></div>
        <div class="content" style="height:470px; background:#fbfbfc; padding:26px;">
          <div style="font-size:13px;color:#6b7280;margin-bottom:4px;">Price Trend</div>
          <div style="font-size:34px;font-weight:700;color:#14161a;">0,66 € <span style="color:#8a909c;font-weight:600;font-size:34px;">≈ 0,75 $</span></div>
          <svg viewBox="0 0 660 300" style="width:100%;height:auto;margin-top:18px">
            <polyline fill="none" stroke="#c7ccd6" stroke-width="2"
              points="0,180 60,120 120,150 180,90 240,140 300,70 360,120 420,60 480,110 540,50 600,90 660,40"/>
            <polyline fill="none" stroke="#6f7bd6" stroke-width="3"
              points="0,200 60,150 120,175 180,120 240,160 300,95 360,140 420,90 480,130 540,80 600,110 660,70"/>
          </svg>
          <div style="display:flex;justify-content:space-between;color:#9aa0ac;font-size:12px;margin-top:10px;">
            <span>23.08</span><span>29.08</span><span>07.09</span><span>14.09</span><span>21.09</span><span>30.09</span>
          </div>
        </div>
      </div>
      ${POPUP("inline").replace('class="nm-popup"', 'class="nm-popup" style="position:absolute;top:250px;right:72px"')}
    </div>`,
};

const PROMO_BRAND = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .tile {
    position: relative; overflow: hidden; color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
    background:
      radial-gradient(120% 130% at 82% 8%, #232a44 0%, transparent 55%),
      radial-gradient(90% 120% at 0% 100%, #1a1c2b 0%, transparent 60%),
      #0b0d12;
  }
  .tile::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(90deg, transparent 0%, transparent 70%, rgba(255,255,255,.04) 100%);
  }
  .glow { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .55; }
  .icon { border-radius: 22%; box-shadow: 0 10px 30px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.35); }
  .name { font-weight: 700; letter-spacing: -0.02em; }
  .tag { color: #b7bdc9; font-weight: 400; }
  .conv { color: #a5c8ff; font-variant-numeric: tabular-nums; }
`;

const small = `<!doctype html><html><head><meta charset="utf-8"/><style>
${PROMO_BRAND}
  .tile { width: 440px; height: 280px; padding: 30px 32px; display: flex; flex-direction: column; justify-content: space-between; }
  .glow.a { width: 300px; height: 300px; right: -50px; top: -70px; background: #6f7bd6; opacity: .7; }
  .glow.b { width: 260px; height: 260px; left: -60px; bottom: -100px; background: #b8f2d8; opacity: .45; }
  .glow.c { width: 200px; height: 200px; right: 20px; bottom: -110px; background: #ffb3c6; opacity: .4; }
  .row { display: flex; align-items: center; gap: 15px; }
  .icon { width: 60px; height: 60px; position: relative; z-index: 2; }
  .name { font-size: 30px; position: relative; z-index: 2; }
  .tag { font-size: 15.5px; line-height: 1.45; max-width: 330px; position: relative; z-index: 2; }
  .price { position: relative; z-index: 2; font-size: 15px; color: #cdd3de; font-weight: 500; }
  .price b { color:#fff; }
</style></head><body>
  <div class="tile">
    <div class="glow a"></div><div class="glow b"></div><div class="glow c"></div>
    <div class="row"><img class="icon" src="${ICON}"/><div class="name">Nomisma</div></div>
    <div class="tag">See every price in your currency, on any website.</div>
    <div class="price"><b>49,90&nbsp;€</b> &nbsp;<span class="conv">≈&nbsp;52,41&nbsp;$</span></div>
  </div>
</body></html>`;

const marquee = `<!doctype html><html><head><meta charset="utf-8"/><style>
${PROMO_BRAND}
  .tile { width: 1400px; height: 560px; padding: 64px 72px; display: flex; align-items: center; justify-content: space-between; gap: 40px; }
  .glow.a { width: 620px; height: 620px; right: 60px; top: -180px; background: #6f7bd6; }
  .glow.b { width: 480px; height: 480px; left: -140px; bottom: -200px; background: #b8f2d8; opacity: .35; }
  .glow.c { width: 360px; height: 360px; right: 320px; bottom: -220px; background: #ffb3c6; opacity: .3; }
  .left { position: relative; z-index: 2; max-width: 660px; }
  .row { display: flex; align-items: center; gap: 22px; margin-bottom: 26px; }
  .icon { width: 92px; height: 92px; }
  .name { font-size: 54px; }
  .tag { font-size: 26px; line-height: 1.4; color: #c4cad6; }
  .right { position: relative; z-index: 2; }
  .card { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 20px; padding: 26px 30px; backdrop-filter: blur(8px); }
  .card h4 { font-size: 15px; color: #9aa1b0; font-weight: 600; text-transform: uppercase; letter-spacing: .1em; margin-bottom: 18px; }
  .pl { display: flex; justify-content: space-between; gap: 40px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,.08); font-size: 20px; color: #fff; font-weight: 600; }
  .pl:last-child { border-bottom: 0; }
</style></head><body>
  <div class="tile">
    <div class="glow a"></div><div class="glow b"></div><div class="glow c"></div>
    <div class="left">
      <div class="row"><img class="icon" src="${ICON}"/><div class="name">Nomisma</div></div>
      <div class="tag">Every price, in your currency.<br/>Shops, marketplaces, booking sites, everywhere.</div>
    </div>
    <div class="right">
      <div class="card">
        <h4>Live conversion</h4>
        <div class="pl"><span>49,90&nbsp;€</span><span class="conv">52,41&nbsp;$</span></div>
        <div class="pl"><span>279,00&nbsp;€</span><span class="conv">293,04&nbsp;$</span></div>
        <div class="pl"><span>1.299,00&nbsp;€</span><span class="conv">1.4K&nbsp;$</span></div>
      </div>
    </div>
  </div>
</body></html>`;

/** name -> { html, width, height } */
export const mockups = {};

for (const [name, body] of Object.entries(screenshotShots)) {
	mockups[name] = {
		width: 1280,
		height: 800,
		html: `<!doctype html><html lang="en"><head><meta charset="utf-8"/><style>${SCREENSHOT_CSS}${SHOP_CSS}</style></head><body>${body}</body></html>`,
	};
}
mockups.small = { width: 440, height: 280, html: small };
mockups.marquee = { width: 1400, height: 560, html: marquee };
