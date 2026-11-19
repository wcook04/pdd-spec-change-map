// Reads one pinned comparison release by following its links, as the backend
// handoff asks: catalog, then manifest, then each resource relative to the
// manifest. Every resource must carry the catalog's release id.

import { BASE } from './base.js';

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url.pathname} answered ${response.status}`);
  return response.json();
}

async function follow(base, link, releaseId) {
  const url = new URL(link.href, base);
  const body = await getJson(url);
  if (body.api_version !== 1) throw new Error(`${url.pathname} has an API version this page does not read`);
  if (body.release_id && body.release_id !== releaseId) throw new Error(`${url.pathname} belongs to a different release`);
  return { url, data: body.data };
}

export async function load() {
  const catalogUrl = new URL(`${BASE}api/v1/index.json`, location.href);
  const catalog = (await getJson(catalogUrl)).data;
  const id = catalog.release_id;
  const manifest = await follow(catalogUrl, catalog.release, id);
  const m = manifest.data;
  const interpreted = m.modes.interpreted;
  if (!m.postconditions || !interpreted.links.worlds) throw new Error('This release has no evaluated comparison to draw');
  const at = (link) => follow(manifest.url, link, id).then((r) => r.data);
  const [postconditions, diff, before, after, summary, worlds, evidence, receipt, text] = await Promise.all([
    at(m.postconditions), at(m.graph_diff), at(m.revisions.before.resource), at(m.revisions.after.resource),
    at(interpreted.links.summary), at(interpreted.links.worlds), at(interpreted.links.verification_evidence),
    interpreted.links.region_check ? getJson(new URL(interpreted.links.region_check.href, manifest.url)) : null,
    getJson(new URL(`${BASE}data/source-text.json`, location.href)),
  ]);
  if (text.release_id !== id) throw new Error('The saved clause text belongs to a different release');
  return { id, manifest: m, postconditions, diff, before, after, summary, worlds, evidence, receipt, text };
}
