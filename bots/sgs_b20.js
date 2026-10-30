async function(){ const B=window.SGSBOT;
  /* 曹沖-交換武將: 被詢問是否和使用錦囊者交換武將時, 一律選「是」(曹沖技能很沒用) */
  (B.roster||[]).forEach((c)=>{ const st=B.strat[c]||{}; const inner=st.decide; st.decide=(s,p,H)=>{ const pr=p.prompt||''; if(/曹沖-交換武將/.test(pr)){ const ys=p.options.find(o=>!/不|否|取消|跳過|拒絕/.test(o.label||''))||p.options[0]; if(ys){ H.L('曹沖: 有人用錦囊, 交換武將 → 是 ('+ys.label+')'); return [ys.i]; } } return inner?inner(s,p,H):null; }; B.strat[c]=st; });
  return 'patch b20 loaded (曹沖交換武將一律是)'; }