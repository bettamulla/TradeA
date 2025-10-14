
import { listTrades } from './storage.js';

export function computeAnalytics(){
  const trades = listTrades();
  const closed = trades.filter(t=> typeof t.exit==='number' && !isNaN(t.exit));
  const res = { count: trades.length, closed: closed.length };
  if(closed.length===0){ res.empty=true; return res; }

  // PnL and R calc: if stop not provided, use 1R = |entry*0.01| per unit fallback
  const rows = closed.map(t=>{
    const dir = t.side==='Long'?1:-1;
    const pnl = (t.exit - t.entry) * dir * (t.size||1);
    const unit = Math.max(1e-9, Math.abs((t.stop?? (t.entry*0.01)) - t.entry));
    const R = pnl / (unit * (t.size||1));
    return { ...t, pnl, R };
  });

  const wins = rows.filter(r=> r.pnl>0), losses = rows.filter(r=> r.pnl<0);
  const winRate = wins.length / rows.length;
  const grossWin = wins.reduce((a,b)=>a+b.pnl,0);
  const grossLoss = Math.abs(losses.reduce((a,b)=>a+b.pnl,0));
  const profitFactor = grossLoss>0? grossWin/grossLoss : (wins.length>0? Infinity:0);
  const expR = rows.reduce((a,b)=>a+b.R,0)/rows.length;

  // Equity curve and max drawdown
  let eq=0, peak=0, maxDD=0; const curve=[];
  rows.forEach(r=>{ eq += r.pnl; peak = Math.max(peak, eq); const dd = peak - eq; maxDD = Math.max(maxDD, dd); curve.push(eq); });

  // Sharpe proxy: daily returns as trade returns; stdev of pnl
  const mean = rows.reduce((a,b)=>a+b.pnl,0)/rows.length;
  const sd = Math.sqrt(rows.reduce((a,b)=>a+Math.pow(b.pnl-mean,2),0)/Math.max(1,rows.length-1)) || 0;
  const sharpe = sd>0? (mean/sd)*Math.sqrt(252) : 0;

  // Streaks
  let cw=0, cl=0, maxW=0, maxL=0;
  rows.forEach(r=>{ if(r.pnl>0){ cw++; cl=0; } else if(r.pnl<0){ cl++; cw=0; } maxW=Math.max(maxW,cw); maxL=Math.max(maxL,cl); });

  // Exposure by symbol
  const bySym = {}; rows.forEach(r=>{ bySym[r.sym]=(bySym[r.sym]||0)+1; });

  // Best/worst
  const best = rows.reduce((a,b)=> a.pnl>b.pnl?a:b);
  const worst = rows.reduce((a,b)=> a.pnl<b.pnl?a:b);

  return { count: trades.length, closed: rows.length, winRate, profitFactor, expR, maxDD, sharpe, maxW, maxL, curve, bySym, best, worst, wins:wins.length, losses:losses.length };
}
