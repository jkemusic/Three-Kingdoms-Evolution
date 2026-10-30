async function(){ const B=window.SGSBOT;
  const SHA=/殺$/, DMG=/殺$|^決鬥$|^火攻$|^笑裡藏刀$|^鴻門宴$/;
  const isTrick=(c)=>c&&c.o&&c.o.card&&c.o.card.kind==='trick';
  const noTrick=(l)=>l.filter((c)=>!isTrick(c));
  const gid=()=>B.history.length;
  const jgOf=(s,H)=>{ const en=H.enemies(s); return s.players.find((q)=>q.char==='蔣幹'&&q.alive&&q.idx!==s.viewer&&en.some((e)=>e.idx===q.idx)); };
  const cur=(s)=>{ const D=B.jd; return (D&&D.round===s.round&&D.gid===gid()&&!D.dead)?D:null; };
  const isDisg=(c,H)=>c.o&&c.o.card&&H.full(c.o.card)==='偽裝';
  function plan(s,p,H,m,jg){
    const free=(n)=>!s.players.some((q)=>q.char===n);
    const hand=(m.hand||[]).filter((c)=>H.full(c)!=='偽裝');
    const names=hand.map((c)=>H.full(c));
    const shaN=names.filter((n)=>SHA.test(n)).length, jiuN=names.filter((n)=>n==='酒').length;
    const otherAtk=names.filter((n)=>/^決鬥$|^火攻$|^笑裡藏刀$/.test(n)).length;
    const playable=new Set(p.options.filter((o)=>o.card).map((o)=>H.full(o.card)));
    const stuck=names.filter((n)=>!playable.has(n)).length;
    const force=B.jdForce;
    if(force&&free(force)) return {as:force,why:'測試指定'};
    if(free('吳懿')&&(jg.hand_n||0)>=2&&stuck<=1) return {as:'吳懿',why:'蔣幹手牌 '+jg.hand_n+', 我打不出的牌 '+stuck};
    const reach=p.options.some((o)=>o.card&&H.pIdx(o)===jg.idx&&SHA.test(H.full(o.card)));   // 現在殺打得到蔣幹嗎 (距離)
    const dd=Math.abs(jg.idx-m.idx); const natAdj=Math.min(dd,s.players.length-dd)===1;   // 呂布無效全場會讓武器/馬都無效 → 只看座位距離 (必須相鄰)
    const aoeN=names.filter((n)=>/^(南蠻入侵|萬箭齊發)$/.test(n)).length;
    const ldDmg=(reach&&shaN>0?1+(jiuN>0?1:0):0)+otherAtk+aoeN;   // 殺 1 點 (+酒 1 點), 其他攻擊錦囊各 1 點
    if(free('劉禪')&&B.ldGame!==gid()&&ldDmg>=jg.hp) return {as:'劉禪',why:'預估傷害 '+ldDmg+' >= 蔣幹血 '+jg.hp};
    /* 對蔣幹不用呂布 (使用者決定 2026-10-29): 無效全場連武器/馬都無效, 殺打不到非相鄰的蔣幹 */
    return null;
  }
  function jdAct(s,p,cands,H){
    const m=H.me(s); if(m.flipped) return null;
    let D=cur(s);
    if(!D){
      if(B.jd&&B.jd.round===s.round&&B.jd.gid===gid()) return null;
      const jg=jgOf(s,H); if(!jg) return null;
      const disg=p.options.find((o)=>o.card&&H.full(o.card)==='偽裝'); if(!disg) return null;
      // 殺打不到蔣幹 (距離) 而手上有 -1馬 / 武器 → 先裝備縮短距離, 下一個提示再重新判斷
      { const handNames=(m.hand||[]).map((c)=>H.full(c)); const reach0=p.options.some((o)=>o.card&&H.pIdx(o)===jg.idx&&SHA.test(H.full(o.card)));
        B.jdPrep=(B.jdPrep&&B.jdPrep.round===s.round&&B.jdPrep.gid===gid())?B.jdPrep:{round:s.round,gid:gid(),n:0};
        if(!reach0&&handNames.some((n)=>SHA.test(n))&&B.jdPrep.n<3){
          const WR={'麒麟弓':5,'孔雀羽扇':4,'方天畫戟':4,'青龍偃月刀':3,'丈八蛇矛':3,'貫石斧':3,'寒冰劍':2,'流星錘':2,'青釭劍':2};   // 射程 (卡牌頁 S.cat); 諸葛連弩射程 1 沒幫助
          const eq=p.options.filter((o)=>o.card&&H.pIdx(o)==null&&(/^-1馬$/.test(H.full(o.card))||WR[H.full(o.card)]>=2));
          const pick=eq.find((o)=>/^-1馬$/.test(H.full(o.card)))||eq.slice().sort((x,y)=>(WR[H.full(y.card)]||0)-(WR[H.full(x.card)]||0))[0];
          if(pick){ B.jdPrep.n++; H.L('偽裝[對蔣幹]: 殺打不到蔣幹, 先裝備 '+H.full(pick.card)+' 縮短距離'); return [{pri:300,o:pick,n:'裝備(縮短距離)'}].concat(cands); } } }
      const pl=plan(s,p,H,m,jg); if(!pl) return null;
      B.jd={round:s.round,gid:gid(),as:pl.as,jg:jg.idx,sel:false,used:false,dis:0};
      if(pl.as==='劉禪') B.ldGame=gid(); if(pl.as==='呂布') B.lbGame=gid();
      B.disg=null;
      H.L('偽裝[對蔣幹]: 場上有敵人蔣幹 P'+jg.idx+' → 偽裝成 '+pl.as+' ('+pl.why+')');
      return [{pri:300,o:disg,n:'偽裝'}].concat(cands);
    }
    B.disg=null;
    const rest=cands.filter((c)=>!isDisg(c,H)&&!(c.o&&/^〈/.test(c.o.label||'')));   // 偽裝成別人後的技能選項由這裡自己決定時機
    if(!D.sel){ const disg=p.options.find((o)=>o.card&&H.full(o.card)==='偽裝'); if(disg&&D.dis<2){ D.dis++; return [{pri:300,o:disg,n:'偽裝'}].concat(rest); } D.dead=true; H.L('偽裝[對蔣幹]: 沒有成功變身, 放棄'); return null; }
    const jgp=s.players[D.jg];
    const skill=p.options.find((o)=>o.label&&/^〈/.test(o.label)&&(D.as==='吳懿'?/交換手牌/:D.as==='劉禪'?/劉禪-棄光/:/呂布-無效全場/).test(o.label)&&(D.as==='呂布'||H.pIdx(o)===D.jg));
    if(D.as==='吳懿'){
      if(!D.used){
        const hand=(m.hand||[]).length;
        if(!skill){ D.dead=true; H.L('偽裝[吳懿]: 找不到交換手牌選項, 放棄'); return null; }
        const pre=rest.filter((c)=>!(c.o&&c.o.card&&H.pIdx(c.o)===D.jg&&DMG.test(H.full(c.o.card)))); if(pre.length===0||hand<=1){ D.used=true; D.hBefore=hand; D.jBefore=jgp&&jgp.hand_n; H.L('偽裝[吳懿]: 我手牌 '+hand+' 張, 蔣幹 '+(jgp&&jgp.hand_n)+' 張 → 和蔣幹交換手牌'); return [{pri:300,o:skill,n:'吳懿-交換→蔣幹'}].concat(rest); }
        return pre;
      }
      if(!D.logged){ D.logged=true; H.L('偽裝[吳懿]: 換完後 我 '+(m.hand||[]).length+' 張 (換前 '+D.hBefore+'), 蔣幹 '+(jgp&&jgp.hand_n)+' 張 (換前 '+D.jBefore+')'); }
      return rest;
    }
    if(!D.used){
      if(skill){ D.used=true; H.L('偽裝['+D.as+']: 對蔣幹發動技能 → '+skill.label); return [{pri:300,o:skill,n:D.as+'技能'}].concat(D.as==='呂布'?noTrick(rest):rest); }
      D.dead=true; H.L('偽裝['+D.as+']: 找不到技能選項, 放棄'); return null;
    }
    if(D.as==='呂布'){
      const out=noTrick(rest); const jiu=p.options.find((o)=>o.card&&H.full(o.card)==='酒');
      const jgOpts=p.options.filter((o)=>o.card&&H.pIdx(o)===D.jg&&SHA.test(H.full(o.card)));
      const pre=[]; if(jiu&&jgOpts.length) pre.push({pri:200,o:jiu,n:'酒'}); jgOpts.forEach((o)=>pre.push({pri:190,o,n:H.full(o.card)+'→蔣幹'}));
      return pre.concat(out);
    }
    if(D.as==='劉禪'){ const aoe=p.options.filter((o)=>o.card&&/^(南蠻入侵|萬箭齊發)$/.test(H.full(o.card))); const seen={}; const pre=[]; aoe.forEach((o)=>{ const n=H.full(o.card); if(!seen[n]){ seen[n]=1; pre.push({pri:186,o,n:n+'→蔣幹(群攻)'}); } }); return pre.concat(rest); }   // 蔣幹被棄光牌後, 群攻不受距離限制又無法回應
    return rest;
  }
  function jdDecide(s,p,H){
    const D=cur(s); if(!D) return null; const pr=p.prompt||'';
    if(!D.sel&&p.kind!=='act'&&/偽裝/.test(pr)){ const hit=(p.options||[]).find((o)=>(o.label||'')===D.as)||(p.options||[]).find((o)=>(o.label||'').includes(D.as)); if(hit){ D.sel=true; H.L('偽裝: 變身 '+D.as); return [hit.i]; } }
    return null;
  }
  (B.roster||[]).forEach((c)=>{ B.layer(c,{ act(s,p,cands,H){ return jdAct(s,p,cands,H); }, decide(s,p,H){ return jdDecide(s,p,H); } }); });
  return 'patch b25 loaded (偽裝針對蔣幹: 吳懿→劉禪→呂布)'; }