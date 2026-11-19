// Turns the comparison release into what the map draws: the 18 situations a
// login can be in (each one a group of modelled logins), the eight clauses of
// login_flow, and the six trusted pieces.
// Nothing here decides what a version allows; every allowed response,
// changed clause and path to an assumed contract is read from the release.

// Request categories adapted from PDD Kit's login explorer.
export const CASES = [
  { id: 'missing-identity', name: 'No email or username', account: null, password: null },
  { id: 'correct-password', name: 'Right password', account: 'Yes', password: 'Right' },
  { id: 'wrong-password', name: 'Wrong password', account: 'Yes', password: 'Wrong' },
  { id: 'unreadable-hash', name: 'Unreadable hash', account: 'Yes', password: 'Bad hash' },
  { id: 'unknown-account', name: 'Account not on file', account: 'No', password: null },
];

// The four responses a login can end in, from the token outward to 500.
export const RINGS = [
  { id: 'token', name: '200 with token' },
  { id: '400', name: '400' },
  { id: '401', name: '401' },
  { id: '500', name: '500' },
];

export const VERSIONS = {
  before: { short: 'Earlier', name: 'Earlier spec', where: 'Microsoft Research post' },
  after: { short: 'Corrected', name: 'Corrected spec', where: 'GitHub Next page' },
};

const FAILURE_CASES = ['Neither lookup nor signing fails', 'Signing fails', 'Lookup fails', 'Lookup and signing fail'];
const SENDS = { email: 'Email', username: 'Username', both: 'Both', neither: 'Neither' };
const TRUSTED_NAMES = {
  ex_customer_find_by_email: 'Customer::find_by_email',
  ex_admin_find_by_username: 'Admin::find_by_username',
  ex_generate_token: 'generate_token',
};
// Which part of the map a clause's stem reaches. The three clauses about a
// token sit with the right-password logins, the only ones that can end in one.
const CLAUSE_CASE = {
  'missing-identity': 'missing-identity', 'valid-token': 'correct-password', 'correct-password': 'correct-password',
  'unknown-account': 'unknown-account', 'wrong-password': 'wrong-password', 'unreadable-hash': 'unreadable-hash',
  'admin-role': 'correct-password', 'email-role': 'correct-password',
};

// The corrected clause in plain words, written for this page. The printed
// comment is always shown beside it as a quotation.
const HEADLINE = {
  'missing-identity': 'With neither an email nor a username, login returns 400',
  'valid-token': 'Login returns a token only for the account the request names, and only with its right password',
  'correct-password': 'With the right password, login must return a token when lookup and signing succeed',
  'unknown-account': 'If lookup succeeds and finds no account, login must return 401',
  'wrong-password': 'With the wrong password, login must return 401 when lookup succeeds',
  'unreadable-hash': 'If bcrypt cannot read the stored hash, login returns 500',
  'admin-role': 'A token has the admin role only for an admin found by username, with no email sent',
  'email-role': 'A token for a login by email always has the customer role',
};

export function outcomeName(id) {
  if (id === '400:expected-message') return '400 with today’s message';
  if (id === '400:other-message') return '400 with another message';
  if (id === 'other-error') return 'another error';
  if (id === 'token:unreadable') return '200 with a token that cannot be read';
  const token = /^token:(\w+)-id:([\w-]+)$/.exec(id);
  if (token) return `200 with token for ${token[1] === 'other' ? 'another account' : `that ${token[1]} account`}, role ${token[2] === 'other-role' ? 'neither customer nor admin' : `“${token[2]}”`}`;
  return id;
}

export function buildModel(api) {
  const kindOf = api.worlds.result_types;
  const kinds = (list) => new Set(list.map((o) => kindOf[o]));
  const caseIndex = new Map(CASES.map((c, i) => [c.id, i]));

  const logins = api.worlds.items.map((item) => {
    const c = CASES[caseIndex.get(item.request_case)];
    const quarter = (item.lookup_fails ? 2 : 0) + (item.world.signing_fails ? 1 : 0);
    return {
      id: item.id, key: `w:${item.id}`, case: c, quarter,
      sends: SENDS[item.world.identity], failureCase: FAILURE_CASES[quarter],
      dbFails: item.lookup_fails, signerFails: item.world.signing_fails,
      customer: { verdict: item.world.customer_verdict, fails: item.world.customer_lookup_fails },
      admin: { verdict: item.world.admin_verdict, fails: item.world.admin_lookup_fails },
      before: item.before_allowed, after: item.after_allowed,
      beforeKinds: kinds(item.before_allowed), afterKinds: kinds(item.after_allowed),
      removed: item.outcomes_removed, added: item.outcomes_added,
      witnesses: item.witnesses, changedClauses: item.changed_clause_ids,
      title: `${c.name}, ${FAILURE_CASES[quarter].toLowerCase()}`,
    };
  });
  logins.sort((a, b) => caseIndex.get(a.case.id) - caseIndex.get(b.case.id) || a.quarter - b.quarter || a.id - b.id);
  const loginById = new Map(logins.map((l) => [l.id, l]));

  // The rim of the map: one situation for each case and each state of the
  // database and signer. Its responses are the union over its logins, and
  // `uniform` records whether every login in it gets the same ones.
  const situations = [];
  for (const l of logins) {
    const key = `s:${l.case.id}:${l.quarter}`;
    let s = situations.find((x) => x.key === key);
    if (!s) {
      s = { key, case: l.case, quarter: l.quarter, failureCase: l.failureCase, dbFails: l.dbFails, signerFails: l.signerFails, title: l.title,
        logins: [], beforeKinds: new Set(), afterKinds: new Set(), changedClauses: [], uniform: true };
      situations.push(s);
    }
    const same = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));
    if (s.logins.length && !(same(s.logins[0].beforeKinds, l.beforeKinds) && same(s.logins[0].afterKinds, l.afterKinds))) s.uniform = false;
    s.logins.push(l);
    l.situation = s;
    for (const k of l.beforeKinds) s.beforeKinds.add(k);
    for (const k of l.afterKinds) s.afterKinds.add(k);
    for (const id of l.changedClauses) if (!s.changedClauses.includes(id)) s.changedClauses.push(id);
  }
  for (const s of situations) {
    s.lost = [...s.beforeKinds].filter((k) => !s.afterKinds.has(k));
    s.gained = [...s.afterKinds].filter((k) => !s.beforeKinds.has(k));
    s.changed = s.lost.length + s.gained.length > 0;
  }
  const situationByKey = new Map(situations.map((s) => [s.key, s]));

  const textOf = (side, id) => api.text.nodes[side][id] || null;
  const clauses = api.postconditions.items.map((item) => {
    const slug = item.id.split('::')[1];
    const analysis = item.analysis_by_mode.interpreted;
    return {
      id: item.id, key: `c:${item.id}`, n: item.after.ordinal, caseId: CLAUSE_CASE[slug],
      change: item.source_change,
      englishChanged: item.source_change === 'english_and_code' || item.source_change === 'english_only',
      codeChanged: item.source_change === 'english_and_code' || item.source_change === 'code_only',
      before: { ...item.before, text: textOf('before', item.id) },
      after: { ...item.after, text: textOf('after', item.id) },
      paths: item.after.failure_assumption_paths,
      // The failure conditions the corrected clause names: lookup_fails, signing_fails.
      names: [...new Set(item.after.failure_assumption_paths.map((p) => p.via[1]))],
      changedLogins: logins.filter((l) => l.changedClauses.includes(item.id)),
      changedSituations: situations.filter((s) => s.changedClauses.includes(item.id)),
      example: analysis.examples.find((e) => e.direction === 'removed') || analysis.examples[0] || null,
      headline: HEADLINE[slug],
      // A clause whose if-part is "a token came back" is a rule about the token, whatever the request.
      aboutToken: /^\(?r matches Ok/.test(textOf('after', item.id).code.trim()),
      ruledOut: Object.fromEntries([['before', 'microsoft'], ['after', 'github_next']].map(([side, rev]) => {
        const cover = api.summary.analysis_by_revision[rev].clause_coverage;
        const own = cover.clauses[item.id];
        const sample = own.example_unique_rejection || cover.rejection_groups.find((g) => g.clauses.includes(item.id))?.example || null;
        return [side, { pairs: own.rejected_pairs, alone: own.uniquely_rejected_pairs, coveredBy: own.implied_by_each_clause, sample }];
      })),
    };
  });
  // A clause is marked `apart` in a version when its comment makes the response
  // depend on a failure ("unless the lookup fails") and its code names no
  // failure condition. Both halves are read: the comment from the page, the
  // named failure conditions from the release.
  for (const c of clauses) {
    c.apart = {};
    for (const side of ['before', 'after']) {
      const names = (c[side].failure_assumption_paths || []).length > 0;
      c.apart[side] = /unless\b.*\bfail/i.test(c[side].text?.english || '') && !names;
    }
  }
  const clauseById = new Map(clauses.map((c) => [c.id, c]));

  const beforeNodes = new Map(api.before.nodes.map((n) => [n.id, n]));
  const shared = new Map(api.diff.shared_trusted_contracts.map((s) => [s.id, s]));
  const trusted = api.after.nodes.filter((n) => n.kind === 'trusted_function').map((node) => {
    const reached = clauses.filter((c) => c.paths.some((p) => p.trusted_function === node.id));
    return {
      id: node.id, key: `t:${node.id}`, name: TRUSTED_NAMES[node.id] || node.id,
      after: { source: node.source, text: textOf('after', node.id) },
      before: beforeNodes.get(node.id)?.source ? { source: beforeNodes.get(node.id).source, text: textOf('before', node.id) } : null,
      comparison: shared.get(node.id) || null,
      reachedBy: reached,
      failure: reached.length ? reached[0].paths.find((p) => p.trusted_function === node.id).via[1] : null,
      via: (clause) => clause.paths.filter((p) => p.trusted_function === node.id).map((p) => p.via.slice(1)),
    };
  });
  // The three pieces the corrected clauses refer to come first, then the rest.
  trusted.sort((a, b) => (b.reachedBy.length ? 1 : 0) - (a.reachedBy.length ? 1 : 0) || a.name.localeCompare(b.name));

  const wires = [];
  for (const c of clauses) for (const t of trusted) if (t.reachedBy.includes(c)) wires.push({ clause: c, trusted: t });

  const lost = logins.filter((l) => l.removed.length);
  const totals = {
    situations: situations.length, changedSituations: situations.filter((s) => s.changed).length,
    gainedSituations: situations.filter((s) => s.gained.length).length,
    apartBefore: clauses.filter((c) => c.apart.before).length, apartAfter: clauses.filter((c) => c.apart.after).length,
    logins: logins.length, lost: lost.length, gained: logins.filter((l) => l.added.length).length,
    clauses: clauses.length, changedClauses: clauses.filter((c) => c.change !== 'unchanged').length,
    resultForms: api.summary.result_candidate_count, pairs: api.summary.world_result_pairs,
  };
  return {
    api, logins, loginById, situations, clauses, clauseById, trusted, trustedById: new Map(trusted.map((t) => [t.id, t])), wires, totals,
    documents: api.text.documents, readOn: api.text.read_on,
    find(key) {
      if (!key) return null;
      const [kind, ...rest] = key.split(':');
      const id = rest.join(':');
      if (kind === 's') return situationByKey.get(key) || null;
      if (kind === 'w') return loginById.get(Number(id))?.situation || null;
      if (kind === 'c') return clauseById.get(id) || null;
      if (kind === 't') return this.trustedById.get(id) || null;
      return null;
    },
  };
}

/** Where two texts differ, token by token: [text, 'same' | 'was' | 'now']. */
export function tokenDiff(a, b) {
  const split = (s) => s.split(/(\s+|==>|<==>|&&|\|\||[(),])/).filter((t) => t !== '');
  const x = split(a), y = split(b);
  const m = x.length, n = y.length;
  const table = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
  for (let i = m - 1; i >= 0; i -= 1) for (let j = n - 1; j >= 0; j -= 1) {
    table[i][j] = x[i] === y[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const was = [], now = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && x[i] === y[j]) { was.push([x[i], 'same']); now.push([y[j], 'same']); i += 1; j += 1; }
    else if (j < n && (i === m || table[i][j + 1] >= table[i + 1][j])) { now.push([y[j], 'now']); j += 1; }
    else { was.push([x[i], 'was']); i += 1; }
  }
  return { was, now };
}

/** A clause's code with a line for its if-part, its then-part and each && or ||. */
export function tidyCode(code) {
  return code.replace(/\s+/g, ' ').trim().replace(/,$/, '').replace(/ (&&|\|\|) /g, '\n    $1 ').replace(/ ==> /, '\n  ==> ');
}
