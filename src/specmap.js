// The spec change map, drawn as SVG in the grammar of the verification map
// (frontend/src/map/engine.js in practical-formal-verification): a round
// instrument made only of rings, read from the centre outward.
//
//   readout   what the pointer is on, or the version on show
//   hub       the six trusted pieces
//   arcs      the eight ensures clauses, each over the situations it covers
//   bands     where the database lookup fails and where token signing fails
//   wedges    one for each of the 18 situations, split into the responses allowed there
//
// The cell shape follows engine.js cellPath and the arc text follows
// drawArcText (upper half clockwise, lower half anticlockwise). A clause arc is
// dom.js dialGlyph opened out: the outer line is what a machine reads and the
// inner line is what is written in words.

import { svg } from './dom.js';
import { CASES, RINGS } from './model.js';

const TURN = Math.PI * 2;
const R = {
  face: 100, hub: [113, 139], clause: 219, pitch: 22, words: 7.5,
  db: [233, 241], signer: [243, 251],
  wedge: [258, 368], cond: 377, names: 398, rim: 414, view: 442,
};
const SECTOR_GAP = 0.55;

const pt = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
const f = (n) => n.toFixed(2);

/** One cell: an annular sector less a fixed gap, as engine.js cellPath. */
function cell(mid, half, gap, r0, r1) {
  const h1 = Math.max(half - gap / r1, 0.0005), h0 = Math.max(half - gap / r0, 0.0005);
  const [ax, ay] = pt(r1, mid - h1), [bx, by] = pt(r1, mid + h1), [cx, cy] = pt(r0, mid + h0), [dx, dy] = pt(r0, mid - h0);
  return `M${f(ax)} ${f(ay)}A${r1} ${r1} 0 0 1 ${f(bx)} ${f(by)}L${f(cx)} ${f(cy)}A${r0} ${r0} 0 0 0 ${f(dx)} ${f(dy)}Z`;
}
function arc(r, a0, a1) {
  const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
  const sweep = a1 > a0 ? 1 : 0;
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} ${sweep} ${f(x1)} ${f(y1)}`;
}

export function createSpecMap(root, model, hooks = {}) {
  root.setAttribute('viewBox', `${-R.view} ${-R.view} ${R.view * 2} ${R.view * 2}`);
  root.setAttribute('role', 'group');
  root.classList.add('specmap');

  /* ---- Layout: every situation gets an equal slot, grouped by case. ---- */
  const sectors = CASES.map((c) => ({ case: c, items: model.situations.filter((x) => x.case === c) }));
  const unit = TURN / sectors.reduce((n, s) => n + s.items.length + SECTOR_GAP, 0);
  let cursor = -Math.PI / 2 - (sectors[0].items.length / 2) * unit;
  const slot = new Map();
  for (const s of sectors) {
    s.from = cursor;
    for (const x of s.items) { slot.set(x.key, { mid: cursor + unit / 2, half: unit / 2 }); cursor += unit; }
    s.to = cursor;
    s.mid = (s.from + s.to) / 2;
    cursor += SECTOR_GAP * unit;
  }
  const sectorOf = new Map(sectors.map((s) => [s.case.id, s]));

  /* ---- Layers, back to front ---- */
  const defs = svg('defs');
  const gFrame = svg('g', { class: 'sm-frame', 'aria-hidden': 'true' });
  const gCols = svg('g', { class: 'sm-cols' });
  const gNames = svg('g', { class: 'sm-names', 'aria-hidden': 'true' });
  const gArm = svg('g', { class: 'sm-arm', 'aria-hidden': 'true' });
  const gPick = svg('path', { class: 'sm-pick', 'aria-hidden': 'true' });
  const gPeek = svg('path', { class: 'sm-peek', 'aria-hidden': 'true' });
  const gClauses = svg('g', { class: 'sm-clauses' });
  const gHub = svg('g', { class: 'sm-hub' });
  const gFace = svg('g', { class: 'sm-face', 'aria-hidden': 'true' });
  defs.append(svg('pattern', { id: 'sm-hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    svg('line', { class: 'sm-hatch__line', x1: 0, y1: 0, x2: 0, y2: 7 })));
  root.classList.add('is-entering');
  setTimeout(() => root.classList.remove('is-entering'), 1700);
  root.append(defs, gFrame, gCols, gNames, gPeek, gPick, gArm, gClauses, gHub, gFace);

  // The rim, with one tick per situation.
  gFrame.append(svg('circle', { class: 'sm-rim', r: R.rim }));
  for (const x of model.situations) {
    const a = slot.get(x.key).mid;
    const [x0, y0] = pt(R.rim, a), [x1, y1] = pt(R.rim + 5, a);
    gFrame.append(svg('line', { class: 'sm-tick', x1: f(x0), y1: f(y0), x2: f(x1), y2: f(y1) }));
  }
  /* ---- The situations. Each wedge is split into the responses the contract
     allows there, and each block carries its own label, so nothing is left
     empty. Outside the wedge is what fails in that situation. ---- */
  const cols = new Map();
  const COND = ['nothing fails', 'signing fails', 'lookup fails', 'both fail'];
  model.situations.forEach((x, n) => {
    const { mid, half } = slot.get(x.key);
    const g = svg('g', { class: `sm-col${x.changed ? ' is-changed' : ''}`, 'data-key': x.key });
    // The direction this wedge slides when it is pointed at or chosen, and its turn in the opening.
    g.style.setProperty('--px', f(Math.cos(mid))); g.style.setProperty('--py', f(Math.sin(mid))); g.style.setProperty('--i', n);
    g.append(svg('path', { class: `sm-band sm-band--db${x.dbFails ? ' is-on' : ''}`, d: cell(mid, half, 1.2, R.db[0], R.db[1]) }));
    g.append(svg('path', { class: `sm-band sm-band--signer${x.signerFails ? ' is-on' : ''}`, d: cell(mid, half, 1.2, R.signer[0], R.signer[1]) }));
    const kinds = RINGS.filter((ring) => x.beforeKinds.has(ring.id) || x.afterKinds.has(ring.id));
    const depth = (R.wedge[1] - R.wedge[0]) / kinds.length;
    kinds.forEach((ring, i) => {
      const r0 = R.wedge[0] + i * depth + (i ? 2 : 0.8), r1 = R.wedge[0] + (i + 1) * depth - (i < kinds.length - 1 ? 2 : 0.8);
      const b = x.beforeKinds.has(ring.id), a = x.afterKinds.has(ring.id);
      const state = `${b ? ' in-before' : ''}${a ? ' in-after' : ''}${b && !a ? ' is-lost' : ''}${a && !b ? ' is-gained' : ''}`;
      const [tx, ty] = pt((r0 + r1) / 2, mid);
      const label = svg('text', { class: `sm-cell__t sm-cell--${ring.id}${state}`, x: f(tx), y: f(ty), 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      label.textContent = ring.id === 'token' ? '200' : ring.id;
      g.append(svg('path', { class: `sm-cell sm-cell--${ring.id}${state}`, d: cell(mid, half, 2.8, r0, r1) }), label);
    });
    const lower = Math.sin(mid) > 0.05;
    const id = `sm-cond-${n}`;
    defs.append(svg('path', { id, d: lower ? arc(R.cond + 7, mid + half, mid - half) : arc(R.cond, mid - half, mid + half) }));
    const cond = svg('text', { class: `sm-cond${x.dbFails || x.signerFails ? ' is-failing' : ''}` });
    const tp = svg('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' });
    tp.textContent = COND[x.quarter];
    cond.append(tp);
    const hit = svg('path', { class: 'sm-hit', d: cell(mid, half, 0.6, R.db[0] - 3, R.wedge[1] + 3.5) });
    hit.addEventListener('pointerenter', () => hooks.onHover?.(x.key));
    hit.addEventListener('pointerleave', () => hooks.onHover?.(null));
    hit.addEventListener('click', () => hooks.onSelect?.(x.key));
    g.append(cond, hit);
    gCols.append(g);
    cols.set(x.key, g);
  });

  /* ---- Case names round the rim ---- */
  sectors.forEach((s, i) => {
    const lower = Math.sin(s.mid) > 0.05;
    const id = `sm-name-${i}`;
    // A short case gets a wider path so its name is never clipped.
    const span = Math.max(s.to - s.from, 0.62) / 2 + 0.5;
    defs.append(svg('path', { id, d: lower ? arc(R.names + 9, s.mid + span, s.mid - span) : arc(R.names, s.mid - span, s.mid + span) }));
    const text = svg('text', { class: 'sm-name' });
    const tp = svg('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' });
    tp.textContent = s.case.name;
    text.append(tp);
    gNames.append(text);
  });

  /* ---- The eight clauses: one arc each, over the situations it covers.
     A case with several clauses stacks them inward, changed ones outermost. ---- */
  for (const s of sectors) {
    const mine = model.clauses.filter((c) => c.caseId === s.case.id)
      .sort((a, b) => (b.change !== 'unchanged') - (a.change !== 'unchanged') || a.n - b.n);
    mine.forEach((c, level) => {
      const r = R.clause - level * R.pitch;
      const from = s.from + 2 / r, to = s.to - 2 / r;
      const what = c.change === 'unchanged' ? 'unchanged' : c.englishChanged ? 'comment and code changed' : 'code changed, comment unchanged';
      const g = svg('g', {
        class: `sm-clause${c.codeChanged ? ' code-changed' : ''}${c.englishChanged ? ' english-changed' : ''}${c.apart.before ? ' apart-before' : ''}${c.apart.after ? ' apart-after' : ''}`,
        tabindex: 0, role: 'button', 'data-key': c.key, 'aria-label': `Clause ${c.n} of login_flow, ${s.case.name}, ${what}`,
      });
      const [bx, by] = pt(r - R.words / 2, s.mid);
      const num = svg('text', { class: 'sm-clause__n', x: f(bx), y: f(by + 0.4), 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      num.textContent = String(c.n);
      g.append(
        svg('path', { class: 'sm-clause__hit', d: cell(s.mid, (to - from) / 2, 0, r - R.words - 7, r + 7) }),
        svg('path', { class: 'sm-clause__code', d: arc(r, from, to) }),
        svg('path', { class: 'sm-clause__words', d: arc(r - R.words, from, to) }),
        svg('circle', { class: 'sm-clause__badge', cx: f(bx), cy: f(by), r: 10.4 }), num);
      // A dot on the code line for each failure condition the corrected clause names.
      c.names.forEach((name, i) => {
        const [px, py] = pt(r, s.mid + (20 + i * 12) / r);
        g.append(svg('circle', { class: `sm-clause__pip is-${name === 'signing_fails' ? 'signing' : 'lookup'}`, cx: f(px), cy: f(py), r: 4.6 }));
      });
      wire(g, c.key);
      gClauses.append(g);
    });
  }

  /* ---- The hub: the six trusted pieces ---- */
  const hubMid = (R.hub[0] + R.hub[1]) / 2;
  model.trusted.forEach((t, i) => {
    const mid = -Math.PI / 2 + (i / model.trusted.length) * TURN, half = TURN / model.trusted.length / 2;
    const lower = Math.sin(mid) > 0.05;
    const id = `sm-piece-${i}`;
    defs.append(svg('path', { id, d: lower ? arc(hubMid + 3.4, mid + half, mid - half) : arc(hubMid - 3.4, mid - half, mid + half) }));
    const g = svg('g', {
      class: `sm-piece${t.reachedBy.length ? ' is-reached' : ''}${t.failure ? ` fails-${t.failure === 'signing_fails' ? 'signing' : 'lookup'}` : ''}${t.before ? '' : ' no-earlier'}`,
      tabindex: 0, role: 'button', 'data-key': t.key, 'aria-label': `${t.name}, trusted, with an assumed contract`,
    });
    const label = svg('text', { class: 'sm-piece__name' });
    const tp = svg('textPath', { href: `#${id}`, startOffset: '50%', 'text-anchor': 'middle' });
    tp.textContent = t.name.replace(/^\w+::/, '');
    label.append(tp);
    g.append(svg('path', { class: 'sm-piece__seg', d: cell(mid, half, 2, R.hub[0], R.hub[1]) }), label);
    wire(g, t.key);
    gHub.append(g);
  });

  /* ---- The readout at the centre ---- */
  const face = {
    kicker: svg('text', { class: 'sm-face__kicker', 'text-anchor': 'middle', y: -36 }),
    main: svg('text', { class: 'sm-face__main', 'text-anchor': 'middle', y: 4 }),
    sub: svg('text', { class: 'sm-face__sub', 'text-anchor': 'middle' }),
  };
  gFace.append(svg('circle', { class: 'sm-face__disc', r: R.face }), face.kicker, face.main, face.sub);

  /* ---- The pointer: an index notch on the rim and an outline ---- */
  gArm.append(svg('line', { class: 'sm-arm__line', x1: R.cond + 12, y1: 0, x2: R.rim + 12, y2: 0 }),
    svg('path', { class: 'sm-arm__notch', d: `M${R.rim + 2} 0L${R.rim + 13} 4L${R.rim + 13} -4Z` }));

  function wire(g, key) {
    g.addEventListener('click', () => hooks.onSelect?.(key));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hooks.onSelect?.(key); } });
    g.addEventListener('pointerenter', () => hooks.onHover?.(key));
    g.addEventListener('pointerleave', () => hooks.onHover?.(null));
    g.addEventListener('focus', () => hooks.onHover?.(key));
    g.addEventListener('blur', () => hooks.onHover?.(null));
  }

  /* ---- State ---- */
  let armAngle = -90;
  function setVersion(v) { root.dataset.version = v; }

  /** What a chosen or pointed-at thing lights: itself and what it is tied to. */
  function related(key) {
    const o = model.find(key);
    const out = { o, cols: new Set(), clauses: new Set(), pieces: new Set() };
    if (!o) return out;
    if (o.key.startsWith('s:')) {
      out.cols.add(o.key);
      for (const id of o.changedClauses) out.clauses.add(`c:${id}`);
      for (const w of model.wires) if (out.clauses.has(w.clause.key)) out.pieces.add(w.trusted.key);
    } else if (o.key.startsWith('c:')) {
      out.clauses.add(o.key);
      for (const x of (o.changedSituations.length ? o.changedSituations : sectorOf.get(o.caseId).items)) out.cols.add(x.key);
      for (const w of model.wires) if (w.clause === o) out.pieces.add(w.trusted.key);
    } else {
      out.pieces.add(o.key);
      for (const c of o.reachedBy) { out.clauses.add(c.key); for (const x of c.changedSituations) out.cols.add(x.key); }
    }
    return out;
  }

  function setChosen(key) {
    const { o, cols: lit, clauses, pieces } = related(key);
    const isSituation = Boolean(o) && o.key.startsWith('s:');
    root.classList.toggle('has-choice', Boolean(o));
    root.classList.toggle('has-lit-cols', lit.size > 0);
    root.classList.toggle('is-login', isSituation);
    for (const [k, g] of cols) { g.classList.toggle('is-lit', lit.has(k)); g.classList.toggle('is-picked', isSituation && k === o.key); }
    for (const g of gClauses.children) { g.classList.toggle('is-lit', clauses.has(g.dataset.key)); g.classList.toggle('is-chosen', g.dataset.key === o?.key); }
    for (const g of gHub.children) { g.classList.toggle('is-lit', pieces.has(g.dataset.key)); g.classList.toggle('is-chosen', g.dataset.key === o?.key); }

    // The notch swings the short way round to a chosen situation, and its column is outlined.
    if (isSituation) {
      const { mid, half } = slot.get(o.key);
      const target = (mid * 180) / Math.PI;
      armAngle += ((((target - armAngle) % 360) + 540) % 360) - 180;
      gArm.style.transform = `rotate(${armAngle}deg)`;
      gArm.classList.add('is-on');
      gPick.setAttribute('d', cell(mid, half, 0, R.db[0] - 3, R.wedge[1] + 3));
      gPick.classList.add('is-on');
    } else {
      gArm.classList.remove('is-on');
      gPick.classList.remove('is-on');
    }
  }

  /** Pointing lights the thing and what it is tied to, without dimming the rest. */
  function setHover(key) {
    const { o, cols: lit, clauses, pieces } = related(key);
    const at = o && slot.get(o.key);
    if (at) gPeek.setAttribute('d', cell(at.mid, at.half, 0, R.db[0] - 3, R.wedge[1] + 3));
    gPeek.classList.toggle('is-on', Boolean(at));
    for (const [k, g] of cols) { g.classList.toggle('is-hover', k === o?.key); g.classList.toggle('is-near', lit.has(k) && k !== o?.key); }
    for (const g of gClauses.children) { g.classList.toggle('is-hover', g.dataset.key === o?.key); g.classList.toggle('is-near', clauses.has(g.dataset.key) && g.dataset.key !== o?.key); }
    for (const g of gHub.children) { g.classList.toggle('is-hover', g.dataset.key === o?.key); g.classList.toggle('is-near', pieces.has(g.dataset.key) && g.dataset.key !== o?.key); }
  }

  /** The readout: a small heading, one main line of [text, class] parts, and lines under it. */
  function setFace({ kicker = '', main = [], size = 'big', sub = [] }) {
    face.kicker.textContent = kicker;
    face.main.replaceChildren(...main.map(([text, cls]) => svg('tspan', { class: cls || null }, text)));
    face.main.setAttribute('class', `sm-face__main is-${size}`);
    face.main.setAttribute('y', size === 'big' ? 6 : -2);
    face.sub.replaceChildren(...sub.filter(Boolean).map((line, i) => {
      const [text, cls] = Array.isArray(line) ? line : [line, null];
      return svg('tspan', { x: 0, y: (size === 'big' ? 30 : 20) + i * 15, class: cls }, text);
    }));
  }

  return {
    setVersion, setChosen, setHover, setFace,
    /** The situation one place round from another, for the arrow keys. */
    neighbour(key, step) {
      const i = model.situations.findIndex((x) => x.key === key);
      const n = model.situations.length;
      return model.situations[(((i < 0 ? 0 : i + step) % n) + n) % n].key;
    },
  };
}
