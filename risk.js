export function posSize(account,riskPct,entry,stop){if(stop>=entry)return{error:'Stop must be below entry for a long.'};const rps=entry-stop;const cash=account*riskPct;const size=Math.max(0,Math.floor(cash/rps));return{size,cashRisk:cash}};
export function plAndR(entry,stop,target,size){const risk=entry-stop;const plStop=(stop-entry)*size;const plTarget=(target-entry)*size;const rMultipleStop=risk?plStop/risk/size:0;const rMultipleTarget=risk?plTarget/risk/size:0;return{plStop,plTarget,rMultipleStop,rMultipleTarget}};

export function pipSize(pair){
  // returns pip size and pip value per unit for USD quoted majors approximation
  const p = pair.toUpperCase();
  if(p.endsWith('JPY')) return {pip:0.01};
  return {pip:0.0001};
}
export function fxPositionSize(account,riskPct,entry,stop,pair){
  const {pip} = pipSize(pair);
  const riskCash = account*riskPct;
  const riskPerUnit = Math.max(1e-9, Math.abs(entry - stop)); // price units
  const size = Math.floor(riskCash / riskPerUnit);
  return {size, riskCash};
}


export function volTargetSize(account, price, atr, volTargetPct=0.2){
  // target annualized vol as fraction of account; simple daily proxy
  const dailyVol = atr/price; // ATR% proxy
  const alloc = account * volTargetPct; // capital allocated
  const unitRisk = price * dailyVol;
  const size = Math.max(0, Math.floor(alloc / Math.max(1e-9, unitRisk)));
  return { size, dailyVol };
}
export function kellyCap(fWin, payoff){ // returns fraction of account
  const b = payoff; const p=fWin; const q=1-p;
  const k = Math.max(0, Math.min(1, (b*p - q)/b ));
  return k;
}
