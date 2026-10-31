import { aggregateDemand, normalizeProfile, profileId, publicProfile } from './profiles.js';

const MAX_BODY = 8192;
const json = (status, body, headers = {}) => ({ status, headers: { 'Cache-Control': 'no-store', ...headers }, jsonBody: body });

/** Regras do perfil, independentes do Azure Functions: o servidor local usa o mesmo código. */
export async function handleProfile({ method, principal, contentType = '', contentLength = 0, rawBody = '', store, now = new Date() }) {
  if (!principal) return json(401, { error: 'Entre para usar seu radar pessoal.' });
  if (!store) return json(503, { error: 'Os perfis ainda não foram configurados neste ambiente.' });
  const id = profileId(principal);
  if (method === 'GET') {
    const document = await store.get(id);
    return json(200, { profile: document ? publicProfile(document, now) : null });
  }
  if (method === 'PUT') {
    // Exigir JSON impede que um formulário de outro site grave no perfil com o cookie de login.
    if (!/^application\/json\b/i.test(contentType)) return json(415, { error: 'Envie o perfil em JSON.' });
    if (contentLength > MAX_BODY || rawBody.length > MAX_BODY) return json(413, { error: 'Perfil grande demais.' });
    let input;
    try { input = JSON.parse(rawBody); } catch { return json(400, { error: 'Perfil inválido.' }); }
    const { value, errors } = normalizeProfile(input, now);
    if (errors) return json(400, { error: errors[0], errors });
    const existing = await store.get(id);
    const stamp = now.toISOString();
    const document = { id, schemaVersion: 1, ...value, createdAt: existing?.createdAt || stamp, updatedAt: stamp };
    await store.put(document);
    return json(200, { profile: publicProfile(document, now) });
  }
  if (method === 'DELETE') {
    await store.remove(id);
    return { status: 204, headers: { 'Cache-Control': 'no-store' } };
  }
  return json(405, { error: 'Método não permitido.' }, { Allow: 'GET, PUT, DELETE' });
}

/** Demanda agregada e anônima: só origem, destino IATA, datas e quantas pessoas pediram. */
export async function handleDemand({ store, now = new Date() }) {
  if (!store) return json(503, { error: 'Os perfis ainda não foram configurados neste ambiente.' });
  const priorities = aggregateDemand(await store.all(), now);
  return json(200, { generatedAt: now.toISOString(), priorities }, { 'Cache-Control': 'public, max-age=300' });
}
