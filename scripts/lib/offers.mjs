const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateValid = value => typeof value === 'string' && datePattern.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function validateOffer(offer) {
  const errors = [];
  for (const key of ['id', 'destinationCity', 'destinationCountry', 'airline', 'sourceName']) if (typeof offer[key] !== 'string' || !offer[key].trim()) errors.push(`${key} obrigatório`);
  for (const key of ['origin', 'destination']) if (!/^[A-Z]{3}$/.test(offer[key] || '')) errors.push(`${key} deve ser IATA`);
  if (!['cash', 'miles'].includes(offer.type)) errors.push('type inválido');
  if (!['domestic', 'international'].includes(offer.region)) errors.push('region inválida');
  if (!finite(offer.price) || offer.price <= 0) errors.push('price inválido');
  if (offer.currency !== 'BRL') errors.push('moeda não suportada');
  if (offer.type === 'miles' && !offer.program) errors.push('programa de pontos obrigatório');
  if (offer.taxes !== null && !finite(offer.taxes)) errors.push('taxes inválidas');
  if (!['oneway', 'roundtrip'].includes(offer.tripType)) errors.push('tripType inválido');
  if (!dateValid(offer.departureDate)) errors.push('data de ida inválida');
  if (offer.tripType === 'roundtrip' && (!dateValid(offer.returnDate) || offer.returnDate < offer.departureDate)) errors.push('data de volta inválida');
  if (offer.tripType === 'oneway' && offer.returnDate != null) errors.push('só ida não pode ter volta');
  if (!Number.isFinite(Date.parse(offer.observedAt))) errors.push('observedAt inválido');
  if (!Number.isFinite(Date.parse(offer.validUntil)) || Date.parse(offer.validUntil) <= Date.parse(offer.observedAt)) errors.push('validUntil obrigatório após observação');
  if (Date.parse(offer.validUntil) - Date.parse(offer.observedAt) > 48 * 3600000) errors.push('TTL máximo de 48 horas');
  if (!['advertised', 'verified'].includes(offer.availability)) errors.push('availability inválida');
  try { const url = new URL(offer.sourceUrl); if (url.protocol !== 'https:' || url.username || url.password) errors.push('fonte deve ser HTTPS pública'); } catch { errors.push('sourceUrl inválida'); }
  return errors;
}

export function normalizeOffers(input, now = new Date()) {
  const rejected = [];
  const unique = new Map();
  const today = now.toISOString().slice(0, 10);
  for (const offer of input) {
    const errors = validateOffer(offer);
    if (errors.length) { rejected.push({ id: offer.id, errors }); continue; }
    if (Date.parse(offer.validUntil) <= now.getTime() || offer.departureDate < today || Date.parse(offer.observedAt) > now.getTime() + 300000) continue;
    const key = [offer.origin, offer.destination, offer.airline, offer.program, offer.type, offer.tripType, offer.departureDate, offer.returnDate || ''].join('|');
    const previous = unique.get(key);
    if (!previous || Date.parse(offer.observedAt) > Date.parse(previous.observedAt) || (offer.observedAt === previous.observedAt && offer.price < previous.price)) unique.set(key, offer);
  }
  return { offers: [...unique.values()], rejected };
}

// Só compara preços da mesma unidade e do mesmo itinerário.
export function compareOffers(a, b) {
  if (a.type !== b.type) return a.type === 'cash' ? -1 : 1;
  return a.price - b.price;
}
