"""Write the clause text the map shows, read again from the two public pages.

The comparison API gives each clause's source document, line span and SHA-256,
but not the words. This reads the same two pages with the backend's own reader,
checks each document's SHA-256 against the release's snapshots, and saves the
comment and the code for every node. It writes nothing unless every hash matches.
"""
import json, sys
from datetime import date
from pathlib import Path

backend, site = Path(sys.argv[1]), Path(sys.argv[2])
sys.path.insert(0, str(backend))
import sources, graph  # noqa: E402

catalog = json.loads((site / "api/v1/index.json").read_text())["data"]
release = site / "api/v1" / Path(catalog["release"]["href"]).parent
docs = {d.id: d for d in sources.microsoft_documents(sources.read_url(sources.MICROSOFT))}
gh = sources.github_next_document(sources.read_url(sources.GITHUB_NEXT))
docs[gh.id] = gh

out = {"release_id": catalog["release_id"], "read_on": date.today().isoformat(), "documents": {}, "nodes": {}}
for side in ("before", "after"):
    snap = json.loads((release / f"snapshots/{side}.json").read_text())["data"]
    for record in snap["sources"]:
        doc = docs[record["id"]]
        if sources.digest(doc.text) != record["sha256"]:
            raise SystemExit(f"{record['id']}: the page text no longer matches the release")
        out["documents"][record["id"]] = {"sha256": record["sha256"], "url": record["url"], "lines": record["lines"]}
    nodes = out["nodes"][side] = {}
    for node in snap["nodes"]:
        src = node.get("source")
        if not src:
            continue
        lines = docs[src["document"]].text.splitlines()
        entry = {"document": src["document"], "from": src["from"], "to": src["to"],
                 "code": "\n".join(lines[src["from"] - 1:src["to"]])}
        if node["kind"] == "ensures_clause":
            entry["english"] = graph.english_before(lines, src["from"])
        else:
            doc_lines = []
            for line in reversed(lines[:src["from"] - 1]):
                s = line.strip()
                if s.startswith("///"):
                    doc_lines.append(s[3:].strip())
                elif s.startswith("#["):
                    continue
                else:
                    break
            entry["english"] = " ".join(reversed(doc_lines))
        nodes[node["id"]] = entry
(site / "data/source-text.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
print("documents", len(out["documents"]), "nodes", {k: len(v) for k, v in out["nodes"].items()})
