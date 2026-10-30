async function(){ const B=window.SGSBOT;
  /* 劉備 v4: 非抽牌類錦囊一律換仁; 爆發手段只留 調虎離山 / 反擊, 手上有發憤圖強時強化也留; 不滿血立即回血; 滿血且仁>1 才拿錦囊攻擊; 爆發時無視這些條件 */
  const DRAW=/^(無中生有|增兵減灶|未雨綢繆|五穀豐登|發憤圖強)$/; const BURST=/^(反擊|調虎離山)$/;
  const isConv=(c,H,kq)=>{ if(!c||c.kind!=='trick') return false; const n=H.full(c); return !DRAW.test(n)&&!BURST.test(n)&&n!=='樂不思蜀'&&!(kq&&n==='強化'); };
  const ATK=/^(決鬥|南蠻入侵|萬箭齊發|飢餓|突襲|火攻|笑裡藏刀)$/;
  /* 沒用的錦囊: 樂不思蜀以外所有延時錦囊 / 轉移 / 出其不意 / 所有敵人都有對應防具(緩衝盾, 或藤甲火盾等擋掉)的攻擊錦囊 — 一律棄掉換仁, 不受模式限制 */
  const isUseless=(c,s,H)=>{ if(!c||c.kind!=='trick') return false; const n=H.full(c); if(BURST.test(n)||DRAW.test(n)||n==='樂不思蜀') return false; if((H.desc(c)||'').indexOf('⏳')===0) return true; if(n==='轉移'||n==='出其不意') return true; if(ATK.test(n)){ const en=H.enemies(s); if(!en.length) return false; const d=H.burstEstimate(s).per; return en.every(q=>{ const ar=[q.equip&&q.equip.armor,q.equip&&q.equip.armor2].filter(Boolean).map(a=>H.full(a)); if(ar.includes('緩衝盾')&&d<=1) return true; const i=q.idx!=null?q.idx:s.players.indexOf(q); return H.atkAdj(s,'',n,i)<=-100; }); } return false; };
  const renOf=(m)=>{ if(typeof m.marks==='number') return m.marks; const bd=(m.badges||[]).find(b=>b&&b.k==='ren'); if(bd){ const t=/(\d+)/.exec(bd.t||''); if(t) return +t[1]; } const mk=m.marks; if(mk&&typeof mk==='object'){ const v=mk['仁']!=null?mk['仁']:Object.values(mk).find(x=>typeof x==='number'); if(typeof v==='number') return v; } return 0; };
  B.layer('劉備',{
    act(s,p,cands,H){ const m=H.me(s); const hand=m.hand||[]; const ren=renOf(m); const team=m.role==='主公'||m.role==='忠臣'; const kq=H.has(m,'發憤圖強')>0;
      const en=H.enemies(s); const minHp=en.length?Math.min.apply(null,en.map(q=>q.hp)):99; const planHold=kq&&(H.has(m,'反擊')+H.has(m,'調虎離山'))>0;
      const full=m.hp>=(m.maxhp||4); const burst=ren>0&&(!!B.lethal||(full&&(planHold||(en.length>0&&H.potentialDamage(s)>=minHp))));
      const convMode=!burst&&!(full&&ren>1);
      const convCards=hand.filter(c=>isConv(c,H,kq)); const useless=hand.filter(c=>isUseless(c,s,H));
      const base=cands.filter(c=>!(convMode&&c.o&&c.o.card&&isConv(c.o.card,H,kq))&&!(c.o&&c.o.card&&isUseless(c.o.card,s,H))&&!/仁回血|棄錦囊得仁/.test((c.n||'')+(c.o&&c.o.label||'')));
      const get=p.options.filter(o=>/棄錦囊得仁/.test(o.label||'')); const drawOpts=p.options.filter(x=>x.card&&x.card.kind==='trick'&&/^(無中生有|增兵減灶|未雨綢繆|五穀豐登)$/.test(H.full(x.card)));
      const wantGet=get.length>0&&((convMode&&convCards.length>0)||useless.length>0);
      if(wantGet&&drawOpts.length){ H.L('劉備: 棄錦囊得仁之前先打出抽牌牌 → '+drawOpts[0].label); const dn=new Set(drawOpts.map(x=>x.i)); return [{pri:151,o:drawOpts[0],n:drawOpts[0].label}].concat(base.filter(c=>!c.o||!dn.has(c.o.i))); }
      if(burst){ if(wantGet){ H.L('劉備: 爆發中仍有沒用的錦囊, 棄牌換仁'); return [{pri:149,o:get[0],n:get[0].label}].concat(base); } return base; }
      const extra=[]; const missing=(q)=>Math.max(0,(q.maxhp||4)-q.hp);
      const heal=p.options.filter(o=>/仁回血/.test(o.label||'')); const enSet=new Set(en.map(q=>q.idx!=null?q.idx:s.players.indexOf(q)));
      if(ren>=1&&heal.length){ let best=null,bs=0; for(const o of heal){ const i=H.pIdx(o); const q=i!=null?s.players[i]:m; const miss=missing(q); if(miss<=0) continue; const mine=(i===s.viewer||i==null); if(!mine&&enSet.has(i)) continue; const sc=miss*10+(mine?100:0)+(team&&q.role==='主公'?(m.role==='忠臣'?40:4):0); if(sc>bs){bs=sc;best=o;} }
        if(best){ H.L('劉備: 不滿血, 用仁回血 → '+best.label+' (仁 '+ren+')'); extra.push({pri:150,o:best,n:best.label}); } }
      if(wantGet){ if(useless.length) H.L('劉備: 沒用的錦囊 ('+useless.map(c=>H.full(c)).join(',')+') 棄牌換仁'); extra.push({pri:149,o:get[0],n:get[0].label}); /* 技能選項本身帶有 card 欄位 (非錦囊), 不能用 isConv 過濾 */ }
      return extra.concat(base); },
    decide(s,p,H){ const pr=p.prompt||''; if(/棄錦囊|仁/.test(pr)&&p.kind!=='skill'&&p.options.some(o=>o.card)){ const m=H.me(s); const kq=H.has(m,'發憤圖強')>0; const co=p.options.filter(o=>o.card); const good=co.find(o=>isUseless(o.card,s,H))||co.find(o=>isConv(o.card,H,kq)); if(good) return [good.i]; } return null; } });
  return 'patch b12 v4 loaded (劉備: 爆發手段只留 調虎離山/反擊, 有發憤圖強時留強化)'; }