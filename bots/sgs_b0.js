async function(){ if(window.SGSWT&&window.SGSWT.w) return 'SGSWT already'; const src='const t={}; onmessage=(e)=>{ const d=e.data; if(d.cmd==="set"){ t[d.id]=setTimeout(()=>{ delete t[d.id]; postMessage({id:d.id}); },d.ms); } else if(d.cmd==="clear"){ clearTimeout(t[d.id]); delete t[d.id]; } };';
  const w=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'}))); const cbs={}; let n=0; const alive={};
  w.onmessage=(e)=>{ const f=cbs[e.data.id]; if(f){ delete cbs[e.data.id]; f(); } };
  const set=(fn,ms)=>{ const i=++n; cbs[i]=fn; w.postMessage({cmd:'set',id:i,ms:ms}); return i; };
  window.SGSWT={ w, sleep:(ms)=>new Promise((r)=>set(r,ms)),
    setInterval:(fn,ms)=>{ const k='w'+(++n); alive[k]=true; const loop=()=>{ if(!alive[k]) return; set(()=>{ if(!alive[k]) return; try{ const r=fn(); if(r&&r.catch) r.catch(()=>{}); }catch(e){} loop(); },ms); }; loop(); return k; },
    clearInterval:(k)=>{ if(typeof k==='string'&&k[0]==='w') delete alive[k]; else clearInterval(k); } };
  return 'SGSWT (worker timers) ready'; }