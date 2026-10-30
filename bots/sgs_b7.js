async function(){ const B=window.SGSBOT;
  const SKIP=/^(無中生有|增兵減灶|未雨綢繆|五穀豐登|桃園結義|發憤圖強|閃電|偽裝)$/;   // 會抽牌 / 自傷 / 變身: 諸葛亮要的是把手牌清空, 不補牌
  const RISK=/^(決鬥|孤注一擲|鴻門宴)$/;                                             // 有扣血風險: 只在這是最後一張牌 (打完手牌就空 = 無敵) 時才出
  B.layer('諸葛亮',{ act(s,p,cands,H){ const m=H.me(s); const hand=m.hand||[]; if(!hand.length) return null;
    const nm=(c)=>c.o&&c.o.card?H.full(c.o.card):'';
    const base=cands.filter(c=>{ const n=nm(c); return !(n&&(SKIP.test(n)||(RISK.test(n)&&hand.length>1))); });
    const used=new Set(base.map(c=>c.o.i)); const groups={}; p.options.forEach(o=>{ if(!o.card) return; const k=o.group!=null?o.group:'i'+o.i; (groups[k]=groups[k]||[]).push(o); });
    const extra=[];
    for(const k in groups){ const os=groups[k]; const o0=os[0]; const n=H.full(o0.card); if(SKIP.test(n)||(RISK.test(n)&&hand.length>1)) continue; if(os.some(o=>used.has(o.i))) continue;
      const wt=os.filter(o=>o.target&&o.target.kind==='player'); let pick=os[0];
      if(wt.length){ if(n==='強化'||n==='投桃報李') pick=wt.find(o=>H.pIdx(o)===s.viewer)||wt[0]; else { let best=null,bs=-1e9; for(const o of wt){ const i=H.pIdx(o); if(i==null||i===s.viewer) continue; const sc=H.targetScore(s,i); if(sc>bs){bs=sc;best=o;} } pick=best||wt[0]; } }
      extra.push({pri:8,o:pick,n:'(清手牌)'+n}); }
    if(extra.length&&B._zgLog!==s.round){ B._zgLog=s.round; H.L('諸葛亮: 手牌 '+hand.length+' 張, 盡量全部出光 (清手牌 '+extra.length+' 種)'); }
    return base.concat(extra); } });
  return 'patch b7 loaded (諸葛亮: 手牌出光才無敵)'; }