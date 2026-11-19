# Spec change map

A map of the two published versions of PDD Kit's `login_flow` contract: the
earlier one in the Microsoft Research post and the corrected one on the GitHub
Next page.

In the earlier version, the comments on clauses 3, 4 and 5 say a 500 is
permitted when the lookup or signing fails, and the Verus clauses under them
permit a 500 whether or not anything fails. The corrected clauses permit a 500
only on that failure.

Round the map there are 18 wedges, one for each situation: a kind of request,
and whether the lookup and the signing work. Each wedge is split into the
responses the contract on show allows there, and each block carries its
response as a label. A block that only the earlier contract allows is drawn
hollow. Inside the wedges, each of the eight ensures clauses is an arc with one
line for its Verus and one for its comment. The six trusted pieces are named
round the centre, and the centre reads out whatever the pointer is on.

The panel says what the chosen thing is. The overview lists what changed under
five headings: comments, Verus, allowed responses, failure conditions and
sign-offs. A clause shows its printed comment, the Verus the corrected contract
adds, the responses allowed by what fails, and how many of the comparison's
pairs of a login and a result the clause rules out, with one example. The
printed Verus, the modelled logins and the method open in a workspace beside a
smaller map. A key stays at the foot of the panel.

A Map and Table switch above the map shows the same 18 situations as rows, with
the responses each contract allows side by side.

"Allowed" means every clause of the contract accepts that response. Nobody ran
Pet Store for this page, so it does not show which allowed response login
returns.

Serve `site/` with any static file server.

## Where each part comes from

| Part | Source |
|---|---|
| Page shell, header lockup, panel, tools, key, dock, fonts, colours | Copied unchanged from `frontend/` in `wcook04/practical-formal-verification` at `origin/main` (552ec9a867): `index.html`, `assets/tokens.css`, `assets/app.css`, `assets/fonts/`, `src/dom.js`, `src/base.js`. |
| The map (`site/src/specmap.js`) | New SVG drawing in the grammar of that explorer's `src/map/engine.js`: the cell shape follows `cellPath`, arc text follows `drawArcText`, and a clause arc is `dialGlyph` from `src/dom.js` opened out along the situations the clause covers. |
| Panel markup (`site/src/main.js`) | The card pieces follow `src/views/explorer.js` and the readout cards, in one inspector with an evidence workspace; the Earlier/Corrected switch uses the `.segs` control from the ownership-repair figure in `src/views/proofparts.js`. |
| New styles | `site/assets/spec.css` only. It reads the explorer's tokens and adds no colours of its own. |
| Data | `site/api/` is a byte copy of the comparison backend's `api-export` (release `21a7b6939d…`). The page follows the catalog and manifest links and refuses a resource from another release. |
| Clause text | `site/data/source-text.json`, written by `tools/make_source_text.py`. It reads the two public pages again with the backend's own reader and stops unless each document's SHA-256 matches the release. |

## What the page computes and what it reads

Every allowed response, changed clause, path to an assumed contract and count
of results a clause rules out is read from the release. The plain-words
headline of each clause is written for this page and shown beside the printed
comment. The page groups the 162 modelled logins of the release
into the 18 situations and records, for each group, whether every login in it
is permitted the same kinds of response (in this release, all 18 are). It marks
a clause as broken in a version when the printed comment says "unless ... fails"
and the release lists no failure condition for the clause in that version. It
also marks token-level differences between two texts.

## Limits

- The permitted responses come from a finite table built from the clauses as
  parsed. Clauses 2, 7 and 8 needed a choice about where a `matches` binding is
  in scope; the choice is the same for both versions.
- Neither publication includes a Verus run, so nothing here says whether the
  Pet Store code meets either version.
- The comments are the ones printed above each clause. The page does not have
  PDD Kit's intent artifact or its sign-offs.
- The lines to trusted pieces are the failure conditions a corrected clause
  names. A clause can refer to a trusted piece in other ways, and those are
  not drawn.
