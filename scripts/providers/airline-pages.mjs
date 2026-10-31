/** Public airline advertisements, not a booking/availability verification API. */
const OFFICIAL_HOSTS = new Set(['passagens.voeazul.com.br', 'www.voegol.com.br', 'www.flytap.com', 'wwws.airfrance.com.br', 'www.klm.com.br', 'jetsmart.com']);
const MAX_SOURCES = 10;
// Páginas de rota por coleta: as pedidas nos perfis primeiro, depois um rodízio que
// percorre todas as rotas encontradas. Com 4 coletas ao dia, cada rota é relida em
// até um dia, dentro do prazo de 48 horas das ofertas.
const DEMAND_ROUTES_PER_RUN = 8;
const ROTATION_ROUTES_PER_RUN = 60;
const ROTATION_HOURS = 6;
const AIRPORTS = {
  FOR:['Fortaleza','Brasil'],REC:['Recife','Brasil'],GRU:['São Paulo','Brasil'],CGH:['São Paulo','Brasil'],SAO:['São Paulo','Brasil'],VCP:['Campinas','Brasil'],GIG:['Rio de Janeiro','Brasil'],SDU:['Rio de Janeiro','Brasil'],RIO:['Rio de Janeiro','Brasil'],BSB:['Brasília','Brasil'],CNF:['Belo Horizonte','Brasil'],BHZ:['Belo Horizonte','Brasil'],SSA:['Salvador','Brasil'],POA:['Porto Alegre','Brasil'],FLN:['Florianópolis','Brasil'],CWB:['Curitiba','Brasil'],IGU:['Foz do Iguaçu','Brasil'],BEL:['Belém','Brasil'],MAO:['Manaus','Brasil'],GYN:['Goiânia','Brasil'],UDI:['Uberlândia','Brasil'],NVT:['Navegantes','Brasil'],FEN:['Fernando de Noronha','Brasil'],THE:['Teresina','Brasil'],AJU:['Aracaju','Brasil'],MAB:['Marabá','Brasil'],MCZ:['Maceió','Brasil'],NAT:['Natal','Brasil'],JPA:['João Pessoa','Brasil'],SLZ:['São Luís','Brasil'],CGB:['Cuiabá','Brasil'],PMW:['Palmas','Brasil'],BPS:['Porto Seguro','Brasil'],VIX:['Vitória','Brasil'],JDO:['Juazeiro do Norte','Brasil'],PNZ:['Petrolina','Brasil'],IMP:['Imperatriz','Brasil'],STM:['Santarém','Brasil'],MCP:['Macapá','Brasil'],PVH:['Porto Velho','Brasil'],RBR:['Rio Branco','Brasil'],BVB:['Boa Vista','Brasil'],CPV:['Campina Grande','Brasil'],IOS:['Ilhéus','Brasil'],RAO:['Ribeirão Preto','Brasil'],SJP:['São José do Rio Preto','Brasil'],LDB:['Londrina','Brasil'],MGF:['Maringá','Brasil'],JOI:['Joinville','Brasil'],XAP:['Chapecó','Brasil'],CXJ:['Caxias do Sul','Brasil'],PPB:['Presidente Prudente','Brasil'],JTC:['Bauru','Brasil'],JJD:['Jericoacoara','Brasil'],OPS:['Sinop','Brasil'],ROO:['Rondonópolis','Brasil'],JPR:['Ji-Paraná','Brasil'],BVH:['Vilhena','Brasil'],DOU:['Dourados','Brasil'],CGR:['Campo Grande','Brasil'],VDC:['Vitória da Conquista','Brasil'],MOC:['Montes Claros','Brasil'],IPN:['Ipatinga','Brasil'],GVR:['Governador Valadares','Brasil'],MII:['Marília','Brasil'],UBA:['Uberaba','Brasil'],BRA:['Barreiras','Brasil'],LEC:['Lençóis','Brasil'],VAL:['Valença','Brasil'],TFF:['Tefé','Brasil'],TBT:['Tabatinga','Brasil'],EIR:['Eirunepé','Brasil'],CZS:['Cruzeiro do Sul','Brasil'],RVD:['Rio Verde','Brasil'],CAC:['Cascavel','Brasil'],GPB:['Guarapuava','Brasil'],PFB:['Passo Fundo','Brasil'],PET:['Pelotas','Brasil'],URG:['Uruguaiana','Brasil'],RIA:['Santa Maria','Brasil'],GEL:['Santo Ângelo','Brasil'],CMG:['Corumbá','Brasil'],TJL:['Três Lagoas','Brasil'],AAX:['Araxá','Brasil'],CFB:['Cabo Frio','Brasil'],MEA:['Macaé','Brasil'],CAW:['Campos dos Goytacazes','Brasil'],IZA:['Juiz de Fora','Brasil'],QNS:['Canoas','Brasil'],SOD:['Sorocaba','Brasil'],ARU:['Araçatuba','Brasil'],PIN:['Parintins','Brasil'],CIZ:['Coari','Brasil'],JAW:['Araripina','Brasil'],CAU:['Caruaru','Brasil'],SET:['Serra Talhada','Brasil'],GNM:['Guanambi','Brasil'],TXF:['Teixeira de Freitas','Brasil'],PAV:['Paulo Afonso','Brasil'],PNS:['Pensacola','Estados Unidos'],
  LIS:['Lisboa','Portugal'],OPO:['Porto','Portugal'],MAD:['Madri','Espanha'],BCN:['Barcelona','Espanha'],CDG:['Paris','França'],ORY:['Paris','França'],PAR:['Paris','França'],LHR:['Londres','Reino Unido'],LGW:['Londres','Reino Unido'],LON:['Londres','Reino Unido'],FCO:['Roma','Itália'],MXP:['Milão','Itália'],AMS:['Amsterdã','Países Baixos'],FRA:['Frankfurt','Alemanha'],MUC:['Munique','Alemanha'],ZRH:['Zurique','Suíça'],GVA:['Genebra','Suíça'],BRU:['Bruxelas','Bélgica'],DUB:['Dublin','Irlanda'],VIE:['Viena','Áustria'],PRG:['Praga','República Tcheca'],CPH:['Copenhague','Dinamarca'],ARN:['Estocolmo','Suécia'],OSL:['Oslo','Noruega'],ATH:['Atenas','Grécia'],FAO:['Faro','Portugal'],FNC:['Funchal','Portugal'],PDL:['Ponta Delgada','Portugal'],TER:['Ilha Terceira','Portugal'],RAI:['Praia','Cabo Verde'],SID:['Ilha do Sal','Cabo Verde'],VXE:['São Vicente','Cabo Verde'],CMN:['Casablanca','Marrocos'],RAK:['Marrakech','Marrocos'],DKR:['Dakar','Senegal'],DSS:['Dakar','Senegal'],LAD:['Luanda','Angola'],MPM:['Maputo','Moçambique'],JNB:['Joanesburgo','África do Sul'],CPT:['Cidade do Cabo','África do Sul'],BUE:['Buenos Aires','Argentina'],AEP:['Buenos Aires','Argentina'],EZE:['Buenos Aires','Argentina'],COR:['Córdoba','Argentina'],ROS:['Rosário','Argentina'],BHI:['Bahía Blanca','Argentina'],USH:['Ushuaia','Argentina'],SLA:['Salta','Argentina'],MDZ:['Mendoza','Argentina'],BRC:['Bariloche','Argentina'],SCL:['Santiago','Chile'],MVD:['Montevidéu','Uruguai'],LIM:['Lima','Peru'],BOG:['Bogotá','Colômbia'],CTG:['Cartagena','Colômbia'],MDE:['Medellín','Colômbia'],ASU:['Assunção','Paraguai'],VVI:['Santa Cruz de la Sierra','Bolívia'],PTY:['Cidade do Panamá','Panamá'],SJO:['San José','Costa Rica'],PUJ:['Punta Cana','República Dominicana'],SDQ:['Santo Domingo','República Dominicana'],CUN:['Cancún','México'],MEX:['Cidade do México','México'],MIA:['Miami','Estados Unidos'],FLL:['Fort Lauderdale','Estados Unidos'],MCO:['Orlando','Estados Unidos'],JFK:['Nova York','Estados Unidos'],EWR:['Nova York','Estados Unidos'],NYC:['Nova York','Estados Unidos'],BOS:['Boston','Estados Unidos'],IAD:['Washington','Estados Unidos'],SFO:['São Francisco','Estados Unidos'],LAX:['Los Angeles','Estados Unidos'],DFW:['Dallas','Estados Unidos'],IAH:['Houston','Estados Unidos'],ATL:['Atlanta','Estados Unidos'],ORD:['Chicago','Estados Unidos'],YYZ:['Toronto','Canadá'],YUL:['Montreal','Canadá'],DOH:['Doha','Catar'],DXB:['Dubai','Emirados Árabes Unidos'],AUH:['Abu Dhabi','Emirados Árabes Unidos'],IST:['Istambul','Turquia'],ADD:['Adis Abeba','Etiópia'],TLV:['Tel Aviv','Israel'],NRT:['Tóquio','Japão'],HND:['Tóquio','Japão'],ICN:['Seul','Coreia do Sul'],BKK:['Bangcoc','Tailândia'],SIN:['Singapura','Singapura'],SYD:['Sydney','Austrália'],
  TPA:['Tampa','Estados Unidos'],CCS:['Caracas','Venezuela'],SAL:['San Salvador','El Salvador'],EDI:['Edimburgo','Reino Unido'],VLC:['Valência','Espanha'],AGP:['Málaga','Espanha'],LYS:['Lyon','França'],NCE:['Nice','França'],MRS:['Marselha','França'],BOD:['Bordéus','França'],NAP:['Nápoles','Itália'],VCE:['Veneza','Itália'],TRN:['Turim','Itália'],FLR:['Florença','Itália'],BLQ:['Bolonha','Itália'],BER:['Berlim','Alemanha'],HAM:['Hamburgo','Alemanha'],BUD:['Budapeste','Hungria'],WAW:['Varsóvia','Polônia'],BLL:['Billund','Dinamarca'],SVO:['Moscou','Rússia'],DEL:['Déli','Índia'],PEK:['Pequim','China'],PVG:['Xangai','China'],TUC:['San Miguel de Tucumán','Argentina'],NQN:['Neuquén','Argentina']
};

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}

function officialUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && OFFICIAL_HOSTS.has(u.hostname) && !u.username && !u.password; }
  catch { return false; }
}

function sourceAllowed(source) {
  return source && source.enabled === true && source.automatic === true && source.allowed === true && source.official === true && source.kind === 'airline-page' && officialUrl(source.url) && typeof source.airline === 'string';
}

// Aeroportos da mesma cidade contam como o mesmo destino pedido nos perfis (mesma tabela do site).
const METRO = {GRU:'SAO',CGH:'SAO',GIG:'RIO',SDU:'RIO',CDG:'PAR',ORY:'PAR',EZE:'BUE',AEP:'BUE',CNF:'BHZ',LHR:'LON',LGW:'LON',JFK:'NYC',EWR:'NYC',NRT:'TYO',HND:'TYO',DSS:'DKR'};
const cityCode = code => METRO[code] || code;
const slug = value => String(value).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const CITIES = new Map();
for (const [code,[city]] of Object.entries(AIRPORTS)) {
  if (!CITIES.has(slug(city))) CITIES.set(slug(city),{city,codes:new Set()});
  CITIES.get(slug(city)).codes.add(cityCode(code));
}
// Grafias usadas nos links das companhias que diferem do nome em português do Brasil.
const SLUG_ALIASES = {montevideo:'Montevidéu',bancoque:'Bangcoc','edimburgo-escocia':'Edimburgo'};
for (const [alias,city] of Object.entries(SLUG_ALIASES)) CITIES.set(alias,CITIES.get(slug(city)));
const directory = path => path.slice(0,path.lastIndexOf('/') + 1);

/** Links de rota que a própria companhia publica na página de origem, como voos-de-fortaleza-para-lisboa. */
export function routeLinks(html, source) {
  const {hostname:host,pathname} = new URL(source.url);
  // Mesmo mercado da página de origem (/pt/, /pt_br/, /ofertas/pt-br/...): outros mercados cobram em outra moeda.
  const market = directory(pathname);
  const links = new Map();
  for (const [,href] of String(html).matchAll(/href\s*=\s*["']([^"'#?\s]+)["']/gi)) {
    const match = /(?:^|\/)(?:voos|passagens)-de-([a-z-]+?)-para-([a-z-]+)$/.exec(href);
    if (!match) continue;
    let url;
    try { url = new URL(href, source.url).href; } catch { continue; }
    if (!officialUrl(url) || new URL(url).hostname !== host || directory(new URL(url).pathname) !== market) continue;
    const origin = [...(CITIES.get(match[1])?.codes || [])].find(code => code === 'FOR' || code === 'REC');
    const destination = CITIES.get(match[2]);
    if (origin && destination) links.set(url,{url,origin,city:destination.city,destinations:[...destination.codes]});
  }
  return [...links.values()];
}

export function parseAirlinePage(html, { source, now = new Date() } = {}) {
  if (!sourceAllowed(source)) throw new Error('Fonte não autorizada para coleta automática.');
  if (typeof html !== 'string' || html.length > 8_000_000) throw new Error('Página vazia ou maior que o limite de 8 MB.');
  // Only extract a known inert JSON script. Never execute scripts from a page.
  const match = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].find(m => /\bid\s*=\s*(["'])__NEXT_DATA__\1/i.test(m[1]) && /\btype\s*=\s*(["'])application\/json\1/i.test(m[1]));
  if (!match) throw new Error('JSON estruturado __NEXT_DATA__ ausente; formato não reconhecido.');
  const page = JSON.parse(match[2]);
  const state = page?.props?.pageProps?.apolloState?.data;
  if (!state || typeof state !== 'object') throw new Error('Cache estruturado de tarifas não encontrado.');
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone:'America/Sao_Paulo'}).format(now);
  const observedAt = now.toISOString();
  const validUntil = new Date(now.getTime() + 48*60*60*1000).toISOString();
  const offers = new Map();
  let visited = 0;
  const visit = (value, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 40) return;
    if (++visited > 120000) throw new Error('Cache de tarifas excede o limite de objetos.');
    if (value.__typename === 'Fare') {
      const origin = value.originAirportCode;
      const destination = value.destinationAirportCode;
      const place = AIRPORTS[destination];
      const departureDate = value.departureDate;
      const tripType = ({ONE_WAY:'oneway',ROUND_TRIP:'roundtrip'})[value.flightType];
      const returnDate = tripType === 'roundtrip' ? value.returnDate : null;
      const cabin = String(value.farenetTravelClass ?? value.travelClass ?? '').toUpperCase();
      const redemption = value.redemption;
      const isMiles = redemption != null;
      const price = isMiles ? redemption.amount : value.totalPrice;
      const currency = value.currencyCode;
      const safe = AIRPORTS[origin] && place && origin !== destination && validDate(departureDate) && departureDate >= today && tripType && (tripType !== 'roundtrip' || (validDate(returnDate) && returnDate >= departureDate)) && cabin === 'ECONOMY' && typeof price === 'number' && Number.isFinite(price) && price > 0 && currency === 'BRL' && (!isMiles || ['POINTS','MILES'].includes(redemption.unit));
      if (safe) {
        const type = isMiles ? 'miles' : 'cash';
        const id = `${source.airline.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${origin.toLowerCase()}-${destination.toLowerCase()}-${departureDate}-${returnDate || 'oneway'}-${type}`;
        const taxAmount = redemption?.taxAmount;
        const taxes = isMiles && typeof taxAmount === 'number' && Number.isFinite(taxAmount) && taxAmount >= 0 ? taxAmount : null;
        const lastSeen = value.priceLastSeen;
        const cacheAge = lastSeen && /^\d+$/.test(String(lastSeen.value)) && ['minute','minutes','hour','hours','day','days'].includes(lastSeen.unit) ? ` A companhia indica registro há ${lastSeen.value} ${lastSeen.unit}.` : '';
        const notes = `Preço anunciado na página pública da companhia; consulta da página em ${observedAt}, sem confirmação no checkout. A fonte pode usar cache de até 48 horas. Prazo de exibição de 48 horas definido pelo radar; não garante validade da tarifa.${isMiles && taxes === null ? ' Taxas da emissão não informadas.' : ''} Bagagem e serviços opcionais devem ser conferidos.${cacheAge}`;
        const offer = {id,origin,destination,destinationCity:place[0],destinationCountry:place[1],region:place[1] === 'Brasil' ? 'domestic' : 'international',airline:source.airline,type,price,currency,program:isMiles ? (source.program || null) : null,taxes,tripType,departureDate,returnDate,sourceName:source.name,sourceUrl:source.url,observedAt,validUntil,availability:'advertised',stops:Number.isInteger(value.stops) && value.stops >= 0 ? value.stops : null,notes,referencePrice:null,reposition:null};
        // Fare cards have age/tax details missing from duplicate page headlines.
        if (!offers.has(id) || value.priceLastSeen) offers.set(id, offer);
      }
    }
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  visit(state);
  return [...offers.values()];
}

const NO_FARES = 'Nenhuma tarifa completa e futura em BRL/econômica reconhecida.';

async function readSource({ fetchImpl, now, source, record, result }) {
  try {
    const response = await fetchImpl(source.url, {headers:{Accept:'text/html','User-Agent':'RotaLeveRadar/1.0 (public advertised fares; 4 checks/day)'},signal:AbortSignal.timeout(25000),redirect:'error'});
    if (!response.ok) throw new Error(`HTTP ${response.status}.`);
    if (response.url && !officialUrl(response.url)) throw new Error('Resposta fora do domínio oficial.');
    const contentType = response.headers?.get?.('content-type');
    if (contentType && !contentType.includes('text/html')) throw new Error('Resposta não é HTML.');
    const length = Number(response.headers?.get?.('content-length') || 0);
    if (length > 8_000_000) throw new Error('Resposta maior que o limite de 8 MB.');
    const html = await response.text();
    try {
      const offers = parseAirlinePage(html,{source,now});
      record.count = offers.length;
      record.status = offers.length ? 'ok' : 'unparsed';
      if (!offers.length) record.error = NO_FARES;
      result.offers.push(...offers);
    } catch (error) { record.status = 'unparsed'; record.error = error.message; }
    return html;
  } catch (error) { record.error = error.name === 'TimeoutError' ? 'A consulta excedeu 25 segundos.' : error.message; return null; }
}

/** Escolhe as páginas de rota da coleta: pedidos dos perfis primeiro, depois a fatia do rodízio. */
export function selectRoutes(links, { demand = [], now = new Date() } = {}) {
  const pending = new Map(links.map(link => [link.url,link]));
  const requested = [];
  for (const wish of demand) {
    for (const link of pending.values()) {
      if (requested.length >= DEMAND_ROUTES_PER_RUN) break;
      if (wish.destination && link.origin === wish.origin && link.destinations.includes(wish.destination)) { requested.push(link); pending.delete(link.url); }
    }
  }
  // Fatias intercaladas da lista ordenada: cada coleta de 6 em 6 horas lê a fatia seguinte
  // e reparte as requisições entre as companhias em vez de concentrar tudo num só site.
  const rest = [...pending.values()].sort((a,b) => a.url.localeCompare(b.url));
  const slices = Math.max(1,Math.ceil(rest.length / ROTATION_ROUTES_PER_RUN));
  const slot = Math.floor(now.getTime() / (ROTATION_HOURS * 3600000)) % slices;
  return {requested,rotation:rest.filter((_,index) => index % slices === slot)};
}

export async function collectAirlinePages({ fetchImpl = fetch, now = new Date(), sources = [], demand = [] } = {}) {
  const result = {offers:[],sources:[]};
  // At most ten public pages per run, requested sequentially, four checks a day.
  const selected = sources.filter(sourceAllowed).slice(0,MAX_SOURCES);
  const links = [];
  for (const source of selected) {
    const record = {id:source.id,name:source.name,url:source.url,status:'error',count:0};
    const html = await readSource({fetchImpl,now,source,record,result});
    if (html) links.push(...routeLinks(html,source).filter(link => !selected.some(base => base.url === link.url)).map(link => ({...link,source})));
    result.sources.push(record);
    // Sequential requests, no aggressive retries; provider failures wait until next run.
  }
  // A página de origem mostra uma data por destino; a de rota costuma trazer o calendário inteiro.
  const {requested,rotation} = selectRoutes(links,{demand,now});
  const routeSource = link => ({...link.source,id:`${link.source.id}-${slug(link.city)}`,name:`${link.source.airline} · ${AIRPORTS[link.origin][0]} → ${link.city}`,url:link.url});
  for (const link of requested) {
    const source = routeSource(link);
    const record = {id:source.id,name:source.name,url:source.url,status:'error',count:0,priority:true};
    await readSource({fetchImpl,now,source,record,result});
    result.sources.push(record);
  }
  // O rodízio vira uma linha por fonte de origem para a lista de fontes do site continuar legível.
  const summaries = new Map();
  for (const link of rotation) {
    const record = {status:'error',count:0};
    await readSource({fetchImpl,now,source:routeSource(link),record,result});
    if (!summaries.has(link.source.id)) summaries.set(link.source.id,{id:`${link.source.id}-rotas`,name:`${link.source.name} · páginas de rota`,url:link.source.url,status:'ok',count:0,pages:0,empty:0,failed:0,route:true});
    const summary = summaries.get(link.source.id);
    summary.pages += 1;
    summary.count += record.count;
    // Rota sem tarifa futura anunciada não é falha; erro de rede ou formato desconhecido é.
    if (record.error === NO_FARES) summary.empty += 1;
    else if (record.status !== 'ok') { summary.failed += 1; summary.error ||= `${link.url}: ${record.error || record.status}`; }
  }
  for (const summary of summaries.values()) {
    summary.status = summary.failed === 0 ? 'ok' : summary.failed === summary.pages ? 'error' : 'partial';
    result.sources.push(summary);
  }
  return result;
}
