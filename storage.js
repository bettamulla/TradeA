const LS={watch:'ta_watch',api:'ta_av',finnhub:'ta_fh',trades:'ta_trades',proxy:'ta_proxy',embed:'ta_embed'};
export const saveList=l=>localStorage.setItem(LS.watch,JSON.stringify(l));
export const loadList=()=>{try{return JSON.parse(localStorage.getItem(LS.watch))||[]}catch{return[]}};
export const getKey=()=>localStorage.getItem(LS.api)||''; export const setKey=k=>localStorage.setItem(LS.api,k);
export const getFH=()=>localStorage.getItem(LS.finnhub)||''; export const setFH=k=>localStorage.setItem(LS.finnhub,k);
export const loadTrades=()=>{try{return JSON.parse(localStorage.getItem(LS.trades))||[]}catch{return[]}}; export const saveTrades=t=>localStorage.setItem(LS.trades,JSON.stringify(t));

export const getProxy=()=>localStorage.getItem(LS.proxy)||''; export const setProxy=u=>localStorage.setItem(LS.proxy,u);

const SIG='ta_siglog'; export const logSignal=(s,side,conf)=>{const a=JSON.parse(localStorage.getItem(SIG)||'[]');a.push({t:new Date().toISOString(),s,side,conf});localStorage.setItem(SIG,JSON.stringify(a))}; export const getSignals=()=>{try{return JSON.parse(localStorage.getItem(SIG))||[]}catch{return[]}};

export const getEmbed=()=>localStorage.getItem(LS.embed)||'on'; export const setEmbed=v=>localStorage.setItem(LS.embed,v);

const STYLE='ta_style'; export const getStyle=()=>localStorage.getItem(STYLE)||'retro'; export const setStyle=v=>localStorage.setItem(STYLE,v);

const SFX='ta_sfx'; export const getSfx=()=>localStorage.getItem(SFX)||'on'; export const setSfx=v=>localStorage.setItem(SFX,v);

const ORD='ta_orders', POS='ta_positions';
export const loadOrders=()=>{try{return JSON.parse(localStorage.getItem(ORD))||[]}catch{return[]}};
export const saveOrders=o=>localStorage.setItem(ORD,JSON.stringify(o));
export const loadPositions=()=>{try{return JSON.parse(localStorage.getItem(POS))||[]}catch{return[]}};
export const savePositions=p=>localStorage.setItem(POS,JSON.stringify(p));

const OAI='ta_openai', OAIM='ta_oa_model'; export const getOAI=()=>localStorage.getItem(OAI)||''; export const setOAI=v=>localStorage.setItem(OAI,v); export const getOAIM=()=>localStorage.getItem(OAIM)||'gpt-4o-mini'; export const setOAIM=v=>localStorage.setItem(OAIM,v);
