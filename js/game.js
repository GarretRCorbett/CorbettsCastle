/* Castle Keep — game data and rules.
 * No DOM access here: this file is shared by the page and tools/simulate.js. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CastleKeep = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SAVE_VERSION = 1;
  const OFFLINE_CAP = 12 * 3600; // seconds
  const MILESTONE = 25; // every N of one worker doubles that worker
  const LEGACY_BONUS = 0.1; // +10% production per Legacy point
  const PRESTIGE_STAGE = 3; // Walled Castle

  const RESOURCES = [
    { id: 'gold', name: 'Gold' },
    { id: 'wood', name: 'Wood' },
    { id: 'stone', name: 'Stone' },
  ];

  const STAGES = [
    { name: 'Watchtower', blurb: 'One wooden tower, one ladder, one very optimistic flag. Technically a castle.' },
    { name: 'Palisade', blurb: 'A ring of pointy logs. Wolves are unimpressed, but it keeps the goats in.' },
    { name: 'Stone Keep', blurb: 'Real stone! The neighbours have started calling you "my liege", mostly sarcastically.' },
    { name: 'Walled Castle', blurb: 'Curtain walls, corner towers, and a gate that actually closes. The crown may now be passed.' },
    { name: 'Fortress', blurb: 'Two rings of walls. Invaders take one look and decide to invade somewhere cosier.' },
    { name: 'Grand Citadel', blurb: 'Spires. Gold. A dragon who insists it is a very large cat. You have made it.' },
  ];

  const WORKERS = [
    { id: 'peasant', name: 'Peasant', plural: 'Peasants', res: 'gold', rate: 0.3, cost: { gold: 10 }, growth: 1.15,
      desc: 'Pays taxes in exchange for being allowed to exist near your tower.' },
    { id: 'woodcutter', name: 'Woodcutter', plural: 'Woodcutters', res: 'wood', rate: 0.4, cost: { gold: 20 }, growth: 1.15,
      desc: 'Hits trees. Trees become wood. A simple, honest trade.' },
    { id: 'mason', name: 'Mason', plural: 'Masons', res: 'stone', rate: 0.3, cost: { gold: 200, wood: 60 }, growth: 1.15,
      desc: 'Knows exactly which rocks are the good rocks.' },
    { id: 'merchant', name: 'Merchant', plural: 'Merchants', res: 'gold', rate: 8, cost: { gold: 2500, stone: 400 }, growth: 1.15,
      desc: 'Sells things to people who did not know they needed them.' },
  ];

  // effect: { workers: {id: mult}, all: mult, click: mult, clickPct: fraction of gold/s per tap, unlock: workerId }
  // stageUp: building this moves the castle to that stage index.
  const BUILDINGS = [
    // Stage 0 — Watchtower
    { id: 'signalFire', name: 'Signal Fire', stage: 0, cost: { gold: 10 }, effect: { click: 2 },
      desc: 'Taps earn double.', flavor: 'Lets everyone know you are open for business.' },
    { id: 'woodshed', name: 'Woodshed', stage: 0, cost: { gold: 20 }, effect: { unlock: 'woodcutter' },
      desc: 'Unlocks Woodcutters.', flavor: 'Somewhere to keep axes that is not under the bed.' },
    { id: 'turnips', name: 'Turnip Patch', stage: 0, cost: { gold: 60, wood: 15 }, effect: { workers: { peasant: 2 } },
      desc: 'Peasants ×2.', flavor: 'Nobody works hard on an empty stomach. Or on a full one, really, but it helps.' },
    { id: 'palisade', name: 'Raise the Palisade', stage: 0, stageUp: 1, cost: { gold: 120, wood: 40 },
      desc: 'Castle upgrade → Palisade.', flavor: 'Pointy logs, arranged in a circle. Very defensive.' },

    // Stage 1 — Palisade
    { id: 'well', name: 'Village Well', stage: 1, cost: { gold: 400, wood: 150 }, effect: { workers: { peasant: 2 } },
      desc: 'Peasants ×2.', flavor: 'Wishes not included. Water is.' },
    { id: 'quarry', name: 'Quarry', stage: 1, cost: { gold: 500, wood: 200 }, effect: { unlock: 'mason' },
      desc: 'Unlocks Masons.', flavor: 'A hole in the ground that produces smaller holes in your treasury.' },
    { id: 'axes', name: 'Sharper Axes', stage: 1, cost: { gold: 700, wood: 250 }, effect: { workers: { woodcutter: 2 } },
      desc: 'Woodcutters ×2.', flavor: 'The old ones were, frankly, spoons.' },
    { id: 'taxBell', name: 'Tax Bell', stage: 1, cost: { gold: 1200, wood: 300 }, effect: { clickPct: 0.05 },
      desc: 'Taps also collect 5% of your gold/sec.', flavor: 'Ding ding. Pay up. Ding.' },
    { id: 'stoneKeep', name: 'Build a Stone Keep', stage: 1, stageUp: 2, cost: { gold: 3000, wood: 1200, stone: 250 },
      desc: 'Castle upgrade → Stone Keep.', flavor: 'The wooden tower had a good run. It is now firewood.' },

    // Stage 2 — Stone Keep
    { id: 'cottages', name: 'Cottages', stage: 2, cost: { gold: 6000, wood: 2500 }, effect: { workers: { peasant: 3 } },
      desc: 'Peasants ×3.', flavor: 'Thatched roofs, window boxes, one cat each. Mandatory.' },
    { id: 'market', name: 'Market Square', stage: 2, cost: { gold: 8000, wood: 3000, stone: 800 }, effect: { unlock: 'merchant' },
      desc: 'Unlocks Merchants.', flavor: 'Now selling: slightly bruised apples, lightly used swords.' },
    { id: 'sawmill', name: 'Sawmill', stage: 2, cost: { gold: 12000, stone: 1200 }, effect: { workers: { woodcutter: 3 } },
      desc: 'Woodcutters ×3.', flavor: 'A water wheel does the boring bit.' },
    { id: 'lodge', name: "Masons' Lodge", stage: 2, cost: { gold: 20000, wood: 6000 }, effect: { workers: { mason: 3 } },
      desc: 'Masons ×3.', flavor: 'Secret handshake optional. Secret biscuits compulsory.' },
    { id: 'banners', name: 'Royal Banners', stage: 2, cost: { gold: 40000, wood: 8000, stone: 3000 }, effect: { all: 1.5 },
      desc: 'All production ×1.5.', flavor: 'Morale is up 50%. Flag budget is up 400%.' },
    { id: 'curtainWalls', name: 'Raise Curtain Walls', stage: 2, stageUp: 3, cost: { gold: 1.6e6, wood: 4e5, stone: 2e5 },
      desc: 'Castle upgrade → Walled Castle.', flavor: 'Big walls. Corner towers. An actual gate. You have arrived.' },

    // Stage 3 — Walled Castle
    { id: 'gatehouse', name: 'Gatehouse', stage: 3, cost: { gold: 600000, stone: 100000 }, effect: { workers: { merchant: 3 } },
      desc: 'Merchants ×3.', flavor: 'Toll: one coin, or one good joke.' },
    { id: 'moat', name: 'Moat', stage: 3, cost: { gold: 1.5e6, wood: 3e5, stone: 2e5 }, effect: { all: 2 },
      desc: 'All production ×2.', flavor: 'Now with ducks. The ducks are not optional.' },
    { id: 'tavern', name: 'Tavern', stage: 3, cost: { gold: 4e6, wood: 8e5 }, effect: { workers: { peasant: 4 } },
      desc: 'Peasants ×4.', flavor: 'The Tipsy Turret. Serves soup and gossip.' },
    { id: 'windmill', name: 'Windmill', stage: 3, cost: { gold: 1e7, wood: 2e6, stone: 1e6 }, effect: { workers: { mason: 3, woodcutter: 3 } },
      desc: 'Masons ×3, Woodcutters ×3.', flavor: 'Grinds flour. Also grinds the gears of the neighbouring baron.' },
    { id: 'outerBailey', name: 'Build the Outer Bailey', stage: 3, stageUp: 4, cost: { gold: 5e8, wood: 3e7, stone: 2e7 },
      desc: 'Castle upgrade → Fortress.', flavor: 'If one wall is good, two walls are… more.' },

    // Stage 4 — Fortress
    { id: 'drawbridge', name: 'Drawbridge', stage: 4, cost: { gold: 2e9, stone: 1e8 }, effect: { workers: { merchant: 4 } },
      desc: 'Merchants ×4.', flavor: 'Up, down, up, down. The children love it.' },
    { id: 'greatHall', name: 'Great Hall', stage: 4, cost: { gold: 8e9, wood: 4e8, stone: 4e8 }, effect: { all: 2 },
      desc: 'All production ×2.', flavor: 'Long tables, longer speeches.' },
    { id: 'barracks', name: 'Barracks', stage: 4, cost: { gold: 3e10, wood: 1.5e9 }, effect: { workers: { mason: 4, peasant: 4 } },
      desc: 'Masons ×4, Peasants ×4.', flavor: 'The guards help lift rocks between naps.' },
    { id: 'lumberYard', name: 'Lumber Yard', stage: 4, cost: { gold: 1e11, stone: 5e9 }, effect: { workers: { woodcutter: 5 } },
      desc: 'Woodcutters ×5.', flavor: 'More logs than a very long diary.' },
    { id: 'grandCitadel', name: 'Crown the Citadel', stage: 4, stageUp: 5, cost: { gold: 2e12, wood: 1e11, stone: 1e11 },
      desc: 'Castle upgrade → Grand Citadel.', flavor: 'Spires so tall the clouds have to go around.' },

    // Stage 5 — Grand Citadel
    { id: 'goldenRoofs', name: 'Golden Roofs', stage: 5, cost: { gold: 1e13, stone: 5e11 }, effect: { all: 2 },
      desc: 'All production ×2.', flavor: 'Visible from space. Nobody knows what space is yet.' },
    { id: 'dragonRoost', name: 'Dragon Roost', stage: 5, cost: { gold: 5e13, wood: 2e12, stone: 2e12 }, effect: { click: 10, workers: { merchant: 3 } },
      desc: 'Taps ×10, Merchants ×3.', flavor: 'The dragon has agreed to guard the castle in exchange for chin scratches.' },
    { id: 'gardens', name: 'Royal Gardens', stage: 5, cost: { gold: 2e14, wood: 1e13, stone: 1e13 }, effect: { all: 3 },
      desc: 'All production ×3.', flavor: 'Hedges shaped like previous rulers. Most of them are flattered.' },
  ];

  const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
  const WORKER_BY_ID = Object.fromEntries(WORKERS.map((w) => [w.id, w]));

  const NAMES = ['Wigbert', 'Mildred', 'Osric', 'Gwendolyn', 'Barnaby', 'Petronella', 'Humphrey', 'Agatha', 'Tobias',
    'Rosalind', 'Cuthbert', 'Winifred', 'Aldous', 'Ysolde', 'Edmund', 'Marigold', 'Percival', 'Beatrix', 'Godfrey', 'Maud'];
  const EPITHETS = ['the Adequate', 'the Mostly Brave', 'the Well-Rested', 'the Punctual', 'the Slightly Damp',
    'Goose-Friend', 'the Magnificent (Allegedly)', 'the Tall-ish', 'the Thrifty', 'the Persistent', 'the Snack-Bearer',
    'the Unbothered', 'the Reasonably Wise', 'the Early Riser', 'the Pleasant'];

  function rulerName(seed) {
    return NAMES[seed % NAMES.length] + ' ' + EPITHETS[Math.floor(seed / NAMES.length) % EPITHETS.length];
  }

  function randomSeed(rng) {
    return Math.floor((rng || Math.random)() * NAMES.length * EPITHETS.length);
  }

  function emptyRes() {
    return { gold: 0, wood: 0, stone: 0 };
  }

  function newState(now, rng) {
    return {
      v: SAVE_VERSION,
      res: emptyRes(),
      workers: { peasant: 0, woodcutter: 0, mason: 0, merchant: 0 },
      built: {},
      legacy: 0,
      generation: 1,
      rulerSeed: randomSeed(rng),
      buffs: [], // { id, kind: 'prod'|'click', mult, t }
      nextEventIn: 90,
      stats: {
        runGold: 0, // gold earned this generation (drives Legacy)
        totalGold: 0,
        clicks: 0,
        playTime: 0, // seconds with the game open
        runTime: 0, // seconds of game time this generation, incl. offline
        bestStage: 0,
        createdAt: now,
        runStartedAt: now,
      },
      settings: { reduceMotion: null, buyAmount: 1 }, // null = follow the system
      savedAt: now,
    };
  }

  // ---- derived values -------------------------------------------------------

  function stageOf(s) {
    let st = 0;
    for (const b of BUILDINGS) if (b.stageUp && s.built[b.id] && b.stageUp > st) st = b.stageUp;
    return st;
  }

  function workerUnlocked(s, id) {
    if (id === 'peasant') return true;
    return BUILDINGS.some((b) => b.effect && b.effect.unlock === id && s.built[b.id]);
  }

  function buffMult(s, kind) {
    let m = 1;
    for (const b of s.buffs) if (b.kind === kind) m *= b.mult;
    return m;
  }

  function globalMult(s) {
    let m = 1 + LEGACY_BONUS * s.legacy;
    for (const b of BUILDINGS) if (s.built[b.id] && b.effect && b.effect.all) m *= b.effect.all;
    return m * buffMult(s, 'prod');
  }

  function workerMult(s, id) {
    let m = Math.pow(2, Math.floor(s.workers[id] / MILESTONE));
    for (const b of BUILDINGS) {
      if (s.built[b.id] && b.effect && b.effect.workers && b.effect.workers[id]) m *= b.effect.workers[id];
    }
    return m;
  }

  /** Production per second of one more worker of this type (at current multipliers). */
  function workerEach(s, id) {
    const w = WORKER_BY_ID[id];
    return w.rate * workerMult(s, id) * globalMult(s);
  }

  function rates(s) {
    const r = emptyRes();
    const g = globalMult(s);
    for (const w of WORKERS) r[w.res] += s.workers[w.id] * w.rate * workerMult(s, w.id) * g;
    return r;
  }

  function clickValue(s) {
    let base = 1;
    let pct = 0;
    for (const b of BUILDINGS) {
      if (!s.built[b.id] || !b.effect) continue;
      if (b.effect.click) base *= b.effect.click;
      if (b.effect.clickPct) pct += b.effect.clickPct;
    }
    base *= 1 + LEGACY_BONUS * s.legacy;
    return (base + pct * rates(s).gold) * buffMult(s, 'click');
  }

  // ---- costs ----------------------------------------------------------------

  function workerCost(s, id, n) {
    const w = WORKER_BY_ID[id];
    const c = s.workers[id];
    const g = w.growth;
    const factor = Math.pow(g, c) * (Math.pow(g, n) - 1) / (g - 1);
    const out = {};
    for (const r in w.cost) out[r] = w.cost[r] * factor;
    return out;
  }

  function maxAffordable(s, id) {
    const w = WORKER_BY_ID[id];
    const c = s.workers[id];
    const g = w.growth;
    let n = Infinity;
    for (const r in w.cost) {
      const first = w.cost[r] * Math.pow(g, c);
      const k = Math.floor(Math.log((s.res[r] * (g - 1)) / first + 1) / Math.log(g));
      n = Math.min(n, k);
    }
    n = Math.max(0, n);
    // guard against floating point edge cases
    while (n > 0 && !canAfford(s, workerCost(s, id, n))) n--;
    return n;
  }

  function canAfford(s, cost) {
    for (const r in cost) if (s.res[r] < cost[r] - 1e-9) return false;
    return true;
  }

  function pay(s, cost) {
    for (const r in cost) s.res[r] = Math.max(0, s.res[r] - cost[r]);
  }

  /** Seconds until cost is affordable at current rates (0 if affordable, Infinity if never). */
  function timeToAfford(s, cost, r) {
    r = r || rates(s);
    let t = 0;
    for (const k in cost) {
      const need = cost[k] - s.res[k];
      if (need <= 0) continue;
      if (r[k] <= 0) return Infinity;
      t = Math.max(t, need / r[k]);
    }
    return t;
  }

  // ---- actions --------------------------------------------------------------

  function buyWorker(s, id, n) {
    if (!workerUnlocked(s, id) || n < 1) return false;
    const cost = workerCost(s, id, n);
    if (!canAfford(s, cost)) return false;
    pay(s, cost);
    s.workers[id] += n;
    return true;
  }

  function buildingAvailable(s, b) {
    return !s.built[b.id] && stageOf(s) >= b.stage;
  }

  function buyBuilding(s, id) {
    const b = BUILDING_BY_ID[id];
    if (!b || !buildingAvailable(s, b) || !canAfford(s, b.cost)) return false;
    pay(s, b.cost);
    s.built[id] = true;
    const st = stageOf(s);
    if (st > s.stats.bestStage) s.stats.bestStage = st;
    return true;
  }

  function earn(s, res, amount) {
    s.res[res] += amount;
    if (res === 'gold') {
      s.stats.runGold += amount;
      s.stats.totalGold += amount;
    }
  }

  function click(s) {
    const v = clickValue(s);
    earn(s, 'gold', v);
    s.stats.clicks++;
    return v;
  }

  /** Advance the simulation by dt seconds of production. Returns resources gained. */
  function advance(s, dt, offline) {
    if (!(dt > 0)) return emptyRes();
    if (offline) s.buffs = []; // boosts don't carry over time away
    const r = rates(s);
    const gained = emptyRes();
    for (const k in r) {
      gained[k] = r[k] * dt;
      earn(s, k, gained[k]);
    }
    s.stats.runTime += dt;
    if (!offline) {
      s.stats.playTime += dt;
      for (const b of s.buffs) b.t -= dt;
      s.buffs = s.buffs.filter((b) => b.t > 0);
      s.nextEventIn -= dt;
    }
    return gained;
  }

  /** Apply time away (clamped to OFFLINE_CAP). Returns { seconds, capped, gained }. */
  function applyOffline(s, seconds) {
    const capped = seconds > OFFLINE_CAP;
    const t = Math.max(0, Math.min(seconds, OFFLINE_CAP));
    return { seconds: t, away: seconds, capped, gained: advance(s, t, true) };
  }

  // ---- prestige -------------------------------------------------------------

  function legacyGain(s) {
    return Math.floor(Math.pow(s.stats.runGold / 1e6, 0.5));
  }

  function prestigeUnlocked(s) {
    return s.stats.bestStage >= PRESTIGE_STAGE;
  }

  function canPrestige(s) {
    return stageOf(s) >= PRESTIGE_STAGE && legacyGain(s) >= 1;
  }

  function prestige(s, now, rng) {
    if (!canPrestige(s)) return false;
    const fresh = newState(now, rng);
    fresh.legacy = s.legacy + legacyGain(s);
    fresh.generation = s.generation + 1;
    let seed = randomSeed(rng);
    if (seed === s.rulerSeed) seed = (seed + 1) % (NAMES.length * EPITHETS.length);
    fresh.rulerSeed = seed;
    fresh.settings = s.settings;
    fresh.stats = Object.assign({}, s.stats, { runGold: 0, runTime: 0, runStartedAt: now });
    Object.keys(s).forEach((k) => delete s[k]);
    Object.assign(s, fresh);
    return true;
  }

  // ---- events ---------------------------------------------------------------
  // Rewards scale with current production so they stay relevant all game.

  function secsOf(s, res, secs, floor) {
    return Math.max(floor || 0, rates(s)[res] * secs);
  }

  const EVENTS = [
    {
      id: 'merchant', title: 'A Traveling Merchant',
      text: 'A merchant with a suspiciously large hat offers to swap your spare wood for shiny coins.',
      when: (s) => s.res.wood >= 10,
      choices: [
        { label: 'Trade', hint: (s) => 'Give ' + fmt(Math.min(s.res.wood, secsOf(s, 'wood', 60, 10))) + ' wood for ' + fmt(secsOf(s, 'gold', 180, 60)) + ' gold',
          apply(s) {
            const give = Math.min(s.res.wood, secsOf(s, 'wood', 60, 10));
            const get = secsOf(s, 'gold', 180, 60);
            s.res.wood -= give; earn(s, 'gold', get);
            return 'The merchant tips their enormous hat. +' + fmt(get) + ' gold.';
          } },
        { label: 'No thanks', apply: () => 'The merchant shrugs and tries to sell the hat to a goat.' },
      ],
    },
    {
      id: 'dragon', title: 'Dragon Sighting!',
      text: 'A small dragon is napping on your roof. It seems friendly. It also seems hungry.',
      when: (s) => stageOf(s) >= 1,
      choices: [
        { label: 'Offer a sheep', hint: () => 'All production ×2 for 60s',
          apply(s) { addBuff(s, 'dragon', 'prod', 2, 60); return 'The dragon purrs. Bandits everywhere reconsider their careers. Production ×2!'; } },
        { label: 'Let it sleep', hint: (s) => '+' + fmt(secsOf(s, 'gold', 30, 20)) + ' gold',
          apply(s) { const g = secsOf(s, 'gold', 30, 20); earn(s, 'gold', g); return 'It snores out a few coins and flies off. +' + fmt(g) + ' gold.'; } },
      ],
    },
    {
      id: 'decree', title: 'A Royal Decree',
      text: '"By order of the Crown, all taxes shall be paid with twice the enthusiasm." Somebody has to enforce it.',
      when: () => true,
      choices: [
        { label: 'Enforce it', hint: () => 'Taps ×5 for 30s',
          apply(s) { addBuff(s, 'decree', 'click', 5, 30); return 'Enthusiasm mandatory. Taps ×5 for 30 seconds — get tapping!'; } },
        { label: 'Lose it', apply: () => 'The decree is used to prop up a wobbly table. It works great.' },
      ],
    },
    {
      id: 'goose', title: 'Goose Situation',
      text: 'A goose has taken the gate hostage. Its demands are unclear but loud.',
      when: (s) => stageOf(s) >= 1 && s.workers.woodcutter > 0,
      choices: [
        { label: 'Bribe with bread', hint: (s) => '+' + fmt(secsOf(s, 'wood', 90, 20)) + ' wood' + (rates(s).stone > 0 ? ', +' + fmt(secsOf(s, 'stone', 90)) + ' stone' : ''),
          apply(s) {
            const w = secsOf(s, 'wood', 90, 20); const st = secsOf(s, 'stone', 90);
            earn(s, 'wood', w); earn(s, 'stone', st);
            return 'The goose accepts. Grateful workers bring you supplies. +' + fmt(w) + ' wood' + (st > 0 ? ', +' + fmt(st) + ' stone.' : '.');
          } },
        { label: 'Retreat', apply: () => 'The goose wins. The goose always wins.' },
      ],
    },
    {
      id: 'bard', title: 'A Wandering Bard',
      text: 'A bard offers to write a ballad about your castle. It rhymes "keep" with "sheep" eleven times.',
      when: (s) => stageOf(s) >= 2,
      choices: [
        { label: 'Commission it', hint: (s) => 'Costs ' + fmt(s.res.gold * 0.1) + ' gold · production ×1.5 for 120s',
          apply(s) { s.res.gold *= 0.9; addBuff(s, 'bard', 'prod', 1.5, 120); return 'The ballad is catchy. Workers hum while they work. Production ×1.5!'; } },
        { label: 'Decline politely', apply: () => 'The bard writes a ballad about you anyway. It is mostly about your hat.' },
      ],
    },
    {
      id: 'knight', title: 'A Lost Knight',
      text: 'A knight in very shiny armour asks for directions to "any quest, really".',
      when: (s) => s.workers.peasant > 0,
      choices: [
        { label: 'Point the way', hint: (s) => '+' + fmt(secsOf(s, 'gold', 120, 50)) + ' gold',
          apply(s) { const g = secsOf(s, 'gold', 120, 50); earn(s, 'gold', g); return 'The knight pays for the advice and gallops off. The wrong way. +' + fmt(g) + ' gold.'; } },
        { label: 'Offer tea', hint: () => 'Taps ×3 for 45s',
          apply(s) { addBuff(s, 'knight', 'click', 3, 45); return 'The knight helps collect taxes between sips. Taps ×3!'; } },
      ],
    },
  ];

  function addBuff(s, id, kind, mult, t) {
    s.buffs = s.buffs.filter((b) => b.id !== id);
    s.buffs.push({ id, kind, mult, t });
  }

  function pickEvent(s, rng) {
    const pool = EVENTS.filter((e) => e.when(s));
    if (!pool.length) return null;
    return pool[Math.floor((rng || Math.random)() * pool.length)];
  }

  function scheduleNextEvent(s, rng) {
    s.nextEventIn = 120 + (rng || Math.random)() * 120;
  }

  // ---- formatting -----------------------------------------------------------

  const UNITS = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 0) return '-' + fmt(-n);
    if (n < 1000) return String(Math.floor(n));
    const i = Math.floor(Math.log10(n) / 3);
    if (i > UNITS.length) return n.toExponential(2).replace('e+', 'e');
    const v = n / Math.pow(10, 3 * i);
    if (v >= 100) return Math.floor(v) + UNITS[i - 1];
    return (Math.floor(v * 10) / 10).toFixed(1) + UNITS[i - 1];
  }

  function fmtRate(n) {
    if (n > 0 && n < 10) return (Math.floor(n * 10) / 10).toFixed(1);
    return fmt(n);
  }

  function fmtTime(sec) {
    if (!isFinite(sec)) return '—';
    sec = Math.max(0, Math.round(sec));
    const d = Math.floor(sec / 86400), h = Math.floor(sec / 3600) % 24, m = Math.floor(sec / 60) % 60, x = sec % 60;
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + (x ? x + 's' : '');
    return x + 's';
  }

  // ---- saving ---------------------------------------------------------------

  // MIGRATIONS[n] upgrades a save from version n to n + 1.
  const MIGRATIONS = {};

  function num(x, d) {
    return typeof x === 'number' && isFinite(x) ? x : d;
  }

  function serialize(s, now) {
    s.savedAt = now;
    return JSON.stringify(s);
  }

  /** Parse and upgrade a save. Throws on anything unusable. */
  function deserialize(str, now) {
    let data = typeof str === 'string' ? JSON.parse(str) : str;
    if (!data || typeof data !== 'object' || typeof data.v !== 'number') throw new Error('Not a Castle Keep save');
    if (data.v > SAVE_VERSION) throw new Error('This save is from a newer version of the game');
    while (data.v < SAVE_VERSION) {
      const m = MIGRATIONS[data.v];
      if (!m) throw new Error('No upgrade path for save version ' + data.v);
      data = m(data);
    }
    // Merge onto fresh defaults so missing or bad fields can't break the game.
    const s = newState(now);
    for (const r of RESOURCES) s.res[r.id] = Math.max(0, num(data.res && data.res[r.id], 0));
    for (const w of WORKERS) s.workers[w.id] = Math.max(0, Math.floor(num(data.workers && data.workers[w.id], 0)));
    for (const b of BUILDINGS) if (data.built && data.built[b.id]) s.built[b.id] = true;
    s.legacy = Math.max(0, Math.floor(num(data.legacy, 0)));
    s.generation = Math.max(1, Math.floor(num(data.generation, 1)));
    s.rulerSeed = Math.max(0, Math.floor(num(data.rulerSeed, s.rulerSeed)));
    s.nextEventIn = num(data.nextEventIn, s.nextEventIn);
    if (Array.isArray(data.buffs)) {
      s.buffs = data.buffs.filter((b) => b && typeof b.id === 'string' && (b.kind === 'prod' || b.kind === 'click'))
        .map((b) => ({ id: b.id, kind: b.kind, mult: num(b.mult, 1), t: num(b.t, 0) })).filter((b) => b.t > 0);
    }
    if (data.stats) for (const k in s.stats) s.stats[k] = num(data.stats[k], s.stats[k]);
    s.stats.bestStage = Math.max(s.stats.bestStage, stageOf(s));
    if (data.settings) {
      const rm = data.settings.reduceMotion;
      s.settings.reduceMotion = rm === true || rm === false ? rm : null;
      s.settings.buyAmount = [1, 10, 'max'].includes(data.settings.buyAmount) ? data.settings.buyAmount : 1;
    }
    s.savedAt = num(data.savedAt, now);
    return s;
  }

  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  function b64decode(str) {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  const EXPORT_PREFIX = 'CASTLEKEEP:';

  function exportCode(s, now) {
    return EXPORT_PREFIX + b64encode(serialize(s, now));
  }

  function importCode(code, now) {
    let c = String(code || '').replace(/\s+/g, '');
    if (c.startsWith(EXPORT_PREFIX)) c = c.slice(EXPORT_PREFIX.length);
    let json;
    try { json = b64decode(c); } catch (e) { throw new Error('That code is not a valid save'); }
    let data;
    try { data = JSON.parse(json); } catch (e) { throw new Error('That code is not a valid save'); }
    return deserialize(data, now);
  }

  return {
    SAVE_VERSION, OFFLINE_CAP, MILESTONE, LEGACY_BONUS, PRESTIGE_STAGE,
    RESOURCES, STAGES, WORKERS, BUILDINGS, BUILDING_BY_ID, WORKER_BY_ID, EVENTS,
    newState, stageOf, workerUnlocked, rates, globalMult, workerMult, workerEach, clickValue,
    workerCost, maxAffordable, canAfford, timeToAfford, buyWorker, buildingAvailable, buyBuilding,
    click, advance, applyOffline, legacyGain, prestigeUnlocked, canPrestige, prestige,
    pickEvent, scheduleNextEvent, rulerName, fmt, fmtRate, fmtTime,
    serialize, deserialize, exportCode, importCode,
  };
});
