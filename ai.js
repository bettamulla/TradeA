
import { getOAI, getOAIM } from './storage.js';
export async function summarize(context){
  const key=getOAI(); if(!key) throw new Error('No OpenAI key set');
  const body={model:getOAIM(), temperature:0.2, messages:[{role:'system',content:'Concise trading summary. Bullets only.'},{role:'user',content:context}], max_tokens:300};
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify(body)});
  if(!r.ok) throw new Error('OpenAI error '+r.status);
  const j=await r.json(); return j.choices?.[0]?.message?.content||'';
}
export async function summarizeMarket(ctx){ return summarize(ctx); }
