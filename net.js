
import { getProxy, getKey, getFH } from './storage.js';
import { CONFIG } from './config.js';

const buckets = {
  alpha: { tokens: CONFIG.alphaRate.max, ts: Date.now() },
  finnhub: { tokens: CONFIG.finnhubRate.max, ts: Date.now() }
};

function bucket(domain){
  if(domain.includes('alphavantage')) return 'alpha';
  if(domain.includes('finnhub')) return 'finnhub';
  return 'alpha';
}

function refill(name){
  const b = buckets[name], now = Date.now(), rate = name==='alpha'? CONFIG.alphaRate : CONFIG.finnhubRate;
  const elapsed = now - b.ts;
  const gain = (elapsed / rate.perMs) * rate.max;
  b.tokens = Math.min(rate.max, b.tokens + gain);
  b.ts = now;
}

async function rateWait(url){
  const name = bucket(url);
  for(let tries=0; tries<60; tries++){
    refill(name);
    const b = buckets[name];
    if(b.tokens >= 1){ b.tokens -= 1; return; }
    await new Promise(r=>setTimeout(r, 500));
  }
}

async function backedFetch(url, init){
  const proxy = getProxy();
  if(proxy){
    const u = new URL(proxy);
    u.searchParams.set('url', url);
    return fetch(u.toString(), init);
  }
  return fetch(url, init);
}

export async function getJSON(url, init={}, retry=2){
  await rateWait(url);
  try{
    const res = await backedFetch(url, init);
    if(!res.ok) throw new Error('HTTP '+res.status);
    return await res.json();
  }catch(e){
    if(retry>0){
      await new Promise(r=>setTimeout(r, 800));
      return getJSON(url, init, retry-1);
    }
    throw e;
  }
}

// Simple TTL cache in localStorage
const CACHE_KEY='ta_cache_v1';
function getCache(){try{return JSON.parse(localStorage.getItem(CACHE_KEY))||{}}catch{return{}}}
function setCache(obj){localStorage.setItem(CACHE_KEY, JSON.stringify(obj))}
export function clearCache(){localStorage.removeItem(CACHE_KEY)}
export async function getJSONCached(url, ttlMs=60_000, init={}, retry=1){
  await rateWait(url);
  const cache = getCache();
  const hit = cache[url];
  const now = Date.now();
  if(hit && (now - hit.t) < ttlMs){ return hit.d; }
  try{
    const res = await backedFetch(url, init);
    if(!res.ok) throw new Error('HTTP '+res.status);
    const d = await res.json();
    cache[url] = { t: now, d };
    setCache(cache);
    return d;
  }catch(e){
    if(retry>0){ await new Promise(r=>setTimeout(r,800)); return getJSONCached(url, ttlMs, init, retry-1); }
    throw e;
  }
}
