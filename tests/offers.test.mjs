import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOffers, validateOffer } from '../scripts/lib/offers.mjs';
import { evaluateReposition } from '../scripts/lib/reposition.mjs';

const sample = { id: 'a', origin: 'FOR', destination: 'REC', destinationCity: 'Recife', destinationCountry: 'Brasil', region: 'domestic', airline: 'Azul', type: 'cash', price: 400, currency: 'BRL', program: null, taxes: null, tripType: 'oneway', departureDate: '2027-03-04', returnDate: null, sourceName: 'Azul', sourceUrl: 'https://passagens.voeazul.com.br/pt/voos-de-fortaleza', observedAt: '2026-10-30T09:00:00Z', validUntil: '2026-11-01T09:00:00Z', availability: 'advertised', stops: null, notes: '' };
test('não renova observação vencida nem aceita datas impossíveis', () => {
  assert.equal(normalizeOffers([sample], new Date('2026-11-01T10:00:00Z')).offers.length, 0);
  assert.ok(validateOffer({ ...sample, departureDate: '2027-02-30' }).length);
});
test('nova observação prevalece mesmo quando o preço sobe', () => {
  const newer = { ...sample, price: 500, observedAt: '2026-10-30T10:00:00Z', validUntil: '2026-11-01T10:00:00Z' };
  assert.equal(normalizeOffers([sample, newer], new Date('2026-10-30T11:00:00Z')).offers[0].price, 500);
});
test('taxas desconhecidas e programas distintos não viram equivalências falsas', () => {
  assert.equal(validateOffer({ ...sample, type: 'miles', program: 'Azul Fidelidade' }).length, 0);
  assert.ok(validateOffer({ ...sample, type: 'miles' }).length);
  const data = normalizeOffers([sample, { ...sample, id: 'b', type: 'miles', program: 'Azul Fidelidade', price: 15000 }], new Date('2026-10-30T11:00:00Z'));
  assert.equal(data.offers.length, 2);
});

function itinerary() {
  const common = { type: 'cash', currency: 'BRL', taxesIncluded: true, baggageAllowance: 'personal-item', tripType: 'oneway', departureDate: '2027-03-04', returnDate: null };
  return {
    positioning: { ...common, id: 'positioning', origin: 'FOR', destination: 'GRU', price: 500, departureAt: '2027-03-03T10:00:00-03:00', arrivalAt: '2027-03-03T13:30:00-03:00' },
    onward: { ...common, id: 'onward', origin: 'GRU', destination: 'LIS', price: 2000, departureAt: '2027-03-04T12:00:00-03:00', arrivalAt: '2027-03-05T00:00:00Z' },
    direct: { ...common, id: 'direct', origin: 'FOR', destination: 'LIS', price: 4000, departureAt: '2027-03-04T15:00:00-03:00', arrivalAt: '2027-03-05T00:00:00Z' },
    extraCosts: { baggage: 100, groundTransport: 100, overnight: 300 },
  };
}
test('reposicionamento inclui bilhetes, taxas extras e pernoite', () => {
  const result = evaluateReposition(itinerary());
  assert.equal(result.totalPrice, 3000);
  assert.equal(result.savings, 1000);
});
test('bloqueia conexão apertada, datas diferentes e custos desconhecidos', () => {
  const a = itinerary(); a.positioning.arrivalAt = '2027-03-04T11:00:00-03:00'; assert.equal(evaluateReposition(a), null);
  const b = itinerary(); b.direct.departureDate = '2027-03-05'; assert.equal(evaluateReposition(b), null);
  const c = itinerary(); c.extraCosts.overnight = null; assert.equal(evaluateReposition(c), null);
  const d = itinerary(); d.onward.taxesIncluded = false; assert.equal(evaluateReposition(d), null);
});
test('ida e volta exige deslocamento de volta com margem segura', () => {
  const a = itinerary(); for (const t of [a.positioning, a.onward, a.direct]) { t.tripType = 'roundtrip'; t.returnDate = '2027-03-20'; }
  assert.equal(evaluateReposition(a), null);
});
