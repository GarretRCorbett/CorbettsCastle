#!/usr/bin/env node
/* End-to-end checks in headless Chromium. Needs Playwright:  npm i -g playwright  (or npx).
 * Usage: node tools/browser-test.js [--shots dir] */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const G = require('../js/game.js');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('Playwright is not installed. Try: npm i -g playwright  (then NODE_PATH=$(npm root -g) node tools/browser-test.js)');
  process.exit(2);
}

const ROOT = path.join(__dirname, '..');
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i > 0 ? process.argv[i + 1] : null; })();
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

let failures = 0;
function check(cond, label) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + label);
  if (!cond) failures++;
}

(async () => {
  const server = await serve();
  const URL = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const errors = [];

  async function phone(opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, opts || {}));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    return { ctx, page };
  }
  const game = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__castleKeep.state)));
  // Put a save in place before the game script runs (the page saves on unload, so write from a neutral page).
  async function loadWithSave(page, s) {
    await page.goto(URL + 'favicon.svg');
    await page.evaluate((json) => localStorage.setItem('castleKeep.save', json), typeof s === 'string' ? s : JSON.stringify(s));
    await page.goto(URL);
    await page.waitForTimeout(300);
  }
  // Dialogs resolve on their async "close" event, so give them a moment.
  async function confirm(page, id) {
    await page.click(id || '#confirmOk');
    await page.waitForTimeout(150);
  }

  // ---------------------------------------------------------------
  console.log('Fresh game on a phone');
  {
    const { ctx, page } = await phone();
    await page.goto(URL);
    check((await page.title()) === 'Castle Keep', 'page title is "Castle Keep"');
    check(await page.locator('meta[property="og:image"]').count() === 1, 'has Open Graph image meta');
    for (let i = 0; i < 25; i++) await page.tap('#scene');
    let s = await game(page);
    check(s.res.gold === 25 && s.stats.clicks === 25, `25 taps → 25 gold (got ${s.res.gold})`);

    await page.click('#tab-build');
    await page.locator('#buildList .item', { hasText: 'Signal Fire' }).click();
    s = await game(page);
    check(s.built.signalFire === true, 'bought Signal Fire from the Build tab');
    await page.tap('#scene');
    check((await game(page)).res.gold === 15 + 2, 'Signal Fire doubles taps');

    await page.click('#tab-workers');
    await page.locator('#workerList .item', { hasText: 'Peasant' }).click();
    s = await game(page);
    check(s.workers.peasant === 1, 'hired a peasant');
    const g0 = s.res.gold;
    await page.waitForTimeout(1500);
    check((await game(page)).res.gold > g0, 'peasant produces gold over time');

    // unaffordable purchase is ignored (force: Playwright otherwise waits for aria-disabled to clear)
    check(await page.locator('#workerList .item', { hasText: 'Peasant' }).getAttribute('aria-disabled') === 'true', 'unaffordable worker is marked disabled');
    await page.locator('#workerList .item', { hasText: 'Peasant' }).click({ force: true });
    check((await game(page)).workers.peasant === 1, 'cannot hire without enough gold');

    // layout: no horizontal scroll, big tap targets
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, 'no horizontal scrolling at 390px');
    const small = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent && !b.closest('dialog'))
      .map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 20), w: r.width, h: r.height }; })
      .filter((r) => r.w < 40 || r.h < 40));
    check(small.length === 0, 'all visible buttons are at least 40×40px' + (small.length ? ' ' + JSON.stringify(small) : ''));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'phone-early.png') });

    // autosave + reload keeps progress
    await page.evaluate(() => window.__castleKeep.save());
    await page.reload();
    await page.waitForTimeout(300);
    s = await game(page);
    check(s.workers.peasant === 1 && s.built.signalFire, 'progress survives a reload');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('castleKeep.save')));
    check(saved.v === G.SAVE_VERSION, `save is versioned (v${saved.v})`);
    await page.waitForTimeout(5600);
    const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('castleKeep.save')));
    check(saved2.savedAt > saved.savedAt, 'autosaves every few seconds');
    await ctx.close();
  }

  // ---------------------------------------------------------------
  console.log('Offline progress');
  {
    const { ctx, page } = await phone();
    const s = G.newState(Date.now() - 2 * 3600 * 1000);
    s.workers.peasant = 10;
    s.nextEventIn = 9999;
    const expected = G.rates(s).gold * 7200;
    await loadWithSave(page, s);
    check(await page.locator('#awayDlg').evaluate((d) => d.open), '"While you were away…" dialog appears');
    const text = await page.locator('#awayDlg').innerText();
    check(/2h 0m/.test(text), 'summary says how long you were away');
    const gold = (await game(page)).res.gold;
    check(Math.abs(gold - expected) / expected < 0.01, `awarded ~2h of production (${G.fmt(gold)} vs ${G.fmt(expected)})`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'phone-away.png') });
    await page.click('#awayDlg button');
    check(!(await page.locator('#awayDlg').evaluate((d) => d.open)), 'dialog closes');

    const s2 = G.newState(Date.now() - 3 * 86400 * 1000);
    s2.workers.peasant = 10;
    await loadWithSave(page, s2);
    const capText = await page.locator('#awayCap').innerText();
    const gold2 = (await game(page)).res.gold;
    const cap = G.rates(s2).gold * G.OFFLINE_CAP;
    check(Math.abs(gold2 - cap) / cap < 0.01 && /12 hours/.test(capText), 'offline gains are capped at 12 hours');
    await ctx.close();
  }

  // ---------------------------------------------------------------
  console.log('Settings: export, import, reset');
  {
    const { ctx, page } = await phone();
    const s = G.newState(Date.now());
    s.workers.peasant = 7; s.built.signalFire = true; s.built.woodshed = true; s.res.gold = 1234;
    await loadWithSave(page, s);
    await page.click('#settingsBtn');
    const code = await page.locator('#exportBox').inputValue();
    check(code.startsWith('CASTLEKEEP:'), 'export shows a save code');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'phone-settings.png') });

    await page.click('#resetBtn');
    await confirm(page);
    let st = await game(page);
    check(st.workers.peasant === 0 && !st.built.signalFire, 'reset (after confirming) starts over');

    await page.click('#settingsBtn');
    await page.fill('#importBox', 'definitely not a save');
    await page.click('#importBtn');
    check(/not a valid save/i.test(await page.locator('#importMsg').innerText()), 'bad import code shows an error');
    await page.fill('#importBox', code);
    await page.click('#importBtn');
    await confirm(page);
    st = await game(page);
    check(st.workers.peasant === 7 && st.built.woodshed && Math.floor(st.res.gold) >= 1234, 'import restores the exported castle');

    await page.click('#settingsBtn');
    await page.click('#resetBtn');
    await confirm(page, '#confirmCancel');
    check((await game(page)).workers.peasant === 7, 'cancelling reset keeps the game');
    await ctx.close();
  }

  // ---------------------------------------------------------------
  console.log('Events, stages and prestige');
  {
    const { ctx, page } = await phone();
    const s = G.newState(Date.now());
    for (const b of G.BUILDINGS) if (b.stage <= 2) s.built[b.id] = true; // Walled Castle
    s.workers = { peasant: 60, woodcutter: 50, mason: 40, merchant: 20 };
    s.stats.runGold = 5e8;
    s.nextEventIn = 0;
    await loadWithSave(page, s);
    await page.waitForTimeout(400);
    check(await page.locator('#event').isVisible(), 'a herald event appears');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'phone-event.png') });
    await page.locator('#eventChoices button').first().click();
    check(await page.locator('#event').isHidden(), 'choosing an option resolves the event');
    check((await page.locator('#toasts').innerText()).length > 0, 'the outcome is shown as a message');

    check(await page.locator('#tab-crown').isVisible(), 'Crown tab is unlocked at the Walled Castle');
    await page.click('#tab-crown');
    const gain = G.legacyGain(s);
    check((await page.locator('#legacyGain').innerText()) === '+' + gain, `shows Legacy gain (+${gain})`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'phone-crown.png') });
    await page.click('#prestigeBtn');
    await confirm(page);
    const after = await game(page);
    check(after.generation === 2 && after.legacy === gain && after.workers.peasant === 0 && G.stageOf(after) === 0,
      'passing the crown resets the castle and grants Legacy');
    await page.tap('#scene');
    check((await game(page)).res.gold === 1 + 0.1 * gain, 'Legacy boosts taps');

    // Buying a castle upgrade changes the stage and the art
    const s3 = G.newState(Date.now());
    s3.res = { gold: 1000, wood: 1000, stone: 0 };
    s3.nextEventIn = 9999;
    await loadWithSave(page, s3);
    const before = await page.locator('#artBody').innerHTML();
    await page.click('#tab-build');
    await page.locator('#buildList .item', { hasText: 'Raise the Palisade' }).click();
    check(G.stageOf(await game(page)) === 1, 'castle upgrade moves to the Palisade stage');
    check((await page.locator('#artBody').innerHTML()) !== before && (await page.locator('#stageChip').innerText()) === 'Palisade', 'castle art and label change');
    await ctx.close();
  }

  // ---------------------------------------------------------------
  console.log('Robustness');
  {
    const { ctx, page } = await phone();
    await loadWithSave(page, '{"this is": broken');
    const st = await game(page);
    check(st.workers.peasant === 0, 'corrupt save → fresh game instead of a crash');
    check(await page.evaluate(() => localStorage.getItem('castleKeep.save.broken')) === '{"this is": broken', 'corrupt save is kept as a backup');
    // partial / older-looking save gets defaults filled in
    await loadWithSave(page, JSON.stringify({ v: 1, res: { gold: 50 }, workers: { peasant: 3 }, savedAt: Date.now() }));
    const p = await game(page);
    check(p.res.gold >= 50 && p.workers.peasant === 3 && p.workers.mason === 0 && p.stats, 'save with missing fields loads with defaults');
    await ctx.close();
  }

  console.log('Reduced motion');
  {
    const { ctx, page } = await phone({ reducedMotion: 'reduce' });
    const s = G.newState(Date.now()); s.workers.peasant = 30;
    await loadWithSave(page, s);
    await page.tap('#scene');
    check(await page.locator('.floater').count() === 0, 'no floating numbers');
    check(await page.locator('.walker').count() === 0, 'villagers stand still');
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.cloud')).animationName);
    check(anim === 'none', 'clouds do not drift');
    await ctx.close();
  }

  console.log('Small phone and desktop layouts');
  for (const vp of [{ width: 320, height: 640 }, { width: 1280, height: 800 }]) {
    const { ctx, page } = await phone({ viewport: vp, isMobile: vp.width < 600, hasTouch: vp.width < 600 });
    const s = G.newState(Date.now());
    for (const b of G.BUILDINGS) if (b.stage <= 4) s.built[b.id] = true;
    s.workers = { peasant: 150, woodcutter: 150, mason: 150, merchant: 150 };
    s.res = { gold: 1.23e15, wood: 4.5e13, stone: 6.7e12 };
    s.nextEventIn = 9999;
    await loadWithSave(page, s);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `no horizontal scrolling at ${vp.width}px with huge numbers`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `layout-${vp.width}.png`) });
    await ctx.close();
  }

  check(errors.length === 0, 'no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})();
