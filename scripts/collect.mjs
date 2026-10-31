import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeOffers, compareOffers } from './lib/offers.mjs';
import { buildRepositionOffers } from './lib/reposition.mjs';

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}

/** Prioridades somadas dos perfis (`/api/demand`). Sem resposta, a coleta segue só com as fontes fixas. */
export async function readDemand({ root = process.cwd(), fetchImpl = fetch } = {}) {
  const site = (await readJson(resolve(root, 'deployment.json'), {})).url;
  const url = process.env.ROTA_LEVE_DEMAND_URL || (site ? `${site}/api/demand` : null);
  if (!url) return [];
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return [];
    const body = await response.json();
    // Só campos estruturados chegam ao coletor; nada de texto livre vindo dos perfis.
    return (Array.isArray(body?.priorities) ? body.priorities : []).filter((wish) => ['FOR', 'REC'].includes(wish?.origin) && (wish.destination === null || /^[A-Z]{3}$/.test(wish.destination ?? '')) && Number.isInteger(wish.people) && wish.people > 0);
  } catch { return []; }
}

export async function collect({ offline = false, root = process.cwd(), now = new Date() } = {}) {
  const config = await readJson(resolve(root, 'config/sources.json'), { sources: [] });
  const observations = await readJson(resolve(root, 'sources/observations.json'), { offers: [] });
  const previous = await readJson(resolve(root, 'site/data/offers.json'), { offers: [] });
  const candidates = await readJson(resolve(root, 'sources/reposition-candidates.json'), { candidates: [] });
  let live = { offers: [], sources: [] };
  let demand = [];
  if (!offline) {
    const { collectAirlinePages } = await import('./providers/airline-pages.mjs');
    demand = await readDemand({ root });
    live = await collectAirlinePages({ now, sources: config.sources, demand });
  }
  // Observações antigas mantêm seu horário original: nunca renovamos validade
  // sem consultar novamente a fonte. Combinações são recalculadas abaixo.
  const combined = [...previous.offers.filter(o => !o.reposition), ...observations.offers, ...live.offers];
  const { offers: normalized, rejected } = normalizeOffers(combined, now);
  const reposition = buildRepositionOffers(normalized, candidates.candidates, now);
  const offers = [...normalized.filter(o => ['FOR', 'REC'].includes(o.origin)), ...reposition].sort(compareOffers);
  const sources = offline
    ? [{ id: 'agent-observations', name: 'Pesquisa nas páginas oficiais', status: 'manual', count: offers.length }]
    : live.sources;
  const ok = sources.filter(s => s.status === 'ok');
  const result = {
    schemaVersion: 1,
    updatedAt: now.toISOString(),
    mode: offers.length ? 'live' : 'empty',
    coverage: {
      summary: 'Anúncios públicos das fontes identificadas em cada oferta. A cobertura varia por companhia e programa; disponibilidade e preço final precisam ser confirmados na emissão.',
      sources,
      airlines: [...new Set(offers.map(o => o.airline))],
      programs: [...new Set(offers.map(o => o.program).filter(Boolean))],
      exhaustive: false,
    },
    run: {
      kind: offline ? 'observations' : 'collector',
      lastAttemptAt: now.toISOString(),
      lastSuccessAt: ok.length ? now.toISOString() : previous.run?.lastSuccessAt || null,
      status: offline ? 'manual' : ok.length ? (sources.some(s => s.status !== 'ok') ? 'partial' : 'ok') : 'failed',
      schedule: { enabled: process.env.GITHUB_ACTIONS === 'true', timeZone: 'America/Sao_Paulo', times: ['00:17', '06:17', '12:17', '18:17'] },
      rejectedCount: rejected.length,
    },
    offers,
  };
  const directory = resolve(root, 'site/data');
  await mkdir(directory, { recursive: true });
  const destination = resolve(directory, 'offers.json');
  const temp = destination + '.tmp';
  await writeFile(temp, JSON.stringify(result, null, 2) + '\n');
  await rename(temp, destination);
  console.log(JSON.stringify({ offers: offers.length, reposition: reposition.length, demand: demand.length, priorityPages: sources.filter(s => s.priority).length, sourcesOk: ok.length, sourceFailures: sources.filter(s => ['error', 'unparsed'].includes(s.status)).map(s => s.name), rejected: rejected.map(r => r.id), mode: result.run.status }));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  collect({ offline: process.argv.includes('--offline') }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
