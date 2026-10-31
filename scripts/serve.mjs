import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { handleDemand, handleProfile } from '../api/src/lib/handlers.js';
import { createMemoryStore, storeFromEnv } from '../api/src/lib/store.js';

const root = resolve('site');
const config = JSON.parse(await readFile(resolve(root, 'staticwebapp.config.json'), 'utf8'));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
// Sem COSMOS_ENDPOINT/COSMOS_KEY, os perfis ficam em memória e somem ao reiniciar o servidor.
const store = storeFromEnv(process.env) || createMemoryStore();

// Simula o login do Static Web Apps: um cookie local escolhe uma pessoa de teste por provedor.
function devPrincipal(req) {
  const provider = /(?:^|;\s*)rotaleve-dev-login=(aad|github)/.exec(req.headers.cookie || '')?.[1];
  return provider ? { identityProvider: provider, userId: `dev-${provider}`, userDetails: provider === 'aad' ? 'pessoa.teste@outlook.com' : 'pessoa-teste', userRoles: ['anonymous', 'authenticated'] } : null;
}
const localRedirect = (value) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';

async function readBody(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 8192) break; }
  return body;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const login = /^\/\.auth\/login\/(aad|github)$/.exec(pathname);
    if (login) {
      res.writeHead(302, { 'Set-Cookie': `rotaleve-dev-login=${login[1]}; Path=/; HttpOnly; SameSite=Lax`, Location: localRedirect(url.searchParams.get('post_login_redirect_uri')) }).end();
      return;
    }
    if (pathname === '/.auth/logout') {
      res.writeHead(302, { 'Set-Cookie': 'rotaleve-dev-login=; Path=/; Max-Age=0', Location: localRedirect(url.searchParams.get('post_logout_redirect_uri')) }).end();
      return;
    }
    if (pathname === '/.auth/me') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }).end(JSON.stringify({ clientPrincipal: devPrincipal(req) }));
      return;
    }
    if (pathname === '/api/profile' || pathname === '/api/demand') {
      const principal = devPrincipal(req);
      const result = pathname === '/api/demand'
        ? await handleDemand({ store })
        : await handleProfile({ method: req.method, principal: principal && { userId: principal.userId, provider: principal.identityProvider }, contentType: req.headers['content-type'] || '', contentLength: Number(req.headers['content-length'] || 0), rawBody: req.method === 'PUT' ? await readBody(req) : '', store });
      res.writeHead(result.status, { ...result.headers, ...(result.jsonBody === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' }) });
      res.end(result.jsonBody === undefined ? undefined : JSON.stringify(result.jsonBody));
      return;
    }
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { ...config.globalHeaders, 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { if (!res.headersSent) res.writeHead(404).end('Não encontrado'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Rota Leve: http://127.0.0.1:${port}${process.env.COSMOS_ENDPOINT ? '' : ' (perfis em memória)'}`));
