const amount = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const instant = s => typeof s === 'string' && /(Z|[+-]\d\d:\d\d)$/.test(s) && Number.isFinite(Date.parse(s));

// Uma proposta exige os três bilhetes comparáveis, horários completos e custos
// adicionais explícitos. Não transforma anúncios sem horários em recomendação.
export function evaluateReposition({ positioning, onward, direct, extraCosts, minimumSavings = 300, minimumSavingsPercent = 0.15, minimumBufferHours = 8 }) {
  if (!positioning || !onward || !direct || !extraCosts) return null;
  const tickets = [positioning, onward, direct];
  if (tickets.some(t => t.type !== 'cash' || t.currency !== 'BRL' || !amount(t.price) || t.price === 0 || t.taxesIncluded !== true || !t.baggageAllowance || !instant(t.departureAt) || !instant(t.arrivalAt) || Date.parse(t.arrivalAt) <= Date.parse(t.departureAt))) return null;
  if (positioning.origin !== direct.origin || positioning.destination !== onward.origin || onward.destination !== direct.destination || onward.origin === direct.origin) return null;
  if (tickets.some(t => !['oneway', 'roundtrip'].includes(t.tripType)) || new Set(tickets.map(t => t.tripType)).size !== 1) return null;
  if (new Set(tickets.map(t => t.baggageAllowance)).size !== 1) return null;
  if (onward.departureDate !== direct.departureDate || onward.returnDate !== direct.returnDate) return null;
  if (!['baggage', 'groundTransport', 'overnight'].every(k => amount(extraCosts[k]))) return null;
  const bufferHours = (Date.parse(onward.departureAt) - Date.parse(positioning.arrivalAt)) / 3600000;
  if (bufferHours < minimumBufferHours || bufferHours > 48) return null;
  let returnBufferHours = null;
  if (onward.tripType === 'roundtrip') {
    if (tickets.some(t => !instant(t.returnDepartureAt) || !instant(t.returnArrivalAt) || Date.parse(t.returnArrivalAt) <= Date.parse(t.returnDepartureAt) || Date.parse(t.returnDepartureAt) <= Date.parse(t.arrivalAt))) return null;
    returnBufferHours = (Date.parse(positioning.returnDepartureAt) - Date.parse(onward.returnArrivalAt)) / 3600000;
    if (returnBufferHours < minimumBufferHours || returnBufferHours > 48) return null;
  }
  const extras = extraCosts.baggage + extraCosts.groundTransport + extraCosts.overnight;
  const total = Math.round((positioning.price + onward.price + extras) * 100) / 100;
  const savings = Math.round((direct.price - total) * 100) / 100;
  if (savings < minimumSavings || savings / direct.price < minimumSavingsPercent) return null;
  return { via: onward.origin, positioningPrice: positioning.price, onwardPrice: onward.price, extraCosts: extras, totalPrice: total, directPrice: direct.price, savings, bufferHours, returnBufferHours,
    notes: 'Bilhetes separados: atraso no primeiro trecho pode causar perda do seguinte. Custos adicionais e bagagem incluídos nesta comparação; confirme preços antes de emitir.',
    legs: [positioning.id, onward.id], directOfferId: direct.id };
}

export function buildRepositionOffers(offers, candidates, now = new Date()) {
  const byId = new Map(offers.map(o => [o.id, o]));
  const result = [];
  for (const candidate of candidates) {
    const positioning = byId.get(candidate.positioningId);
    const onward = byId.get(candidate.onwardId);
    const direct = byId.get(candidate.directId);
    const reposition = evaluateReposition({ positioning, onward, direct, extraCosts: candidate.extraCosts });
    if (!reposition) continue;
    const validity = Math.min(...[positioning, onward, direct].map(t => Date.parse(t.validUntil)));
    if (validity <= now.getTime()) continue;
    result.push({ ...onward, id: `via-${positioning.id}-${onward.id}`, origin: positioning.origin, price: reposition.totalPrice, reposition, observedAt: [positioning, onward, direct].map(t => t.observedAt).sort()[0], validUntil: new Date(validity).toISOString(),
      availability: [positioning, onward, direct].every(t => t.availability === 'verified') ? 'verified' : 'advertised',
      notes: reposition.notes, sourceName: 'Comparação de trechos', sourceUrl: onward.sourceUrl, sourceLinks: [positioning, onward, direct].map(t => ({ label: `${t.origin} → ${t.destination}`, url: t.sourceUrl })) });
  }
  return result;
}
