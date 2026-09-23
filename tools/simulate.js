#!/usr/bin/env node
/* Headless pacing simulation for Castle Keep.
 * Plays the real game rules (js/game.js) with a simple strategy and prints when each
 * castle stage is reached.  Usage: node tools/simulate.js [--cps 2] [--hours 96] */
'use strict';
const G = require('../js/game.js');

const args = process.argv.slice(2);
const opt = (name, d) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const CPS = opt('cps', 2); // taps per second while actively playing
const HOURS = opt('hours', 96);
const FIRST_SESSION = opt('first', 60) * 60; // first sitting, seconds
const CHECKIN_EVERY = opt('every', 3) * 3600; // time between later check-ins while awake
const CHECKIN_LEN = opt('len', 5) * 60; // length of later check-ins
const AWAKE = [9, 23]; // play between 09:00 and 23:00; the game starts at 09:00 on day 1
const TRACE = args.includes('--trace'); // print a status line at every check-in

// Deterministic RNG so runs are repeatable.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build the list of [start, end] active windows (seconds since start). */
function schedule() {
  const out = [[0, FIRST_SESSION]];
  let t = FIRST_SESSION + CHECKIN_EVERY;
  while (t < HOURS * 3600) {
    const hour = (9 + t / 3600) % 24;
    if (hour >= AWAKE[0] && hour < AWAKE[1]) {
      out.push([t, t + CHECKIN_LEN]);
      t += CHECKIN_EVERY;
    } else {
      t += 600; // asleep: try again in 10 minutes
    }
  }
  return out;
}

function effectiveRates(s) {
  const r = G.rates(s);
  r.gold += G.clickValue(s) * CPS;
  return r;
}

const RES_WORKER = { wood: ['woodcutter'], stone: ['mason'], gold: ['peasant', 'merchant'] };

/** One round of shopping. Returns a list of purchase names made. */
function shop(s, log, t) {
  let bought = true;
  let guard = 0;
  while (bought && guard++ < 500) {
    bought = false;
    // 1. Any affordable building, stage upgrades first.
    const avail = G.BUILDINGS.filter((b) => G.buildingAvailable(s, b));
    avail.sort((a, b) => (b.stageUp ? 1 : 0) - (a.stageUp ? 1 : 0));
    for (const b of avail) {
      if (G.canAfford(s, b.cost)) {
        G.buyBuilding(s, b.id);
        log.push({ t, what: b.name });
        bought = true;
        break;
      }
    }
    if (bought) continue;

    // 2. Pick the building we're saving for (quickest to afford) and feed its bottleneck.
    const r = effectiveRates(s);
    let target = null, best = Infinity;
    for (const b of avail) {
      const tt = G.timeToAfford(s, b.cost, r);
      if (tt < best) { best = tt; target = b; }
    }
    let wanted;
    if (!target) {
      // Everything built: grow the weakest resource.
      wanted = ['gold', 'wood', 'stone'];
    } else {
      // resources ordered by how long they hold up the target
      wanted = Object.keys(target.cost)
        .map((k) => [k, Math.max(0, target.cost[k] - s.res[k]) / Math.max(r[k], 1e-9)])
        .sort((a, b) => b[1] - a[1]).map((x) => x[0]);
      // also need to unlock a missing producer? then only buy things that don't delay the target
    }
    // Candidate workers producing the most-needed resource, best cost-effectiveness first.
    for (const res of wanted) {
      const cands = RES_WORKER[res].filter((id) => G.workerUnlocked(s, id)).map((id) => {
        const cost = G.workerCost(s, id, 1);
        const price = Object.values(cost).reduce((a, b) => a + b, 0);
        return { id, cost, value: G.workerEach(s, id) / price };
      }).sort((a, b) => b.value - a.value);
      const c = cands[0];
      if (!c) continue;
      // Don't spend a resource the target needs if it would push the target back a lot.
      let ok = G.canAfford(s, c.cost);
      if (ok && target && best < Infinity) {
        const after = JSON.parse(JSON.stringify(s));
        G.buyWorker(after, c.id, 1);
        const delay = G.timeToAfford(after, target.cost, effectiveRates(after)) - best;
        ok = delay <= Math.max(1, best * 0.05);
      }
      if (ok) {
        G.buyWorker(s, c.id, 1);
        bought = true;
        break;
      }
    }
  }
}

/** True when the next castle stage is more than 2 hours of production away. */
function isStuck(s) {
  const next = G.BUILDINGS.find((b) => b.stageUp && G.buildingAvailable(s, b));
  return !next || G.timeToAfford(s, next.cost) > 2 * 3600;
}

function run(usePrestige) {
  const rng = mulberry32(42);
  const s = G.newState(0, rng);
  const windows = schedule();
  const log = [];
  const stageTimes = [{ stage: 0, wall: 0, active: 0, gen: 1 }];
  const firstBuys = [];
  let active = 0;
  let now = 0;
  let lastStage = 0;
  let prestiges = [];
  const recordStage = () => {
    const st = G.stageOf(s);
    if (st > lastStage) {
      for (let k = lastStage + 1; k <= st; k++) {
        if (!stageTimes.find((x) => x.stage === k)) stageTimes.push({ stage: k, wall: now, active, gen: s.generation });
      }
    }
    lastStage = st;
  };

  for (const [start, end] of windows) {
    if (start > now) {
      G.applyOffline(s, start - now);
      now = start;
    }
    if (TRACE) {
      const R = G.rates(s);
      console.log(`  [${G.fmtTime(now).padStart(7)}] gen ${s.generation} stage ${G.stageOf(s)} ` +
        `rates g/w/s ${G.fmt(R.gold)}/${G.fmt(R.wood)}/${G.fmt(R.stone)} legacy ${s.legacy} (+${G.legacyGain(s)} avail) ` +
        `workers ${Object.values(s.workers).join('/')}`);
    }
    for (; now < end; now += 1) {
      for (let c = 0; c < CPS; c++) G.click(s);
      G.advance(s, 1, false);
      active += 1;
      const n = log.length;
      shop(s, log, now);
      if (firstBuys.length < 3) for (let i = n; i < log.length && firstBuys.length < 3; i++) firstBuys.push(log[i]);
      recordStage();
      if (stageTimes.find((x) => x.stage === 5)) break;
      if (usePrestige && G.canPrestige(s) && isStuck(s)) {
        const gain = G.legacyGain(s);
        // Pass the crown when the next castle stage is hours away and it would at least double Legacy.
        if (gain >= Math.max(10, s.legacy)) {
          prestiges.push({ wall: now, gain, total: s.legacy + gain, fromStage: G.stageOf(s) });
          G.prestige(s, now, rng);
          lastStage = 0;
        }
      }
    }
    if (stageTimes.find((x) => x.stage === 5)) break;
  }
  return { stageTimes, firstBuys, prestiges, s, log };
}

function hms(sec) {
  return G.fmtTime(sec).padStart(8);
}

console.log(`Castle Keep pacing sim — ${CPS} taps/s while active; first sitting ${FIRST_SESSION / 60} min, ` +
  `then ${CHECKIN_LEN / 60}-min check-ins every ${CHECKIN_EVERY / 3600}h between ${AWAKE[0]}:00–${AWAKE[1]}:00 (offline cap ${G.OFFLINE_CAP / 3600}h). Events ignored.\n`);

for (const usePrestige of [false, true]) {
  const { stageTimes, firstBuys, prestiges, s } = run(usePrestige);
  console.log(usePrestige ? '== Strategy B: passes the crown when the next stage is >2h away and Legacy would at least double (min +10) ==' : '== Strategy A: never passes the crown ==');
  if (!usePrestige) {
    console.log('First purchases: ' + firstBuys.map((b) => `${b.what} @ ${G.fmtTime(b.t)}`).join(', '));
  }
  console.log('Stage              wall clock   active play   generation');
  for (let k = 0; k < G.STAGES.length; k++) {
    // report the first time each stage was reached
    const x = stageTimes.find((y) => y.stage === k);
    const name = G.STAGES[k].name.padEnd(16);
    if (!x) console.log(`${k + 1} ${name}   (not reached in ${HOURS}h)`);
    else console.log(`${k + 1} ${name} ${hms(x.wall)}      ${hms(x.active)}        ${x.gen}`);
  }
  for (const p of prestiges) console.log(`   passed the crown @ ${G.fmtTime(p.wall)} (+${p.gain} Legacy → ${p.total}) from ${G.STAGES[p.fromStage].name}`);
  console.log(`   workers at end: ${JSON.stringify(s.workers)}\n`);
}
