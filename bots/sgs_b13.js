async function(){ const B=window.SGSBOT;
  // 忠臣: 主公缺血時, 主動幫主公回血 (投桃報李選主公 / 桃園結義 / 技能回血選主公), 排在偽裝/發憤圖強之後最前面
  (B.roster||[]).forEach((c)=>{ B.layer(c,{ act(s,p,cands,H){ const m=H.me(s); if(m.role!=='忠臣') return null; const lord=H.lordOf(s); if(!lord||!lord.alive||lord.hp>=(lord.maxhp||4)) return null;
      const extra=[]; const seen={};
      for(const o of p.options){ const i=H.pIdx(o); const n=o.card?H.full(o.card):''; const lab=o.label||'';
        if(n==='投桃報李'&&i===lord.idx&&!seen.t){ seen.t=1; extra.push({pri:120,o,n:'投桃報李→主公'}); }
        else if(n==='桃園結義'&&!seen.p&&m.char!=='劉備'){ seen.p=1; extra.push({pri:119,o,n}); }
        else if(!o.card&&/回血|回復/.test(lab)&&i===lord.idx&&!seen.s&&m.char!=='劉備'){ seen.s=1; extra.push({pri:118,o,n:lab}); } }
      if(!extra.length) return null;
      const rest=cands.filter(x=>!extra.some(e=>e.o===x.o)&&!(seen.t&&x.o&&x.o.card&&H.full(x.o.card)==='投桃報李')); let k=0; while(k<rest.length&&rest[k].o&&rest[k].o.card&&/^(偽裝|發憤圖強)$/.test(H.full(rest[k].o.card))) k++;
      if(B._lordHealLog!==s.round){ B._lordHealLog=s.round; H.L('忠臣: 主公血量 '+lord.hp+'/'+(lord.maxhp||4)+', 幫主公回血 ('+extra.map(e=>e.n).join(',')+')'); }
      return rest.slice(0,k).concat(extra,rest.slice(k)); } }); });
  return 'patch b13 loaded (忠臣幫主公回血)'; }