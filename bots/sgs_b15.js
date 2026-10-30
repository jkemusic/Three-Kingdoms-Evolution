async function(){ const B=window.SGSBOT;
  // 周魴: 棄牌扣血 只在「能殺死人 (敵人血量 <=3 且手牌夠)」或手牌很多時用, 棄的張數=目標血量 (最多 3); 換血 在對方 (場上血量最多的人) 比我血多、而且是敵人時發動
  B.layer('周魴',{ act(s,p,cands,H){ const m=H.me(s); const hand=(m.hand||[]).length; const en=H.enemies(s); const low=en.filter(q=>q.hp<=3).sort((a,b)=>a.hp-b.hp)[0];
      const isSk=(c)=>/周魴-棄牌扣血/.test((c.n||'')+(c.o&&c.o.label||''));
      const skOpts=p.options.filter(o=>!o.card&&/周魴-棄牌扣血/.test(o.label||'')&&H.pIdx(o)!=null);
      const out=cands.filter(c=>!isSk(c)); if(!skOpts.length) return out;
      if(low&&hand>=low.hp){ const o=skOpts.find(x=>H.pIdx(x)===low.idx); if(o){ B._zfX=low.hp; H.L('周魴: 棄牌扣血 → P'+low.idx+' (血 '+low.hp+', 手牌 '+hand+')'); return [{pri:150,o,n:o.label}].concat(out); } }
      if(hand>=6){ const bt=H.bestTargetFor(s,skOpts,'周魴-棄牌扣血','周魴'); if(bt){ B._zfX=3; return [{pri:60,o:bt.o,n:bt.o.label}].concat(out); } }
      return out; },
    decide(s,p,H){ const pr=p.prompt||'';
      if(/周魴-棄牌扣血: 選擇張數/.test(pr)){ const nums=p.options.map(o=>({i:o.i,v:H.numOf(o)})).sort((a,b)=>a.v-b.v); const x=Math.min(3,Math.max(1,B._zfX||3)); const pick=nums.filter(n=>n.v<=x).pop()||nums[0]; H.L('周魴: 棄 '+pick.v+' 張'); return [pick.i]; }
      if(/周魴-換血/.test(pr)){ const m=H.me(s); const top=H.alive(s).filter(q=>q.idx!==s.viewer).sort((a,b)=>b.hp-a.hp)[0]; if(top&&top.hp>m.hp&&H.targetScore(s,top.idx)>-100){ const y=p.options.find(o=>/^發動/.test(o.label)); if(y){ H.L('周魴: 換血 (我 '+m.hp+', 對方 P'+top.idx+' '+top.hp+')'); return [y.i]; } } const no=H.passOpt(p); return no?[no.i]:null; }
      return null; } });
  return 'patch b15 loaded (周魴: 棄牌扣血只在能殺人/手牌多時用, 換血對敵人發動)'; }