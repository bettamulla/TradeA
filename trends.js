import { sma, rsi, macd } from './indicators.js';
export function analyseSeries(data){const c=data.map(d=>d.c);const sma50=sma(c,50),sma200=sma(c,200);const mom252=c.map((x,i)=>i>=252?(x/c[i-252]-1):null);const mom63=c.map((x,i)=>i>=63?(x/c[i-63]-1):null);const mom21=c.map((x,i)=>i>=21?(x/c[i-21]-1):null);const M=macd(c);const i=c.length-1;const regime=analyseRegime(data);return{price:c[i],trendLong:sma200[i]&&sma50[i]?(sma50[i]>sma200[i]?'up':'down'):'n/a',goldenCross:i>0&&sma50[i-1]<=sma200[i-1]&&sma50[i]>sma200[i],deathCross:i>0&&sma50[i-1]>=sma200[i-1]&&sma50[i]<sma200[i],momY:mom252[i],momQ:mom63[i],momM:mom21[i],macdUp:M.macd[i]!=null&&M.signal[i]!=null?M.macd[i]>M.signal[i]:false,regime}}

import { atr } from './indicators.js';
import { atrPctSeries, regimeFromAtrPct } from './vol.js';
export function analyseRegime(data){
  const c=data.map(d=>d.c), h=data.map(d=>d.h), l=data.map(d=>d.l);
  const atrP = atrPctSeries(h,l,c,atr);
  const last = atrP[atrP.length-1];
  return regimeFromAtrPct(last);
}
