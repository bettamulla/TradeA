import { getKey, getFH } from './storage.js';

const CRED = new Map([
  ['Reuters', 1.0], ['Bloomberg', 1.0], ['Financial Times', 0.95],
  ['Wall Street Journal', 0.95], ['CNBC', 0.9], ['The New York Times', 0.9],
  ['AP News', 0.95]
]);

function scoreNews(it){
  const src = it.source || '';
  const w = CRED.get(src) || 0.8;
  const ageMin = Math.max(1, (Date.now() - new Date(it.time).getTime())/60000);
  const recency = Math.max(0, 1 - Math.log10(ageMin)/3); // 0..1
  const length = it.summary ? Math.min(1, it.summary.length/400) : 0.2;
  return 0.6*recency + 0.3*w + 0.1*length;
}

export async function loadNewsItems(symbol){const items=[];const avKey=getKey();if(avKey){try{const u=new URL('https://www.alphavantage.co/query');u.searchParams.set('function','NEWS_SENTIMENT');if(symbol)u.searchParams.set('tickers',symbol);u.searchParams.set('sort','LATEST');u.searchParams.set('apikey',avKey);const { getJSON } = await import('./net.js'); const j = await getJSON(u.toString());const arr=j.feed||[];for(const a of arr.slice(0,25)){items.push({source:a.source,title:a.title,url:a.url,time:a.time_published,summary:a.summary})}}catch{}}
const fh=getFH();if(fh){try{const today=new Date();const prior=new Date(Date.now()-7*864e5);const from=prior.toISOString().slice(0,10),to=today.toISOString().slice(0,10);const base=symbol?`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`:`https://finnhub.io/api/v1/news?category=general`;const u=`${base}&token=${fh}`;const { getJSON } = await import('./net.js'); const j = await getJSON(u.toString());for(const a of (j||[]).slice(0,25)){items.push({source:a.source||'Finnhub',title:a.headline||a.title,url:a.url,time:new Date(a.datetime*1000).toISOString(),summary:a.summary||''})}}catch{}}
const seen=new Set();const out=[];for(const it of items){if(it.url&&!seen.has(it.url)){seen.add(it.url);out.push(it)}}out.sort((a,b)=>String(b.time).localeCompare(String(a.time)));return out.slice(0,40)}
