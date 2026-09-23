/* Castle Keep — the castle scene, drawn as SVG from game state. */
(function (root) {
  'use strict';

  const C = {
    wood: '#a8733f', woodDark: '#6f4724', woodLight: '#c89a62',
    roof: '#c4553d', roofDark: '#963b2a',
    stone: '#bdb6a6', stoneDark: '#8e8778', stoneLight: '#d8d2c3', stoneShade: '#a39c8c',
    slate: '#56698f', slateDark: '#3f4f70', gold: '#e8b93a', goldDark: '#b88a1e',
    win: '#3b2e2a', banner: '#c8373a', bannerDark: '#9c2427', trim: '#f2c14e',
    water: '#5aa6d6', waterLight: '#8cc8ea', leaf: '#4f9a3c', leafDark: '#3b7a2d',
    grass: '#86c262', path: '#d8b98a', soil: '#8a5f3a',
  };

  const BASE = 198; // ground line under the main castle

  function rect(x, y, w, h, fill, extra) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
  }
  function poly(points, fill, extra) {
    return `<polygon points="${points}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
  }
  function path(d, fill, extra) {
    return `<path d="${d}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
  }

  /** Crenellations: merlons along the top of a wall. */
  function merlons(x, y, w, fill, size) {
    size = size || 7;
    let out = '';
    const n = Math.max(2, Math.round(w / (size * 1.6)));
    const step = (w - size) / (n - 1);
    for (let i = 0; i < n; i++) out += rect((x + i * step).toFixed(1), y - size, size, size, fill);
    return out;
  }

  /** A block of stone wall with crenellations and a few brick marks. */
  function stoneWall(x, y, w, h, opts) {
    opts = opts || {};
    const fill = opts.fill || C.stone;
    let out = rect(x, y, w, h, fill) + merlons(x, y, w, fill, opts.merlon);
    out += rect(x, y, w, 3, C.stoneLight, 'opacity=".6"');
    // brick hints
    for (let yy = y + 10; yy < y + h - 4; yy += 11) {
      for (let xx = x + ((yy / 11) % 2 ? 6 : 14); xx < x + w - 10; xx += 22) {
        out += rect(xx, yy, 9, 2, C.stoneShade, 'opacity=".55"');
      }
    }
    return out;
  }

  function arch(cx, bottom, w, h, fill) {
    const r = w / 2;
    return path(`M${cx - r} ${bottom} V${bottom - h + r} A${r} ${r} 0 0 1 ${cx + r} ${bottom - h + r} V${bottom} Z`, fill);
  }

  function flag(x, y, color, tall) {
    const h = tall || 16;
    return `<g class="flag"><line x1="${x}" y1="${y}" x2="${x}" y2="${y - h}" stroke="${C.woodDark}" stroke-width="1.6"/>` +
      `<path class="flag-cloth" d="M${x + 0.8} ${y - h} L${x + 13} ${y - h + 3.5} L${x + 0.8} ${y - h + 7} Z" fill="${color || C.banner}"/></g>`;
  }

  function coneRoof(cx, y, w, h, fill, dark) {
    return poly(`${cx - w / 2 - 3},${y} ${cx},${y - h} ${cx + w / 2 + 3},${y}`, fill) +
      poly(`${cx},${y - h} ${cx + w / 2 + 3},${y} ${cx + 2},${y}`, dark, 'opacity=".45"');
  }

  function roundTower(cx, top, bottom, w, roofFill, roofDark, roofH) {
    let out = rect(cx - w / 2, top, w, bottom - top, C.stone) +
      rect(cx + w / 6, top, w / 3, bottom - top, C.stoneShade, 'opacity=".5"') +
      arch(cx, top + 26, 6, 12, C.win);
    if (roofFill) out += coneRoof(cx, top, w, roofH || w * 1.1, roofFill, roofDark);
    else out += merlons(cx - w / 2, top, w, C.stone, 6);
    return out;
  }

  function banner(x, y, h) {
    h = h || 22;
    return `<g>${rect(x - 5, y, 10, h, C.banner)}${poly(`${x - 5},${y + h} ${x},${y + h - 5} ${x + 5},${y + h}`, C.stone)}` +
      `${rect(x - 5, y, 10, 2.5, C.trim)}<circle cx="${x}" cy="${y + 9}" r="2.6" fill="${C.trim}"/></g>`;
  }

  function fire(x, y) {
    return `<g class="signal-fire">` +
      rect(x - 4, y - 2, 8, 4, C.woodDark) + `<line x1="${x}" y1="${y + 2}" x2="${x}" y2="${y + 10}" stroke="${C.woodDark}" stroke-width="2"/>` +
      `<path class="flame" d="M${x - 4} ${y - 2} Q${x - 5} ${y - 9} ${x} ${y - 15} Q${x + 5} ${y - 9} ${x + 4} ${y - 2} Z" fill="#ff9f1c"/>` +
      `<path class="flame flame-inner" d="M${x - 2} ${y - 2} Q${x - 2} ${y - 6} ${x} ${y - 10} Q${x + 2} ${y - 6} ${x + 2} ${y - 2} Z" fill="#ffe066"/></g>`;
  }

  // ---- backdrop -------------------------------------------------------------

  function backdrop(stage) {
    let out = `<defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${stage >= 5 ? '#f7b267' : '#79c3ef'}"/>
        <stop offset="1" stop-color="${stage >= 5 ? '#fde4b8' : '#d9f1fb'}"/>
      </linearGradient>
      <clipPath id="sceneClip"><rect width="400" height="280"/></clipPath>
    </defs>`;
    out += rect(0, 0, 400, 280, 'url(#sky)');
    out += `<circle cx="336" cy="48" r="20" fill="#ffe27a"/><circle cx="336" cy="48" r="28" fill="#ffe27a" opacity=".25"/>`;
    out += cloud(60, 42, 1, 'c1') + cloud(250, 28, 0.8, 'c2') + cloud(150, 70, 0.6, 'c3');
    // distant hills
    out += path('M0 170 Q60 130 130 160 T260 150 T400 140 V280 H0 Z', '#a9d68b');
    out += path('M0 190 Q90 160 180 185 T400 175 V280 H0 Z', '#95ca73');
    // main ground and castle mound
    out += path(`M0 214 Q100 200 200 ${BASE} T400 212 V280 H0 Z`, C.grass);
    out += path(`M60 222 Q120 ${BASE - 6} 200 ${BASE - 4} T340 222 Z`, '#7cb959', 'opacity=".7"');
    out += rect(0, 236, 400, 44, '#7ab656');
    // a dirt path down from the gate
    out += path(`M193 ${BASE} L207 ${BASE} L226 280 L174 280 Z`, C.path, 'opacity=".85"');
    return out;
  }

  function cloud(x, y, s, cls) {
    return `<g class="cloud ${cls}"><g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity=".92">` +
      `<ellipse cx="0" cy="0" rx="22" ry="10"/><ellipse cx="14" cy="-6" rx="14" ry="10"/><ellipse cx="-12" cy="-4" rx="11" ry="8"/></g></g>`;
  }

  // ---- main structures per stage -----------------------------------------------
  // Each returns { back, front, fire: [x, y], flags: [[x, y], ...], roof } so extras can attach.

  function watchtower() {
    let s = '';
    s += `<g stroke="${C.woodDark}" stroke-linecap="round">` +
      `<line x1="186" y1="${BASE}" x2="190" y2="124" stroke-width="5"/>` +
      `<line x1="214" y1="${BASE}" x2="210" y2="124" stroke-width="5"/>` +
      `<path d="M188 192 L212 162 M212 192 L188 162 M189 158 L211 130 M211 158 L189 130" stroke-width="2.5" stroke="${C.wood}" fill="none"/></g>`;
    // ladder
    s += `<g stroke="${C.woodLight}" stroke-width="1.6"><line x1="197" y1="${BASE}" x2="198" y2="127"/><line x1="204" y1="${BASE}" x2="203" y2="127"/>`;
    for (let y = BASE - 8; y > 130; y -= 9) s += `<line x1="197" y1="${y}" x2="204" y2="${y}"/>`;
    s += '</g>';
    s += rect(174, 119, 52, 7, C.woodDark);
    s += rect(181, 97, 38, 22, C.wood);
    for (let x = 187; x < 219; x += 7) s += rect(x, 97, 1.2, 22, C.woodDark, 'opacity=".35"');
    s += rect(194, 102, 12, 10, C.win);
    s += poly('174,99 200,74 226,99', C.roof) + poly('200,74 226,99 202,99', C.roofDark, 'opacity=".5"');
    return { back: '', front: s, fire: [232, 118], flags: [[200, 75]] };
  }

  function palisadeRow(x1, x2, base, h, back) {
    let out = '';
    for (let x = x1; x < x2; x += 8) {
      if (x > 186 && x < 210 && !back) continue; // gate gap
      const hh = h + ((x * 7) % 5);
      out += poly(`${x},${base} ${x},${base - hh} ${x + 3.5},${base - hh - 5} ${x + 7},${base - hh} ${x + 7},${base}`,
        back ? '#9a6a3b' : C.wood, back ? '' : `stroke="${C.woodDark}" stroke-width=".8"`);
    }
    return out;
  }

  function palisadeGate(base) {
    return rect(187, base - 22, 23, 22, C.woodDark) +
      `<g stroke="${C.wood}" stroke-width="1.2"><line x1="192" y1="${base - 22}" x2="192" y2="${base}"/><line x1="198.5" y1="${base - 22}" x2="198.5" y2="${base}"/><line x1="205" y1="${base - 22}" x2="205" y2="${base}"/></g>` +
      rect(186, base - 24, 25, 3, C.woodDark);
  }

  function palisade(inner) {
    const w = inner();
    return {
      back: palisadeRow(118, 282, BASE - 8, 18, true) + w.back,
      front: w.front + palisadeRow(112, 290, BASE + 8, 22, false) + palisadeGate(BASE + 8),
      fire: w.fire, flags: w.flags, keepTop: w.keepTop,
    };
  }

  function keep(top, opts) {
    opts = opts || {};
    const x = 168, w = 64;
    let s = stoneWall(x, top, w, BASE - top, { merlon: 8 });
    s += rect(x + w - 12, top, 12, BASE - top, C.stoneShade, 'opacity=".45"');
    // windows
    for (let y = top + 16; y < BASE - 40; y += 30) {
      s += arch(186, y + 14, 8, 14, C.win) + arch(214, y + 14, 8, 14, C.win);
    }
    if (!opts.noDoor) s += arch(200, BASE, 16, 24, C.woodDark) + rect(199.3, BASE - 17, 1.4, 17, C.wood);
    return s;
  }

  function stoneKeep() {
    return { back: '', front: keep(110), fire: [228, 100], flags: [[200, 102]], keepTop: 110 };
  }

  function walled(stage) {
    const fortress = stage >= 4;
    const citadel = stage >= 5;
    let back = '';
    // keep behind the walls, taller
    const kTop = citadel ? 76 : 84;
    back += keep(kTop, { noDoor: true });
    if (fortress) {
      // a side tower attached to the keep
      back += roundTower(246, kTop + 12, BASE, 20, citadel ? 'ROOF' : C.slate, C.slateDark, 26);
    }
    // curtain wall and corner towers
    let front = '';
    front += stoneWall(104, 150, 192, BASE - 150 + 2, { merlon: 7 });
    front += roundTower(98, 124, BASE + 4, 26, 'ROOF', C.slateDark, 30);
    front += roundTower(302, 124, BASE + 4, 26, 'ROOF', C.slateDark, 30);
    front += arch(200, BASE + 2, 22, 30, C.win);
    front += `<g stroke="${C.stoneDark}" stroke-width="1.2" opacity=".8">` +
      [192, 197, 203, 208].map((x) => `<line x1="${x}" y1="${BASE - 22}" x2="${x}" y2="${BASE + 2}"/>`).join('') + '</g>';
    const flags = [[200, kTop - 8], [98, 94], [302, 94]];
    if (fortress) flags.push([246, kTop - 14]);
    return { back, front, fire: [224, kTop - 8], flags, keepTop: kTop };
  }

  function outerWall() {
    let s = stoneWall(62, 184, 276, 30, { merlon: 7, fill: C.stoneLight });
    s += rect(62, 184, 276, 30, C.stoneShade, 'opacity=".15"');
    s += roundTower(56, 156, 218, 30, 'ROOF', C.slateDark, 34);
    s += roundTower(344, 156, 218, 30, 'ROOF', C.slateDark, 34);
    // barbican around the gate
    s += stoneWall(182, 176, 36, 38, { merlon: 6 }) + arch(200, 214, 20, 26, C.win);
    s += `<g stroke="${C.stoneDark}" stroke-width="1.2" opacity=".8">` +
      [193, 198, 203, 208].map((x) => `<line x1="${x}" y1="192" x2="${x}" y2="214"/>`).join('') + '</g>';
    return s;
  }

  function citadelSpires() {
    let s = '';
    s += roundTower(200, 44, 90, 22, 'ROOF', C.slateDark, 40);
    s += roundTower(152, 70, 150, 18, 'ROOF', C.slateDark, 32);
    s += roundTower(248, 64, 150, 18, 'ROOF', C.slateDark, 32);
    return s;
  }

  // ---- village and extras ---------------------------------------------------------

  function house(x, y, w, roofColor, chimney) {
    const h = w * 0.62;
    let s = '';
    if (chimney) s += rect(x + w * 0.66, y - h * 0.9, 5, 10, C.stoneDark) + `<g class="smoke"><circle cx="${x + w * 0.66 + 2.5}" cy="${y - h - 4}" r="3" fill="#fff" opacity=".7"/><circle cx="${x + w * 0.66 + 5}" cy="${y - h - 10}" r="4" fill="#fff" opacity=".5"/></g>`;
    s += rect(x, y - h, w, h, '#f1e2c4') + rect(x, y - h, w, h, C.woodDark, 'opacity=".08"');
    s += poly(`${x - 3},${y - h} ${x + w / 2},${y - h - w * 0.45} ${x + w + 3},${y - h}`, roofColor || '#d49a4a');
    s += rect(x + w / 2 - 3, y - 9, 6, 9, C.woodDark) + rect(x + 3, y - h + 4, 5, 5, C.win);
    return s;
  }

  const EXTRAS = {
    turnips: () => {
      let s = rect(42, 250, 50, 14, C.soil, 'rx="3"');
      for (let x = 47; x < 90; x += 8) for (const y of [253, 260]) s += `<path d="M${x} ${y} l-2 -5 M${x} ${y} l2 -5 M${x} ${y} l0 -6" stroke="${C.leaf}" stroke-width="1.6"/>` + `<circle cx="${x}" cy="${y + 1}" r="1.8" fill="#e7d3e9"/>`;
      return s;
    },
    woodshed: () => rect(334, 226, 34, 20, C.wood) + poly('330,228 351,214 372,228', C.woodDark) +
      rect(346, 234, 9, 12, C.win) + [338, 344, 360, 366].map((x) => `<circle cx="${x}" cy="242" r="2.4" fill="${C.woodLight}" stroke="${C.woodDark}" stroke-width=".8"/>`).join(''),
    axes: () => rect(308, 244, 14, 8, C.woodDark, 'rx="2"') + `<ellipse cx="315" cy="244" rx="7" ry="2.2" fill="${C.woodLight}"/>` +
      `<line x1="315" y1="243" x2="320" y2="233" stroke="${C.woodDark}" stroke-width="1.8"/><path d="M317 236 l6 -2 l-1 5 Z" fill="#9aa3ad"/>` +
      [0, 1, 2].map((i) => `<circle cx="${292 + i * 5}" cy="250" r="2.6" fill="${C.woodLight}" stroke="${C.woodDark}" stroke-width=".8"/>`).join('') +
      `<circle cx="294.5" cy="245.5" r="2.6" fill="${C.woodLight}" stroke="${C.woodDark}" stroke-width=".8"/><circle cx="299.5" cy="245.5" r="2.6" fill="${C.woodLight}" stroke="${C.woodDark}" stroke-width=".8"/>`,
    well: () => `<ellipse cx="96" cy="240" rx="11" ry="4" fill="${C.stoneDark}"/>` + rect(85, 230, 22, 10, C.stone) +
      `<ellipse cx="96" cy="230" rx="11" ry="3.5" fill="${C.water}" stroke="${C.stoneDark}"/>` +
      `<line x1="87" y1="230" x2="87" y2="216" stroke="${C.woodDark}" stroke-width="2"/><line x1="105" y1="230" x2="105" y2="216" stroke="${C.woodDark}" stroke-width="2"/>` +
      poly('82,217 96,208 110,217', C.roof),
    quarry: () => path('M352 206 L360 186 L384 180 L400 186 V210 Z', '#9d978a') +
      rect(362, 192, 10, 7, C.stoneLight) + rect(375, 188, 12, 8, C.stone) + rect(368, 200, 9, 6, C.stoneLight) +
      `<path d="M358 206 L366 198" stroke="${C.stoneDark}" stroke-width="1.2"/>`,
    taxBell: () => `<line x1="238" y1="226" x2="238" y2="202" stroke="${C.woodDark}" stroke-width="2.4"/><line x1="233" y1="203" x2="246" y2="203" stroke="${C.woodDark}" stroke-width="2"/>` +
      path('M240 205 Q240 213 237 216 H249 Q246 213 246 205 Z', C.gold) + `<circle cx="243" cy="217" r="1.5" fill="${C.goldDark}"/>`,
    cottages: () => house(8, 232, 28, '#d49a4a', true) + house(44, 238, 24, '#c9824a', false) + house(138, 262, 26, '#d49a4a', true),
    market: () => {
      let s = '';
      [[228, '#e05d5d'], [256, '#4f8fd6']].forEach(([x, col]) => {
        s += rect(x, 248, 24, 10, C.woodLight) + `<line x1="${x + 1}" y1="258" x2="${x + 1}" y2="238" stroke="${C.woodDark}" stroke-width="1.6"/><line x1="${x + 23}" y1="258" x2="${x + 23}" y2="238" stroke="${C.woodDark}" stroke-width="1.6"/>`;
        for (let i = 0; i < 4; i++) s += rect(x - 2 + i * 7, 236, 7, 6, i % 2 ? '#fff' : col);
        s += `<circle cx="${x + 7}" cy="246" r="2.4" fill="#e74c3c"/><circle cx="${x + 13}" cy="246" r="2.4" fill="#f39c12"/><circle cx="${x + 18}" cy="246" r="2.4" fill="#8bc34a"/>`;
      });
      return s;
    },
    sawmill: () => rect(352, 252, 40, 20, C.wood) + poly('348,254 372,240 396,254', C.roofDark) +
      `<g class="wheel" style="transform-origin:352px 266px"><circle cx="352" cy="266" r="10" fill="none" stroke="${C.woodDark}" stroke-width="2"/>` +
      [0, 45, 90, 135].map((a) => `<line x1="342" y1="266" x2="362" y2="266" stroke="${C.woodDark}" stroke-width="1.6" transform="rotate(${a} 352 266)"/>`).join('') + '</g>' +
      path('M334 280 Q345 272 360 276 T400 272 V280 Z', C.water, 'opacity=".85"'),
    lodge: () => rect(286, 262, 40, 18, C.stoneLight) + poly('282,264 306,250 330,264', C.slate) + arch(306, 280, 8, 12, C.woodDark) +
      rect(290, 268, 6, 5, C.win) + rect(316, 268, 6, 5, C.win),
    banners: (ctx) => {
      let s = '';
      const t = ctx.keepTop;
      if (t != null) s += banner(186, t + 14, 26) + banner(214, t + 14, 26);
      if (ctx.stage >= 3) s += banner(150, 158, 20) + banner(250, 158, 20);
      if (ctx.stage >= 4) s += banner(120, 190, 16) + banner(280, 190, 16);
      return s;
    },
    tavern: () => house(98, 282, 34, '#a8553d', true) + `<line x1="98" y1="266" x2="90" y2="266" stroke="${C.woodDark}" stroke-width="1.5"/>` +
      rect(87, 267, 8, 7, C.trim, 'rx="1"'),
    windmill: () => `<g>` + poly('24,206 30,160 42,160 48,206', '#efe0c3') + poly('22,162 36,146 50,162', C.roof) +
      rect(32, 190, 8, 16, C.woodDark) +
      `<g class="sails" style="transform-origin:36px 162px">` +
      [0, 90, 180, 270].map((a) => `<g transform="rotate(${a} 36 162)"><rect x="34.5" y="130" width="3" height="32" fill="${C.woodDark}"/><rect x="37.5" y="132" width="8" height="26" fill="#fff" opacity=".85"/></g>`).join('') +
      `<circle cx="36" cy="162" r="3" fill="${C.woodDark}"/></g></g>`,
    greatHall: () => rect(116, 132, 50, 18, C.stoneLight) + poly('112,134 141,116 170,134', C.roofDark) +
      [124, 136, 148].map((x) => arch(x + 4, 146, 5, 9, C.win)).join(''),
    barracks: () => rect(234, 134, 46, 16, C.wood) + poly('230,136 257,120 284,136', C.slateDark) +
      [242, 256, 270].map((x) => rect(x, 139, 5, 6, C.win)).join(''),
    lumberYard: () => {
      let s = '';
      for (let row = 0; row < 3; row++) for (let i = 0; i < 5 - row; i++) {
        s += `<circle cx="${8 + i * 7 + row * 3.5}" cy="${276 - row * 6}" r="3.3" fill="${C.woodLight}" stroke="${C.woodDark}" stroke-width=".9"/>`;
      }
      return s;
    },
    gardens: () => {
      let s = '';
      for (const [x, y] of [[160, 250], [172, 256], [228, 256], [240, 250], [166, 270], [234, 270]]) {
        s += `<circle cx="${x}" cy="${y}" r="7" fill="${C.leafDark}"/><circle cx="${x - 2}" cy="${y - 2}" r="4" fill="${C.leaf}"/>` +
          `<circle cx="${x + 3}" cy="${y - 3}" r="1.6" fill="#ff8fab"/><circle cx="${x - 3}" cy="${y + 3}" r="1.6" fill="#fff176"/>`;
      }
      return s;
    },
    dragonRoost: () => dragon(272, 146, 0.55, 'roost'),
  };

  function dragon(x, y, s, cls) {
    return `<g class="dragon ${cls}"><g transform="translate(${x} ${y}) scale(${s})">` +
      path('M-20 0 Q-6 -14 10 -6 Q22 0 30 -8 L32 -2 Q24 8 10 6 Q-6 12 -20 0 Z', '#8e6cc9') +
      path('M-4 -6 L6 -30 L14 -6 Z', '#b39ddb', 'class="wing"') +
      path('M30 -8 L40 -14 L38 -4 Z', '#8e6cc9') + `<circle cx="36" cy="-10" r="1.4" fill="#222"/>` +
      path('M-20 0 L-32 -6 L-28 4 Z', '#7a57b8') +
      `<path d="M40 -12 l3 -3" stroke="#ffb74d" stroke-width="1.4"/></g></g>`;
  }

  function moat(stage) {
    const fortress = stage >= 4;
    const cy = fortress ? 226 : 212, rx = fortress ? 176 : 132;
    let s = `<ellipse cx="200" cy="${cy}" rx="${rx}" ry="9" fill="${C.water}"/>` +
      `<ellipse cx="200" cy="${cy - 2}" rx="${rx - 10}" ry="4" fill="${C.waterLight}" opacity=".6"/>`;
    // ducks
    for (const [x, d] of [[150, 1], [262, -1]]) {
      s += `<g class="duck" transform="translate(${x} ${cy}) scale(${d} 1)"><ellipse cx="0" cy="-1" rx="5" ry="3" fill="#fff"/>` +
        `<circle cx="4" cy="-4.5" r="2.4" fill="#fff"/><path d="M6 -4.5 l3 1 l-3 1 Z" fill="#ff9800"/></g>`;
    }
    return s;
  }

  function drawbridge(stage) {
    const y = stage >= 4 ? 214 : BASE + 2;
    return poly(`190,${y} 210,${y} 214,${y + 22} 186,${y + 22}`, C.wood) +
      `<g stroke="${C.woodDark}" stroke-width="1">${[0, 5, 10, 15].map((d) => `<line x1="${187 + d * 0.1}" y1="${y + 3 + d}" x2="${213 - d * 0.1}" y2="${y + 3 + d}"/>`).join('')}</g>`;
  }

  function gatehouse(stage) {
    if (stage < 3) return '';
    const base = BASE + 2;
    return stoneWall(176, 140, 14, base - 140, { merlon: 5 }) + stoneWall(210, 140, 14, base - 140, { merlon: 5 }) +
      rect(186, 152, 28, 8, C.stoneDark) + arch(200, base, 20, 30, C.win) +
      `<g stroke="${C.stoneDark}" stroke-width="1.4">` + [193, 198, 203, 208].map((x) => `<line x1="${x}" y1="${base - 26}" x2="${x}" y2="${base - 6}"/>`).join('') +
      `<line x1="190" y1="${base - 18}" x2="210" y2="${base - 18}"/><line x1="190" y1="${base - 10}" x2="210" y2="${base - 10}"/></g>`;
  }

  function walkers(count, reduced) {
    let s = '';
    const colors = ['#5c6bc0', '#8d6e63', '#43a047', '#e57373', '#fbc02d', '#26a69a'];
    for (let i = 0; i < count; i++) {
      const y = 262 + (i % 3) * 5;
      const dur = 26 + i * 7;
      const x0 = 30 + ((i * 97) % 340);
      const person = `<g transform="translate(0 ${y})"><circle cx="0" cy="-9" r="2.4" fill="#f1c7a0"/>` +
        rect(-2.6, -7, 5.2, 7, colors[i % colors.length], 'rx="1.5"') + `</g>`;
      s += reduced
        ? `<g transform="translate(${x0} 0)">${person}</g>`
        : `<g class="walker" style="animation-duration:${dur}s;animation-delay:-${(i * 11) % dur}s">${person}</g>`;
    }
    return s;
  }

  /** Full scene SVG markup for the given state. */
  function render(G, s, opts) {
    const stage = G.stageOf(s);
    const b = s.built;
    const reduced = !!opts.reduced;

    let main;
    if (stage === 0) main = watchtower();
    else if (stage === 1) main = palisade(watchtower);
    else if (stage === 2) main = palisade(stoneKeep);
    else main = walled(stage);

    const ctx = { stage, keepTop: main.keepTop };
    let out = backdrop(stage);
    if (b.windmill) out += EXTRAS.windmill();
    if (b.quarry) out += EXTRAS.quarry();
    // things behind the walls
    if (stage >= 5) out += citadelSpires();
    out += main.back;
    if (b.greatHall && stage >= 3) out += EXTRAS.greatHall();
    if (b.barracks && stage >= 3) out += EXTRAS.barracks();
    out += main.front;
    if (b.gatehouse) out += gatehouse(stage);
    if (b.signalFire) out += fire(main.fire[0], main.fire[1]);
    if (b.banners) out += EXTRAS.banners(ctx);
    for (const [x, y] of main.flags) out += flag(x, y, C.banner);
    if (b.dragonRoost) out += EXTRAS.dragonRoost();
    if (stage >= 4) out += outerWall();
    if (b.moat) out += moat(stage);
    if (b.drawbridge) out += drawbridge(stage);
    // village, back to front
    for (const id of ['woodshed', 'axes', 'taxBell', 'cottages', 'well', 'market', 'lodge', 'turnips', 'lumberYard', 'tavern', 'sawmill', 'gardens']) {
      if (b[id]) out += EXTRAS[id](ctx);
    }
    const people = s.workers.peasant > 0 ? Math.min(6, 1 + Math.floor(s.workers.peasant / 15)) : 0;
    out += walkers(people, reduced);
    if (opts.dragon) {
      out += reduced ? `<g transform="translate(300 70)">${dragon(0, 0, 0.8, 'flying')}</g>`
        : `<g class="sky-dragon">${dragon(0, 0, 0.8, 'flying')}</g>`;
    }

    const roof = b.goldenRoofs ? C.gold : C.slate;
    out = out.split('ROOF').join(roof);
    return `<g clip-path="url(#sceneClip)"><g id="castleBody">${out}</g></g>`;
  }

  /** Key describing everything the picture depends on, so we only redraw on change. */
  function key(G, s, opts) {
    return [G.stageOf(s), Object.keys(s.built).sort().join(','),
      s.workers.peasant > 0 ? Math.min(6, 1 + Math.floor(s.workers.peasant / 15)) : 0,
      opts.reduced ? 'r' : 'm', opts.dragon ? 'd' : ''].join('|');
  }

  root.CastleArt = { render, key };
})(typeof self !== 'undefined' ? self : this);
