import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseAirlinePage,collectAirlinePages,routeLinks} from '../scripts/providers/airline-pages.mjs';

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
  const html = '<a href="voos-de-fortaleza-para-sao-paulo">SP</a><a href="voos-de-fortaleza-para-bancoque">?</a><a href="voos-de-campinas-para-lisboa">VCP</a><a href="https://example.com/voos-de-fortaleza-para-lisboa">fake</a><a href="https://www.voegol.com.br/br/voos-de-fortaleza-para-lisboa">outro host</a><a href="/en/voos-de-fortaleza-para-lisboa">outro mercado</a>';
  assert.deepEqual(routeLinks(html,source),[{url:'https://passagens.voeazul.com.br/pt/voos-de-fortaleza-para-sao-paulo',origin:'FOR',city:'São Paulo',destinations:['SAO']}]);
});

test('profile demand adds route pages for requested cities, most requested first',async()=>{
  const origin = `<a href="voos-de-fortaleza-para-sao-paulo"></a><a href="voos-de-fortaleza-para-lisboa"></a><a href="voos-de-fortaleza-para-recife"></a>${htmlFor([fare])}`;
  const route = htmlFor([{...fare,destinationAirportCode:'GRU',departureDate:'2027-01-10'},{...fare,destinationAirportCode:'CGH',departureDate:'2027-01-12'}]);
  const requested = [];
  const fetchImpl = async url => { requested.push(url); return {ok:true,status:200,headers:new Headers({'content-type':'text/html'}),text:async()=>url.endsWith('voos-de-fortaleza') ? origin : route}; };
  const demand = [{origin:'FOR',destination:'SAO',people:2},{origin:'REC',destination:'LIS',people:1},{origin:'FOR',destination:null,people:1}];
  const result = await collectAirlinePages({sources:[source],now,fetchImpl,demand});
  assert.deepEqual(requested,[source.url,'https://passagens.voeazul.com.br/pt/voos-de-fortaleza-para-sao-paulo']);
  assert.deepEqual(result.sources.map(x=>[x.name,x.status,x.count,Boolean(x.priority)]),[['Azul','ok',1,false],['Azul · Fortaleza → São Paulo','ok',2,true]]);
  const without = await collectAirlinePages({sources:[source],now,fetchImpl:async()=>({ok:true,status:200,headers:new Headers({'content-type':'text/html'}),text:async()=>origin})});
  assert.equal(without.sources.length,1,'sem perfis, nenhuma página extra');
});
