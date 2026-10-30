'use strict';

(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const cityNames = { FOR: 'Fortaleza', REC: 'Recife', GRU: 'São Paulo', CGH: 'São Paulo', VCP: 'Campinas', GIG: 'Rio de Janeiro', SDU: 'Rio de Janeiro', BSB: 'Brasília', SSA: 'Salvador', CNF: 'Belo Horizonte', POA: 'Porto Alegre', CWB: 'Curitiba', BEL: 'Belém', MAO: 'Manaus', FEN: 'Fernando de Noronha', LIS: 'Lisboa', OPO: 'Porto', MAD: 'Madri', CDG: 'Paris', ORY: 'Paris', MIA: 'Miami', MCO: 'Orlando', EZE: 'Buenos Aires', AEP: 'Buenos Aires', SCL: 'Santiago' };
  const photographs = {
    LIS: 'photo-1555881400-74d7acaacd8b', OPO: 'photo-1555881400-74d7acaacd8b',
    CDG: 'photo-1502602898657-3e91760cbb34', ORY: 'photo-1502602898657-3e91760cbb34',
    GIG: 'photo-1483729558449-99ef09a8c325', SDU: 'photo-1483729558449-99ef09a8c325',
    REC: 'photo-1507525428034-b723cf961d3e', FOR: 'photo-1507525428034-b723cf961d3e',
    FEN: 'photo-1519046904884-53103b34b206', SSA: 'photo-1519046904884-53103b34b206',
    default: 'photo-1476514525535-07fb3b4ae5f1'
  };
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
  const timestamp = (value) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.valueOf()) ? 'Horário não informado' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(parsed);
  };
  const calendarIcon = '<svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 5h12v10H3zM6 2v5m6-5v5M3 9h12"/></svg>';
  const starIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>';
  let favorites = new Set();
  try { const saved = JSON.parse(localStorage.getItem('rotaleve.favorites') || '[]'); if (Array.isArray(saved)) favorites = new Set(saved.filter((id) => typeof id === 'string')); } catch { /* Browser storage is optional. */ }
  let data = { offers: [], coverage: { summary: '', sources: [] } };
  let state = { origin: 'FOR', payment: 'all', region: 'all', search: '', sort: 'price', budget: 100, direct: false, reposition: false, favorites: false };
  let loadError = false;
  let toastTimer;

  function notify(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2600);
  }

  function activeOffers() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const component = (type) => parts.find((part) => part.type === type).value;
    const today = `${component('year')}-${component('month')}-${component('day')}`;
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

  function filteredOffers() {
    const query = normalize(state.search.trim());
    const offers = activeOffers().filter((offer) => offer.origin === state.origin
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

  function card(offer, index) {
    const miles = offer.type === 'miles';
    const saved = favorites.has(offer.id);
    const destination = offer.destinationCity || cityNames[offer.destination] || offer.destination;
    const image = photographs[offer.destination] || photographs.default;
    const url = safeUrl(offer.sourceUrl);
    const stops = offer.reposition ? `via ${offer.reposition.via}` : offer.stops === 0 ? 'Voo direto' : Number.isInteger(offer.stops) ? `${offer.stops} ${offer.stops === 1 ? 'conexão' : 'conexões'}` : 'Ver itinerário';
    const taxes = offer.taxes === null || offer.taxes === undefined ? 'Taxas: confira na fonte' : offer.taxes === 0 ? miles ? 'Taxas informadas: R$ 0,00' : 'Taxas incluídas' : `+ ${money(offer.taxes)} em taxas`;
    const priceHtml = miles ? `${integer(offer.price)}<span class="price-unit">${escape(offer.unit || 'pts')}</span>` : `<span class="currency">R$</span>${escape(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(offer.price))}`;
    const trip = offer.tripType === 'roundtrip' ? 'Ida e volta' : 'Só ida';
    const tripDates = `${date(offer.departureDate)}${offer.returnDate ? ` → ${date(offer.returnDate)}` : ''}`;
    const savings = offer.reposition?.savings > 0 ? `<div class="saving-note">↗ Economia estimada de ${escape(money(offer.reposition.savings))} com saída por ${escape(offer.reposition.via)}</div>` : '';
    return `<article class="offer-card" aria-label="${escape(destination)}, ${miles ? 'milhas' : 'dinheiro'}"><div class="card-cover"><div class="cover-fallback" aria-hidden="true">${escape(offer.destination)}</div><img src="https://images.unsplash.com/${image}?auto=format&fit=crop&w=800&q=80" alt="" ${index < 3 ? 'fetchpriority="low"' : 'loading="lazy"'} decoding="async" referrerpolicy="no-referrer"><div class="cover-badges"><span class="offer-badge ${miles ? 'miles' : ''}">${miles ? '✧ Milhas' : 'R$ Dinheiro'}</span>${offer.reposition ? '<span class="offer-badge reposition">Nova rota</span>' : ''}</div><span class="image-caption">Imagem ilustrativa</span><button class="favorite-button ${saved ? 'saved' : ''}" data-favorite="${escape(offer.id)}" aria-label="${saved ? 'Remover' : 'Salvar'} ${escape(destination)} ${saved ? 'das favoritas' : 'nas favoritas'}" aria-pressed="${saved}">${starIcon}</button></div><div class="card-body"><div class="destination-title"><h3>${escape(destination)}</h3><span>${escape(offer.destinationCountry || (offer.region === 'domestic' ? 'Brasil' : 'Internacional'))}</span></div><div class="card-route"><span>${escape(offer.origin)}</span><span class="route-arrow">⟶</span><span>${escape(offer.destination)}</span><span class="stops">${escape(stops)}</span></div><div class="trip-dates">${calendarIcon}<span>${escape(tripDates)}</span><span>${trip}</span></div><div class="card-price-row"><div><div class="price-label">Preço anunciado por pessoa</div><div class="price">${priceHtml}</div><div class="price-tax">${escape(taxes)}</div></div><span class="airline-pill"><span class="airline-mark"></span>${escape(miles ? (offer.program || offer.airline) : offer.airline)}</span></div>${savings}<div class="card-source"><span>${escape(offer.sourceName || 'Fonte da oferta')}</span><span>${offer.availability === 'verified' ? 'Consultado' : 'Anunciado'} ${escape(date(offer.observedAt))}</span></div><div class="card-actions">${url ? `<a class="source-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer">Ver na fonte <span>↗</span></a>` : '<span class="source-link">Fonte indisponível</span>'}<button class="details-button" data-details="${escape(offer.id)}">Detalhes</button></div></div></article>`;
  }

  function render() {
    refreshControls();
    renderMetrics();
    const offers = filteredOffers();
    $('#offersGrid').setAttribute('aria-busy', 'false');
    $('#offersGrid').innerHTML = offers.map(card).join('');
    $('#offersGrid').hidden = !offers.length;
    $('#emptyState').hidden = Boolean(offers.length);
    $('#resultCount').textContent = `${offers.length} ${offers.length === 1 ? 'oferta encontrada' : 'ofertas encontradas'}`;
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
    $$('#offersGrid img').forEach((image) => image.addEventListener('error', () => { image.hidden = true; }, { once: true }));
  }

  function resetFilters() {
    state = { ...state, payment: 'all', region: 'all', search: '', sort: 'price', budget: 100, direct: false, reposition: false };
    render();
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
    openDialog(`<h2>Viajar leve começa com informação clara.</h2><p>O Rota Leve reúne preços anunciados em dinheiro e milhas saindo de Fortaleza e Recife, com links para você conferir cada oportunidade na fonte.</p><h3>O que significa uma oferta no radar?</h3><p>Uma publicação ou página de companhia pode anunciar uma tarifa que já não esteja disponível. Cada card mostra a fonte, a data da observação e a condição do preço. A confirmação final acontece no site onde você fará a reserva.</p><h3>Atualização e cobertura</h3>${schedule}<p>${escape(data.coverage?.summary || 'A cobertura depende das fontes conectadas. Não há garantia de busca em todas as companhias ou programas de fidelidade.')}</p>${sourceList}<h3>Dinheiro e milhas</h3><p>Os valores são por pessoa, na modalidade indicada: só ida ou ida e volta. Em milhas, as taxas são exibidas separadamente quando informadas. A ordenação por menor preço mantém dinheiro e milhas em grupos, pois são unidades diferentes.</p>${positioning}<h3>Favoritas, sem conta</h3><p>As estrelas são salvas apenas neste navegador. Elas não reservam uma tarifa e não enviam alertas. Limpar os dados do navegador remove suas favoritas.</p>`, 'FONTES E METODOLOGIA');
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

  $$('.origin-choice').forEach((button) => button.addEventListener('click', () => { state.origin = button.dataset.origin; state.budget = 100; render(); }));
  $('#originSelect').addEventListener('change', (event) => { state.origin = event.target.value; state.budget = 100; render(); });
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
  $('#navExplore').addEventListener('click', () => { state.favorites = false; render(); });
  $('#navFavorites').addEventListener('click', () => { state.favorites = true; render(); $('#offersTitle').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
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
    const details = event.target.closest('[data-details]');
    if (details) showDetails(details.dataset.details);
  });
  window.addEventListener('storage', (event) => { if (event.key !== 'rotaleve.favorites') return; try { const saved = JSON.parse(event.newValue || '[]'); favorites = new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []); render(); } catch { /* Ignore malformed browser-local data. */ } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadOffers(); });
  setInterval(() => { if (!document.hidden) render(); }, 60 * 1000);
  setInterval(() => { if (!document.hidden) loadOffers(); }, 5 * 60 * 1000);
  loadOffers();
})();
