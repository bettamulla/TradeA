import { avDaily, avQuote } from './alphaVantage.js'; import { analyseSeries } from './trends.js';
export async function recommend(symbols,key){const investments=[],shortterm=[];for(const s of symbols){try{const data=await avDaily(s,key,2000);if(!data||data.length<260)continue;const st=analyseSeries(data);if(st.trendLong==='up'&&st.momY>0){investments.push(card(s,st,'Hold until trend breaks'))}if(st.macdUp&&st.momM>0&&st.momQ>0){shortterm.push(card(s,st,'Swing with trailing stop'))}}catch{}}investments.sort((a,b)=>b.scores.score-a.scores.score);shortterm.sort((a,b)=>b.scores.short-a.scores.short);return{investments:investments.slice(0,10),shortterm:shortterm.slice(0,10)}}
function card(sym,st,note){const score=(st.momY||0)+0.5*(st.momQ||0);const short=(st.momQ||0)+0.5*(st.momM||0);const ta=[st.goldenCross?'Golden cross':null,st.deathCross?'Death cross':null,st.macdUp?'MACD > signal':null,st.momY!=null?`1y mom ${(st.momY*100).toFixed(1)}%`:null,st.momQ!=null?`3m mom ${(st.momQ*100).toFixed(1)}%`:null,st.momM!=null?`1m mom ${(st.momM*100).toFixed(1)}%`:null].filter(Boolean);return{sym:sym,price:st.price,ta,regime:st.regime||'normal',note,scores:{score,short}}}

export function signalState(st){
  // Bullish if long trend up and near-term momentum is positive and MACD up
  const bull = (st.trendLong==='up') + (st.momQ>0) + (st.momM>0) + (st.macdUp?1:0);
  const bear = (st.trendLong==='down') + (st.momQ<0) + (st.momM<0) + (!st.macdUp?1:0);
  const score = bull - bear; // positive => bullish, negative => bearish
  const side = score>=0 ? 'bullish' : 'bearish';
  return { side, score };
}

export async function hotlist(symbols, key){
  const out = [];
  for(const s of symbols){
    try{
      const data = await avDaily(s, key, 800);
      if(!data || data.length<200) continue;
      const st = analyseSeries(data);
      const sig = signalState(st);
      out.push({ sym:s, price: st.price, side: sig.side, score: sig.score, st });
    }catch{}
  }
  // sort by absolute score, strongest first
  out.sort((a,b)=> Math.abs(b.score) - Math.abs(a.score));
  return out.slice(0,12);
}

export function signalState(st){
  // Features normalized to [-1,1]
  const fY = st.momY==null?0:Math.tanh(st.momY*3);   // heavier weight
  const fQ = st.momQ==null?0:Math.tanh(st.momQ*4);
  const fM = st.momM==null?0:Math.tanh(st.momM*6);
  const fMA = st.trendLong==='up'? 0.8 : st.trendLong==='down'? -0.8 : 0;
  const fMACD = st.macdUp ? 0.5 : -0.5;
  const raw = 0.4*fY + 0.25*fQ + 0.15*fM + 0.15*fMA + 0.05*fMACD;
  const side = raw>0.08 ? 'bullish' : raw<-0.08 ? 'bearish' : 'neutral';
  const conf = Math.min(1, Math.abs(raw)*1.4); // 0..1
  return { side, score: raw, confidence: conf,
    why: {
      mom1y: st.momY, mom3m: st.momQ, mom1m: st.momM,
      maTrend: st.trendLong, macdUp: st.macdUp,
      goldenCross: st.goldenCross, deathCross: st.deathCross
    }
  };
}


function patternSignals(data){
  const c=data.map(d=>d.c), h=data.map(d=>d.h), l=data.map(d=>d.l);
  const n=c.length-1;
  // 20D breakout
  const hi20 = Math.max(...h.slice(Math.max(0,n-20), n));
  const breakout = c[n]>hi20 ? 1 : 0;
  // SMA20 pullback
  const SMA = (arr,n)=>{let out=new Array(arr.length).fill(null), s=0; for(let i=0;i<arr.length;i++){s+=arr[i]; if(i>=n)s-=arr[i-n]; if(i>=n-1) out[i]=s/n} return out;}
  const sma20 = SMA(c,20);
  const pullback = sma20[n]!=null && c[n]>sma20[n] && c[n-1]<sma20[n-1] ? 1 : 0;
  // RSI bounce
  function rsi(c,p=14){const o=new Array(c.length).fill(null);let g=0,l=0;for(let i=1;i<=p;i++){const d=c[i]-c[i-1];if(d>=0)g+=d;else l-=d}let ag=g/p, al=l/p;for(let i=p+1;i<c.length;i++){const d=c[i]-c[i-1],G=Math.max(d,0),L=Math.max(-d,0);ag=(ag*(p-1)+G)/p;al=(al*(p-1)+L)/p;const rs=al===0?100:ag/al;o[i]=100-(100/(1+rs))}return o;}
  const r = rsi(c,14); const bounce = r[n-1]<35 && r[n]>r[n-1] ? 1 : 0;
  return { breakout, pullback, bounce };
}

export async function confluenceScore(sym,key){
  try{
    const data = await avDaily(sym,key,400);
    if(!data||data.length<60) return {score:0, parts:{}};
    const st = analyseSeries(data);
    const pats = patternSignals(data);
    // News factor: crude proxy from latest change in AV quote
    const q = await avQuote(sym,key);
    const newsF = q && q.change ? Math.tanh(q.change/Math.max(1, q.price)*6) : 0;
    // Weighted sum
    const raw = (st.momQ||0)*0.4 + (st.momM||0)*0.2 + (st.trendLong==='up'?0.2:-0.1) + (st.macdUp?0.1:-0.05) + (pats.breakout*0.15 + pats.pullback*0.1 + pats.bounce*0.1) + newsF*0.1;
    return { score: raw, side: raw>0.05?'bullish': raw<-0.05?'bearish':'neutral', parts:{st,pats,newsF} };
  }catch{ return {score:0, parts:{}} }
}
