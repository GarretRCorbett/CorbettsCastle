#!/usr/bin/env node
/* Renders images/og-image.png (link previews) and images/apple-touch-icon.png from the game's own art.
 * Needs Playwright. Usage: node tools/make-images.js */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const G = require('../js/game.js');

const ROOT = path.join(__dirname, '..');
const artJs = fs.readFileSync(path.join(ROOT, 'js/art.js'), 'utf8');
const favicon = fs.readFileSync(path.join(ROOT, 'favicon.svg'), 'utf8');

// A finished Grand Citadel for the preview.
const s = G.newState(0);
for (const b of G.BUILDINGS) if (b.id !== 'goldenRoofs') s.built[b.id] = true;
s.workers.peasant = 100;

const page = (body, w, h) => `<!doctype html><html><head><style>
  html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
  body { font-family: "Iowan Old Style", Palatino, Georgia, serif; }
</style></head><body>${body}<script>${artJs}</script></body></html>`;

(async () => {
  fs.mkdirSync(path.join(ROOT, 'images'), { recursive: true });
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  await tab.setContent(page(`
    <div style="position:relative;width:1200px;height:630px;background:#2b3a67">
      <svg id="art" viewBox="0 0 400 211" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%"></svg>
      <div style="position:absolute;left:0;right:0;bottom:0;height:210px;background:linear-gradient(transparent,rgba(20,24,45,.85))"></div>
      <div style="position:absolute;left:56px;bottom:44px;color:#fff">
        <div style="font-size:92px;font-weight:700;line-height:1;text-shadow:0 3px 12px rgba(0,0,0,.4)">Castle Keep</div>
        <div style="font:500 34px system-ui,sans-serif;margin-top:12px;opacity:.95">Grow a castle, one peasant at a time.</div>
      </div>
    </div>`, 1200, 630));
  await tab.evaluate(({ state, gameSrc }) => {
    const G = new Function('module', gameSrc + '; return module.exports;')({ exports: {} });
    document.getElementById('art').innerHTML = window.CastleArt.render(G, state, { reduced: true, dragon: true });
  }, { state: s, gameSrc: fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8') });
  await tab.screenshot({ path: path.join(ROOT, 'images/og-image.png') });

  await tab.setViewportSize({ width: 180, height: 180 });
  await tab.setContent(`<!doctype html><html><body style="margin:0">${favicon.replace('<svg ', '<svg width="180" height="180" ').replace('rx="14"', 'rx="0"')}</body></html>`);
  await tab.screenshot({ path: path.join(ROOT, 'images/apple-touch-icon.png'), clip: { x: 0, y: 0, width: 180, height: 180 } });

  await browser.close();
  console.log('Wrote images/og-image.png and images/apple-touch-icon.png');
})();
