'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const cityNames = { FOR: 'Fortaleza', REC: 'Recife', GRU: 'São Paulo', CGH: 'São Paulo', VCP: 'Campinas', GIG: 'Rio de Janeiro', SDU: 'Rio de Janeiro', BSB: 'Brasília', SSA: 'Salvador', CNF: 'Belo Horizonte', POA: 'Porto Alegre', CWB: 'Curitiba', BEL: 'Belém', MAO: 'Manaus', FEN: 'Fernando de Noronha', LIS: 'Lisboa', OPO: 'Porto', MAD: 'Madri', CDG: 'Paris', ORY: 'Paris', MIA: 'Miami', MCO: 'Orlando', EZE: 'Buenos Aires', AEP: 'Buenos Aires', SCL: 'Santiago' };
  const photographs = {
    LIS: 'photo-1555881400-74d7acaacd8b', OPO: 'photo-1555881400-74d7acaacd8b',
    CDG: 'photo-1502602898657-3e91760cbb34', ORY: 'photo-1502602898657-3e91760cbb34',
    GIG: 'photo-1483729558449-99ef09a8c325', SDU: 'photo-1483729558449-99ef09a8c325', RIO: 'photo-1483729558449-99ef09a8c325',
    REC: 'photo-1507525428034-b723cf961d3e', FOR: 'photo-1507525428034-b723cf961d3e',
    FEN: 'photo-1519046904884-53103b34b206', SSA: 'photo-1519046904884-53103b34b206'
  };
  const previewFares = 3;
  // Prioridades guardam a cidade, então aeroportos da mesma cidade contam como o mesmo destino.
  const metroCodes = { GRU: 'SAO', CGH: 'SAO', GIG: 'RIO', SDU: 'RIO', CDG: 'PAR', ORY: 'PAR', EZE: 'BUE', AEP: 'BUE', CNF: 'BHZ', LHR: 'LON', LGW: 'LON', JFK: 'NYC', EWR: 'NYC', NRT: 'TYO', HND: 'TYO', DSS: 'DKR' };
  const cityCode = (code) => metroCodes[code] || code;
  const maxPriorities = 5;
  const maxWindowDays = 62;
  const paymentLabels = { any: 'Dinheiro ou milhas', cash: 'Dinheiro', miles: 'Milhas' };
  const tripLabels = { any: 'Só ida ou ida e volta', oneway: 'Só ida', roundtrip: 'Ida e volta' };
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const money = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(Number(value)) : 'Não informado';
  const integer = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value));
  const safeUrl = (value) => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
  const date = (value, withYear = false) => {
    if (!value) return 'Datas na fonte';
    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
    return Number.isNaN(parsed.valueOf()) ? 'Datas na fonte' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', ...(withYear ? { year: 'numeric' } : {}) , timeZone: 'America/Sao_Paulo' }).format(parsed).replace(/\./g, '');
  };
  const monthYear = (value, withYear = true) => new Intl.DateTimeFormat('pt-BR', { month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'America/Sao_Paulo' }).format(new Date(`${value}T12:00:00`)).replace(/\./g, '').replace(' de ', ' ');
  const dateRange = (first, last) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(first || '') || !/^\d{4}-\d{2}-\d{2}$/.test(last || '')) return 'Datas na fonte';
    if (first.slice(0, 7) === last.slice(0, 7)) return monthYear(first);
    return first.slice(0, 4) === last.slice(0, 4) ? `${monthYear(first, false)} – ${monthYear(last)}` : `${monthYear(first)} – ${monthYear(last)}`;
  };
  const dayTile = (value) => {
    const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value || '') ? `${value}T12:00:00` : NaN);
    if (Number.isNaN(parsed.valueOf())) return { day: '—', month: '', weekday: '' };
    const part = (options) => new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'America/Sao_Paulo' }).format(parsed).replace(/\./g, '');
    return { day: part({ day: '2-digit' }), month: part({ month: 'short' }), weekday: part({ weekday: 'short' }) };
  };
  // Destinos sem foto própria recebem um degradê estável em vez de repetir a mesma imagem genérica.
  const tone = (value) => [...String(value)].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 6;
  const timestamp = (value) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? 'Horário não informado' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(parsed);
  };
  const calendarIcon = '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 5h12v10H3zM6 2v5m6-5v5M3 9h12"/></svg>';
  const starIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>';
  let favorites = new Set();
  try { const saved = JSON.parse(localStorage.getItem('rotaleve.favorites') || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.filter((id) => typeof id === 'string')); } catch { /* Browser storage is optional. */ }
  let data = { offers: [], coverage: { summary: '', sources: [] } };
  let state = { origin: 'FOR', payment: 'all', region: 'all', search: '', sort: 'price', budget: 100, direct: false, reposition: false, favorites: false, priority: null };
  let expanded = new Set();
  // status: loading, signed-out, ready ou unavailable (fora do Static Web Apps, sem /.auth).
  let account = { status: 'loading', user: null, profile: null, error: '' };
  let loadError = false;
  let toastTimer;

  function notify(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600);
  }

  function todayIso() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const component = (type) => parts.find((part) => part.type === type).value;
    return `${component('year')}-${component('month')}-${component('day')}`;
  }
  const addDays = (day, days) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const daysBetween = (first, last) => Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86400000);

  function activeOffers() {
    const today = todayIso();
    return data.offers.filter((offer) => {
      if (offer.validUntil && new Date(offer.validUntil).valueOf() < Date.now()) return false;
      if (/^\d{4}-\d{2}-\d{2}$/.test(offer.departureDate) && offer.departureDate < today) return false;
      return true;
    });
  }

  function budgetMaximum() {
    const candidates = activeOffers().filter((offer) => offer.origin === state.origin && offer.type === state.payment);
    const max = Math.max(0, ...candidates.map((offer) => Number(offer.price)));
    const unit = state.payment === 'miles' ? 5000 : 100;
    return Math.max(unit, Math.ceil(max / unit) * unit);
  }

  function budgetValue() { return Math.round(budgetMaximum() * state.budget / 100); }

  function refreshControls() {
    const originName = cityNames[state.origin] || state.origin;
    $('#heroOrigin').textContent = originName;
    $('#mapCode').textContent = `${state.origin} ↗`;
    $('#originSelect').value = state.origin;
    $$('.origin-choice').forEach((button) => {
      const selected = button.dataset.origin === state.origin;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $$('[data-payment]').forEach((button) => {
      const selected = button.dataset.payment === state.payment;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $('#regionSelect').value = state.region;
    $('#sortSelect').value = state.sort;
    $('#destination').value = state.search;
    $('#budget').value = state.budget;
    $('#directOnly').checked = state.direct;
    $('#repositionOnly').checked = state.reposition;
    $('#budget').disabled = state.payment === 'all';
    $('#budgetLabel').textContent = state.budget === 100 || state.payment === 'all' ? 'Sem limite' : state.payment === 'miles' ? `${integer(budgetValue())} pontos` : money(budgetValue());
    $('#budgetHint').textContent = state.payment === 'all' ? 'Escolha Dinheiro ou Milhas para limitar o preço.' : state.payment === 'miles' ? 'Limite em pontos ou milhas, sem incluir taxas.' : 'Valor anunciado por pessoa, em reais.';
    $('#activeFilterBadge').hidden = !(state.direct || state.reposition || (state.budget < 100 && state.payment !== 'all'));
    $('#navExplore').classList.toggle('active', !state.favorites);
    $('#navFavorites').classList.toggle('active', state.favorites);
    $('#navExplore').setAttribute('aria-current', state.favorites ? 'false' : 'page');
    $('#navFavorites').setAttribute('aria-current', state.favorites ? 'page' : 'false');
    $('#pageLabel').textContent = state.favorites ? 'Favoritas' : 'Explorar';
    $('#offersTitle').innerHTML = state.favorites ? 'Seus próximos planos<span>.</span>' : 'Bons achados para você<span>.</span>';
    $('#favoriteCount').textContent = favorites.size;
    const priority = activePriority();
    $('#priorityFilter').hidden = !priority;
    $('#priorityFilterLabel').textContent = priority ? `${destinationName(priority.destination)} · ${windowLabel(priority)}` : '';
  }

  function renderMetrics() {
    const offers = activeOffers().filter((offer) => offer.origin === state.origin);
    const cash = offers.filter((offer) => offer.type === 'cash');
    const miles = offers.filter((offer) => offer.type === 'miles');
    $('#metricOffers').innerHTML = `${offers.length} <small>achados</small>`;
    $('#allTabCount').textContent = offers.length;
    $('#metricCash').textContent = cash.length ? money(Math.min(...cash.map((offer) => Number(offer.price)))) : '—';
    const programs = new Set(miles.map((offer) => offer.program));
    $('#metricMiles').innerHTML = programs.size > 1 ? `${programs.size} <small>programas</small>` : miles.length ? `${integer(Math.min(...miles.map((offer) => Number(offer.price))))} <small>pts</small>` : '—';
    $('#metricMiles').title = programs.size === 1 ? [...programs][0] : 'Compare os valores dentro de cada programa de fidelidade.';
    const sources = new Set(offers.map((offer) => offer.sourceName).filter(Boolean));
    $('#metricSources').innerHTML = `${sources.size} <small>${sources.size === 1 ? 'fonte' : 'fontes'}</small>`;
    const schedule = data.run?.schedule;
    if (schedule && Array.isArray(schedule.times) && schedule.times.length) {
      $('#metricScheduleLabel').textContent = schedule.enabled === true ? 'Coletas programadas' : 'Programação preparada';
      $('#metricSources').innerHTML = `${schedule.times.length}× <small>ao dia</small>`;
    } else {
      $('#metricScheduleLabel').textContent = 'Fontes consultadas';
    }
    $('#updatedLabel').textContent = data.updatedAt ? `Radar atualizado em ${timestamp(data.updatedAt)}` : loadError ? 'Radar indisponível no momento' : 'Aguardando primeira coleta';
    $('#coverageSummary').textContent = data.coverage?.summary || 'A cobertura varia por fonte. Cada preço inclui um link para consultar os detalhes e a disponibilidade.';
  }

  const priorities = () => account.profile?.priorities || [];
  const activePriority = () => priorities().find((priority) => priority.id === state.priority) || null;
  const priorityMatches = (offer, priority) => offer.origin === priority.origin
    && (!priority.destination || cityCode(offer.destination) === priority.destination)
    && /^\d{4}-\d{2}-\d{2}$/.test(offer.departureDate || '') && offer.departureDate >= priority.from && offer.departureDate <= priority.to
    && (priority.payment === 'any' || offer.type === priority.payment)
    && (priority.tripType === 'any' || offer.tripType === priority.tripType);
  const destinationName = (code) => {
    if (!code) return 'Qualquer destino';
    const offer = data.offers.find((item) => cityCode(item.destination) === code && item.destinationCity);
    return offer ? offer.destinationCity : cityNames[code] || code;
  };
  const windowLabel = (priority) => priority.from.slice(0, 7) === priority.to.slice(0, 7) ? `${dayTile(priority.from).day} – ${date(priority.to, true)}` : `${date(priority.from)} – ${date(priority.to, true)}`;

  function filteredOffers() {
    const query = normalize(state.search.trim());
    const priority = activePriority();
    const offers = activeOffers().filter((offer) => offer.origin === state.origin
      && (!priority || priorityMatches(offer, priority))
      && (state.payment === 'all' || offer.type === state.payment)
      && (state.region === 'all' || offer.region === state.region)
      && (!state.favorites || favorites.has(offer.id))
      && (!query || normalize([offer.destinationCity, offer.destinationCountry, offer.destination, offer.airline, offer.program, offer.reposition?.via].join(' ')).includes(query))
      && (!state.direct || (offer.stops === 0 && !offer.reposition))
      && (!state.reposition || Boolean(offer.reposition))
      && (state.payment === 'all' || state.budget === 100 || Number(offer.price) <= budgetValue()));
    return offers.sort((a, b) => {
      if (state.sort === 'price') {
        if (a.type !== b.type) return a.type === 'cash' ? -1 : 1;
        if (a.type === 'miles') {
          const programOrder = String(a.program || '').localeCompare(String(b.program || ''), 'pt-BR');
          if (programOrder) return programOrder;
        }
        return Number(a.price) - Number(b.price);
      }
      if (state.sort === 'departure') return (a.departureDate || '9999').localeCompare(b.departureDate || '9999');
      if (state.sort === 'savings') return Number(b.reposition?.savings || 0) - Number(a.reposition?.savings || 0) || Number(Boolean(b.reposition)) - Number(Boolean(a.reposition));
      return new Date(b.observedAt || 0).valueOf() - new Date(a.observedAt || 0).valueOf() || Number(a.price) - Number(b.price);
    });
  }

  // Agrupa por cidade, não por aeroporto: CGH, GRU e SAO aparecem juntos em São Paulo.
  // A ordem dos grupos segue a melhor oferta de cada um na ordenação escolhida.
  function groupOffers(offers) {
    const groups = new Map();
    for (const offer of offers) {
      const city = offer.destinationCity || cityNames[offer.destination] || offer.destination;
      const country = offer.destinationCountry || (offer.region === 'domestic' ? 'Brasil' : 'Internacional');
      const key = normalize(`${city} ${country}`).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || offer.destination.toLowerCase();
      if (!groups.has(key)) groups.set(key, { key, city, country, offers: [] });
      groups.get(key).offers.push(offer);
    }
    return [...groups.values()].map((group) => ({ ...group, airports: [...new Set(group.offers.map((offer) => offer.destination))].sort() }));
  }

  function fareRow(offer, group, best) {
    const miles = offer.type === 'miles';
    const saved = favorites.has(offer.id);
    const tile = dayTile(offer.departureDate);
    const when = offer.tripType === 'roundtrip' ? offer.returnDate ? `Volta ${date(offer.returnDate)}` : 'Ida e volta' : `${tile.weekday ? `${tile.weekday} · ` : ''}Só ida`;
    const meta = [miles ? offer.program || offer.airline : offer.airline, group.airports.length > 1 ? offer.destination : null, offer.reposition ? `via ${offer.reposition.via}` : null, offer.stops === 0 && !offer.reposition ? 'Direto' : null, offer.reposition?.savings > 0 ? `economia de ${money(offer.reposition.savings)}` : null].filter(Boolean).join(' · ');
    const price = miles ? `${integer(offer.price)}<small>${escape(offer.unit || 'pts')}</small>` : escape(money(offer.price));
    const taxes = !miles ? '' : offer.taxes === 0 ? 'Taxas R$ 0,00' : Number.isFinite(offer.taxes) ? `+ ${money(offer.taxes)}` : '+ taxas';
    return `<li class="fare-row${miles ? ' miles' : ''}"><button class="fare-main" data-details="${escape(offer.id)}"><span class="sr-only">Ver detalhes: </span><span class="fare-date"><strong>${escape(tile.day)}</strong><small>${escape(tile.month)}</small></span><span class="fare-info"><span class="fare-when">${escape(when)}</span><span class="fare-meta">${priorities().some((priority) => priorityMatches(offer, priority)) ? '<span class="best-tag mine">Sua data</span>' : ''}${best ? '<span class="best-tag">Menor preço</span>' : ''}<span>${escape(meta)}</span></span></span><span class="fare-price"><strong>${price}</strong>${taxes ? `<small>${escape(taxes)}</small>` : ''}</span></button><button class="favorite-button fare-favorite ${saved ? 'saved' : ''}" data-favorite="${escape(offer.id)}" aria-label="${saved ? 'Remover' : 'Salvar'} ${escape(group.city)} em ${escape(date(offer.departureDate))} ${saved ? 'das favoritas' : 'nas favoritas'}" aria-pressed="${saved}">${starIcon}</button></li>`;
  }

  function groupCard(group, index) {
    const { offers, airports } = group;
    const cheapest = (list) => list.reduce((best, offer) => !best || Number(offer.price) < Number(best.price) ? offer : best, null);
    const cash = offers.filter((offer) => offer.type === 'cash');
    // Milhas de programas diferentes não são comparáveis: cada programa tem o seu "a partir de".
    const programs = [...new Set(offers.filter((offer) => offer.type === 'miles').map((offer) => offer.program))].map((program) => offers.filter((offer) => offer.type === 'miles' && offer.program === program));
    const highlights = [cash, ...programs].filter((list) => list.length > 1).map((list) => cheapest(list).id);
    const bestCash = cheapest(cash);
    const fromPrices = `${bestCash ? `<div class="from-price"><div class="price-label">Dinheiro</div><div class="price"><span class="currency">R$</span>${escape(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bestCash.price))}</div></div>` : ''}${programs.map((list) => { const best = cheapest(list); return `<div class="from-price miles"><div class="price-label" title="${escape(best.program)}">${escape(best.program)}</div><div class="price">${integer(best.price)}<span class="price-unit">${escape(best.unit || 'pts')}</span></div></div>`; }).join('')}`;
    const departures = offers.map((offer) => offer.departureDate).filter(Boolean).sort();
    const airlines = [...new Set(offers.map((offer) => offer.airline))].join(' · ');
    const sources = [...new Set(offers.map((offer) => offer.sourceName).filter(Boolean))].join(', ');
    const latest = offers.map((offer) => offer.observedAt).filter(Boolean).sort().at(-1);
    const open = expanded.has(group.key);
    const visible = open ? offers : offers.slice(0, previewFares);
    const photoCode = airports.find((code) => photographs[code]);
    const cover = photoCode ? `<img src="https://images.unsplash.com/${photographs[photoCode]}?auto=format&fit=crop&w=800&q=80" alt="" ${index < 3 ? 'fetchpriority="low"' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer"><span class="image-caption">Imagem ilustrativa</span>` : '';
    const badges = `${cash.length ? '<span class="offer-badge">R$ Dinheiro</span>' : ''}${programs.length ? '<span class="offer-badge miles">✧ Milhas</span>' : ''}${offers.some((offer) => offer.reposition) ? '<span class="offer-badge reposition">Nova rota</span>' : ''}`;
    const toggle = offers.length > previewFares ? `<button class="group-toggle" data-group-toggle="${escape(group.key)}" aria-expanded="${open}" aria-controls="fares-${escape(group.key)}">${open ? 'Mostrar menos' : `Ver todas as ${offers.length} opções`}<span aria-hidden="true">${open ? '↑' : '↓'}</span></button>` : '';
    return `<article class="offer-card destination-card" aria-labelledby="dest-${escape(group.key)}"><div class="card-cover"><div class="cover-fallback${airports.length > 1 ? ' multi' : ''}" data-tone="${tone(group.key)}" aria-hidden="true">${escape(airports.join(' '))}</div>${cover}<div class="cover-badges">${badges}</div></div><div class="card-body"><div class="destination-title"><h3 id="dest-${escape(group.key)}">${escape(group.city)}</h3><span>${escape(group.country)}</span></div><div class="card-route"><span>${escape(state.origin)}</span><span class="route-arrow">⟶</span><span>${escape(airports.join(' · '))}</span><span class="stops">${escape(airlines)}</span></div><div class="from-label">A partir de</div><div class="from-prices">${fromPrices}</div><div class="trip-dates">${calendarIcon}<span>${escape(dateRange(departures[0], departures.at(-1)))}</span><span>${offers.length} ${offers.length === 1 ? 'opção' : 'opções'}</span></div><ol class="fare-list" id="fares-${escape(group.key)}" aria-label="Datas e preços para ${escape(group.city)}">${visible.map((offer) => fareRow(offer, group, highlights.includes(offer.id))).join('')}</ol>${toggle}<div class="card-source"><span title="${escape(sources)}">${escape(sources || 'Fonte da oferta')}</span><span>Anunciado ${escape(date(latest))}</span></div></div></article>`;
  }

  function renderRadar() {
    const section = $('#personalRadar');
    const list = priorities();
    $('#accountButton').hidden = account.status === 'loading' || account.status === 'unavailable';
    $('#accountButton').textContent = account.status === 'ready' ? 'Meu radar' : 'Entrar';
    $('#radarCount').hidden = !list.length;
    $('#radarCount').textContent = list.length;
    $('#navRadar').hidden = account.status === 'unavailable';
    section.hidden = account.status === 'loading' || account.status === 'unavailable';
    if (section.hidden) return;
    const heading = (title) => `<span class="section-eyebrow">SEU RADAR PESSOAL</span><h2 id="radarTitle" tabindex="-1">${title}${title.endsWith('?') ? '' : '<span>.</span>'}</h2>`;
    if (account.status === 'signed-out') {
      section.innerHTML = `<div class="radar-intro"><div>${heading('Diga quando você quer viajar')}<p>Escolha até ${maxPriorities} janelas de datas, com ou sem destino. O radar procura essas datas primeiro e mostra aqui o que encontrar.</p></div><div class="radar-login"><a class="login-option" href="/.auth/login/aad?post_login_redirect_uri=/">Entrar com Microsoft</a><a class="login-option" href="/.auth/login/github?post_login_redirect_uri=/">Entrar com GitHub</a><small>Guardamos só um código do seu login e as datas que você escolher.</small></div></div>`;
      return;
    }
    const tools = `<div class="radar-tools"><span class="radar-user" title="Conta usada no login">${escape(account.user?.userDetails || 'Conta conectada')}</span>${account.profile ? '<button class="text-button" data-radar-delete>Excluir perfil</button>' : ''}<a class="text-button" href="/.auth/logout?post_logout_redirect_uri=/">Sair</a></div>`;
    if (account.error) {
      section.innerHTML = `<div class="radar-head"><div>${heading('Seu radar pessoal')}</div>${tools}</div><p class="radar-message">${escape(account.error)}</p>`;
      return;
    }
    const cards = list.map((priority) => {
      const found = activeOffers().filter((offer) => priorityMatches(offer, priority));
      const cash = found.filter((offer) => offer.type === 'cash').map((offer) => Number(offer.price));
      const status = found.length
        ? `<strong>${found.length} ${found.length === 1 ? 'oferta' : 'ofertas'} nessas datas</strong>${cash.length ? ` · a partir de ${escape(money(Math.min(...cash)))}` : ' · em milhas'}`
        : '<strong>Nada no radar ainda.</strong> Essa busca tem prioridade nas próximas coletas.';
      return `<li class="priority-card${found.length ? ' found' : ''}"><div class="priority-route"><span>${escape(priority.origin)}</span><span class="route-arrow">⟶</span><strong>${escape(destinationName(priority.destination))}</strong></div><div class="priority-window">${calendarIcon}<span>${escape(windowLabel(priority))}</span></div><div class="priority-tags"><span>${escape(tripLabels[priority.tripType])}</span><span>${escape(paymentLabels[priority.payment])}</span></div><p class="priority-status">${status}</p><div class="priority-actions">${found.length ? `<button class="button-secondary" data-radar-view="${escape(priority.id)}">Ver ofertas</button>` : ''}<button class="text-button" data-radar-edit="${escape(priority.id)}">Editar</button><button class="text-button" data-radar-remove="${escape(priority.id)}">Remover</button></div></li>`;
    }).join('');
    const add = list.length < maxPriorities ? `<li><button class="priority-add" data-radar-add><span aria-hidden="true">+</span>${list.length ? 'Adicionar data' : 'Adicionar a primeira data'}</button></li>` : '';
    section.innerHTML = `<div class="radar-head"><div>${heading(list.length ? 'Suas datas prioritárias' : 'Quando você quer viajar?')}${list.length ? '' : '<p>Escolha uma janela de datas e, se quiser, um destino. O radar procura essas datas primeiro.</p>'}</div>${tools}</div><ol class="priority-list">${cards}${add}</ol>`;
  }

  function render() {
    refreshControls();
    renderMetrics();
    renderRadar();
    const offers = filteredOffers();
    const groups = groupOffers(offers);
    $('#offersGrid').setAttribute('aria-busy', 'false');
    $('#offersGrid').innerHTML = groups.map(groupCard).join('');
    $('#offersGrid').hidden = !offers.length;
    $('#emptyState').hidden = Boolean(offers.length);
    $('#resultCount').textContent = offers.length ? `${groups.length} ${groups.length === 1 ? 'destino' : 'destinos'} · ${offers.length} ${offers.length === 1 ? 'oferta' : 'ofertas'}` : '0 ofertas encontradas';
    if (loadError) {
      $('#emptyTitle').textContent = 'O radar não carregou agora.';
      $('#emptyMessage').textContent = 'Não foi possível consultar o arquivo de ofertas. Tente novamente em alguns instantes.';
      $('#emptyReset').textContent = 'Tentar novamente';
    } else if (!data.offers.length) {
      $('#emptyTitle').textContent = 'O radar está pronto para novos achados.';
      $('#emptyMessage').textContent = 'Ainda não há ofertas disponíveis. Novos preços aparecerão aqui quando a primeira coleta for concluída.';
      $('#emptyReset').hidden = true;
    } else if (state.favorites) {
      $('#emptyTitle').textContent = 'Seus planos começam com uma estrela.';
      $('#emptyMessage').textContent = 'Salve ofertas para acompanhar por aqui. Você também pode mudar a origem ou os filtros para ver mais favoritas.';
      $('#emptyReset').hidden = false;
      $('#emptyReset').textContent = 'Explorar ofertas';
    } else {
      $('#emptyTitle').textContent = state.reposition ? 'Ainda não há comparação para esta rota.' : 'Vamos encontrar outro caminho?';
      $('#emptyMessage').textContent = state.reposition ? 'Uma oportunidade com saída por outra cidade só aparece quando os trechos, datas e custos podem ser comparados.' : 'Não há ofertas disponíveis com esses filtros. Tente outro destino, forma de pagamento ou aeroporto de saída.';
      $('#emptyReset').hidden = false;
      $('#emptyReset').textContent = 'Limpar filtros';
    }
    $$('#offersGrid img').forEach((image) => image.addEventListener('error', () => { image.hidden = true; if (image.nextElementSibling?.classList.contains('image-caption')) image.nextElementSibling.hidden = true; }, { once: true }));
  }

  function resetFilters() {
    state = { ...state, payment: 'all', region: 'all', search: '', sort: 'price', budget: 100, direct: false, reposition: false, priority: null };
    render();
  }

  async function loadAccount() {
    try {
      const me = await fetch('/.auth/me', { cache: 'no-store' });
      if (!me.ok) throw new Error(`HTTP ${me.status}`);
      const principal = (await me.json())?.clientPrincipal;
      if (!principal) { account = { status: 'signed-out', user: null, profile: null, error: '' }; render(); return; }
      account = { status: 'ready', user: principal, profile: null, error: '' };
      const response = await fetch('/api/profile', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(payload.error || `HTTP ${response.status}`), { fromProfile: true });
      account.profile = payload.profile;
    } catch (error) {
      // Sem /.auth (servidor estático comum), o radar pessoal some; com login, mostramos o motivo.
      if (account.status === 'ready') account.error = error.fromProfile ? `Seu radar pessoal ainda não está disponível: ${error.message}` : 'Não foi possível carregar seu radar pessoal agora. Tente novamente em instantes.';
      else account = { status: 'unavailable', user: null, profile: null, error: '' };
    }
    render();
  }

  async function saveProfile(list) {
    const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priorities: list }) });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Sua sessão terminou. Entre novamente para salvar.');
    if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar agora. Tente novamente.');
    account.profile = payload.profile;
    if (!activePriority()) state.priority = null;
    render();
  }

  function destinationOptions() {
    const codes = new Map();
    for (const offer of data.offers) if (offer.destinationCity) codes.set(cityCode(offer.destination), `${offer.destinationCity} · ${offer.destinationCountry || ''}`.replace(/ · $/, ''));
    for (const [code, city] of Object.entries(cityNames)) if (!codes.has(cityCode(code))) codes.set(cityCode(code), city);
    return [...codes].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([code, label]) => `<option value="${escape(code)}">${escape(label)}</option>`).join('');
  }

  function showPriorityForm(id) {
    const existing = priorities().find((priority) => priority.id === id);
    const today = todayIso();
    const last = addDays(today, 365);
    openDialog(`<h2>${existing ? 'Editar data prioritária' : 'Nova data prioritária'}</h2><p>Escolha quando você quer embarcar. O radar procura primeiro as datas com mais pessoas interessadas.</p><form class="priority-form" id="priorityForm" data-priority-id="${existing ? escape(existing.id) : ''}" novalidate><div class="form-row"><label>Saindo de<select name="origin"><option value="FOR">Fortaleza · FOR</option><option value="REC">Recife · REC</option></select></label><label>Destino<select name="destination"><option value="">Qualquer destino</option>${destinationOptions()}</select></label></div><div class="form-row"><label>Embarque a partir de<input type="date" name="from" min="${today}" max="${last}" required></label><label>Embarque até<input type="date" name="to" min="${today}" max="${last}" required></label></div><div class="form-row"><label>Pagamento<select name="payment">${Object.entries(paymentLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><label>Viagem<select name="tripType">${Object.entries(tripLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label></div><p class="form-hint">Janela de até ${maxWindowDays} dias, nos próximos 12 meses.</p><p class="form-error" id="priorityError" role="alert" hidden></p><div class="dialog-footer"><button class="button-primary" type="submit">Salvar data</button><button class="text-button" type="button" data-close-dialog>Cancelar</button></div></form>`, 'SEU RADAR PESSOAL');
    const form = $('#priorityForm');
    const values = existing || { origin: state.origin, destination: null, from: '', to: '', payment: 'any', tripType: 'any' };
    for (const field of ['origin', 'from', 'to', 'payment', 'tripType']) form.elements[field].value = values[field];
    form.elements.destination.value = values.destination || '';
    form.elements.from.addEventListener('change', () => { if (form.elements.from.value && (!form.elements.to.value || form.elements.to.value < form.elements.from.value)) form.elements.to.value = form.elements.from.value; });
    form.elements.origin.focus();
  }

  async function submitPriority(form) {
    const values = Object.fromEntries(new FormData(form));
    const fail = (message) => { $('#priorityError').textContent = message; $('#priorityError').hidden = false; };
    if (!values.from || !values.to) return fail('Escolha as duas datas de embarque.');
    if (values.from < todayIso()) return fail('Escolha datas a partir de hoje.');
    if (values.from > values.to) return fail('A primeira data precisa vir antes da segunda.');
    if (daysBetween(values.from, values.to) > maxWindowDays) return fail(`Use uma janela de até ${maxWindowDays} dias.`);
    if (values.destination === values.origin) return fail('Escolha um destino diferente da cidade de saída.');
    const entry = { origin: values.origin, destination: values.destination || null, from: values.from, to: values.to, payment: values.payment, tripType: values.tripType };
    const id = form.dataset.priorityId;
    const list = id ? priorities().map((priority) => priority.id === id ? { ...entry, id } : priority) : [...priorities(), entry];
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await saveProfile(list);
      $('#detailsDialog').close();
      notify(id ? 'Data prioritária atualizada.' : 'Data salva. O radar vai procurar essas datas primeiro.');
    } catch (error) { fail(error.message); submit.disabled = false; }
  }

  async function deleteProfile() {
    const response = await fetch('/api/profile', { method: 'DELETE' });
    if (!response.ok && response.status !== 404) { notify('Não foi possível excluir agora. Tente novamente.'); return; }
    account.profile = null;
    state.priority = null;
    $('#detailsDialog').close();
    render();
    notify('Perfil excluído. Suas datas foram apagadas.');
  }

  function openDialog(content, eyebrow = 'ROTA LEVE') {
    $('#dialogEyebrow').textContent = eyebrow;
    $('#dialogContent').innerHTML = content;
    const title = $('#dialogContent h2');
    if (title) title.id = 'dialogTitle';
    if (!$('#detailsDialog').open) $('#detailsDialog').showModal();
  }

  function showDetails(id) {
    const offer = data.offers.find((item) => item.id === id);
    if (!offer) return;
    const miles = offer.type === 'miles';
    const url = safeUrl(offer.sourceUrl);
    const destination = offer.destinationCity || cityNames[offer.destination] || offer.destination;
    const totalPrice = miles ? `${integer(offer.price)} ${offer.unit || 'pontos'}` : money(offer.price);
    let positioning = '';
    if (offer.reposition) {
      const route = offer.reposition;
      positioning = `<h3>Vale mudar o aeroporto de saída?</h3><table class="breakdown"><tbody><tr><td>Chegar a ${escape(route.via)}</td><td>${escape(money(route.positioningPrice))}</td></tr><tr><td>Passagem seguinte</td><td>${escape(money(route.onwardPrice))}</td></tr><tr><td>Custos extras estimados</td><td>${escape(money(route.extraCosts))}</td></tr><tr><td>Total estimado</td><td>${escape(money(route.totalPrice))}</td></tr><tr><td>Alternativa saindo de ${escape(cityNames[offer.origin])}</td><td>${escape(money(route.directPrice))}</td></tr><tr><td>Economia estimada</td><td>${escape(money(route.savings))}</td></tr></tbody></table><p>${escape(route.notes || '')}</p><p class="detail-note">Bilhetes separados exigem cuidado com atrasos, bagagem, deslocamentos e eventual hospedagem. ${Number.isFinite(route.bufferHours) ? `Intervalo considerado: ${escape(route.bufferHours)} horas.` : ''} Confira os horários de todos os trechos antes de reservar.</p>`;
    }
    const outbound = date(offer.departureDate, true);
    const dates = offer.returnDate ? `${outbound} a ${date(offer.returnDate, true)}` : outbound;
    const sourceLinks = Array.isArray(offer.sourceLinks) ? offer.sourceLinks.filter((source) => safeUrl(source.url)) : [];
    const legLinks = sourceLinks.length ? `<h3>Confira os trechos da comparação</h3><ul class="source-list">${sourceLinks.map((source) => `<li><a href="${escape(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer">${escape(source.label || 'Consultar trecho')} ↗</a></li>`).join('')}</ul>` : '';
    openDialog(`<h2>${escape(cityNames[offer.origin] || offer.origin)} <span class="dialog-route-arrow">→</span> ${escape(destination)}</h2><p>${escape(offer.airline)} · ${offer.tripType === 'roundtrip' ? 'Ida e volta' : 'Somente ida'} · ${escape(offer.origin)} → ${escape(offer.destination)}</p><div class="dialog-price">${escape(totalPrice)}</div><div class="detail-grid"><div><span>Quando viajar</span><strong>${escape(dates)}</strong></div><div><span>Forma de pagamento</span><strong>${miles ? escape(offer.program || 'Milhas') : 'Dinheiro · BRL'}</strong></div><div><span>Taxas</span><strong>${offer.taxes === null || offer.taxes === undefined ? 'Conferir na fonte' : offer.taxes === 0 ? miles ? 'Taxas informadas: R$ 0,00' : 'Incluídas no preço' : escape(money(offer.taxes))}</strong></div><div><span>Itinerário</span><strong>${offer.stops === 0 ? 'Voo direto' : Number.isInteger(offer.stops) ? `${escape(offer.stops)} ${offer.stops === 1 ? 'conexão' : 'conexões'}` : 'Confirmar horários e conexões'}</strong></div><div><span>Fonte</span><strong>${escape(offer.sourceName || 'Fonte da oferta')}</strong></div><div><span>Última observação · Brasília</span><strong>${escape(timestamp(offer.observedAt))}</strong></div></div><h3>${offer.availability === 'verified' ? 'Disponibilidade consultada' : 'Preço anunciado pela fonte'}</h3><p>${offer.availability === 'verified' ? 'A disponibilidade foi consultada na data indicada e pode mudar a qualquer momento.' : 'Este valor foi encontrado em uma publicação ou página de ofertas. Ele pode ter disponibilidade limitada e não representa uma reserva ou confirmação de disponibilidade no pagamento.'}</p>${offer.notes ? `<p>${escape(offer.notes)}</p>` : ''}${positioning}${legLinks}<p class="detail-note">Confira o preço final, regras da tarifa, taxas e franquia de bagagem na fonte. Valores em milhas variam por programa e não são comparados diretamente com valores em reais.</p><div class="dialog-footer">${url ? `<a class="source-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">Consultar ${escape(offer.sourceName || 'oferta')} <span>↗</span></a>` : ''}<small>O Rota Leve não vende passagens.</small></div>`, miles ? 'UM ACHADO EM MILHAS' : 'UM ACHADO EM DINHEIRO');
  }

  function showMethodology(section = 'all') {
    const sources = Array.isArray(data.coverage?.sources) ? data.coverage.sources : [];
    const sourceList = sources.length ? `<h3>Fontes desta coleta</h3><ul class="source-list">${sources.map((source) => {
      const name = typeof source === 'string' ? source : source.name || source.sourceName || source.id || 'Fonte';
      const url = typeof source === 'object' ? safeUrl(source.url || source.sourceUrl) : null;
      const detail = typeof source === 'object' ? source.coverage || source.description || source.message || '' : '';
      const status = typeof source === 'object' ? source.status : null;
      const statusLabels = { ok: 'Consultada', error: 'Falha na consulta', partial: 'Consulta parcial', stale: 'Consulta anterior', skipped: 'Não consultada', disabled: 'Desativada', pending: 'Aguardando consulta' };
      const statusLabel = status ? statusLabels[status] || 'Estado da consulta indisponível' : '';
      const count = typeof source === 'object' && Number.isFinite(source.count) ? ` · ${integer(source.count)} anúncios coletados` : '';
      const error = typeof source === 'object' && source.error ? String(source.error) : '';
      const http = error.match(/HTTP\s+(\d{3})/i)?.[1];
      const errorLabel = error ? http === '404' ? 'A página da fonte não foi encontrada (404).' : http === '403' || http === '429' ? `A fonte limitou o acesso à consulta (${http}).` : http ? `A fonte respondeu com uma falha de consulta (${http}).` : 'Não foi possível obter novos preços desta fonte nesta coleta.' : '';
      return `<li>${url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(name)} ↗</a>` : `<strong>${escape(name)}</strong>`}${statusLabel ? `<span class="source-status">${escape(statusLabel)}</span>` : ''}${count ? `<span class="source-count">${escape(count)}</span>` : ''}${detail ? `<br>${escape(detail)}` : ''}${errorLabel ? `<br><span class="source-error">${escape(errorLabel)}</span>` : ''}</li>`;
    }).join('')}</ul>` : '';
    const times = data.run?.schedule?.times;
    const schedule = Array.isArray(times) && times.length ? `<p>${data.run.schedule.enabled === true ? 'Janelas de coleta configuradas' : 'Programação preparada, ainda não ativada'}: ${escape(times.join(', '))}. Horário de Brasília. ${data.run.schedule.enabled === true ? 'A execução pode atrasar conforme a disponibilidade do serviço.' : 'As atualizações recorrentes começam após a ativação da implantação e do serviço de coleta.'}</p>` : '<p>O radar é atualizado quando uma coleta é concluída. O horário mostrado na página indica a última atualização do arquivo de ofertas.</p>';
    const positioning = '<h3>Quando sair por outra cidade compensa?</h3><p>Somamos a passagem para o outro aeroporto, a viagem seguinte e custos adicionais como taxas, bagagem, transporte e hospedagem. A economia precisa continuar positiva em relação a uma alternativa comparável saindo da sua cidade.</p><p>Uma comparação só é publicada quando há preços, datas e horários suficientes para avaliar os trechos. Bilhetes separados não garantem proteção se o primeiro voo atrasar. O intervalo e os custos estimados aparecem nos detalhes.</p><p class="detail-note">Exemplo de caminho possível: Fortaleza → São Paulo → destino final. A ilustração da página explica a estratégia; não é uma oferta disponível.</p>';
    if (section === 'reposition') {
      openDialog(`<h2>Um caminho diferente pode valer a viagem.</h2>${positioning}`, 'NOVAS POSSIBILIDADES DE ROTA');
      return;
    }
    openDialog(`<h2>Viajar leve começa com informação clara.</h2><p>O Rota Leve reúne preços anunciados em dinheiro e milhas saindo de Fortaleza e Recife, com links para você conferir cada oportunidade na fonte.</p><h3>O que significa uma oferta no radar?</h3><p>Uma publicação ou página de companhia pode anunciar uma tarifa que já não esteja disponível. Cada destino reúne as datas encontradas, e os detalhes de cada data mostram a fonte, o momento da observação e a condição do preço. A confirmação final acontece no site onde você fará a reserva.</p><h3>Atualização e cobertura</h3>${schedule}<p>${escape(data.coverage?.summary || 'A cobertura depende das fontes conectadas. Não há garantia de busca em todas as companhias ou programas de fidelidade.')}</p>${sourceList}<h3>Dinheiro e milhas</h3><p>Os valores são por pessoa, na modalidade indicada: só ida ou ida e volta. Em milhas, as taxas são exibidas separadamente quando informadas. A ordenação por menor preço mantém dinheiro e milhas em grupos, pois são unidades diferentes.</p>${positioning}<h3>Radar pessoal</h3><p>Com login Microsoft ou GitHub, você escolhe até ${maxPriorities} janelas de datas, com ou sem destino. Guardamos apenas um código derivado do login e essas datas, sem nome nem e-mail. O coletor e a pesquisa complementar recebem os pedidos somados e anônimos, com origem, destino, datas e quantas pessoas pediram, e procuram primeiro os mais pedidos. Você pode excluir o perfil a qualquer momento.</p><h3>Favoritas, sem conta</h3><p>As estrelas são salvas apenas neste navegador. Elas não reservam uma tarifa e não enviam alertas. Limpar os dados do navegador remove suas favoritas.</p>`, 'FONTES E METODOLOGIA');
  }

  async function loadOffers() {
    loadError = false;
    $('#emptyReset').hidden = false;
    $('#offersGrid').setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('./data/offers.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.offers)) throw new Error('Invalid offers file');
      data = { ...payload, offers: payload.offers.filter((offer) => typeof offer.id === 'string' && ['FOR', 'REC'].includes(offer.origin) && ['cash', 'miles'].includes(offer.type) && Number.isFinite(offer.price) && offer.price > 0) };
    } catch (error) {
      loadError = true;
      data = { offers: [], coverage: { summary: 'As fontes não puderam ser carregadas. Tente novamente para consultar as ofertas mais recentes.', sources: [] } };
      console.warn('Não foi possível carregar as ofertas do radar.', error.message);
    }
    render();
  }

  $$('.origin-choice').forEach((button) => button.addEventListener('click', () => { state.origin = button.dataset.origin; state.budget = 100; state.priority = null; render(); }));
  $('#originSelect').addEventListener('change', (event) => { state.origin = event.target.value; state.budget = 100; state.priority = null; render(); });
  $$('[data-payment]').forEach((button) => button.addEventListener('click', () => { state.payment = button.dataset.payment; state.budget = 100; render(); }));
  $('#destination').addEventListener('input', (event) => { state.search = event.target.value; render(); });
  $('#regionSelect').addEventListener('change', (event) => { state.region = event.target.value; render(); });
  $('#sortSelect').addEventListener('change', (event) => { state.sort = event.target.value; render(); });
  $('#budget').addEventListener('input', (event) => { state.budget = Number(event.target.value); render(); });
  $('#directOnly').addEventListener('change', (event) => { state.direct = event.target.checked; render(); });
  $('#repositionOnly').addEventListener('change', (event) => { state.reposition = event.target.checked; render(); });
  $('#filterToggle').addEventListener('click', () => { const expanded = $('#filterToggle').getAttribute('aria-expanded') === 'true'; $('#filterToggle').setAttribute('aria-expanded', String(!expanded)); $('#advancedFilters').hidden = expanded; });
  $('#resetFilters').addEventListener('click', resetFilters);
  $('#emptyReset').addEventListener('click', () => { if (loadError) { loadOffers(); return; } if (state.favorites) state.favorites = false; resetFilters(); });
  $('#navExplore').addEventListener('click', () => { state.favorites = false; state.priority = null; render(); });
  $('#navFavorites').addEventListener('click', () => { state.favorites = true; state.priority = null; render(); $('#offersTitle').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const goToRadar = () => { $('#personalRadar').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#radarTitle')?.focus({ preventScroll: true }); };
  $('#navRadar').addEventListener('click', goToRadar);
  $('#accountButton').addEventListener('click', goToRadar);
  $('#clearPriority').addEventListener('click', () => { state.priority = null; render(); goToRadar(); });
  $('#personalRadar').addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.matches('[data-radar-add]')) { showPriorityForm(); return; }
    if (target.dataset.radarEdit) { showPriorityForm(target.dataset.radarEdit); return; }
    if (target.dataset.radarView) {
      const priority = priorities().find((item) => item.id === target.dataset.radarView);
      state = { ...state, origin: priority.origin, favorites: false, payment: 'all', search: '', budget: 100, direct: false, reposition: false, priority: priority.id };
      render();
      $('#offersTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (target.dataset.radarRemove) {
      target.disabled = true;
      try { await saveProfile(priorities().filter((priority) => priority.id !== target.dataset.radarRemove)); notify('Data prioritária removida.'); }
      catch (error) { notify(error.message); target.disabled = false; }
      $('#radarTitle')?.focus({ preventScroll: true });
      return;
    }
    if (target.matches('[data-radar-delete]')) openDialog('<h2>Excluir seu perfil?</h2><p>Suas datas prioritárias serão apagadas do radar e deixarão de orientar as buscas. As favoritas deste navegador continuam salvas.</p><div class="dialog-footer"><button class="button-danger" data-confirm-delete>Excluir perfil</button><button class="text-button" data-close-dialog>Cancelar</button></div>', 'SEU RADAR PESSOAL');
  });
  $('#dialogContent').addEventListener('click', (event) => {
    if (event.target.closest('[data-close-dialog]')) $('#detailsDialog').close();
    if (event.target.closest('[data-confirm-delete]')) deleteProfile();
  });
  $('#dialogContent').addEventListener('submit', (event) => { if (event.target.id !== 'priorityForm') return; event.preventDefault(); submitPriority(event.target); });
  ['#navHow', '#helpButton', '#coverageButton'].forEach((selector) => $(selector).addEventListener('click', () => showMethodology()));
  $('#repositionLearn').addEventListener('click', () => showMethodology('reposition'));
  $('#closeDialog').addEventListener('click', () => $('#detailsDialog').close());
  $('#detailsDialog').addEventListener('click', (event) => { if (event.target !== $('#detailsDialog')) return; const bounds = event.target.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.target.close(); });
  $('#offersGrid').addEventListener('click', (event) => {
    const favorite = event.target.closest('[data-favorite]');
    if (favorite) {
      const id = favorite.dataset.favorite;
      const saved = !favorites.has(id);
      if (saved) favorites.add(id); else favorites.delete(id);
      try { localStorage.setItem('rotaleve.favorites', JSON.stringify([...favorites])); } catch { notify('O navegador não permitiu salvar suas favoritas.'); render(); return; }
      render();
      const replacement = $$('#offersGrid [data-favorite]').find((button) => button.dataset.favorite === id);
      if (replacement) replacement.focus({ preventScroll: true });
      notify(saved ? 'Um novo plano salvo nas favoritas.' : 'Oferta removida das favoritas.');
      return;
    }
    const toggle = event.target.closest('[data-group-toggle]');
    if (toggle) {
      const key = toggle.dataset.groupToggle;
      if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
      render();
      const replacement = $$('#offersGrid [data-group-toggle]').find((button) => button.dataset.groupToggle === key);
      if (replacement) replacement.focus();
      return;
    }
    const details = event.target.closest('[data-details]');
    if (details) showDetails(details.dataset.details);
  });
  window.addEventListener('storage', (event) => { if (event.key !== 'rotaleve.favorites') return; try { const saved = JSON.parse(event.newValue || '[]'); favorites = new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []); render(); } catch { /* Ignore malformed browser-local data. */ } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadOffers(); });
  setInterval(() => { if (!document.hidden) render(); }, 60 * 1000);
  setInterval(() => { if (!document.hidden) loadOffers(); }, 5 * 60 * 1000);
  loadOffers();
  loadAccount();
})();
