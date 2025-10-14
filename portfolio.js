import { loadTrades, saveTrades } from './storage.js';
let trades=loadTrades(); export function listTrades(){return trades}
export function upsertTrade(t){const i=trades.findIndex(x=>x.sym===t.sym&&x.entry==t.entry&&x.size==t.size);if(i>=0)trades[i]=t;else trades.push(t);saveTrades(trades)}
export function removeTrade(i){trades.splice(i,1);saveTrades(trades)}
