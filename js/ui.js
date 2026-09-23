/* Castle Keep — page wiring: rendering, input, saving. */
(function () {
  'use strict';
  const G = window.CastleKeep;
  const Art = window.CastleArt;
  const fmt = G.fmt, fmtRate = G.fmtRate, fmtTime = G.fmtTime;

  const SAVE_KEY = 'castleKeep.save';
  const BACKUP_KEY = 'castleKeep.save.broken';
  const AUTOSAVE_MS = 5000;
  const TICK_MS = 200;
  const EVENT_LIFETIME = 30; // seconds an event waits for an answer
  const AWAY_DIALOG_MIN = 60; // show "while you were away" after this many seconds

  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();

  // ---- storage --------------------------------------------------------------

  function storageGet(k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function storageSet(k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }
  function storageRemove(k) {
    try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
  }

  let state;
  let loadNote = null;

  function load() {
    const raw = storageGet(SAVE_KEY);
    if (!raw) return G.newState(now());
    try {
      return G.deserialize(raw, now());
    } catch (e) {
      storageSet(BACKUP_KEY, raw);
      loadNote = 'Your save could not be read, so a new castle was started. The old save was kept as a backup.';
      return G.newState(now());
    }
  }

  function save() {
    storageSet(SAVE_KEY, G.serialize(state, now()));
  }

  // ---- motion ---------------------------------------------------------------

  const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() {
    const pref = state.settings.reduceMotion;
    if (pref === true || pref === false) return pref;
    return !!(motionQuery && motionQuery.matches);
  }
  function applyMotionSetting() {
    const pref = state.settings.reduceMotion;
    document.documentElement.dataset.motion = pref === true ? 'reduced' : pref === false ? 'full' : 'system';
    $('motionSel').value = pref === true ? 'reduced' : pref === false ? 'full' : 'system';
    artKey = null;
  }
  if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener('change', () => { artKey = null; });

  // ---- small helpers ------------------------------------------------------------

  function icon(id, cls) {
    return `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true"><use href="#i-${id}"/></svg>`;
  }
  const RES_NAME = { gold: 'gold', wood: 'wood', stone: 'stone' };

  function costHTML(cost) {
    return Object.keys(cost).map((r) => {
      const short = state.res[r] < cost[r] ? ' short' : '';
      return `<span class="cost-part${short}">${icon(r)}${fmt(cost[r])}<span class="sr-only"> ${RES_NAME[r]}${short ? ' (not enough)' : ''}</span></span>`;
    }).join('');
  }

  /** Set innerHTML only when it changed, so buttons aren't rebuilt under the user's finger. */
  function setHTML(el, html) {
    if (el._html !== html) {
      el._html = html;
      el.innerHTML = html;
    }
  }

  function toast(msg, big) {
    const el = document.createElement('div');
    el.className = 'toast' + (big ? ' big' : '');
    el.textContent = msg;
    const box = $('toasts');
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.remove(), big ? 5000 : 4000);
  }

  function openDialog(dlg) {
    if (dlg.open) return;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  let confirmResolve = null;
  function confirmBox(title, text, okLabel, danger) {
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    const ok = $('confirmOk');
    ok.textContent = okLabel || 'OK';
    ok.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    const dlg = $('confirmDlg');
    dlg.returnValue = '';
    openDialog(dlg);
    return new Promise((resolve) => { confirmResolve = resolve; });
  }
  $('confirmDlg').addEventListener('close', () => {
    if (confirmResolve) confirmResolve($('confirmDlg').returnValue === 'ok');
    confirmResolve = null;
  });

  // ---- art ------------------------------------------------------------------

  let artKey = null;
  function updateArt() {
    const opts = { reduced: reducedMotion(), dragon: !!(currentEvent && currentEvent.def.id === 'dragon') || state.buffs.some((b) => b.id === 'dragon') };
    const k = Art.key(G, state, opts);
    if (k === artKey) return;
    artKey = k;
    $('artBody').innerHTML = Art.render(G, state, opts);
    const st = G.stageOf(state);
    $('artTitle').textContent = 'Your castle: ' + G.STAGES[st].name;
  }

  // ---- tapping --------------------------------------------------------------

  const scene = $('scene');
  scene.addEventListener('click', (e) => {
    const v = G.click(state);
    const rect = scene.getBoundingClientRect();
    const x = e.detail && e.clientX ? e.clientX - rect.left : rect.width / 2;
    const y = e.detail && e.clientY ? e.clientY - rect.top : rect.height / 2;
    if (!reducedMotion()) {
      const f = document.createElement('span');
      f.className = 'floater';
      f.textContent = '+' + fmt(v);
      f.style.left = x + 'px';
      f.style.top = y + 'px';
      const box = $('floaters');
      box.appendChild(f);
      if (box.children.length > 14) box.firstChild.remove();
      f.addEventListener('animationend', () => f.remove());
      scene.classList.remove('bump');
      void scene.offsetWidth;
      scene.classList.add('bump');
    }
    updateNumbers();
  });

  // Holding a key down shouldn't become a free autoclicker.
  scene.addEventListener('keydown', (e) => {
    if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
  });

  // ---- tabs -----------------------------------------------------------------

  const tabs = ['workers', 'build', 'crown'];
  function selectTab(name, focus) {
    for (const t of tabs) {
      const on = t === name;
      const tab = $('tab-' + t);
      tab.setAttribute('aria-selected', on);
      tab.tabIndex = on ? 0 : -1;
      $('panel-' + t).hidden = !on;
      if (on && focus) tab.focus();
    }
    currentTab = name;
  }
  let currentTab = 'workers';
  tabs.forEach((t) => {
    const tab = $('tab-' + t);
    tab.addEventListener('click', () => selectTab(t));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const visible = tabs.filter((x) => !$('tab-' + x).hidden);
      let i = visible.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1);
      i = (i + visible.length) % visible.length;
      selectTab(visible[i], true);
      e.preventDefault();
    });
  });

  // ---- buy amount -----------------------------------------------------------

  document.querySelectorAll('.seg').forEach((b) => {
    b.addEventListener('click', () => {
      const a = b.dataset.amount;
      state.settings.buyAmount = a === 'max' ? 'max' : Number(a);
      syncBuyAmount();
      updateLists();
    });
  });
  function syncBuyAmount() {
    document.querySelectorAll('.seg').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.amount === String(state.settings.buyAmount)));
    });
  }

  // ---- worker list ----------------------------------------------------------

  let workerKey = null;
  const workerEls = {};

  function buildWorkerList() {
    const unlocked = G.WORKERS.filter((w) => G.workerUnlocked(state, w.id)).map((w) => w.id);
    const firstLocked = G.WORKERS.find((w) => !G.workerUnlocked(state, w.id));
    const key = unlocked.join(',') + '|' + (firstLocked ? firstLocked.id : '');
    if (key === workerKey) return;
    workerKey = key;
    const list = $('workerList');
    list.innerHTML = '';
    for (const w of G.WORKERS) {
      if (!unlocked.includes(w.id)) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'item';
      el.dataset.worker = w.id;
      el.innerHTML = `<span class="item-icon">${icon(w.id)}</span>
        <span class="item-body"><span class="item-top"><span class="item-name">${w.name}</span><span class="item-count">0</span></span>
        <span class="item-desc"></span></span>
        <span class="cost"></span>`;
      el.addEventListener('click', () => hire(w.id));
      list.appendChild(el);
      workerEls[w.id] = el;
    }
    if (firstLocked) {
      const unlocker = G.BUILDINGS.find((b) => b.effect && b.effect.unlock === firstLocked.id);
      const el = document.createElement('div');
      el.className = 'item';
      el.setAttribute('aria-disabled', 'true');
      el.innerHTML = `<span class="item-icon">${icon(firstLocked.id)}</span>
        <span class="item-body"><span class="item-top"><span class="item-name">${firstLocked.name}</span><span class="item-count">🔒</span></span>
        <span class="item-desc">Build the <strong>${unlocker.name}</strong> to hire ${firstLocked.plural.toLowerCase()}.</span></span>`;
      list.appendChild(el);
    }
  }

  function amountFor(id) {
    const a = state.settings.buyAmount;
    if (a === 'max') return Math.max(1, G.maxAffordable(state, id));
    return a;
  }

  function hire(id) {
    const n = state.settings.buyAmount === 'max' ? G.maxAffordable(state, id) : state.settings.buyAmount;
    if (n > 0 && G.buyWorker(state, id, n)) {
      updateAll();
    }
  }

  function updateWorkers(r) {
    for (const w of G.WORKERS) {
      const el = workerEls[w.id];
      if (!el || !el.isConnected) continue;
      const n = amountFor(w.id);
      const cost = G.workerCost(state, w.id, n);
      const ok = G.canAfford(state, cost);
      const count = state.workers[w.id];
      const each = G.workerEach(state, w.id);
      const toMilestone = G.MILESTONE - (count % G.MILESTONE);
      el.querySelector('.item-count').textContent = count;
      el.querySelector('.item-desc').textContent =
        `+${fmtRate(each)} ${w.res}/s each · ${toMilestone} more to double`;
      const eta = ok ? '' : ` <span class="eta">${etaText(cost, r)}</span>`;
      setHTML(el.querySelector('.cost'), `<span class="muted">${n > 1 ? 'Hire ' + n + ':' : ''}</span>` + costHTML(cost) + eta);
      el.setAttribute('aria-disabled', String(!ok));
      el.setAttribute('aria-label', `Hire ${n} ${n === 1 ? w.name : w.plural}. You have ${count}. ${ok ? '' : 'Not enough resources.'}`);
    }
  }

  function etaText(cost, r) {
    const t = G.timeToAfford(state, cost, r);
    return isFinite(t) ? 'in ' + fmtTime(t) : '';
  }

  // ---- build list -----------------------------------------------------------

  let buildKey = null;
  const buildEls = {};

  function buildBuildList() {
    const st = G.stageOf(state);
    const avail = G.BUILDINGS.filter((b) => G.buildingAvailable(state, b));
    const key = st + '|' + avail.map((b) => b.id).join(',');
    if (key === buildKey) return;
    buildKey = key;
    const list = $('buildList');
    list.innerHTML = '';
    // Castle upgrade first, then the rest cheapest-first.
    const total = (b) => Object.values(b.cost).reduce((a, c) => a + c, 0);
    avail.sort((a, b) => (b.stageUp ? 1 : 0) - (a.stageUp ? 1 : 0) || total(a) - total(b));
    for (const b of avail) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'item' + (b.stageUp ? ' stage-up' : '');
      el.innerHTML = `<span class="item-icon">${icon(b.stageUp ? 'castle' : 'build')}</span>
        <span class="item-body">${b.stageUp ? '<span class="ribbon">Castle upgrade</span>' : ''}
        <span class="item-top"><span class="item-name">${b.name}</span></span>
        <span class="item-desc">${b.desc} <span class="item-flavor">${b.flavor}</span></span></span>
        <span class="cost"></span>`;
      el.addEventListener('click', () => build(b.id));
      list.appendChild(el);
      buildEls[b.id] = el;
    }
    if (!avail.length) list.innerHTML = '<p class="muted">Everything is built! Your citadel is the envy of the realm.</p>';
    const next = G.STAGES[st + 1];
    $('buildNote').textContent = next ? `More buildings unlock when your castle becomes a ${next.name}.` : '';
    const built = G.BUILDINGS.filter((b) => state.built[b.id]);
    $('builtWrap').hidden = !built.length;
    $('builtCount').textContent = built.length;
    $('builtList').innerHTML = built.map((b) => `<li>${b.name}</li>`).join('');
  }

  function build(id) {
    const before = G.stageOf(state);
    if (!G.buyBuilding(state, id)) return;
    const b = G.BUILDING_BY_ID[id];
    if (G.stageOf(state) > before) {
      celebrateStage();
    } else {
      toast(`${b.name} built! ${b.desc}`);
    }
    save();
    updateAll();
  }

  function updateBuild(r) {
    let ready = 0;
    for (const id in buildEls) {
      const el = buildEls[id];
      if (!el.isConnected) continue;
      const b = G.BUILDING_BY_ID[id];
      const ok = G.canAfford(state, b.cost);
      if (ok) ready++;
      setHTML(el.querySelector('.cost'), costHTML(b.cost) + (ok ? '' : ` <span class="eta">${etaText(b.cost, r)}</span>`));
      el.setAttribute('aria-disabled', String(!ok));
      el.classList.toggle('ready', ok);
    }
    const badge = $('badge-build');
    badge.hidden = !ready;
    badge.textContent = ready;
  }

  function celebrateStage() {
    const st = G.stageOf(state);
    toast(`Your castle is now a ${G.STAGES[st].name}!`, true);
    const col = document.querySelector('.scene-col');
    col.classList.remove('stage-up');
    void col.offsetWidth;
    col.classList.add('stage-up');
    if (st === G.PRESTIGE_STAGE && state.generation === 1) {
      setTimeout(() => toast('The Crown tab is open: you can now pass the crown to the next generation.'), 1200);
    }
  }

  // ---- stage card -----------------------------------------------------------

  function updateStageCard(r) {
    const st = G.stageOf(state);
    const stage = G.STAGES[st];
    $('stageName').textContent = stage.name;
    $('stageName').dataset.num = `${st + 1} of ${G.STAGES.length}`;
    $('stageChip').textContent = stage.name;
    $('stageBlurb').textContent = stage.blurb;
    const nextB = G.BUILDINGS.find((b) => b.stageUp === st + 1);
    const box = $('nextStage');
    if (!nextB) {
      setHTML(box, '<div class="next"><p class="muted">The Grand Citadel is complete. Finish the last buildings, or pass the crown and do it all again with style.</p></div>');
      return;
    }
    const rows = Object.keys(nextB.cost).map((k) => {
      const pct = Math.min(100, (state.res[k] / nextB.cost[k]) * 100);
      return `<div class="progress-row">${icon(k)}<div class="bar${pct >= 100 ? ' done' : ''}" role="progressbar" aria-label="${RES_NAME[k]}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(pct)}"><span style="width:${pct}%"></span></div><span>${fmt(Math.min(state.res[k], nextB.cost[k]))} / ${fmt(nextB.cost[k])}</span></div>`;
    }).join('');
    const t = G.timeToAfford(state, nextB.cost, r);
    const when = t === 0 ? 'Ready to build!' : isFinite(t) ? '≈ ' + fmtTime(t) : missingHint(nextB.cost, r);
    setHTML(box, `<div class="next"><div class="next-title"><span>Next: ${G.STAGES[st + 1].name}</span><span class="muted">${when}</span></div>${rows}</div>`);
  }

  /** What to do when a cost can't be afforded at current rates. */
  function missingHint(cost, r) {
    const res = Object.keys(cost).find((k) => state.res[k] < cost[k] && !(r[k] > 0));
    if (res === 'gold') return 'Tap the castle!';
    const w = G.WORKERS.find((x) => x.res === res);
    if (!w) return '';
    if (!G.workerUnlocked(state, w.id)) {
      const b = G.BUILDINGS.find((x) => x.effect && x.effect.unlock === w.id);
      return 'Build the ' + b.name;
    }
    return 'Hire ' + w.plural.toLowerCase();
  }

  // ---- crown ----------------------------------------------------------------

  function updateCrown() {
    const unlocked = G.prestigeUnlocked(state) || state.legacy > 0;
    const tab = $('tab-crown');
    if (tab.hidden === unlocked) tab.hidden = !unlocked;
    if (!unlocked) return;
    const gain = G.legacyGain(state);
    const can = G.canPrestige(state);
    $('legacyNow').textContent = fmt(state.legacy);
    $('legacyBonus').textContent = '+' + fmt(state.legacy * G.LEGACY_BONUS * 100) + '%';
    $('legacyGain').textContent = '+' + fmt(gain);
    let hint;
    if (G.stageOf(state) < G.PRESTIGE_STAGE) hint = `This generation must reach the Walled Castle before the crown can be passed.`;
    else if (gain < 1) hint = 'Earn a bit more gold this reign to gain your first point of Legacy.';
    else if (gain < Math.max(1, state.legacy)) hint = 'Tip: passing the crown is most worthwhile once it would at least double your Legacy.';
    else hint = `The next ruler will produce ${fmt((1 + (state.legacy + gain) * G.LEGACY_BONUS) / (1 + state.legacy * G.LEGACY_BONUS) * 100 - 100)}% more than you. Not bad!`;
    $('crownHint').textContent = hint;
    $('prestigeBtn').setAttribute('aria-disabled', String(!can));
    const badge = $('badge-crown');
    badge.hidden = !(can && gain >= Math.max(1, state.legacy));
    badge.textContent = '!';
  }

  $('prestigeBtn').addEventListener('click', async () => {
    if (!G.canPrestige(state)) return;
    const gain = G.legacyGain(state);
    const ok = await confirmBox('Pass the Crown?',
      `${G.rulerName(state.rulerSeed)} will retire to a cottage with a nice view. Your castle, workers and resources start over, and you gain ${fmt(gain)} Royal Legacy (+${fmt(gain * G.LEGACY_BONUS * 100)}% production, forever).`,
      'Pass the Crown');
    if (!ok || !G.canPrestige(state)) return;
    G.prestige(state, now());
    dismissEvent();
    save();
    workerKey = buildKey = artKey = null;
    selectTab('workers');
    updateAll();
    toast(`Long live ${G.rulerName(state.rulerSeed)}! Generation ${state.generation} begins.`, true);
  });

  // ---- events ---------------------------------------------------------------

  let currentEvent = null;

  function spawnEvent() {
    G.scheduleNextEvent(state);
    const def = G.pickEvent(state);
    if (!def) return;
    currentEvent = { def, left: EVENT_LIFETIME };
    $('eventTitle').textContent = def.title;
    $('eventText').textContent = def.text;
    const box = $('eventChoices');
    box.innerHTML = '';
    def.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (i === 0 ? ' btn-primary' : '');
      b.innerHTML = `<span></span><small></small>`;
      b.firstChild.textContent = c.label;
      b.lastChild.textContent = c.hint ? c.hint(state) : '';
      if (!c.hint) b.lastChild.remove();
      b.addEventListener('click', () => {
        const msg = c.apply(state);
        dismissEvent();
        toast(msg);
        updateAll();
      });
      box.appendChild(b);
    });
    $('event').hidden = false;
    artKey = null;
  }

  function dismissEvent() {
    currentEvent = null;
    $('event').hidden = true;
    artKey = null;
  }

  function tickEvent(dt) {
    if (currentEvent) {
      currentEvent.left -= dt;
      $('eventTimer').style.width = Math.max(0, (currentEvent.left / EVENT_LIFETIME) * 100) + '%';
      if (currentEvent.left <= 0) dismissEvent();
    } else if (state.nextEventIn <= 0 && document.visibilityState === 'visible') {
      spawnEvent();
    }
  }

  // ---- numbers & buffs --------------------------------------------------------

  function updateNumbers(r) {
    r = r || G.rates(state);
    for (const el of document.querySelectorAll('.res')) {
      const k = el.dataset.res;
      el.querySelector('.res-val').textContent = fmt(state.res[k]);
      el.querySelector('.res-rate').textContent = '+' + fmtRate(r[k]) + '/s';
      el.classList.toggle('locked', state.res[k] < 1 && r[k] === 0);
    }
    $('clickVal').textContent = fmt(G.clickValue(state));
  }

  let buffKey = '';
  function updateBuffs() {
    const k = state.buffs.map((b) => b.id + Math.ceil(b.t)).join(',');
    if (k === buffKey) return;
    buffKey = k;
    $('buffs').innerHTML = state.buffs.map((b) =>
      `<span class="chip buff">${b.kind === 'prod' ? 'Production' : 'Taps'} ×${b.mult} · ${Math.ceil(b.t)}s</span>`).join('');
  }

  function updateHeader() {
    $('ruler').textContent = `Generation ${state.generation} · ${G.rulerName(state.rulerSeed)}`;
  }

  function updateLists() {
    const r = G.rates(state);
    updateWorkers(r);
    updateBuild(r);
  }

  function updateAll() {
    buildWorkerList();
    buildBuildList();
    const r = G.rates(state);
    updateNumbers(r);
    updateWorkers(r);
    updateBuild(r);
    updateStageCard(r);
    updateCrown();
    updateBuffs();
    updateHeader();
    updateArt();
  }

  // ---- time -----------------------------------------------------------------

  let lastTick = now();

  function showAway(result) {
    const g = result.gained;
    if (result.seconds < AWAY_DIALOG_MIN || !(g.gold + g.wood + g.stone > 0)) return;
    $('awayText').textContent = `You were gone for ${fmtTime(result.away)}. Your workers kept at it (mostly):`;
    $('awayGains').innerHTML = ['gold', 'wood', 'stone'].filter((k) => g[k] > 0)
      .map((k) => `<li>${icon(k)}+${fmt(g[k])} ${RES_NAME[k]}</li>`).join('');
    $('awayCap').textContent = result.capped
      ? `Workers only keep going for ${G.OFFLINE_CAP / 3600} hours without you. Then they nap.` : '';
    openDialog($('awayDlg'));
  }

  function tick() {
    const t = now();
    let dt = (t - lastTick) / 1000;
    lastTick = t;
    if (!(dt > 0)) dt = 0;
    if (dt > 30) {
      // The page was asleep (phone locked, tab frozen): treat it as time away.
      showAway(G.applyOffline(state, dt));
      dismissEvent();
      save();
    } else {
      G.advance(state, dt, false);
      tickEvent(dt);
    }
    updateAll();
  }

  // ---- settings -------------------------------------------------------------

  $('settingsBtn').addEventListener('click', () => {
    $('exportBox').value = G.exportCode(state, now());
    $('importBox').value = '';
    $('importMsg').textContent = '';
    $('importMsg').className = 'form-msg';
    renderStats();
    openDialog($('settingsDlg'));
  });

  $('motionSel').addEventListener('change', (e) => {
    const v = e.target.value;
    state.settings.reduceMotion = v === 'reduced' ? true : v === 'full' ? false : null;
    applyMotionSetting();
    updateArt();
    save();
  });

  $('copyBtn').addEventListener('click', async () => {
    const box = $('exportBox');
    box.value = G.exportCode(state, now());
    let ok = false;
    try {
      await navigator.clipboard.writeText(box.value);
      ok = true;
    } catch (e) {
      box.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    }
    $('copyBtn').textContent = ok ? 'Copied!' : 'Select the code and copy it';
    setTimeout(() => { $('copyBtn').textContent = 'Copy code'; }, 2000);
  });

  $('importBtn').addEventListener('click', async () => {
    const msg = $('importMsg');
    let imported;
    try {
      imported = G.importCode($('importBox').value, now());
    } catch (e) {
      msg.textContent = e.message || 'That code is not a valid save.';
      msg.className = 'form-msg error';
      return;
    }
    $('settingsDlg').close();
    const ok = await confirmBox('Replace your castle?',
      `This loads a Generation ${imported.generation} ${G.STAGES[G.stageOf(imported)].name} and replaces your current game.`, 'Import');
    if (!ok) return;
    imported.savedAt = now();
    state = imported;
    afterStateSwap();
    toast('Save imported. Welcome back, your majesty.');
  });

  $('resetBtn').addEventListener('click', async () => {
    $('settingsDlg').close();
    const ok = await confirmBox('Reset everything?',
      'Your castle, workers, resources and Royal Legacy will be gone for good. Consider exporting a save first.', 'Yes, reset', true);
    if (!ok) return;
    const settings = state.settings;
    state = G.newState(now());
    state.settings = settings;
    storageRemove(SAVE_KEY);
    afterStateSwap();
    toast('A fresh start. One tower, one ladder, one dream.');
  });

  function afterStateSwap() {
    dismissEvent();
    workerKey = buildKey = artKey = null;
    lastTick = now();
    applyMotionSetting();
    syncBuyAmount();
    selectTab('workers');
    save();
    updateAll();
  }

  function renderStats() {
    const s = state.stats;
    const rows = [
      ['Generation', state.generation],
      ['Royal Legacy', fmt(state.legacy)],
      ['Gold earned (all time)', fmt(s.totalGold)],
      ['Gold earned this reign', fmt(s.runGold)],
      ['Castle taps', fmt(s.clicks)],
      ['Time played', fmtTime(s.playTime)],
      ['Current reign', fmtTime(s.runTime)],
      ['Best castle', G.STAGES[s.bestStage].name],
      ['Save version', 'v' + G.SAVE_VERSION],
    ];
    $('statsList').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  }

  // ---- lifecycle ------------------------------------------------------------

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
    else tick();
  });
  window.addEventListener('pagehide', save);
  window.addEventListener('beforeunload', save);

  function start() {
    state = load();
    applyMotionSetting();
    syncBuyAmount();
    const away = (now() - state.savedAt) / 1000;
    const result = G.applyOffline(state, away > 0 ? away : 0);
    lastTick = now();
    updateAll();
    showAway(result);
    if (loadNote) toast(loadNote);
    save();
    setInterval(tick, TICK_MS);
    setInterval(save, AUTOSAVE_MS);
  }

  // Expose a tiny hook for automated tests.
  window.__castleKeep = { get state() { return state; }, save, tick, G };

  start();
})();
