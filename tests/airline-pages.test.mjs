import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseAirlinePage,collectAirlinePages,routeLinks,selectRoutes} from '../scripts/providers/airline-pages.mjs';

const now = new Date('2026-10-30T17:26:26Z');
const source = {id:'azul-for',name:'Azul',airline:'Azul',program:'Azul Fidelidade',url:'https://passagens.voeazul.com.br/pt/voos-de-fortaleza',kind:'airline-page',official:true,allowed:true,automatic:true,enabled:true};
const fare = {__typename:'Fare',originAirportCode:'FOR',destinationAirportCode:'REC',travelClass:'Economy',departureDate:'2027-03-04',returnDate:'',flightType:'ONE_WAY',totalPrice:474.86,currencyCode:'BRL',redemption:null,stops:null};
const htmlFor = values => `<script type="application/json" id="__NEXT_DATA__">${JSON.stringify({props:{pageProps:{apolloState:{data:{fares:values}}}}})}</script>`;

test('reads structured cash and award data without treating unknown taxes or stops as zero',()=>{
  const offers = parseAirlinePage(htmlFor([fare,{...fare,redemption:{unit:'POINTS',amount:15000,taxAmount:null}}]),{source,now});
  assert.equal(offers.length,2);
  assert.equal(offers[0].price,474.86);
  assert.equal(offers[1].price,15000);
  assert.equal(offers[1].type,'miles');
  assert.equal(offers[1].taxes,null);
  assert.equal(offers[1].stops,null);
  assert.equal(offers[1].availability,'advertised');
  assert.equal(offers[1].validUntil,'2026-11-01T17:26:26.000Z');
});

test('excludes expired, unsupported currency, unresolved airports, business and incomplete roundtrips',()=>{
  const invalid = [{...fare,departureDate:'2026-10-29'},{...fare,currencyCode:'USD'},{...fare,destinationAirportCode:'ZZZ'},{...fare,travelClass:'Business'},{...fare,flightType:'ROUND_TRIP',returnDate:''},{...fare,totalPrice:'474.86'}];
  assert.deepEqual(parseAirlinePage(htmlFor(invalid),{source,now}),[]);
});

test('deduplicates headlines and refuses unrecognized payloads and unauthorized sources',()=>{
  assert.equal(parseAirlinePage(htmlFor([fare,fare]),{source,now}).length,1);
  assert.throws(()=>parseAirlinePage('<p>R$ 100 Fortaleza Recife</p>',{source,now}),/ausente/);
  assert.throws(()=>parseAirlinePage(htmlFor([fare]),{source:{...source,url:'https://example.com'},now}),/autorizada/);
});

test('collector records source errors and unparsed formats without fabricated offers',async()=>{
  const config = [{...source,id:'ok'},{...source,id:'format',url:source.url+'?format=changed'},{...source,id:'error',url:source.url+'?error=1'},{...source,id:'disabled',enabled:false},{...source,id:'unofficial',official:false}];
  const result=await collectAirlinePages({sources:config,now,fetchImpl:async url=>{if(url.includes('error'))throw new Error('Network failed');return {ok:true,status:200,headers:new Headers({'content-type':'text/html'}),text:async()=>url.includes('format')?'<p>Changed</p>':htmlFor([fare])};}});
  assert.equal(result.offers.length,1);
  assert.deepEqual(result.sources.map(x=>x.status),['ok','unparsed','error']);
});

test('parses a minimal fixture from the observed airline GraphQL cache shape',async()=>{
  const html=await readFile(new URL('./fixtures/airline-next.html',import.meta.url),'utf8');
  const offers=parseAirlinePage(html,{source,now});
  assert.equal(offers.length,2);
  assert.deepEqual(offers.map(x=>[x.destination,x.price,x.type]),[['REC',474.86,'cash'],['REC',15000,'miles']]);
});

test('reads only official same-host route links that start in FOR or REC',()=>{
  const html = '<a href="voos-de-fortaleza-para-sao-paulo">SP</a><a href="voos-de-fortaleza-para-atlantida">?</a><a href="voos-de-campinas-para-lisboa">VCP</a><a href="https://example.com/voos-de-fortaleza-para-lisboa">fake</a><a href="https://www.voegol.com.br/br/voos-de-fortaleza-para-lisboa">outro host</a><a href="/en/voos-de-fortaleza-para-lisboa">outro mercado</a>';
  assert.deepEqual(routeLinks(html,source),[{url:'https://passagens.voeazul.com.br/pt/voos-de-fortaleza-para-sao-paulo',origin:'FOR',city:'São Paulo',destinations:['SAO']}]);
});

test('market is the page directory and airline spellings resolve to the same city',()=>{
  const jetsmart = {...source,id:'jetsmart-rec',airline:'JetSMART',program:undefined,url:'https://jetsmart.com/ofertas/pt-br/voos-de-recife'};
  const html = '<a href="/ofertas/pt-br/voos-de-recife-para-montevideo">MVD</a><a href="/ofertas/en-us/voos-de-recife-para-buenos-aires">USD</a><a href="/ofertas/pt-br/voos-de-recife-para-buenos-aires">BUE</a>';
  assert.deepEqual(routeLinks(html,jetsmart).map(x=>[x.url,x.city,x.destinations]),[
    ['https://jetsmart.com/ofertas/pt-br/voos-de-recife-para-montevideo','Montevidéu',['MVD']],
    ['https://jetsmart.com/ofertas/pt-br/voos-de-recife-para-buenos-aires','Buenos Aires',['BUE']],
  ]);
});

const page = body => async () => ({ok:true,status:200,headers:new Headers({'content-type':'text/html'}),text:async()=>body});
const origin = `<a href="voos-de-fortaleza-para-sao-paulo"></a><a href="voos-de-fortaleza-para-lisboa"></a><a href="voos-de-fortaleza-para-recife"></a>${htmlFor([fare])}`;
const route = htmlFor([{...fare,destinationAirportCode:'GRU',departureDate:'2027-01-10'},{...fare,destinationAirportCode:'CGH',departureDate:'2027-01-12'}]);

test('profile demand reads requested route pages first, then the rotation',async()=>{
  const requested = [];
  const fetchImpl = async url => { requested.push(url); return page(url.endsWith('voos-de-fortaleza') ? origin : route)(); };
  const demand = [{origin:'FOR',destination:'SAO',people:2},{origin:'REC',destination:'LIS',people:1},{origin:'FOR',destination:null,people:1}];
  const result = await collectAirlinePages({sources:[source],now,fetchImpl,demand});
  const base = 'https://passagens.voeazul.com.br/pt/voos-de-fortaleza';
  assert.deepEqual(requested,[base,`${base}-para-sao-paulo`,`${base}-para-lisboa`,`${base}-para-recife`]);
  assert.deepEqual(result.sources.map(x=>[x.name,x.status,x.count,Boolean(x.priority),x.pages]),[['Azul','ok',1,false,undefined],['Azul · Fortaleza → São Paulo','ok',2,true,undefined],['Azul · páginas de rota','ok',4,false,2]]);
});

test('without profiles the rotation still reads route pages and reports failures apart from empty pages',async()=>{
  const fetchImpl = async url => {
    if (url.endsWith('-para-lisboa')) throw new Error('Network failed');
    return page(url.endsWith('voos-de-fortaleza') ? origin : url.endsWith('-para-recife') ? htmlFor([]) : route)();
  };
  const result = await collectAirlinePages({sources:[source],now,fetchImpl});
  const summary = result.sources.find(x=>x.route);
  assert.deepEqual([summary.status,summary.pages,summary.count,summary.empty,summary.failed],['partial',3,2,1,1]);
  assert.match(summary.error,/para-lisboa: Network failed/);
});

test('rotation covers every route within one slice per 6 hours, at most 60 pages each',()=>{
  const links = Array.from({length:130},(_,i)=>({url:`https://www.voegol.com.br/br/voos-de-fortaleza-para-r${String(i).padStart(3,'0')}`,origin:'FOR',destinations:[i < 3 ? 'LIS' : `X${i}`]}));
  const demand = [{origin:'FOR',destination:'LIS',people:3}];
  const seen = new Set();
  for (let run = 0; run < 3; run++) {
    const {requested,rotation} = selectRoutes(links,{demand,now:new Date(now.getTime() + run * 6 * 3600000)});
    assert.equal(requested.length,3);
    assert.ok(rotation.length <= 60);
    assert.ok(rotation.every(link => !requested.includes(link)));
    for (const link of [...requested,...rotation]) seen.add(link.url);
  }
  assert.equal(seen.size,130);
});
