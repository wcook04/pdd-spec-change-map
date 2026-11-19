// The page: the explorer's shell round the spec change map. One inspector says
// what the chosen thing is. Its evidence (the Verus as printed, the modelled
// logins, the method) opens in a workspace beside a smaller map, at a size
// made for reading. Pointing changes only the map and its centre; a click
// chooses. The shell and card markup follow
// frontend/src/views/explorer.js in practical-formal-verification.

import { h, svg, clear, announce } from './dom.js';
import { load } from './api.js';
import { buildModel, outcomeName, tokenDiff, tidyCode, CASES, RINGS, VERSIONS } from './model.js';
import { createSpecMap } from './specmap.js';

document.documentElement.classList.add('is-explorer');
const main = document.getElementById('main');

/* ---- Theme switch, as in the explorer's main.js ---- */
const toggle = document.querySelector('[data-theme-toggle]');
function syncToggle() {
  toggle.setAttribute('aria-checked', document.documentElement.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
}
toggle.addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.getAttribute('data-theme') !== 'dark';
  root.classList.add('theme-switching');
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  try {
    if (dark === systemDark) localStorage.removeItem('plectis-theme'); else localStorage.setItem('plectis-theme', dark ? 'dark' : 'light');
  } catch { /* storage may be unavailable; the choice still applies to this page */ }
  syncToggle();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
});
syncToggle();

/* ---- Small pieces ---- */
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listWords = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const ext = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text);
/** Text from a doc comment, with its `names` set as code. */
const inline = (text) => String(text).split('`').map((part, i) => (i % 2 ? h('code', {}, part) : part));

/** A clause as the map draws it: comment ring inside, code ring outside. */
function miniDial(c, extraClass = 'mini-dial') {
  const root = svg('svg', { class: `${extraClass} sm-dial${c.codeChanged ? ' code-changed' : ''}${c.englishChanged ? ' english-changed' : ''}${c.apart?.before ? ' apart-before' : ''}${c.apart?.after ? ' apart-after' : ''}${c.isApart ? ' is-apart' : ''}`, viewBox: '-22 -22 44 44', 'aria-hidden': 'true', focusable: 'false' });
  const n = svg('text', { class: 'sm-dial__n', 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 0.5 });
  n.textContent = c.n ? String(c.n) : '';
  root.append(svg('circle', { class: 'sm-dial__face', r: 17 }), svg('circle', { class: 'sm-dial__code', r: 17 }), svg('circle', { class: 'sm-dial__english', r: 10.5 }), n);
  return root;
}
function pieceGlyph() {
  return svg('svg', { viewBox: '-11 -11 22 22', width: 14, height: 14, 'aria-hidden': 'true', focusable: 'false' },
    svg('circle', { class: 'sm-piece__ring', r: 8.5 }), svg('circle', { class: 'sm-piece__dot', r: 3.4 }));
}
const swatch = (cls) => h('span', { class: `swatch ${cls}`, 'aria-hidden': 'true' });

function marked(tokens, kind) {
  // Neighbouring changed tokens, and the spaces between them, become one mark.
  const out = [];
  let run = '';
  const flush = () => {
    if (!run) return;
    const tail = run.match(/\s+$/)?.[0] || '';
    out.push(h('mark', { class: kind === 'now' ? 'is-now' : 'is-was' }, run.slice(0, run.length - tail.length)), tail);
    run = '';
  };
  for (const [text, state] of tokens) {
    if (state !== 'same') run += text;
    else if (run && !text.trim()) run += text;
    else { flush(); out.push(text); }
  }
  flush();
  return out;
}
function sourceLine(side, source, model) {
  const doc = model.documents[source.document];
  const lines = source.from === source.to ? `line ${source.from}` : `lines ${source.from} to ${source.to}`;
  return side === 'before'
    ? ext(doc.url, `Microsoft Research post, ${lines} of the printed listing`)
    : ext(doc.url, `GitHub Next page, ${lines} of login.rs`);
}

/* ---- Start ---- */
const status = h('div', { class: 'explorer__status', role: 'status' }, 'Reading the saved comparison…');
main.append(status);
load().then((api) => start(buildModel(api))).catch((error) => {
  status.replaceChildren(h('div', { class: 'state state--error' }, h('strong', {}, 'The comparison could not be read. '), String(error.message || error)));
});

function start(model) {
  const t = model.totals;
  const state = { version: 'after', chosen: null, hover: null, evidence: false };
  const narrow = window.matchMedia('(max-width: 899px)');
  const caseName = (id) => CASES.find((c) => c.id === id).name;
  const SHORT = { token: '200', 400: '400', 401: '401', 500: '500' };
  const FLAG = { lookup_fails: 'dbFails', signing_fails: 'signerFails' };

  /* ---- Stage ---- */
  const figure = svg('svg', { tabindex: 0, 'aria-label': `Map of the ${t.situations} situations a login can be in and the responses each printed version of the login_flow contract allows. Use the left and right arrow keys to move between situations.` });
  const where = h('span', { class: 'spec-version__where' });
  const versionButtons = Object.fromEntries(Object.entries(VERSIONS).map(([id, v]) => [id, h('button', { type: 'button', class: 'seg', 'aria-pressed': 'false', onclick: () => setVersion(id) }, v.short)]));
  const versionBox = h('div', { class: 'spec-version' }, h('div', { class: 'segs', role: 'group', 'aria-label': 'Version of the spec' }, versionButtons.before, versionButtons.after), where);
  const tools = h('div', { class: 'explorer__tools' },
    h('button', { type: 'button', class: 'explorer-tool', onclick: (e) => {
      const collapsed = explorer.classList.toggle('is-panel-collapsed');
      e.currentTarget.textContent = collapsed ? 'Show panel' : 'Hide panel';
    } }, 'Hide panel'));
  const lensButtons = ['map', 'table'].map((v) => h('button', { type: 'button', class: 'seg', 'aria-pressed': String(v === 'map'), onclick: () => setLens(v) }, v === 'map' ? 'Map' : 'Table'));
  tools.prepend(h('div', { class: 'segs spec-lens', role: 'group', 'aria-label': 'Show the situations as' }, lensButtons));
  const sheet = h('div', { class: 'sheet', hidden: true });
  const stage = h('div', { class: 'explorer__stage' }, figure, sheet, versionBox, tools);
  function setLens(v) {
    const table = v === 'table';
    sheet.hidden = !table;
    figure.style.visibility = table ? 'hidden' : '';
    lensButtons.forEach((b, i) => b.setAttribute('aria-pressed', String((i === 1) === table)));
  }

  /* ---- Inspector and evidence workspace ---- */
  const reading = h('div', { class: 'insp', tabindex: '-1' });
  const keyLine = (mark, words) => h('li', {}, h('span', { class: 'mapkey__mark', 'aria-hidden': 'true' }, mark), h('span', {}, words));
  const mapKey = h('details', { class: 'mapkey' },
    h('summary', {}, 'How to read the map'),
    h('ul', {},
      keyLine(h('span', { class: 'mapkey__wedge' }, swatch('sw-401'), swatch('sw-500')), 'Each wedge is one situation: a kind of request, with or without a lookup failure and a signing failure. Its blocks are the HTTP responses allowed in that situation.'),
      keyLine(h('span', { class: 'mapkey__wedge' }, swatch('sw-401'), swatch('is-lost')), 'Hatching and a crossed-out 500 mark a response allowed only by the earlier contract.'),
      keyLine(h('span', { class: 'mapkey__bands' }, swatch('swatch--thin sw-signer'), swatch('swatch--thin sw-db')), 'The two thin bands inside the wedges are filled where the signing fails and where the lookup fails.'),
      keyLine(miniDial({ codeChanged: true, englishChanged: false, n: 4, isApart: true }), 'Each numbered arc is an ensures clause, with its Verus on the outer line and its comment on the inner line. The Verus line is dashed where the comment limits a 500 to a failure and the Verus does not.'),
      keyLine(pieceGlyph(), 'The names around the centre are functions whose contracts the login proof takes on trust.')),
    h('p', { class: 'mapkey__note' }, 'A response is allowed when it satisfies every clause in the model.'));
  const panel = h('aside', { class: 'explorer__panel', 'aria-label': 'Comparison details' }, reading, mapKey);
  const evidence = h('section', { id: 'evidence', class: 'explorer__evidence', 'aria-label': 'Evidence', inert: true });
  const viewButtons = ['map', 'details'].map((v) => h('button', { type: 'button', class: 'explorer-tool', 'aria-pressed': 'false', onclick: () => show(v) }, v === 'map' ? 'Explore' : 'Details'));
  const views = h('div', { class: 'explorer__views', role: 'group', 'aria-label': 'Show' }, viewButtons);
  const explorer = h('div', { class: 'explorer', 'data-explorer-shown': 'map' }, views, panel, evidence, stage);
  function show(v) {
    explorer.dataset.explorerShown = v;
    viewButtons.forEach((b, i) => b.setAttribute('aria-pressed', String((i === 0) === (v === 'map'))));
  }
  show(narrow.matches ? 'details' : 'map');
  main.replaceChildren(explorer);

  const map = createSpecMap(figure, model, { onSelect: (k) => choose(k === state.chosen ? null : k), onHover: point });

  let counting = 0, lastCount = null;
  /* ---- Version ---- */
  function setVersion(v, { quiet = false } = {}) {
    state.version = v;
    for (const [id, b] of Object.entries(versionButtons)) b.setAttribute('aria-pressed', String(id === v));
    where.textContent = `The contract as printed ${v === 'before' ? 'in the Microsoft Research post' : 'on the GitHub Next page'}`;
    map.setVersion(v);
    explorer.dataset.version = v;
    const shown = model.find(state.hover ?? state.chosen);
    const target = faceFor(shown);
    clearInterval(counting);
    const to = model.situations.filter((x) => x[v === 'before' ? 'beforeKinds' : 'afterKinds'].has('500')).length;
    if (!shown && lastCount !== null && lastCount !== to && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let n = lastCount;
      counting = setInterval(() => {
        n += Math.sign(to - n);
        map.setFace({ ...target, main: [[`${n} of ${t.situations}`]] });
        if (n === to) clearInterval(counting);
      }, 80);
    } else map.setFace(target);
    lastCount = to;
    if (!quiet) { writeHash(); announce(`${VERSIONS[v].name}, ${where.textContent.toLowerCase()}`); }
  }

  /* ---- The inspector shows the chosen thing; its evidence opens beside it ---- */
  function paint() {
    const o = model.find(state.chosen);
    const view = !o ? overview() : o.key.startsWith('s:') ? situationView(o) : o.key.startsWith('c:') ? clauseView(o) : pieceView(o);
    reading.replaceChildren(h('div', { class: 'insp__inner' },
      o ? h('div', { class: 'insp__head' }, h('button', { type: 'button', class: 'card-head__back', onclick: () => choose(null, { focusDetails: true }) }, '← Overview')) : null,
      view.reading));
    explorer.classList.toggle('has-evidence', state.evidence);
    evidence.inert = !state.evidence;
    clear(evidence);
    if (state.evidence) {
      evidence.append(h('div', { class: 'ev' },
        h('div', { class: 'ev__head' }, h('h2', { class: 'ev__title' }, view.evidenceTitle),
          h('button', { type: 'button', class: 'ev__close', onclick: () => openEvidence(false) }, h('span', { class: 'ev__close-wide' }, 'Close'), h('span', { class: 'ev__close-narrow' }, '‹ Back'))),
        view.evidence));
    }
    map.setFace(faceFor(model.find(state.hover ?? state.chosen)));
  }
  function openEvidence(on) {
    state.evidence = on;
    paint();
    writeHash();
    const focus = on ? evidence.querySelector('.ev__close') : reading.querySelector('.insp__open');
    focus?.focus({ preventScroll: on });
  }
  const evidenceButton = (text) => h('button', { type: 'button', class: 'insp__open', 'aria-expanded': String(state.evidence), 'aria-controls': evidence.id, onclick: () => openEvidence(!state.evidence) },
    h('span', {}, text), h('span', { class: 'insp__open-mark', 'aria-hidden': 'true' }, state.evidence ? '×' : '›'));

  // Pointing changes the map and its centre only; the inspector stays where it is.
  function point(k) {
    clearInterval(counting);
    state.hover = k || null;
    map.setHover(state.hover);
    map.setFace(faceFor(model.find(state.hover ?? state.chosen)));
  }

  function choose(k, { quiet = false, focusDetails = false, linkedEvidence } = {}) {
    clearInterval(counting);
    const o = model.find(k);
    const next = o?.key ?? null;
    if (next !== state.chosen) state.evidence = false;
    if (linkedEvidence !== undefined) state.evidence = linkedEvidence;
    state.chosen = next;
    if (narrow.matches && (o || focusDetails)) show('details');
    map.setChosen(state.chosen);
    for (const [k, tr] of sheetRows) tr.classList.toggle('is-here', k === state.chosen);
    paint();
    reading.scrollTop = 0;
    panel.scrollTop = 0;
    if (focusDetails || (!quiet && narrow.matches && o)) reading.focus({ preventScroll: true });
    if (!quiet) {
      writeHash();
      if (o) announce(o.title || (o.n ? `Clause ${o.n}` : o.name));
    }
  }
  /** A link in the inspector: pointing lights the thing on the map, a click chooses it. */
  const go = (o, label, cls = 'textbtn') => h('button', {
    type: 'button', class: cls, onclick: () => choose(o.key, { focusDetails: true }),
    onpointerenter: () => point(o.key), onpointerleave: () => point(null),
    onfocus: () => point(o.key), onblur: () => point(null),
  }, label);

  function writeHash() {
    const parts = [];
    if (state.version !== 'after') parts.push(`v=${state.version}`);
    if (state.chosen) parts.push(`o=${encodeURIComponent(state.chosen)}`);
    if (state.evidence) parts.push('e=1');
    history.replaceState(null, '', parts.length ? `#${parts.join('&')}` : location.pathname + location.search);
  }

  /* ---- The readout at the centre of the map ---- */
  const FACE_NAME = { token: 'token', 400: '400', 401: '401', 500: '500' };
  function faceFor(o) {
    const v = state.version, kinds = v === 'before' ? 'beforeKinds' : 'afterKinds';
    if (!o) {
      const n = model.situations.filter((x) => x[kinds].has('500')).length;
      return { kicker: v === 'before' ? 'Earlier contract' : 'Corrected contract', main: [[`${n} of ${t.situations}`]], sub: ['situations allow a 500'] };
    }
    if (o.key.startsWith('s:')) {
      const names = RINGS.filter((r) => o[kinds].has(r.id));
      return {
        kicker: o.case.name,
        main: names.flatMap((r, i) => [i ? [' or ', 'is-or'] : null, [FACE_NAME[r.id], `is-${r.id}`]]).filter(Boolean),
        sub: [`lookup ${o.dbFails ? 'fails' : 'works'} · signing ${o.signerFails ? 'fails' : 'works'}`,
          o.changed ? [v === 'after' ? '500 no longer allowed' : '500 allowed here', 'is-strong'] : 'same in both contracts'],
      };
    }
    if (o.key.startsWith('c:')) {
      const unchanged = o.change === 'unchanged';
      return {
        kicker: `Clause ${o.n}`, size: 'mid',
        main: [[unchanged ? 'Printed the same in both' : o.apart[v] ? '500 with no condition' : '500 only on a failure']],
        sub: unchanged ? [o.aboutToken ? 'a rule about the token' : caseName(o.caseId)] : o.apart[v] ? ['its comment has the condition', 'its Verus does not'] : o.names.map((name) => [name, 'is-code']),
      };
    }
    return {
      kicker: 'Trusted piece', size: 'mid', main: [[o.name.replace(/^\w+::/, ''), 'is-code']],
      sub: ['assumed contract', o.reachedBy.length ? `used by ${o.reachedBy.length === 1 ? 'clause' : 'clauses'} ${listWords(o.reachedBy.map((c) => c.n))}` : null],
    };
  }

  /* ---- Small pieces of the inspector ---- */
  const kindsWords = (kinds) => listWords(RINGS.filter((r) => kinds.has(r.id)).map((r) => r.name)).replace(/,? and /, ' or ');
  const label = (text) => h('p', { class: 'insp__label' }, text);
  const chip = (ringId, gone = false) => h('span', { class: `rchip${gone ? ' is-gone' : ''}` }, swatch(`sw-${ringId}`), SHORT[ringId], gone ? h('span', { class: 'sr-only' }, ', earlier contract only') : null);
  const codeNames = (names) => names.map((name, i) => [i ? ' or ' : '', h('code', {}, name)]);
  const quote = (text, note) => h('figure', { class: 'quote' }, h('blockquote', { class: 'spec-words' }, text), h('figcaption', {}, note));
  const count = (n) => n.toLocaleString('en-GB');

  /** The situations of one kind of request, laid out by what fails. A failure
      that changes nothing in either contract is left out and stated under the table. */
  function failTable(caseId, current) {
    const xs = model.situations.filter((x) => x.case.id === caseId);
    const sig = (x) => `${[...x.beforeKinds].sort()}|${[...x.afterKinds].sort()}`;
    const varies = (flag) => new Set(xs.map((x) => x[flag])).size > 1;
    const matters = (flag, other) => xs.some((a) => xs.some((b) => a[flag] !== b[flag] && a[other] === b[other] && sig(a) !== sig(b)));
    const db = varies('dbFails') && matters('dbFails', 'signerFails'), signer = varies('signerFails') && matters('signerFails', 'dbFails');
    const rows = db ? [false, true] : [null], cols = signer ? [false, true] : [null];
    const pick = (d, s) => xs.find((x) => (d === null ? x.dbFails === (current?.case.id === caseId ? current.dbFails : false) : x.dbFails === d)
      && (s === null ? x.signerFails === (current?.case.id === caseId ? current.signerFails : false) : x.signerFails === s)) || xs[0];
    const cell = (d, s) => {
      const x = pick(d, s);
      return h('td', {}, go(x, [
        RINGS.filter((r) => x.afterKinds.has(r.id)).map((r) => chip(r.id)),
        RINGS.filter((r) => x.lost.includes(r.id)).map((r) => chip(r.id, true)),
      ], `ftable__cell${x.changed ? ' is-changed' : ''}${current && current.key === x.key ? ' is-here' : ''}`));
    };
    const signingUsed = model.clauses.some((c) => c.caseId === caseId && /signing_fails/.test(c.after.text.code));
    const notes = [];
    if (varies('signerFails') && !signer) notes.push(signingUsed ? 'The allowed responses are the same whether or not the signing fails.' : 'No clause for this kind of request mentions signing, so a signing failure changes nothing here.');
    if (varies('dbFails') && !db) notes.push('The allowed responses are the same whether or not the lookup fails.');
    if (!varies('dbFails')) notes.push('A lookup failure is modelled only for requests that name an account.');
    return [
      h('table', { class: `ftable${signer ? '' : ' ftable--one'}` },
        signer ? h('thead', {}, h('tr', {}, db ? h('td', {}) : null, h('th', { scope: 'col' }, 'Signing works'), h('th', { scope: 'col' }, swatch('swatch--thin sw-signer'), 'Signing fails'))) : null,
        h('tbody', {}, rows.map((d) => h('tr', {},
          db ? h('th', { scope: 'row' }, d ? [swatch('swatch--thin sw-db'), 'Lookup fails'] : 'Lookup works') : null,
          cols.map((s) => cell(d, s)))))),
      h('p', { class: 'insp__aside' }, xs.some((x) => x.changed) ? 'A crossed-out 500 was allowed only by the earlier contract. ' : null, notes.join(' ')),
    ];
  }

  /** What the saved comparison records about the results a clause rules out. */
  function ruledOut(c) {
    const now = c.ruledOut.after, was = c.ruledOut.before;
    const l = now.sample && model.loginById.get(now.sample.world_id);
    const others = now.coveredBy.map((id) => model.clauseById.get(id)).filter(Boolean);
    const changed = was.pairs !== now.pairs;
    return [
      label('What this clause rules out'),
      l && !changed ? h('p', { class: 'example' }, h('span', { class: 'example__when' }, `Example: ${l.situation.title.toLowerCase()}${{ Email: ', and the request sends an email', Username: ', and the request sends a username', Both: ', and the request sends both an email and a username' }[l.sends] || ''}.`),
        h('span', { class: 'example__what' }, 'Ruled out: ', h('strong', {}, outcomeName(now.sample.outcome_id)), '.')) : null,
      h('p', { class: 'insp__text' }, `Of the ${count(t.pairs)} pairs of a modelled login and a result, this clause rules out ${count(now.pairs)}`,
        changed ? `, up from ${count(was.pairs)} in the earlier contract. The ${now.pairs - was.pairs} more are the 500s struck out above.` : '.',
        others.length ? [' ', others.map((o, i) => [i ? ' and ' : '', go(o, `Clause ${o.n}`)]), ' rules out each of these as well. This clause states the rule about the role on its own.'] : ''),
    ];
  }

  /* ---- Overview: what changed between the two printed contracts ---- */
  function overview() {
    const changed = model.clauses.filter((c) => c.change !== 'unchanged');
    const example = model.find('s:correct-password:0');
    const sources = changed[0];
    return {
      reading: [
        h('p', { class: 'insp__kicker' }, 'PDD Kit · ', h('code', {}, 'login_flow')),
        h('h1', { class: 'insp__title' }, 'What changed in the login contract'),
        h('p', { class: 'insp__lead' }, `The GitHub Next contract rules out HTTP 500 in ${t.changedSituations} of the ${t.situations} situations modelled here. It adds failure conditions to clauses ${listWords(changed.map((c) => c.n))}. The comments in the Microsoft Research post already described those conditions.`),
        h('p', { class: 'example' },
          h('span', {}, 'Take the right password for an existing account, with no lookup or signing failure.'),
          go(example, 'See why 200 or 500 became 200 only')),
        label('Changed clauses'),
        h('ul', { class: 'changes' }, changed.map((c) => h('li', {}, go(c, [
          miniDial(c, 'changes__dial'),
          h('span', { class: 'changes__title' }, caseName(c.caseId)),
          h('span', { class: 'changes__sub' }, `Clause ${c.n} · ${plural(c.changedSituations.length, 'situation')}`),
        ], 'changes__go')))),
        h('p', { class: 'insp__aside' }, 'The allowed responses come from a finite model of the two listings. Nobody ran the app for this comparison.'),
        h('p', { class: 'insp__aside' },
          ext(model.documents[sources.before.source.document].url, 'Microsoft Research listing'), ' · ',
          ext(model.documents[sources.after.source.document].url, 'GitHub Next listing')),
        evidenceButton('Method and limits'),
      ],
      evidenceTitle: 'Method and limits',
      evidence: [
        h('div', { class: 'ev__text' },
          label('What was compared'),
          h('p', {}, `The model groups ${t.logins} login cases into ${t.situations} situations by request type and the lookup and signing failure conditions. Every case within a group allows the same HTTP response types in each version.`),
          h('p', {}, 'A response is allowed when it satisfies every clause in the model. “Lookup fails” and “signing fails” are settings of the model: they say the operation would fail if login reached it. They do not say login reached it.'),
          label('Method and limits'),
          h('ul', { class: 'facts' },
            fact(true, `Both listings were read from the public pages on ${longDate(model.readOn)}. Each one’s text matches the SHA-256 recorded in the comparison.`),
            fact(true, `The allowed responses come from a finite table: ${t.logins} modelled logins, each tried against ${t.resultForms} forms of result (${count(t.pairs)} pairs), using the clauses as parsed.`,
              'Clauses 2, 7 and 8 needed a choice about where a “matches” binding is in scope. The choice is the same for both contracts, and none of the three is a changed clause.'),
            fact(true, 'A checker compiled from Dafny accepted the list of changed logins and their conditions for this exact table.'),
            fact(false, 'Neither publication includes a Verus run, so this page does not show whether the Pet Store code meets either contract.'),
            fact(false, 'The comparison uses the published comments. It has no intent artifact or developer sign-off records to compare.'),
            fact(false, 'The map ties a trusted piece to a clause only where the clause refers to a failure condition that the piece’s assumed contract defines. Other dependencies are not drawn.'),
            fact(false, 'The clauses describe the result when the login future completes. Whether it completes is outside both contracts.')),
          h('p', { class: 'insp__aside figures' }, `Comparison ${model.api.id.slice(0, 10)}. Clause text read from the two pages on ${longDate(model.readOn)}.`)),
      ],
    };
  }
  function fact(have, text, caution) {
    const glyph = svg('svg', { viewBox: '0 0 12 12', width: 12, height: 12, 'aria-hidden': 'true', focusable: 'false' },
      have ? svg('circle', { cx: 6, cy: 6, r: 2.4, fill: 'currentColor' }) : svg('circle', { cx: 6, cy: 6, r: 3, fill: 'none', stroke: 'currentColor', 'stroke-dasharray': '1.2 1.3' }));
    return h('li', { class: `fact${have ? '' : ' fact--unknown'}` }, glyph, h('span', { class: 'fact__text' }, text, caution ? h('span', { class: 'fact__caution' }, caution) : null));
  }

  /* ---- One situation ---- */
  const ROW_WORD = { matching: 'right password', wrong: 'wrong password', unreadable: 'bad hash' };
  function situationView(x) {
    const mine = model.clauses.filter((c) => c.caseId === x.case.id && !c.aboutToken);
    const changedHere = x.changedClauses.map((id) => model.clauseById.get(id)).filter(Boolean);
    const revised = mine.filter((c) => c.change !== 'unchanged');
    const lostNames = listWords(RINGS.filter((r) => x.lost.includes(r.id)).map((r) => r.name));
    const where = `${x.failureCase}.`;
    const either = x.afterKinds.size > 1 ? ' The contract allows either result. It does not say which one login returns.' : '';
    let title, why;
    if (x.changed) {
      title = `A ${lostNames} is no longer allowed here`;
      why = changedHere.map((c) => h('p', { class: 'insp__text' }, 'The earlier ', go(c, `clause ${c.n}`), ` allows a ${lostNames} here. The corrected clause allows it only when `, codeNames(c.names), ` is true, and in this situation ${c.names.length > 1 ? 'neither is' : 'it is not'}.`));
    } else if (revised.length) {
      title = `Both contracts allow ${kindsWords(x.afterKinds)} here`;
      why = revised.map((c) => {
        const holding = c.names.filter((name) => x[FLAG[name]]);
        return h('p', { class: 'insp__text' }, 'The corrected ', go(c, `clause ${c.n}`), ' still allows a 500 here, because ', codeNames(holding), holding.length > 1 ? ' are both true.' : ' is true.', either);
      });
    } else {
      title = `Both contracts allow ${kindsWords(x.afterKinds)} here`;
      why = mine.map((c) => h('p', { class: 'insp__text' }, go(c, `Clause ${c.n}`), ' is printed the same in both. ', c.headline, '.'));
    }
    const step = (by, text, name) => h('button', { type: 'button', class: 'insp__step', 'aria-label': name, onclick: () => choose(map.neighbour(x.key, by), { focusDetails: true }) }, text);
    const exact = (side) => [...new Set(x.logins.flatMap((l) => l[side]))];
    const after = exact('after'), gone = exact('before').filter((o) => !after.includes(o));
    const perRow = new Set(x.logins.map((l) => l.after.join())).size > 1;
    const row = (a) => h('td', {}, a.verdict ? ROW_WORD[a.verdict] : h('span', { class: 'muted' }, 'no row'), a.fails ? h('span', { class: 'logins__fails' }, swatch('swatch--thin sw-db'), 'lookup fails') : null);
    const many = x.logins.length > 1;
    return {
      reading: [
        h('p', { class: 'insp__kicker' }, `Situation · ${x.case.name}`),
        h('h1', { class: 'insp__title' }, title),
        h('p', { class: 'insp__where' }, where),
        why,
        label(`Allowed responses by failure condition`),
        failTable(x.case.id, x),
        evidenceButton(many ? `See the ${x.logins.length} modelled logins` : 'See the modelled login'),
        h('p', { class: 'insp__steps' }, step(-1, '‹', 'Previous situation'), step(1, '›', 'Next situation'), h('span', {}, `${model.situations.indexOf(x) + 1} of ${t.situations} situations`)),
      ],
      evidenceTitle: `${x.title}: ${plural(x.logins.length, 'modelled login')}`,
      evidence: [
        h('div', { class: 'ev__text' },
          h('p', {}, many ? `Each of the ${x.logins.length} is allowed the same kinds of response. ` : '',
            `Earlier contract: ${kindsWords(x.beforeKinds)}. Corrected contract: ${kindsWords(x.afterKinds)}.`, many ? ' The logins differ in what the request sends and in what each account table holds.' : ''),
          h('table', { class: 'logins figures' },
            h('thead', {}, h('tr', {}, ['Request sends', 'Customer row', 'Admin row', perRow ? 'Exact result, corrected contract' : null].filter(Boolean).map((name) => h('th', { scope: 'col' }, name)))),
            h('tbody', {}, x.logins.map((l) => h('tr', {}, h('td', {}, l.sends), row(l.customer), row(l.admin), perRow ? h('td', {}, l.after.map(outcomeName).join('; ')) : null)))),
          h('p', { class: 'insp__aside' }, 'Right password, wrong password and bad hash are bcrypt’s verdict on the password for that row.'),
          label('Exact results allowed across them'),
          h('ul', { class: 'spec-exact' }, after.map((o) => h('li', {}, outcomeName(o))), gone.map((o) => h('li', { class: 'is-gone' }, outcomeName(o), ' (earlier contract only)')))),
      ],
    };
  }

  /* ---- One clause ---- */
  function clauseView(c) {
    const english = c.englishChanged ? tokenDiff(c.before.text.english, c.after.text.english) : null;
    const codeA = tidyCode(c.before.text.code), codeB = tidyCode(c.after.text.code);
    const code = c.codeChanged ? tokenDiff(codeA, codeB) : null;
    const side = (s, src) => h('span', { class: 'spec-side' }, VERSIONS[s].short, ' · ', sourceLine(s, src, model));
    const changed = c.change !== 'unchanged';
    const caseChanged = model.clauses.some((k) => k.caseId === c.caseId && k.change !== 'unchanged');
    const pieces = c.names.map((name) => ({ name, pieces: [...new Set(c.paths.filter((p) => p.via[1] === name).map((p) => model.trustedById.get(p.trusted_function)))] }));
    return {
      reading: [
        h('p', { class: 'insp__kicker' }, miniDial(c), `Clause ${c.n} of ${t.clauses} · ${c.aboutToken ? 'a rule about the token' : caseName(c.caseId)}`),
        h('h1', { class: 'insp__title' }, c.headline),
        quote(english ? marked(english.now, 'now') : c.after.text.english,
          !changed ? 'The printed comment. Comment and Verus are the same in both contracts.' : english ? 'The printed comment in the corrected contract. The marked words are new.' : 'The printed comment, word for word the same in both contracts.'),
        changed ? h('p', { class: 'insp__text' }, 'The earlier clause allows a 500 with no failure condition. The corrected clause allows a 500 only when ', codeNames(c.names), ' is true.') : null,
        evidenceButton(code ? 'Compare the two printed clauses' : 'Read the printed clause'),
        changed || (!caseChanged && !c.aboutToken) ? [label('Allowed responses by failure condition'), failTable(c.caseId, null)] : null,
        pieces.length ? [label('Assumptions behind the failure conditions'), pieces.map(({ name, pieces: functions }) => h('p', { class: 'insp__aside' },
          h('code', {}, name), ' depends on ',
          functions.map((piece, i) => [i ? ' and ' : '', go(piece, piece.name)]), '.'))] : null,
        ruledOut(c),
      ],
      evidenceTitle: `Clause ${c.n} as printed`,
      evidence: [
        code
          ? h('div', { class: 'spec-pair' },
            h('div', {}, side('before', c.before.source), h('code', { class: 'spec-code' }, marked(code.was, 'was'))),
            h('div', {}, side('after', c.after.source), h('code', { class: 'spec-code' }, marked(code.now, 'now'))))
          : [h('code', { class: 'spec-code' }, codeB),
            h('p', { class: 'ev__note' }, 'Printed the same in both contracts. ', sourceLine('before', c.before.source, model), ' · ', sourceLine('after', c.after.source, model))],
        code ? h('p', { class: 'ev__note' }, 'Strikethrough marks removals. Underlining marks additions.') : null,
        english ? [h('p', { class: 'insp__label' }, 'The comment, earlier and corrected'), h('div', { class: 'spec-pair' }, h('p', { class: 'spec-words' }, marked(english.was, 'was')), h('p', { class: 'spec-words' }, marked(english.now, 'now')))] : null,
      ],
    };
  }

  /* ---- One trusted piece ---- */
  function pieceView(p) {
    const added = p.comparison?.clauses_added.length || 0;
    const clean = (side) => p[side].text.code.replace(/[ \t]+$/gm, '').trimEnd();
    const diff = p.before && added ? tokenDiff(clean('before'), clean('after')) : null;
    const through = p.reachedBy.length ? p.via(p.reachedBy[0])[0] : [];
    const rel = (name, body) => h('div', { class: 'rel' }, h('p', { class: 'rel__name' }, name), body);
    return {
      reading: [
        h('p', { class: 'insp__kicker' }, pieceGlyph(), 'Trusted function'),
        h('h1', { class: 'insp__title insp__title--code' }, h('code', {}, p.name)),
        quote(inline(p.after.text.english), 'Its doc comment in the corrected contract.'),
        p.reachedBy.length
          ? rel('How the changed clauses use it', [
            h('p', {}, 'The login proof assumes this function returns an error exactly when ', h('code', {}, through.at(-1)), ' is true. ',
              through.length > 1 ? ['For a request that uses this lookup, ', h('code', {}, through[0]), ' is ', h('code', {}, through.at(-1)), '.'] : null),
            h('ul', { class: 'golist' }, p.reachedBy.map((c) => h('li', {}, go(c, [
              `Clause ${c.n} · 500 requires `, codeNames(c.names),
            ], 'golist__go'))))])
          : rel('In this comparison', h('p', {}, 'Verus does not check this function, and the login proof takes its contract on trust. The conditions added to clauses 3, 4 and 5 do not refer to it.')),
        rel('In the two publications', h('p', {}, !p.before ? 'Only the GitHub Next page prints this assumed contract, so the two versions cannot be compared.'
          : added ? 'The GitHub Next listing adds a clause to this assumed contract specifying when the lookup fails.' : 'Both publications print the same assumed contract.')),
        evidenceButton(diff ? 'Compare the two assumed contracts' : 'Read the assumed contract'),
      ],
      evidenceTitle: `${p.name}: the assumed contract as printed`,
      evidence: [
        diff ? h('div', { class: 'spec-pair' }, [['before', 'was'], ['after', 'now']].map(([side, mark]) => h('div', {},
          h('span', { class: 'spec-side' }, VERSIONS[side].short, ' · ', sourceLine(side, p[side].source, model)),
          h('code', { class: 'spec-code' }, marked(diff[mark], mark))))) : [
          h('span', { class: 'spec-side' }, VERSIONS.after.short, ' · ', sourceLine('after', p.after.source, model)),
          h('code', { class: 'spec-code' }, p.after.text.code),
          p.before ? h('p', { class: 'ev__note' }, 'Also printed in the ', sourceLine('before', p.before.source, model), '.')
            : h('p', { class: 'ev__note' }, 'The Microsoft Research listing omits this contract.'),
        ],
      ],
    };
  }

  /* ---- The same 18 situations as a table ---- */
  const sheetRows = new Map();
  function buildSheet() {
    const cells = (x, side) => h('td', { class: `sheet__allowed is-${side}` },
      RINGS.filter((r) => x[`${side}Kinds`].has(r.id)).map((r) => chip(r.id)));
    sheet.replaceChildren(h('table', { class: 'sheet__table' },
      h('caption', {}, `The ${t.situations} situations and the responses each printed contract allows`),
      h('thead', {}, h('tr', {}, ['Request', 'Failure conditions', 'Earlier allows', 'Corrected allows', 'Removed by'].map((name, i) => h('th', { scope: 'col', class: i === 2 ? 'is-before' : i === 3 ? 'is-after' : null }, name)))),
      CASES.map((kind) => h('tbody', {}, model.situations.filter((x) => x.case === kind).map((x, i, all) => {
        const clauses = x.changedClauses.map((id) => model.clauseById.get(id)).filter(Boolean);
        const tr = h('tr', { class: x.changed ? 'is-changed' : null, tabindex: 0, onclick: () => choose(x.key),
          onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(x.key); } },
          onpointerenter: () => point(x.key), onpointerleave: () => point(null) },
        i === 0 ? h('th', { scope: 'rowgroup', rowspan: all.length }, kind.name) : null,
        h('td', {}, x.failureCase), cells(x, 'before'), cells(x, 'after'),
        h('td', { class: 'sheet__by' }, clauses.length ? [x.lost.map((id) => chip(id, true)), ' · ', clauses.map((c) => `Clause ${c.n}`).join(', ')] : ''));
        sheetRows.set(x.key, tr);
        return tr;
      })))));
  }
  buildSheet();

  /* ---- Keys ---- */
  figure.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); choose(map.neighbour(state.chosen?.startsWith('s:') ? state.chosen : null, e.key === 'ArrowRight' ? 1 : -1)); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (state.evidence) openEvidence(false); else if (state.chosen) choose(null);
  });

  // Restore the version, selection and evidence from a shared link.
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    choose(p.get('o'), { quiet: true, linkedEvidence: p.get('e') === '1' });
    setVersion(p.get('v') === 'before' ? 'before' : 'after', { quiet: true });
  }
  window.addEventListener('hashchange', () => { if (location.hash !== '#main') readHash(); });
  readHash();
}
