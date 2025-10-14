import { getKey, setKey, getFH, setFH, saveList, loadList } from './modules/storage.js';
import { posSize, plAndR } from './modules/risk.js';
import { avDaily, avQuote } from './modules/alphaVantage.js';
import { loadNewsItems } from './modules/news.js';
import { recommend } from './modules/reco.js';
import { listTrades, upsertTrade, removeTrade } from './modules/portfolio.js';
import { fmt } from './modules/config.js';

const toastEl=document.getElementById('toast'); function toast(s){toastEl.textContent=s;toastEl.classList.add('show');setTimeout(()=>toastEl.classList.remove('show'),1200)}

// Theme + SFX
(async ()=>{
  const { getStyle, setStyle, getSfx, setSfx } = await import('./modules/storage.js');
  const style = getStyle(); document.body.classList.toggle('retro', style==='retro');
  const sel = document.getElementById('styleSelect'); if(sel){ sel.value=style; sel.onchange=()=>{ setStyle(sel.value); document.body.classList.toggle('retro', sel.value==='retro'); const crt=document.getElementById('crtOverlay'); if(crt) crt.style.display = (sel.value==='retro')?'block':'none'; }; }
  const sfxSel=document.getElementById('sfxSelect'); if(sfxSel){ sfxSel.value=getSfx(); sfxSel.onchange=()=> setSfx(sfxSel.value); }
})();

let _audCtx=null;
function beep(freq=880, dur=0.08){
  try{
    const { getSfx } = window._storageApi || {};
    if(getSfx && getSfx()!=='on') return;
  }catch{}
  try{
    _audCtx = _audCtx || new (window.AudioContext||window.webkitAudioContext)();
    const o=_audCtx.createOscillator(); const g=_audCtx.createGain();
    o.type='square'; o.frequency.value=freq; o.connect(g); g.connect(_audCtx.destination);
    g.gain.setValueAtTime(0.08, _audCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, _audCtx.currentTime+dur);
    o.start(); o.stop(_audCtx.currentTime+dur);
  }catch{}
}
// Expose storage helpers to beep
import('./modules/storage.js').then(m=> window._storageApi = { getSfx: m.getSfx });


function refreshEnabled(){
  if(document.hidden) return false;
  const c = navigator.connection || {};
  if(c.saveData) return false;
  return true;
}


function setDot(sym, side){
  const el = document.getElementById('d-' + sym);
  if(!el) return;
  el.classList.remove('green','red','gray');
  el.classList.add('dot', side==='bullish' ? 'green' : side==='bearish' ? 'red' : 'gray');
}


// Embedded keys on first run
try{ const { getEmbed } = await import('./modules/storage.js'); if(getEmbed()==='on'){ if(!getKey()) setKey("87DZO2INTJNOQR8B"); if(!getFH()) setFH("d3mopp1r01qmso34qncgd3mopp1r01qmso34qnd0"); } }catch{}

// Tabs
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));t.classList.add('active');document.getElementById(t.dataset.tab).classList.add('active')});

// Watchlist
let watch=loadList(); const listEl=document.getElementById('watchlist');
function renderList(){ listEl.innerHTML=''; if(watch.length===0){const li=document.createElement('li');li.textContent='Add a symbol to get started.';listEl.appendChild(li)} for(const s of watch){const li=document.createElement('li');li.innerHTML=`<span class="dot" id="d-${s}"></span><strong>${s}</strong><span class="quote badge" id="q-${s}">…</span><div style="display:flex;gap:6px"><button class="viewBtn" data-sym="${s}">View</button><button class="delBtn" data-sym="${s}">Del</button></div>`;listEl.appendChild(li)} listEl.querySelectorAll('.viewBtn').forEach(b=>b.onclick=()=>viewSymbol(b.dataset.sym)); listEl.querySelectorAll('.delBtn').forEach(b=>b.onclick=()=>{watch=watch.filter(x=>x!==b.dataset.sym);saveList(watch);renderList()}) }
document.getElementById('addSymbolForm').onsubmit=e=>{beep(920,0.05);e.preventDefault();const s=document.getElementById('symbolInput').value.trim().toUpperCase();if(!s)return;if(!watch.includes(s))watch.push(s);saveList(watch);renderList();updateQuotes();document.getElementById('symbolInput').value=''}

async function updateQuotes(){const key=getKey();if(!key)return;for(const s of watch){try{const q=await avQuote(s,key);const el=document.getElementById('q-'+s);if(el&&q&&q.price){el.textContent=`${q.price.toFixed(2)} (${q.change.toFixed(2)})`;el.style.color=q.change>=0?'var(--ok)':'var(--bad)'}}catch{}}}
setInterval(()=>{try{updateQuotes()}catch{}}, 5*60*1000);

// Chart
let chart, series, rsiSeries, smaLine; const chartDiv=document.getElementById('chart');
function ensureChart(){if(chart)return;chart=LightweightCharts.createChart(chartDiv,{layout:{textColor:getComputedStyle(document.body).color,background:{type:'solid',color:'rgba(0,0,0,0)'}},grid:{horzLines:{color:'#1f2937'},vertLines:{color:'#1f2937'}},rightPriceScale:{borderColor:'#1f2937'},timeScale:{borderColor:'#1f2937'}});series=chart.addAreaSeries({lineWidth:2})}
const indicatorSelect=document.getElementById('indicatorSelect'), rangeSelect=document.getElementById('rangeSelect');
indicatorSelect.onchange=()=> lastSymbol && viewSymbol(lastSymbol); rangeSelect.onchange=()=> lastSymbol && viewSymbol(lastSymbol);
let lastSymbol=null;
async function viewSymbol(sym){ lastSymbol=sym; document.getElementById('chartTitle').textContent=sym+' — Daily'; ensureChart(); series.setData([]); if(rsiSeries){chart.removeSeries(rsiSeries);rsiSeries=null}; if(smaLine){chart.removeSeries(smaLine);smaLine=null}; const key=getKey(); if(!key) return toast('Add key'); const days=parseInt(rangeSelect.value,10); const data=await avDaily(sym,key,days); if(!data||data.length===0) return; series.setData(data.map(d=>({time:d.t,value:d.c})); const closes=data.map(d=>d.c); const latest=closes.at(-1), max=Math.max(...closes), min=Math.min(...closes); const chg=latest-closes[0]; const pct=100*chg/closes[0]; document.getElementById('stats').innerHTML=`<div class="stat">Close: <strong class='neon'>${latest.toFixed(2)}</strong></div><div class="stat">Change: <strong class='neon'>${chg.toFixed(2)} (${pct.toFixed(2)}%)</strong></div><div class="stat">High: <strong>${max.toFixed(2)}</strong></div><div class="stat">Low: <strong>${min.toFixed(2)}</strong></div>`; const choice=indicatorSelect.value; if(choice.startsWith('sma_')){ const len=parseInt(choice.split('_')[1],10); const s=(await import('./modules/indicators.js')).sma(closes,len); smaLine=chart.addLineSeries({lineWidth:2}); smaLine.setData(s.map((v,i)=> v==null? null : { time:data[i].t, value:v }).filter(Boolean)); } else if(choice==='rsi_14'){ const r=(await import('./modules/indicators.js')).rsi(closes,14); rsiSeries = chart.addLineSeries({ priceScaleId:'left', lineWidth:2 }); chart.priceScale('left').applyOptions({ scaleMargins:{ top:0.8, bottom:0 } }); rsiSeries.setData(r.map((v,i)=> v==null? null : { time:data[i].t, value:v }).filter(Boolean)); } }

// News
document.getElementById('loadNews').onclick = async ()=>{ const sym=document.getElementById('newsSym').value.trim().toUpperCase(); const list=document.getElementById('newsList'); list.innerHTML='Loading...'; const items = await loadNewsItems(sym||null); list.innerHTML=''; if(items.length===0){ list.textContent='No news.'; return; } for(const it of items.slice(0,30)){ const div=document.createElement('div'); div.className='item'; div.innerHTML = `<strong>${it.title}</strong><br><span class="badge">${it.source}</span> • <span>${new Date(it.time).toLocaleString()}</span><p>${it.summary||''}</p><a href="${it.url}" target="_blank" rel="noopener">Open source</a>`; list.appendChild(div); } };
setInterval(async ()=>{ try{ const symEl=document.getElementById('newsSym'); const sym=symEl? symEl.value.trim().toUpperCase() : ''; const list=document.getElementById('newsList'); if(list){ const items = await loadNewsItems(sym||null); list.innerHTML=''; for(const it of items.slice(0,30)){ const div=document.createElement('div'); div.className='item'; div.innerHTML = `<strong>${it.title}</strong><br><span class="badge">${it.source}</span> • <span>${new Date(it.time).toLocaleString()}</span><p>${it.summary||''}</p><a href="${it.url}" target="_blank" rel="noopener">Open source</a>`; list.appendChild(div); } } }catch{} }, 5*60*1000);

// Risk
document.getElementById('riskForm').onsubmit=e=>{e.preventDefault();const acct=parseFloat(document.getElementById('acct').value);const rpct=parseFloat(document.getElementById('riskPct').value)/100;const entry=parseFloat(document.getElementById('entry').value);const stop=parseFloat(document.getElementById('stop').value);const out=posSize(acct,rpct,entry,stop);document.getElementById('riskOut').innerHTML=out.error?out.error:`Size: <strong>${out.size}</strong> | Cash at risk: <strong>£${out.cashRisk.toFixed(2)}</strong>`};
document.getElementById('plForm').onsubmit=e=>{e.preventDefault();const entry=parseFloat(document.getElementById('plEntry').value);const stop=parseFloat(document.getElementById('plStop').value);const target=parseFloat(document.getElementById('plTarget').value);const size=parseFloat(document.getElementById('plSize').value);const r=plAndR(entry,stop,target,size);document.getElementById('plOut').innerHTML=`Stop P/L: <strong>£${r.plStop.toFixed(2)}</strong> (${r.rMultipleStop.toFixed(2)}R) — Target P/L: <strong>£${r.plTarget.toFixed(2)}</strong> (${r.rMultipleTarget.toFixed(2)}R)`};

// Tracker
function renderTrades(){ const list=document.getElementById('tradeList'); const rows=listTrades(); list.innerHTML=''; rows.forEach((t,i)=>{ const div=document.createElement('div'); div.className='item'; const dir=(t.side||'long').toLowerCase().startsWith('s')?-1:1; const pnl=t.exit? (t.exit - t.entry)*t.size*dir : 0; div.innerHTML = `<strong>${t.sym}</strong> ${t.side} | entry ${t.entry} | size ${t.size} | stop ${t.stop||'-'} | exit ${t.exit||'-'} <span class="badge">PnL £${pnl.toFixed(2)}</span><div style='margin-top:6px'><button data-i='${i}' class='rm'>Remove</button></div>`; list.appendChild(div); }); list.querySelectorAll('.rm').forEach(b=> b.onclick=()=>{ removeTrade(parseInt(b.dataset.i,10)); renderTrades(); }) }
document.getElementById('tradeForm').onsubmit=e=>{ e.preventDefault(); const t = { sym:document.getElementById('t_sym').value.trim().toUpperCase(), side:document.getElementById('t_side').value.trim(), entry:parseFloat(document.getElementById('t_entry').value), size:parseFloat(document.getElementById('t_size').value), stop:parseFloat(document.getElementById('t_stop').value), exit:document.getElementById('t_exit').value?parseFloat(document.getElementById('t_exit').value):null }; upsertTrade(t); renderTrades(); e.target.reset(); beep(880,0.06); toast('Saved'); };

renderTrades(); renderList(); updateQuotes();


// Calendar
document.getElementById('loadCal').onclick = async ()=>{
  const from = document.getElementById('calFrom').value || new Date(Date.now()-3*864e5).toISOString().slice(0,10);
  const to = document.getElementById('calTo').value || new Date(Date.now()+10*864e5).toISOString().slice(0,10);
  const C = await import('./modules/calendar.js');
  const macro = await C.loadMacro(from,to);
  const earn = await C.loadEarnings(from,to);
  const mEl = document.getElementById('macroList'); const eEl = document.getElementById('earnList');
  mEl.innerHTML=''; eEl.innerHTML='';
  macro.forEach(x=>{ const d=document.createElement('div'); d.className='item'; d.innerHTML = `<strong>${x.event}</strong> — ${x.country} — ${x.date}<br><small>Prev ${x.previous||'-'} | Forecast ${x.forecast||'-'} | Actual ${x.actual||'-'} | Impact ${x.impact||'-'}</small>`; mEl.appendChild(d); });
  earn.forEach(x=>{ const d=document.createElement('div'); d.className='item'; const surprise = (x.actual!=null && x.estimate!=null) ? (x.actual-x.estimate) : null; const badge = surprise!=null ? ` — surprise ${(surprise>=0?'+':'')}${surprise.toFixed(2)}` : ''; d.innerHTML = `<strong>${x.symbol}</strong> — ${x.date} ${x.hour||''}${badge}<br><small>EPS est ${x.estimate||'-'} | actual ${x.actual||'-'}</small>`; eEl.appendChild(d); });
};


document.getElementById('exportSignalsBtn').onclick = ()=>{
  const rows = getSignals();
  const head = 'time,symbol,side,confidence\n';
  const csv = head + rows.map(r=>[r.t,r.s,r.side,r.conf].join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='signals.csv'; a.click();
};


// Pull-to-refresh for touch
(function(){
  const el = document.getElementById('ptr');
  let y0=null, dragging=false;
  window.addEventListener('touchstart',e=>{ if(window.scrollY===0){ y0=e.touches[0].clientY; dragging=true; } });
  window.addEventListener('touchmove',e=>{ if(!dragging)return; const dy=e.touches[0].clientY - y0; if(dy>10){ el.classList.add('active'); } });
  window.addEventListener('touchend',async()=>{ if(!dragging)return; dragging=false; if(el.classList.contains('active')){ el.textContent='Refreshing…'; try{ await updateQuotes(); document.getElementById('runReco').click(); document.getElementById('loadNews').click(); }catch{} setTimeout(()=>{ el.classList.remove('active'); el.textContent='↓ pull to refresh'; }, 400); } });
})();

function renderAlloc(plan){
  const el = document.getElementById('allocPlan'); if(!el) return;
  el.innerHTML = '';
  if(!plan || plan.length===0){ el.textContent = 'Not enough data for allocation.'; return; }
  for(const p of plan){
    const d = document.createElement('div'); d.className='cardlet';
    d.innerHTML = `<strong>${p.sym}</strong> — weight ${(p.weight*100).toFixed(1)}% — capital £${p.capital.toFixed(2)}`;
    el.appendChild(d);
  }
}


function pushNotify(title, body){
  try{
    if(!('Notification' in window)) return;
    if(Notification.permission !== 'granted') return;
    new Notification(title, { body });
  }catch{}
}
// Track last side per symbol
const lastSide = JSON.parse(localStorage.getItem('ta_lastside')||'{}');
function updateSide(sym, side){
  const prev = lastSide[sym];
  if(prev && prev!==side){
    pushNotify(`Signal flip: ${sym}`, `Now ${side}`); beep(side==='bullish'?1020:540,0.09);
  }
  lastSide[sym] = side;
  localStorage.setItem('ta_lastside', JSON.stringify(lastSide));
}


// Budget Builder
document.getElementById('runBudget').onclick = async ()=>{
  const budget = parseFloat(document.getElementById('bbBudget').value||'0');
  const riskPct = parseFloat(document.getElementById('bbRisk').value||'1');
  const uni = document.getElementById('bbUniverse').value;
  const bb = await import('./modules/budget.js');
  const list = document.getElementById('bbList'); list.innerHTML = 'Scanning…';
  const rows = await bb.screenBudget(uni, budget, riskPct);
  list.innerHTML = '';
  if(rows.length===0){ list.textContent = 'No qualifying setups for the current budget.'; return; }
  for(const r of rows){
    const div = document.createElement('div'); div.className='cardlet';
    div.innerHTML = `<strong>${r.sym}</strong> <span class='badge'>${r.market}</span><br>
      Side: ${r.side} — entry ${r.price.toFixed(4)} — stop ${r.stop.toFixed(4)} — target ${r.target.toFixed(4)}<br>
      Size: ${r.size} — R/R score ${(r.score).toFixed(2)} — mom(3m) ${(r.momQ*100).toFixed(1)}%`;
    list.appendChild(div);
  }
};


// Budget Builder — Simulate growth and export
document.getElementById('bbSim').onclick = async ()=>{
  const budget = parseFloat(document.getElementById('bbBudget').value||'0');
  const riskPct = parseFloat(document.getElementById('bbRisk').value||'1');
  const uni = document.getElementById('bbUniverse').value;
  const steps = Math.max(1, parseInt(document.getElementById('bbSteps').value||'6',10));
  const sim = await import('./modules/sim.js');
  const out = document.getElementById('bbSimOut'); out.innerHTML='Running...';
  const res = await sim.simulateGrowth(uni, budget, riskPct, steps);
  out.innerHTML = '';
  res.history.forEach(r=>{
    const div = document.createElement('div'); div.className='item';
    div.innerHTML = `<strong>Step ${r.step}</strong> — ${r.symbol} (${r.market}) ${r.side}<br><small>start £${r.start} | risk £${r.risk} | expR ${r.expR}R | end £${r.end}</small>`;
    out.appendChild(div);
  });
  const tail = document.createElement('div'); tail.className='item';
  tail.innerHTML = `<strong>Final budget</strong>: £${res.final}`;
  out.appendChild(tail);
};

document.getElementById('bbExport').onclick = ()=>{
  const rows = Array.from(document.querySelectorAll('#bbList .cardlet')).map(el=>el.textContent.replace(/\s+/g,' ').trim());
  const head = 'row\n';
  const csv = head + rows.map(r=>JSON.stringify(r)).join('\n');
  const blob = new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='budget_candidates.csv'; a.click();
};


document.addEventListener('click', (e)=>{
  const b = e.target.closest('.overlayBtn');
  if(!b) return;
  const sym = b.dataset.sym;
  const entry = parseFloat(b.dataset.entry);
  const stop = parseFloat(b.dataset.stop);
  viewSymbol(sym).then(()=>{
    try{
      if(window._entryLine){ chart.removeSeries(window._entryLine); window._entryLine=null; }
      if(window._stopLine){ chart.removeSeries(window._stopLine); window._stopLine=null; }
      window._entryLine = chart.addLineSeries({lineWidth:1});
      window._entryLine.setData([{time:Math.floor(Date.now()/1000), value: entry}]);
      window._stopLine = chart.addLineSeries({lineWidth:1});
      window._stopLine.setData([{time:Math.floor(Date.now()/1000), value: stop}]);
      toast('Overlay added');
    }catch{}
  });
});


// Performance recompute
document.getElementById('perfRefresh').onclick = async ()=>{
  const S = await import('./modules/storage.js');
  const trades = S.loadTrades();
  const sigs = S.getSignals();
  // Equity: start at 10k synthetic
  let eq = 10000;
  const curve = [{time: new Date(Date.now()-30*864e5).toISOString().slice(0,10), value: eq}];
  let wins=0, losses=0, gross=0, net=0, maxDD=0, peak=eq, n=0;
  for(const t of trades){
    if(t.exit!=null && !isNaN(+t.exit)){
      const dir=(t.side||'long').toLowerCase().startsWith('s')?-1:1;
      const pnl=(t.exit - t.entry)*t.size*dir;
      eq += pnl; gross += Math.max(0,pnl); net += pnl;
      if(pnl>=0) wins++; else losses++;
      peak = Math.max(peak, eq);
      maxDD = Math.max(maxDD, peak - eq);
      n++;
      curve.push({time: new Date().toISOString().slice(0,10), value:eq});
    }
  }
  // Stats
  const wr = n? wins/n : 0;
  const avg = n? net/n : 0;
  const statDiv = document.getElementById('perfStats');
  statDiv.innerHTML = `<div class='stat'>Trades <strong>${n}</strong></div>
  <div class='stat'>Win rate <strong>${(wr*100).toFixed(1)}%</strong></div>
  <div class='stat'>Avg PnL <strong>£${avg.toFixed(2)}</strong></div>
  <div class='stat'>Net <strong>£${net.toFixed(2)}</strong></div>
  <div class='stat'>Max DD <strong>£${maxDD.toFixed(2)}</strong></div>`;
  // Equity chart
  try{
    const target = document.getElementById('eqChart');
    target.innerHTML='';
    const lc = LightweightCharts.createChart(target,{layout:{textColor:getComputedStyle(document.body).color,background:{type:'solid',color:'rgba(0,0,0,0)'}},
      grid:{horzLines:{color:'#1f2937'},vertLines:{color:'#1f2937'}},rightPriceScale:{borderColor:'#1f2937'},timeScale:{borderColor:'#1f2937'}});
    const s = lc.addAreaSeries({lineWidth:2});
    s.setData(curve.map(p=>({time:p.time, value:p.value})));
  }catch{}
  // Recent signals list
  const list = document.getElementById('perfList'); list.innerHTML='';
  sigs.slice(-20).reverse().forEach(x=>{
    const d=document.createElement('div'); d.className='item';
    d.innerHTML = `<strong>${x.s}</strong> — ${x.side} — conf ${x.conf}% — ${new Date(x.t).toLocaleString()}`;
    list.appendChild(d);
  });
};


// Heatmap
document.getElementById('hmRefresh').onclick = async ()=>{
  const key = getKey(); if(!key) return toast('Add API key');
  const list = Array.isArray(watch)? watch.slice(0,30) : [];
  const extra = ['BTC','ETH'].map(s=> s+'USD').concat(['EURUSD','GBPUSD','USDJPY']);
  const syms = [...new Set([...list,...extra])];
  const grid = document.getElementById('heatGrid'); grid.innerHTML='';
  for(const s of syms){
    try{
      let pct = 0, price=0;
      if(s.length===6 && !s.endsWith('USDUSD')){ // FX
        const u = new URL('https://www.alphavantage.co/query'); u.searchParams.set('function','FX_DAILY'); u.searchParams.set('from_symbol', s.slice(0,3)); u.searchParams.set('to_symbol', s.slice(3,6)); u.searchParams.set('outputsize','compact'); u.searchParams.set('apikey',key);
        const { getJSONCached } = await import('./modules/net.js'); const j = await getJSONCached(u.toString(), 30_000);
        const ts = j['Time Series FX (Daily)']||{}; const arr = Object.entries(ts).map(([t,o])=>({t,c:+o['4. close']})).sort((a,b)=>a.t.localeCompare(b.t)); if(arr.length>1){ price=arr.at(-1).c; pct = price/arr.at(-2).c - 1; }
      }else if(s.endsWith('USD')){ // crypto
        const coin = s.replace('USD','');
        const u = new URL('https://www.alphavantage.co/query'); u.searchParams.set('function','DIGITAL_CURRENCY_DAILY'); u.searchParams.set('symbol', coin); u.searchParams.set('market','USD'); u.searchParams.set('apikey',key);
        const { getJSONCached } = await import('./modules/net.js'); const j = await getJSONCached(u.toString(), 30_000);
        const ts = j['Time Series (Digital Currency Daily)']||{}; const arr = Object.entries(ts).map(([t,o])=>({t,c:+o['4a. close (USD)']})).sort((a,b)=>a.t.localeCompare(b.t)); if(arr.length>1){ price=arr.at(-1).c; pct = price/arr.at(-2).c - 1; }
      }else{ // equity
        const u = new URL('https://www.alphavantage.co/query'); u.searchParams.set('function','GLOBAL_QUOTE'); u.searchParams.set('symbol', s); u.searchParams.set('apikey', key);
        const { getJSONCached } = await import('./modules/net.js'); const j = await getJSONCached(u.toString(), 30_000);
        const q = j['Global Quote']||{}; price = +q['05. price']||0; pct = (+q['10. change percent']||'0').toString().replace('%',''); pct = parseFloat(pct)/100||0;
      }
      const tile = document.createElement('div'); tile.className='hm';
      const hue = pct>0? 140 : 0; const alpha = Math.min(0.9, Math.abs(pct)*4+0.2);
      tile.style.background = `linear-gradient(180deg, rgba(${pct>0?'16,185,129':'239,68,68'},${alpha}), rgba(0,0,0,0))`;
      tile.innerHTML = `<div class='sym'>${s}</div><div class='pct'>${(pct*100).toFixed(2)}%</div><div>${price?price.toFixed(2):''}</div>`;
      grid.appendChild(tile);
    }catch{}
  }
};


// Save earnings guard
const guardEl = document.getElementById('earnGuardDays');
if(guardEl){ const gS = localStorage.getItem('ta_gdays')||'3'; guardEl.value = gS; guardEl.addEventListener('change', ()=> localStorage.setItem('ta_gdays', guardEl.value)); }

// Retro theme toggle
(async ()=>{
  const { getStyle, setStyle } = await import('./modules/storage.js');
  const style = getStyle();
  document.body.classList.toggle('retro', style==='retro');
  const sel = document.getElementById('styleSelect');
  if(sel){ sel.value = style; sel.onchange = ()=>{ setStyle(sel.value); document.body.classList.toggle('retro', sel.value==='retro'); }; }
  // Ensure overlay present
  const crt = document.getElementById('crtOverlay'); if(crt){ crt.style.display = (style==='retro')?'block':'none'; }
})();

// PWA: register service worker
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }


// Share/import watchlist via URL
function encodeState(){
  try{
    const state = { w: watch };
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
    return location.origin+location.pathname+'?s='+s;
  }catch{ return location.href; }
}
function importStateFromURL(){
  try{
    const s = new URLSearchParams(location.search).get('s');
    if(!s) return;
    const json = JSON.parse(decodeURIComponent(escape(atob(s))));
    if(Array.isArray(json.w)){ watch = Array.from(new Set([...(watch||[]), ...json.w])).slice(0,100); saveList(watch); renderList(); }
  }catch{}
}
importStateFromURL();

document.getElementById('shareBtn').onclick=()=>{ const url=encodeState(); navigator.clipboard&&navigator.clipboard.writeText(url).then(()=>toast('URL copied')).catch(()=>{ prompt('Copy URL:', url); }); };
document.getElementById('addUSMajors').onclick=()=>{ const a=['SPY','QQQ','DIA','IWM']; a.forEach(s=>{if(!watch.includes(s)) watch.push(s)}); saveList(watch); renderList(); toast('Added US Majors'); };
document.getElementById('addTech').onclick=()=>{ const a=['AAPL','MSFT','NVDA','GOOGL','AMZN','META']; a.forEach(s=>{if(!watch.includes(s)) watch.push(s)}); saveList(watch); renderList(); toast('Added Tech'); };
document.getElementById('addCrypto').onclick=()=>{ const a=['BTCUSD','ETHUSD','SOLUSD','XRPUSD']; a.forEach(s=>{if(!watch.includes(s)) watch.push(s)}); saveList(watch); renderList(); toast('Added Crypto'); };
document.getElementById('addFX').onclick=()=>{ const a=['EURUSD','GBPUSD','USDJPY','USDCHF']; a.forEach(s=>{if(!watch.includes(s)) watch.push(s)}); saveList(watch); renderList(); toast('Added FX'); };


document.getElementById('mcForm').onsubmit = async (e)=>{
  e.preventDefault();
  const wr = parseFloat(document.getElementById('mcWR').value||'50')/100;
  const pay = parseFloat(document.getElementById('mcPayoff').value||'1.5');
  const r = parseFloat(document.getElementById('mcRisk').value||'1')/100;
  const M = await import('./modules/monte.js');
  const ruin = M.riskOfRuinSim(wr, pay, r, 3000, 250);
  document.getElementById('mcOut').innerHTML = `Prob. of 50% drawdown ≈ <strong>${(ruin*100).toFixed(1)}%</strong>`;
};

document.getElementById('saveAI').onclick=async()=>{ const S = await import('./modules/storage.js'); S.setOAI((oaiInput?.value||'').trim()); S.setOAIM((oaiModel?.value||'gpt-4o-mini')); toast('AI settings saved')};

try{
  document.getElementById('aiRefresh').onclick = async ()=>{
    const out=document.getElementById('aiSummary'); out.innerHTML='Analyzing...';
    try{
      const ctx = JSON.stringify({date:new Date().toISOString(), watch: (Array.isArray(watch)?watch.slice(0,10):[]) });
      const AI = await import('./modules/ai.js'); const txt = await AI.summarizeMarket? await AI.summarizeMarket(ctx) : await AI.summarize(ctx);
      out.innerHTML = '<div class="item">'+(txt||'No output')+'</div>';
    }catch(e){ out.innerHTML = '<div class="empty">'+e.message+'</div>'; }
  };
}catch{}


// v5.6 — API Key Status checks
async function checkAlphaVantage(){
  const S = await import('./modules/storage.js'); const key = S.getKey();
  const el = document.getElementById('avStatus'); if(!el) return;
  if(!key){ el.classList.remove('ok'); el.classList.add('bad'); return; }
  try{
    const u = new URL('https://www.alphavantage.co/query');
    u.searchParams.set('function','GLOBAL_QUOTE'); u.searchParams.set('symbol','IBM'); u.searchParams.set('apikey', key);
    const r = await fetch(u.toString());
    const j = await r.json();
    const ok = j && j['Global Quote'];
    el.classList.toggle('ok', !!ok); el.classList.toggle('bad', !ok);
  }catch{ el.classList.remove('ok'); el.classList.add('bad'); }
}
async function checkFinnhub(){
  const S = await import('./modules/storage.js'); const key = S.getFH();
  const el = document.getElementById('fhStatus'); if(!el) return;
  if(!key){ el.classList.remove('ok'); el.classList.add('bad'); return; }
  try{
    const u = new URL('https://finnhub.io/api/v1/quote'); u.searchParams.set('symbol','AAPL'); u.searchParams.set('token', key);
    const r = await fetch(u.toString()); const j = await r.json();
    const ok = j && typeof j.c === 'number';
    el.classList.toggle('ok', !!ok); el.classList.toggle('bad', !ok);
  }catch{ el.classList.remove('ok'); el.classList.add('bad'); }
}
async function checkOpenAI(){
  const S = await import('./modules/storage.js'); const key = S.getOAI();
  const el = document.getElementById('oaiStatus'); if(!el) return;
  if(!key){ el.classList.remove('ok'); el.classList.add('bad'); return; }
  try{
    const r = await fetch('https://api.openai.com/v1/models', { headers:{ 'Authorization':'Bearer '+key }});
    el.classList.toggle('ok', r.ok); el.classList.toggle('bad', !r.ok);
  }catch{ el.classList.remove('ok'); el.classList.add('bad'); }
}
async function runKeyChecks(){ await Promise.all([checkAlphaVantage(), checkFinnhub(), checkOpenAI()]); }
document.querySelectorAll('.tab').forEach(t=> t.addEventListener('click', ()=>{ if(t.dataset.tab==='settings') runKeyChecks(); }));
const _saveCore=document.getElementById('saveKey'); if(_saveCore){ const old=_saveCore.onclick; _saveCore.onclick=(...a)=>{ if(typeof old==='function') old.apply(this,a); setTimeout(runKeyChecks,600); }; }
const _saveAI=document.getElementById('saveAI'); if(_saveAI){ const old2=_saveAI.onclick; _saveAI.onclick=(...a)=>{ if(typeof old2==='function') old2.apply(this,a); setTimeout(runKeyChecks,600); }; }
if(document.querySelector('.panel.active')?.id==='settings'){ runKeyChecks(); }



// v5.7 — Analytics render
async function renderAnalytics(){
  const A = await import('./modules/analytics.js');
  const r = A.computeAnalytics();
  const wrap = document.getElementById('perfSummary'); if(!wrap) return;
  if(r.empty){ wrap.innerHTML = '<div class="empty">Add closed trades in Tracker to see analytics.</div>'; return; }
  wrap.innerHTML = `<div class="kpi">
    <div class="box">Trades <strong>${r.closed}/${r.count}</strong></div>
    <div class="box">Win rate <strong>${(r.winRate*100).toFixed(1)}%</strong></div>
    <div class="box">Profit factor <strong>${(r.profitFactor===Infinity?'∞':r.profitFactor.toFixed(2))}</strong></div>
    <div class="box">Expectancy (R) <strong>${r.expR.toFixed(2)}</strong></div>
    <div class="box">Max drawdown £<strong>${r.maxDD.toFixed(2)}</strong></div>
    <div class="box">Sharpe* <strong>${r.sharpe.toFixed(2)}</strong></div>
    <div class="box">Streak W/L <strong>${r.maxW}/${r.maxL}</strong></div>
    <div class="box">Best £<strong>${r.best.pnl.toFixed(2)}</strong> (${r.best.sym})</div>
    <div class="box">Worst £<strong>${r.worst.pnl.toFixed(2)}</strong> (${r.worst.sym})</div>
  </div><div class="hint">*Sharpe is a rough proxy using per-trade returns.</div>`;

  // Equity mini-grid
  const eq = document.getElementById('equity'); eq.innerHTML='';
  let prev=0; r.curve.forEach(v=>{ const cell=document.createElement('div'); cell.className='cell equityCell'; cell.classList.add(v-prev>=0?'up':'down'); prev=v; eq.appendChild(cell); });
  eq.classList.add('equity');

  // R distribution (simple buckets -3..+3+)
  const buckets=[-3,-2,-1,0,1,2,3]; const counts={};
  for(const b of buckets) counts[b]=0;
  const trades = (await import('./modules/storage.js')).listTrades().filter(t=>typeof t.exit==='number');
  trades.forEach(t=>{
    const dir=t.side==='Long'?1:-1;
    const pnl=(t.exit-t.entry)*dir*(t.size||1);
    const unit=Math.max(1e-9, Math.abs((t.stop??(t.entry*0.01))-t.entry));
    const R=pnl/(unit*(t.size||1));
    const clamped = Math.max(-3, Math.min(3, Math.round(R)));
    counts[clamped] = (counts[clamped]||0)+1;
  });
  const maxCount = Math.max(1, ...Object.values(counts));
  const dist = document.getElementById('rDist'); dist.innerHTML='';
  [-3,-2,-1,0,1,2,3].forEach(k=>{
    const row=document.createElement('div'); row.className='chart-row';
    const lab=document.createElement('div'); lab.className='chart-label'; lab.textContent = (k===-3?'≤ -3':k===3? '≥ 3': (k>=0? '+'+k: k));
    const bar=document.createElement('div'); bar.className='chart-bar';
    const span=document.createElement('span'); span.style.width=(counts[k]/maxCount*100)+'%'; bar.appendChild(span);
    row.appendChild(lab); row.appendChild(bar); dist.appendChild(row);
  });

  // Exposure
  const ex=document.getElementById('exposure'); ex.innerHTML='';
  const total = Object.values(r.bySym).reduce((a,b)=>a+b,0)||1;
  Object.entries(r.bySym).sort((a,b)=>b[1]-a[1]).forEach(([sym,c])=>{
    const row=document.createElement('div'); row.className='chart-row';
    const lab=document.createElement('div'); lab.className='chart-label'; lab.textContent=sym;
    const bar=document.createElement('div'); bar.className='chart-bar'; const span=document.createElement('span'); span.style.width=(c/total*100)+'%'; bar.appendChild(span);
    row.appendChild(lab); row.appendChild(bar); ex.appendChild(row);
  });
}


// Trigger analytics when opening Performance tab
document.querySelectorAll('.tab').forEach(t=> t.addEventListener('click', ()=>{ if(t.dataset.tab==='perf') renderAnalytics(); }));
// If already on Performance at load
if(document.querySelector('.panel.active')?.id==='perf'){ renderAnalytics(); }
