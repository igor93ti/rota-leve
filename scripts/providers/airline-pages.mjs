/** Public airline advertisements, not a booking/availability verification API. */
const OFFICIAL_HOSTS = new Set(['passagens.voeazul.com.br', 'www.voegol.com.br', 'www.flytap.com', 'wwws.airfrance.com.br', 'www.klm.com.br']);
const AIRPORTS = {
  FOR:['Fortaleza','Brasil'],REC:['Recife','Brasil'],GRU:['São Paulo','Brasil'],CGH:['São Paulo','Brasil'],SAO:['São Paulo','Brasil'],VCP:['Campinas','Brasil'],GIG:['Rio de Janeiro','Brasil'],SDU:['Rio de Janeiro','Brasil'],RIO:['Rio de Janeiro','Brasil'],BSB:['Brasília','Brasil'],CNF:['Belo Horizonte','Brasil'],BHZ:['Belo Horizonte','Brasil'],SSA:['Salvador','Brasil'],POA:['Porto Alegre','Brasil'],FLN:['Florianópolis','Brasil'],CWB:['Curitiba','Brasil'],IGU:['Foz do Iguaçu','Brasil'],BEL:['Belém','Brasil'],MAO:['Manaus','Brasil'],GYN:['Goiânia','Brasil'],UDI:['Uberlândia','Brasil'],NVT:['Navegantes','Brasil'],FEN:['Fernando de Noronha','Brasil'],THE:['Teresina','Brasil'],AJU:['Aracaju','Brasil'],MAB:['Marabá','Brasil'],MCZ:['Maceió','Brasil'],NAT:['Natal','Brasil'],JPA:['João Pessoa','Brasil'],SLZ:['São Luís','Brasil'],CGB:['Cuiabá','Brasil'],PMW:['Palmas','Brasil'],BPS:['Porto Seguro','Brasil'],VIX:['Vitória','Brasil'],JDO:['Juazeiro do Norte','Brasil'],PNZ:['Petrolina','Brasil'],IMP:['Imperatriz','Brasil'],STM:['Santarém','Brasil'],MCP:['Macapá','Brasil'],PVH:['Porto Velho','Brasil'],RBR:['Rio Branco','Brasil'],BVB:['Boa Vista','Brasil'],CPV:['Campina Grande','Brasil'],IOS:['Ilhéus','Brasil'],RAO:['Ribeirão Preto','Brasil'],SJP:['São José do Rio Preto','Brasil'],LDB:['Londrina','Brasil'],MGF:['Maringá','Brasil'],JOI:['Joinville','Brasil'],XAP:['Chapecó','Brasil'],CXJ:['Caxias do Sul','Brasil'],PPB:['Presidente Prudente','Brasil'],JTC:['Bauru','Brasil'],JJD:['Jericoacoara','Brasil'],OPS:['Sinop','Brasil'],ROO:['Rondonópolis','Brasil'],JPR:['Ji-Paraná','Brasil'],BVH:['Vilhena','Brasil'],DOU:['Dourados','Brasil'],CGR:['Campo Grande','Brasil'],VDC:['Vitória da Conquista','Brasil'],MOC:['Montes Claros','Brasil'],IPN:['Ipatinga','Brasil'],GVR:['Governador Valadares','Brasil'],MII:['Marília','Brasil'],UBA:['Uberaba','Brasil'],BRA:['Barreiras','Brasil'],LEC:['Lençóis','Brasil'],VAL:['Valença','Brasil'],TFF:['Tefé','Brasil'],TBT:['Tabatinga','Brasil'],EIR:['Eirunepé','Brasil'],CZS:['Cruzeiro do Sul','Brasil'],RVD:['Rio Verde','Brasil'],CAC:['Cascavel','Brasil'],GPB:['Guarapuava','Brasil'],PFB:['Passo Fundo','Brasil'],PET:['Pelotas','Brasil'],URG:['Uruguaiana','Brasil'],RIA:['Santa Maria','Brasil'],GEL:['Santo Ângelo','Brasil'],CMG:['Corumbá','Brasil'],TJL:['Três Lagoas','Brasil'],AAX:['Araxá','Brasil'],CFB:['Cabo Frio','Brasil'],MEA:['Macaé','Brasil'],CAW:['Campos dos Goytacazes','Brasil'],IZA:['Juiz de Fora','Brasil'],QNS:['Canoas','Brasil'],SOD:['Sorocaba','Brasil'],ARU:['Araçatuba','Brasil'],PIN:['Parintins','Brasil'],CIZ:['Coari','Brasil'],JAW:['Araripina','Brasil'],CAU:['Caruaru','Brasil'],SET:['Serra Talhada','Brasil'],GNM:['Guanambi','Brasil'],TXF:['Teixeira de Freitas','Brasil'],PAV:['Paulo Afonso','Brasil'],PNS:['Pensacola','Estados Unidos'],
  LIS:['Lisboa','Portugal'],OPO:['Porto','Portugal'],MAD:['Madri','Espanha'],BCN:['Barcelona','Espanha'],CDG:['Paris','França'],ORY:['Paris','França'],PAR:['Paris','França'],LHR:['Londres','Reino Unido'],LGW:['Londres','Reino Unido'],LON:['Londres','Reino Unido'],FCO:['Roma','Itália'],MXP:['Milão','Itália'],AMS:['Amsterdã','Países Baixos'],FRA:['Frankfurt','Alemanha'],MUC:['Munique','Alemanha'],ZRH:['Zurique','Suíça'],GVA:['Genebra','Suíça'],BRU:['Bruxelas','Bélgica'],DUB:['Dublin','Irlanda'],VIE:['Viena','Áustria'],PRG:['Praga','República Tcheca'],CPH:['Copenhague','Dinamarca'],ARN:['Estocolmo','Suécia'],OSL:['Oslo','Noruega'],ATH:['Atenas','Grécia'],FAO:['Faro','Portugal'],FNC:['Funchal','Portugal'],PDL:['Ponta Delgada','Portugal'],TER:['Ilha Terceira','Portugal'],RAI:['Praia','Cabo Verde'],SID:['Ilha do Sal','Cabo Verde'],VXE:['São Vicente','Cabo Verde'],CMN:['Casablanca','Marrocos'],RAK:['Marrakech','Marrocos'],DKR:['Dakar','Senegal'],DSS:['Dakar','Senegal'],LAD:['Luanda','Angola'],MPM:['Maputo','Moçambique'],JNB:['Joanesburgo','África do Sul'],CPT:['Cidade do Cabo','África do Sul'],BUE:['Buenos Aires','Argentina'],AEP:['Buenos Aires','Argentina'],EZE:['Buenos Aires','Argentina'],COR:['Córdoba','Argentina'],ROS:['Rosário','Argentina'],BHI:['Bahía Blanca','Argentina'],USH:['Ushuaia','Argentina'],SLA:['Salta','Argentina'],MDZ:['Mendoza','Argentina'],BRC:['Bariloche','Argentina'],SCL:['Santiago','Chile'],MVD:['Montevidéu','Uruguai'],LIM:['Lima','Peru'],BOG:['Bogotá','Colômbia'],CTG:['Cartagena','Colômbia'],MDE:['Medellín','Colômbia'],ASU:['Assunção','Paraguai'],VVI:['Santa Cruz de la Sierra','Bolívia'],PTY:['Cidade do Panamá','Panamá'],SJO:['San José','Costa Rica'],PUJ:['Punta Cana','República Dominicana'],SDQ:['Santo Domingo','República Dominicana'],CUN:['Cancún','México'],MEX:['Cidade do México','México'],MIA:['Miami','Estados Unidos'],FLL:['Fort Lauderdale','Estados Unidos'],MCO:['Orlando','Estados Unidos'],JFK:['Nova York','Estados Unidos'],EWR:['Nova York','Estados Unidos'],NYC:['Nova York','Estados Unidos'],BOS:['Boston','Estados Unidos'],IAD:['Washington','Estados Unidos'],SFO:['São Francisco','Estados Unidos'],LAX:['Los Angeles','Estados Unidos'],DFW:['Dallas','Estados Unidos'],IAH:['Houston','Estados Unidos'],ATL:['Atlanta','Estados Unidos'],ORD:['Chicago','Estados Unidos'],YYZ:['Toronto','Canadá'],YUL:['Montreal','Canadá'],DOH:['Doha','Catar'],DXB:['Dubai','Emirados Árabes Unidos'],AUH:['Abu Dhabi','Emirados Árabes Unidos'],IST:['Istambul','Turquia'],ADD:['Adis Abeba','Etiópia'],TLV:['Tel Aviv','Israel'],NRT:['Tóquio','Japão'],HND:['Tóquio','Japão'],ICN:['Seul','Coreia do Sul'],BKK:['Bangcoc','Tailândia'],SIN:['Singapura','Singapura'],SYD:['Sydney','Austrália']
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

export async function collectAirlinePages({ fetchImpl = fetch, now = new Date(), sources = [] } = {}) {
  const result = {offers:[],sources:[]};
  // At most ten public pages per run, requested sequentially, four checks a day.
  const selected = sources.filter(sourceAllowed).slice(0,10);
  for (const source of selected) {
    const record = {id:source.id,name:source.name,url:source.url,status:'error',count:0};
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
        if (!offers.length) record.error = 'Nenhuma tarifa completa e futura em BRL/econômica reconhecida.';
        result.offers.push(...offers);
      } catch (error) { record.status = 'unparsed'; record.error = error.message; }
    } catch (error) { record.error = error.name === 'TimeoutError' ? 'A consulta excedeu 25 segundos.' : error.message; }
    result.sources.push(record);
    // Sequential requests, no aggressive retries; provider failures wait until next run.
  }
  return result;
}
