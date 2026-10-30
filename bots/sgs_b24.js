async function(){ const B=window.SGSBOT;
  const RXD=/殺$|^決鬥$|^火攻$|^笑裡藏刀$|^鴻門宴$/, TRK=/^決鬥$|^火攻$|^笑裡藏刀$|^鴻門宴$/;
  const isTrick=(c)=>c&&c.o&&c.o.card&&c.o.card.kind==='trick';
  const noTrick=(l)=>l.filter((c)=>!isTrick(c));
  const jgOf=(s,H)=>{ const en=H.enemies(s); return s.players.find((q)=>q.char==='蔣幹'&&q.alive&&q.idx!==s.viewer&&en.some((e)=>e.idx===q.idx)); };
  const cur=(s)=>{ const C=B.cts; return (C&&C.round===s.round&&C.gid===B.history.length&&!C.dead)?C:null; };
  const tryFlip=(s)=>{ B.flipTry=B.flipTry||{}; const k=B.history.length+'|'+s.round; B.flipTry[k]=(B.flipTry[k]||0)+1; return B.flipTry[k]<=3; };
  const lastUser=(s)=>{ const L=(s.logs||[]); for(let i=L.length-1,n=0;i>=0&&n<14;i--,n++){ const t=String(L[i]); if(!/使用/.test(t)) continue; const m=/(?:^|\s|\])P(\d)\(/.exec(t); if(m) return +m[1]; } return null; };
  function myAct(s,p,cands,H,base){
    const m=H.me(s);
    if(m.flipped){
      const so=p.options.filter((o)=>o.card&&H.full(o.card)==='降雷'&&H.pIdx(o)===s.viewer)[0];
      if(so&&tryFlip(s)){ H.L('被翻面: 對自己用降雷翻回來'); return [{pri:300,o:so,n:'降雷→自己(翻回)'}]; }
      let g=cands.filter((c)=>!(c.o&&/^〈/.test(c.o.label||'')));
      if(jgOf(s,H)) g=g.filter((c)=>!/強化|弱化|反擊/.test((c.n||'')+(c.o&&c.o.label||'')));   // 敵人蔣幹: 我用強化/弱化/反擊會被跳過回合
      if(cur(s)) g=noTrick(g.filter((c)=>!(c.o&&c.o.card&&H.full(c.o.card)==='偽裝')));   // 偽裝曹沖戰術中被翻面: 仍不再出錦囊
      H.L('被翻面且沒有降雷: 當作沒有武將技能'); return g;
    }
    let C=cur(s);
    if(!C){
      if(B.cts&&B.cts.round===s.round&&B.cts.gid===B.history.length) return null;
      return null;   /* 偽裝曹沖打蔣幹: 使用者取消 (交換武將提問不會被蔣幹的調虎離山觸發, 實測會失敗) */
      const jg=jgOf(s,H); if(!jg) return null;
      const disg=p.options.find((o)=>o.card&&H.full(o.card)==='偽裝'); if(!disg) return null;
      if(s.players.some((q)=>q.char==='曹沖')) return null;
      const atk=p.options.filter((o)=>o.card&&H.pIdx(o)===jg.idx&&RXD.test(H.full(o.card))&&H.atkAdj(s,o.label,H.full(o.card),jg.idx)>-100);
      if(!atk.length) return null;
      B.cts={round:s.round,gid:B.history.length,jg:jg.idx,sel:false,swapped:false,atk:false,post:false,dis:0}; B.disg=null;
      H.L('偽裝[曹沖→蔣幹]: 場上有敵人蔣幹 P'+jg.idx+', 手上有攻擊牌 → 最優先偽裝成曹沖');
      return [{pri:300,o:disg,n:'偽裝'}].concat(base);
    }
    const jgp=s.players[C.jg];
    if(!C.sel){ const disg=p.options.find((o)=>o.card&&H.full(o.card)==='偽裝'); if(disg&&C.dis<2){ C.dis++; return [{pri:300,o:disg,n:'偽裝'}].concat(base); } C.dead=true; H.L('偽裝[曹沖]: 沒有成功變身, 放棄這個戰術'); return null; }
    if(!C.swapped&&jgp&&jgp.char==='曹沖'){ C.swapped=true; H.L('曹沖偽裝: 已和蔣幹交換武將 (我現在是 '+m.char+')'); }
    const rest=base.filter((c)=>!(c.o&&c.o.card&&H.full(c.o.card)==='偽裝'));
    if(!C.swapped){
      if(C.atk||!(jgp&&jgp.alive)) return noTrick(rest);
      const os=p.options.filter((o)=>o.card&&H.pIdx(o)===C.jg&&RXD.test(H.full(o.card))&&H.atkAdj(s,o.label,H.full(o.card),C.jg)>-100);
      const pick=os.find((o)=>!TRK.test(H.full(o.card)))||os[0];   /* 偽裝本身就是這回合第 1 張錦囊, 再用錦囊攻擊 = 第 2 張, 會被曹沖技能2扣 1 血 → 先用殺 (非錦囊) */
      if(pick){ C.atk=true; H.L('偽裝[曹沖]: 攻擊蔣幹 → '+pick.label); return [{pri:300,o:pick,n:H.full(pick.card)+'→蔣幹'}].concat(noTrick(rest)); }
      C.atk=true; return noTrick(rest);
    }
    if(C.post) return noTrick(rest);
    C.post=true;
    const ts=p.options.filter((o)=>o.card&&H.pIdx(o)===C.jg);
    const fl=ts.find((o)=>H.full(o.card)==='降雷');
    const at=ts.find((o)=>TRK.test(H.full(o.card))&&H.atkAdj(s,o.label,H.full(o.card),C.jg)>-100);
    const pk=fl||at;
    if(pk){ C.used=true; H.L('曹沖偽裝: 換完後再用一張錦囊 → '+pk.label); return [{pri:300,o:pk,n:H.full(pk.card)+'→原蔣幹'}].concat(noTrick(rest)); }
    return noTrick(rest);
  }
  function myDecide(s,p,H,inner){
    const m=H.me(s), pr=p.prompt||''; const C=cur(s);
    if(C&&!C.sel&&p.kind!=='act'&&(/偽裝|變身/.test(pr))){ const hit=(p.options||[]).find((o)=>(o.label||'').includes('曹沖')); if(hit){ C.sel=true; H.L('偽裝: 變身曹沖'); return [hit.i]; } }
    if(C&&/曹沖-交換武將/.test(pr)&&!C.swapped){ const lu=lastUser(s); const yes=(p.options||[]).find((o)=>!/不|否|取消|跳過|拒絕/.test(o.label||''))||(p.options||[])[0]; const no=H.passOpt(p);
      if((lu==null||lu===C.jg)&&yes){ H.L('偽裝[曹沖]: 蔣幹出了錦囊(調虎離山), 交換武將 → 是'); return [yes.i]; }
      if(no){ H.L('偽裝[曹沖]: 不是蔣幹出的錦囊, 不交換'); return [no.i]; } }
    if(C&&C.swapped&&C.used&&m.char==='蔣幹'&&p.kind!=='act'){
      const os=p.options||[];
      if(/即將受到/.test(pr)){ const co=os.filter((o)=>o.card); if(co.length){ const pick=co.slice().sort((a,b)=>H.keepVal(a.card)-H.keepVal(b.card))[0]; H.L('蔣幹(換來的): 承受曹沖技能傷害後, 手牌當調虎離山 → '+pick.label); return [pick.i]; } }
      else if(os.some((o)=>o.card&&H.full(o.card)==='閃')&&/可閃|錦囊|超過/.test(pr)){ const no=H.passOpt(p); if(no){ H.L('蔣幹(換來的): 錦囊超過上限的扣血不出閃, 直接承受再調虎離山'); return [no.i]; } }
    }
    if(m.flipped){
      const os=(p.options||[]);
      const fs=os.filter((o)=>o.card&&H.full(o.card)==='降雷');
      const so=fs.find((o)=>H.pIdx(o)===s.viewer)||fs.find((o)=>H.pIdx(o)==null);
      if(so&&p.kind!=='target'&&tryFlip(s)){ B.flipSelf={t:Date.now()}; H.L('被翻面: 連鎖/提問中用降雷翻回自己'); return [so.i]; }
      if(B.flipSelf&&Date.now()-B.flipSelf.t<10000){ const me2=os.find((o)=>H.pIdx(o)===s.viewer); if(me2&&(p.kind==='target'||/降雷|目標|對象/.test(pr))){ B.flipSelf=null; H.L('被翻面: 降雷目標選自己'); return [me2.i]; } }
      if(/無懈/.test(pr)) return inner?inner(s,p,H):null;
      if(p.kind==='skill'&&s.cur===s.viewer&&/即將受到|使用了|傷害結算前/.test(pr)&&jgOf(s,H)){ const no=H.passOpt(p); if(no){ H.L('被翻面: 敵人蔣幹在場, 自己回合不用連鎖牌'); return [no.i]; } }
      if(/發憤圖強-少棄/.test(pr)&&m.char==='蔣幹'){ const o=os.map((x)=>({i:x.i,k:(/扣 (\d+) 點/.exec(x.label)||[0,0])[1]*1})).sort((a,b)=>a.k-b.k)[0]; if(o) return [o.i]; }
      return null;
    }
    return null;
  }
  (B.roster||[]).forEach((c)=>{ const prev=B.strat[c]||{}; const orig=prev.__b24||prev; const o=Object.assign({},orig);
    o.act=(s,p,cands,H)=>{ if(H.me(s).flipped) return myAct(s,p,cands,H,cands)||cands; const base=orig.act?(orig.act(s,p,cands,H)||cands):cands; const r=myAct(s,p,cands,H,base); return r||base; };
    o.decide=(s,p,H)=>{ const r=myDecide(s,p,H,orig.decide); if(r) return r; if(H.me(s).flipped) return null; return orig.decide?orig.decide(s,p,H):null; };
    o.__b24=orig; B.strat[c]=o; });
  return 'patch b24 loaded (被翻面降雷自救/無技能; 偽裝曹沖打蔣幹)'; }