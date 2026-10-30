async function(){ const B=window.SGSBOT;
  /* 全部武將 (最外層): (1) 發憤圖強爆發法 (發憤圖強 + 轉傷牌/阻擋/吸收/蔣幹) 在所有戰術中一律最優先, 排在最前面; (2) 孤注一擲: 沒牌出時, 血量不為 1 或有轉傷牌/防禦能力/緩衝盾 才打; 連鎖詢問時若攻擊會傷到自己也打出去 */
  const DEF=new Set(['曹真','諸葛亮','典韋','劉協','呂蒙','龐統','蔣幹','楊修','周倉','張昭']);
  (B.roster||[]).forEach((c)=>{ B.layer(c,{ act(s,p,cands,H){ const m=H.me(s); const hand=m.hand||[]; let list=cands;
      // (1) 發憤圖強爆發法最優先
      const plan=H.has(m,'發憤圖強')>0&&(H.redirectCnt(m)>0||m.char==='蔣幹'||m.char==='曹真'||m.char==='沮授'||(m.char==='楊修'&&B.yxRound===s.round));
      if(plan){ const isFj=(x)=>x.o&&x.o.card&&H.full(x.o.card)==='發憤圖強'; let fj=list.filter(isFj); if(!fj.length){ const o=p.options.find(o=>o.card&&H.full(o.card)==='發憤圖強'); if(o) fj=[{pri:97,o,n:'發憤圖強'}]; } if(fj.length) list=fj.concat(list.filter(x=>!isFj(x))); }
      // (2) 孤注一擲 (沒牌出時才打, 排在最後)
      const gz=p.options.find(o=>o.card&&H.full(o.card)==='孤注一擲'&&o.target==null);
      if(gz&&!list.some(x=>x.o&&x.o.card&&H.full(x.o.card)==='孤注一擲')){ const armorOk=[m.equip&&m.equip.armor,m.equip&&m.equip.armor2].some(a=>a&&H.full(a)==='緩衝盾'); const safe=m.hp!==1||H.redirectCnt(m)>0||DEF.has(m.char)||armorOk; const useful=m.hp<(m.maxhp||4)||hand.length<=2; if(safe&&useful){ list=list.concat([{pri:5,o:gz,n:'孤注一擲'}]); } }
      return list===cands?null:list; } }); });
  // 連鎖詢問: 受到傷害時 (沒有反擊/調虎離山/占卜/弱化可用的話) 把孤注一擲打出去 — 排在內層決策之後
  (B.roster||[]).forEach((c)=>{ const st=B.strat[c]||{}; const inner=st.decide; st.decide=(s,p,H)=>{ const r=inner?inner(s,p,H):null; if(r) return r; const pr=p.prompt||''; if(p.kind!=='skill'||!/即將受到/.test(pr)) return null; const mt=/P(\d)\([^)]*\) 即將受到 (\d+) 點傷害/.exec(pr); if(!mt||+mt[1]!==s.viewer) return null; if(s.cur===s.viewer&&B.sbPhase===s.round) return null;
      const names=p.options.filter(o=>o.card).map(o=>H.full(o.card)); if(names.some(n=>/^(反擊|調虎離山|占卜|弱化)$/.test(n))) return null; const gz=p.options.find(o=>o.card&&H.full(o.card)==='孤注一擲'); if(gz){ H.L('孤注一擲: 受到傷害時打出 (傷害 '+mt[2]+')'); return [gz.i]; } return null; }; B.strat[c]=st; });
  return 'patch b19 loaded (發憤圖強爆發法最優先 / 孤注一擲)'; }