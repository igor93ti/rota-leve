import { createHash, randomUUID } from 'node:crypto';

export const ORIGINS = ['FOR', 'REC'];
export const MAX_PRIORITIES = 5;
export const MAX_WINDOW_DAYS = 62;
const PAYMENTS = ['any', 'cash', 'miles'];
const TRIPS = ['any', 'oneway', 'roundtrip'];
const PROVIDERS = ['aad', 'github'];

export const today = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(now);
const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (first, last) => Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000);

function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

/** Lê o cabeçalho que o Static Web Apps injeta depois do login; o cliente não consegue forjá-lo. */
export function parsePrincipal(header) {
  if (typeof header !== 'string' || !header || header.length > 8192) return null;
  try {
    const principal = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    if (typeof principal?.userId !== 'string' || !principal.userId || !PROVIDERS.includes(principal.identityProvider)) return null;
    return { userId: principal.userId, provider: principal.identityProvider };
  } catch { return null; }
}

// O banco guarda só um hash do identificador do login, nunca nome, e-mail ou o id bruto do provedor.
export const profileId = (principal) => createHash('sha256').update(`${principal.provider}:${principal.userId}`).digest('hex').slice(0, 40);

/**
 * Valida o perfil enviado pelo navegador. Destinos são códigos IATA e não há texto livre:
 * as prioridades chegam ao agente de busca, então nada escrito pelo usuário vira instrução.
 */
export function normalizeProfile(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { errors: ['Perfil inválido.'] };
  const list = input.priorities ?? [];
  if (!Array.isArray(list)) return { errors: ['Lista de datas inválida.'] };
  if (list.length > MAX_PRIORITIES) return { errors: [`Use no máximo ${MAX_PRIORITIES} datas prioritárias.`] };
  const start = today(now);
  const limit = addDays(start, 365);
  const errors = [];
  const priorities = [];
  list.forEach((item, index) => {
    const label = `Data ${index + 1}`;
    if (!item || typeof item !== 'object') { errors.push(`${label}: formato inválido.`); return; }
    const { origin, from, to } = item;
    const destination = item.destination ?? null;
    const payment = item.payment ?? 'any';
    const tripType = item.tripType ?? 'any';
    if (!ORIGINS.includes(origin)) errors.push(`${label}: escolha Fortaleza ou Recife como origem.`);
    if (destination !== null && !(typeof destination === 'string' && /^[A-Z]{3}$/.test(destination))) errors.push(`${label}: destino inválido.`);
    if (destination === origin) errors.push(`${label}: o destino precisa ser diferente da origem.`);
    if (!PAYMENTS.includes(payment)) errors.push(`${label}: forma de pagamento inválida.`);
    if (!TRIPS.includes(tripType)) errors.push(`${label}: tipo de viagem inválido.`);
    if (!validDay(from) || !validDay(to)) { errors.push(`${label}: informe datas válidas.`); return; }
    if (from > to) errors.push(`${label}: a data inicial precisa vir antes da final.`);
    else if (daysBetween(from, to) > MAX_WINDOW_DAYS) errors.push(`${label}: use uma janela de até ${MAX_WINDOW_DAYS} dias.`);
    if (from > limit) errors.push(`${label}: escolha datas nos próximos 12 meses.`);
    // Janelas que já passaram saem do perfil em silêncio; as que começaram hoje ou antes são cortadas em hoje.
    if (to < start) return;
    const id = typeof item.id === 'string' && /^[a-z0-9-]{1,40}$/.test(item.id) ? item.id : randomUUID();
    priorities.push({ id, origin, destination, from: from < start ? start : from, to: to > limit ? limit : to, payment, tripType });
  });
  return errors.length ? { errors } : { value: { priorities } };
}

export function publicProfile(document, now = new Date()) {
  const start = today(now);
  return { priorities: (document.priorities || []).filter((priority) => priority.to >= start), updatedAt: document.updatedAt };
}

/** Junta pedidos iguais de pessoas diferentes para o coletor e o agente buscarem uma vez só. */
export function aggregateDemand(profiles, now = new Date()) {
  const start = today(now);
  const demand = new Map();
  for (const profile of profiles) {
    for (const priority of Array.isArray(profile?.priorities) ? profile.priorities : []) {
      if (!ORIGINS.includes(priority?.origin) || !validDay(priority.from) || !validDay(priority.to) || priority.to < start) continue;
      const entry = {
        origin: priority.origin,
        destination: /^[A-Z]{3}$/.test(priority.destination ?? '') ? priority.destination : null,
        from: priority.from < start ? start : priority.from,
        to: priority.to,
        payment: PAYMENTS.includes(priority.payment) ? priority.payment : 'any',
        tripType: TRIPS.includes(priority.tripType) ? priority.tripType : 'any',
      };
      const key = Object.values(entry).join('|');
      if (demand.has(key)) demand.get(key).people += 1;
      else demand.set(key, { ...entry, people: 1 });
    }
  }
  return [...demand.values()].sort((a, b) => b.people - a.people || a.from.localeCompare(b.from) || a.origin.localeCompare(b.origin));
}
