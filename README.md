# PDD Kit spec change map

PDD Kit's `login_flow` contract has been published twice: in a
[Microsoft Research post](https://www.microsoft.com/en-us/research/blog/formally-verifying-agent-written-full-stack-web-apps-with-pdd-kit/#step-5-reading-the-spec)
and, with three clauses corrected, on the
[GitHub Next page](https://githubnext.com/projects/pdd-kit/#an-overview-of-loginrs).
This map shows what the correction changed: which Verus clauses differ, which
HTTP responses each version allows, and which trusted functions the changed
clauses depend on.

[Open the map](https://wcook04.github.io/pdd-spec-change-map/)

## The change in one example

Take a login with the right password for an existing account, where the account
lookup and the token signing both work.

- The Microsoft Research listing allows a token or an HTTP 500.
- The GitHub Next listing allows only a token.

[Open this case in the map](https://wcook04.github.io/pdd-spec-change-map/#o=s%3Acorrect-password%3A0)

## What changed

The GitHub Next listing adds a failure condition to the HTTP 500 branch of
three clauses. In the finite model behind the map, that removes HTTP 500 from
5 of 18 situations and adds no response anywhere.

| Clause | The corrected clause allows HTTP 500 only when | Situations that lose HTTP 500 |
|---|---|---:|
| 3 · Right password | the lookup or the signing fails | 1 |
| 4 · Account not on file | the lookup fails | 2 |
| 5 · Wrong password | the lookup fails | 2 |

The comments printed above these clauses in the Microsoft Research listing
already limit the 500 to those failures. The Verus under them did not. The
comment on clause 3 was reworded in the GitHub Next listing, and the comments
on clauses 4 and 5 are word for word the same in both.

## How to read a change in the map

1. **Table** lists all 18 situations with the responses each version allows.
   The last column names the clause that removed a response. In **Map**, the
   same response is a hatched block with its number crossed out.
2. Click a situation, then the clause it links to. **Compare the two printed
   clauses** shows the two Verus excerpts side by side, with a link to each
   publication. The address bar holds a link to that exact view.
3. From a clause, follow a function name to see what the login proof assumes
   about the account lookup or the token signing. Both listings print the
   assumed contract for the customer lookup. Only the GitHub Next listing
   prints the ones for the admin lookup and the token signing, so those two
   cannot be compared.

## How the comparison was made

The comparison is a finite model. It checks 162 modelled logins against 15
forms of result, and a response counts as allowed when it satisfies every
clause. The page groups the 162 logins into 18 situations by the kind of
request and by whether the lookup and the signing fail. Within a situation,
every login is allowed the same kinds of HTTP response in a given version.

A checker compiled from Dafny accepted the list of changed logins and their
failure conditions for that table.
[Check record](site/api/v1/releases/21a7b6939d0e347c65e2ca244fc69b10666ff2d3d543431d3b1e062004d3df43/analysis/interpreted/region-check.json)

## What the map does not show

- **What Pet Store returns.** Nobody ran the app. "Allowed" is a statement
  about the printed contract.
- **Whether the code meets either contract.** Neither publication includes a
  Verus run.
- **What the team approved.** The comparison uses the printed comments. It has
  no intent artifact and no sign-off record.
- **Every dependency on a trusted function.** The map links a clause to a
  trusted function only through the failure conditions added to clauses 3, 4
  and 5.
- **Whether login reaches a failing operation.** "Lookup fails" and "signing
  fails" are settings of the model. For a request with no email and no
  username, for example, the model still has a "signing fails" setting.

One reading choice affects the model: where a `matches` binding is in scope in
clauses 2, 7 and 8. The same choice is used for both listings, and none of
those three clauses changed.

## Run it locally

```sh
python3 -m http.server 8743 --bind 127.0.0.1 --directory site
```

Then open [http://127.0.0.1:8743/](http://127.0.0.1:8743/).

## Where each part comes from

| Part | Source |
|---|---|
| Page shell and controls | Adapted from the [Practical Formal Verification explorer](https://github.com/wcook04/practical-formal-verification/tree/552ec9a867/frontend). |
| [Map drawing](site/src/specmap.js), [details and table](site/src/main.js), [styles](site/assets/spec.css) | Written for this map, reusing that explorer's sector shapes, curved labels, cards and switches. |
| [Comparison data](site/api/v1/index.json) | A saved export of the comparison: the allowed responses, the changed clauses and the links from clauses to trusted functions. |
| [Source excerpts](site/data/source-text.json) | Saved by [the extraction script](tools/make_source_text.py), which stops unless each publication's text matches the hash recorded in the comparison. |
