import { createHmac } from 'node:crypto';

// Cliente REST mínimo do Cosmos DB for NoSQL, sem SDK, para a API não depender de outros pacotes.
// https://learn.microsoft.com/en-us/rest/api/cosmos-db/access-control-on-cosmosdb-resources
const API_VERSION = '2018-12-31';

export function cosmosAuthorization({ verb, resourceType, resourceLink, date, key }) {
  const payload = `${verb.toLowerCase()}\n${resourceType.toLowerCase()}\n${resourceLink}\n${date.toLowerCase()}\n\n`;
  const signature = createHmac('sha256', Buffer.from(key, 'base64')).update(payload).digest('base64');
  return encodeURIComponent(`type=master&ver=1.0&sig=${signature}`);
}

export function createCosmosStore({ endpoint, key, database, container, fetchImpl = fetch }) {
  const collection = `dbs/${database}/colls/${container}`;

  async function send(method, resourceLink, { path = resourceLink, partitionKey, headers = {}, body } = {}) {
    for (let attempt = 0; ; attempt += 1) {
      const date = new Date().toUTCString();
      const response = await fetchImpl(new URL(`/${path}`, endpoint), {
        method,
        headers: {
          authorization: cosmosAuthorization({ verb: method, resourceType: 'docs', resourceLink, date, key }),
          'x-ms-date': date,
          'x-ms-version': API_VERSION,
          ...(partitionKey === undefined ? {} : { 'x-ms-documentdb-partitionkey': JSON.stringify([partitionKey]) }),
          ...headers,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      // 429 indica que a conta chegou ao teto de RU/s; o limite da conta impede cobrança, então só esperamos.
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(Number(response.headers.get('x-ms-retry-after-ms')) || 500, 3000)));
        continue;
      }
      return response;
    }
  }

  const fail = (method, response) => new Error(`Cosmos ${method} respondeu HTTP ${response.status}.`);

  return {
    async get(id) {
      const response = await send('GET', `${collection}/docs/${id}`, { partitionKey: id });
      if (response.status === 404) return null;
      if (!response.ok) throw fail('GET', response);
      return response.json();
    },
    async put(document) {
      const response = await send('POST', collection, { path: `${collection}/docs`, partitionKey: document.id, headers: { 'content-type': 'application/json', 'x-ms-documentdb-is-upsert': 'True' }, body: JSON.stringify(document) });
      if (!response.ok) throw fail('POST', response);
      return response.json();
    },
    async remove(id) {
      const response = await send('DELETE', `${collection}/docs/${id}`, { partitionKey: id });
      if (!response.ok && response.status !== 404) throw fail('DELETE', response);
    },
    async all() {
      const documents = [];
      let continuation;
      do {
        const response = await send('POST', collection, {
          path: `${collection}/docs`,
          headers: { 'content-type': 'application/query+json', 'x-ms-documentdb-isquery': 'True', 'x-ms-documentdb-query-enablecrosspartition': 'True', 'x-ms-max-item-count': '100', ...(continuation ? { 'x-ms-continuation': continuation } : {}) },
          body: JSON.stringify({ query: 'SELECT * FROM c', parameters: [] }),
        });
        if (!response.ok) throw fail('QUERY', response);
        documents.push(...(await response.json()).Documents);
        continuation = response.headers.get('x-ms-continuation');
      } while (continuation);
      return documents;
    },
  };
}

/** Armazenamento em memória para o servidor local e os testes. */
export function createMemoryStore(initial = []) {
  const documents = new Map(initial.map((document) => [document.id, structuredClone(document)]));
  return {
    async get(id) { return documents.has(id) ? structuredClone(documents.get(id)) : null; },
    async put(document) { documents.set(document.id, structuredClone(document)); return structuredClone(document); },
    async remove(id) { documents.delete(id); },
    async all() { return [...documents.values()].map((document) => structuredClone(document)); },
  };
}

export function storeFromEnv(env) {
  if (!env.COSMOS_ENDPOINT || !env.COSMOS_KEY) return null;
  return createCosmosStore({ endpoint: env.COSMOS_ENDPOINT, key: env.COSMOS_KEY, database: env.COSMOS_DATABASE || 'rotaleve', container: env.COSMOS_CONTAINER || 'profiles' });
}
