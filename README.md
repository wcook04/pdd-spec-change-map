# PDD Kit spec change map

The map compares two published versions of PDD Kit’s `login_flow` contract. Give
the right password for an existing account and assume neither lookup nor token
signing fails. The Microsoft Research listing permits either a token or HTTP 500.
The GitHub Next listing permits only a token in that case.

[Open the map](https://wcook04.github.io/pdd-spec-change-map/) · [See the right-password case](https://wcook04.github.io/pdd-spec-change-map/#o=s%3Acorrect-password%3A0)

## What changed

GitHub Next adds a failure condition to the HTTP 500 branch of three Verus
clauses. In the finite model used by the map, those edits remove HTTP 500 from
five of the 18 situations and add no responses.

| Clause | When the corrected clause permits HTTP 500 | Situations that lose HTTP 500 |
|---|---|---:|
| 3 · Right password | Lookup or signing fails | 1 |
| 4 · Account not on file | Lookup fails | 2 |
| 5 · Wrong password | Lookup fails | 2 |

The earlier comments already describe those failure conditions. Clause 3’s
comment was reworded. The comments on clauses 4 and 5 stayed the same.
[Microsoft Research listing](https://www.microsoft.com/en-us/research/blog/formally-verifying-agent-written-full-stack-web-apps-with-pdd-kit/#step-5-reading-the-spec) · [GitHub Next listing](https://githubnext.com/projects/pdd-kit/#an-overview-of-loginrs)

## Review a change

1. Open **Table** to compare both versions across all 18 situations. The last
   column names the clause that removed a response. In **Map**, that response
   appears as a hatched and crossed-out block in the corrected version.
2. Select a situation and follow its clause link. **Compare the two printed
   clauses** opens the Verus excerpts and links to the publications. Copy the
   URL from the address bar to share that exact view.
3. Follow the function links to see what the login proof assumes about account
   lookup or token signing. For the customer lookup, the map shows the assumed
   contract in both listings. The Microsoft Research listing omits the admin
   lookup and token-signing contracts, so their earlier text is unknown.

## Run locally

From the repository root, serve the `site/` directory and open the map at
[http://127.0.0.1:8743/](http://127.0.0.1:8743/).

```sh
python3 -m http.server 8743 --bind 127.0.0.1 --directory site
```

## Where each part comes from

| Part | Source |
|---|---|
| Page shell and controls | Adapted from the [Practical Formal Verification explorer](https://github.com/wcook04/practical-formal-verification/tree/552ec9a867/frontend). |
| [Map drawing](site/src/specmap.js), [details and table](site/src/main.js), [styles](site/assets/spec.css) | The map adapts the explorer’s sector shapes and curved labels. The details and controls reuse its cards and switches. |
| [Comparison data](site/api/v1/index.json) | The saved API export supplies the allowed responses, changed clauses and links to trusted functions. |
| [Source excerpts](site/data/source-text.json) | [The extraction script](tools/make_source_text.py) saves the excerpts only after checking the source text against the release’s recorded hashes. |

## What the page computes and what it reads

The saved comparison checks 162 modelled login cases against 15 forms of
result. A response is allowed when it satisfies every clause in the model.
The page groups cases by request type and by the two failure conditions.
Within each group, all cases allow the same HTTP response types for a given
version. A saved Dafny check covers the group memberships, response changes
and failure conditions in that finite table. [Check record](site/api/v1/releases/21a7b6939d0e347c65e2ca244fc69b10666ff2d3d543431d3b1e062004d3df43/analysis/interpreted/region-check.json)

## Limits

- The model uses the same interpretation of `matches` binding scope in clauses
  2, 7 and 8 for both listings.
- The comparison uses the printed contracts and comments. It contains no Pet
  Store run, Verus verification result or developer sign-off.
- The map traces the trusted function contracts behind the added failure
  conditions. A failure flag describes an assumption about an operation that
  may never be reached in that case.
