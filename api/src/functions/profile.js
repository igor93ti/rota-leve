import { app } from '@azure/functions';
import { handleDemand, handleProfile } from '../lib/handlers.js';
import { parsePrincipal } from '../lib/profiles.js';
import { storeFromEnv } from '../lib/store.js';

const store = storeFromEnv(process.env);
const unavailable = { status: 502, headers: { 'Cache-Control': 'no-store' }, jsonBody: { error: 'Não foi possível acessar os perfis agora. Tente novamente em instantes.' } };

app.http('profile', {
  route: 'profile',
  methods: ['GET', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const contentLength = Number(request.headers.get('content-length') || 0);
    try {
      return await handleProfile({
        method: request.method,
        principal: parsePrincipal(request.headers.get('x-ms-client-principal')),
        contentType: request.headers.get('content-type') || '',
        contentLength,
        rawBody: request.method === 'PUT' && contentLength <= 8192 ? await request.text() : '',
        store,
      });
    } catch (error) {
      context.error(`Falha no perfil: ${error.message}`);
      return unavailable;
    }
  },
});

app.http('demand', {
  route: 'demand',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (_request, context) => {
    try { return await handleDemand({ store }); }
    catch (error) { context.error(`Falha na demanda: ${error.message}`); return unavailable; }
  },
});
