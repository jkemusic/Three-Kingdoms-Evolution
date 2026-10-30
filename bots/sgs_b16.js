async function(){ const B=window.SGSBOT;
  // 周魴 (outermost): 棄牌扣血 只要有「不要用的手牌」就能發動 — 多的裝備牌 / 馬 / 樂不思蜀以外的延時錦囊 / 桃園結義 / 效果差的錦囊 / 多的殺 (這回合已打不出的殺), 能用就用
  const WEAK=new Set(['拋磚引玉','聲東擊西','借刀殺人','隔岸觀火','轉移','弱化','降雷','五穀豐登','桃園結義']);
  const isEq=(c,H)=>/^裝備|^武器/.test(H.desc(c)||'');
  const junkRank=(c,H)=>{ const n=H.full(c); const d=H.desc(c)||''; if(isEq(c,H)) return 0; if(d.indexOf('⏳')===0&&n!=='樂不思蜀') return 1; if(WEAK.has(n)) return 2; if(H.isSha(n)) return 3; return 10+H.keepVal(c); };
  B.layer('周魴',{ act(s,p,cands,H){ const m=H.me(s); const hand=m.hand||[]; const isSk=(c)=>/周魴-棄牌扣血/.test((c.n||'')+(c.o&&c.o.label||''));
      const skOpts=p.options.filter(o=>!o.card&&/周魴-棄牌扣血/.test(o.label||'')&&H.pIdx(o)!=null); const rest=cands.filter(c=>!isSk(c)); if(!skOpts.length) return rest;
      const equipPlay=new Set(rest.filter(c=>c.o&&c.o.card&&isEq(c.o.card,H)).map(c=>H.full(c.o.card)));
      const canSha=rest.some(c=>c.o&&c.o.card&&H.isSha(H.full(c.o.card)));
      let junk=0; let shaN=hand.filter(c=>H.isSha(H.full(c))).length;
      for(const c of hand){ const n=H.full(c); if(isEq(c,H)){ if(!equipPlay.has(n)) junk++; } else if((c.desc||'').indexOf('⏳')===0&&n!=='樂不思蜀') junk++; else if(WEAK.has(n)) junk++; }
      junk+=Math.max(0,shaN-(canSha?1:0));
      if(junk<1) return rest;
      const X=Math.min(3,junk); B._zfX=X;
      let best=null,bs=1e9; for(const o of skOpts){ const i=H.pIdx(o); const q=s.players[i]; if(!q||H.targetScore(s,i)<=-100) continue; const sc=(q.hand_n===0?-50:0)+(q.hp<=X?-30:0)+q.hp; if(sc<bs){bs=sc;best=o;} }
      if(!best) return rest;
      H.L('周魴: 有 '+junk+' 張不要的牌, 棄牌扣血 X='+X+' → '+best.label); return rest.concat([{pri:20,o:best,n:best.label}]); },
    decide(s,p,H){ const pr=p.prompt||'';
      if(/周魴-棄牌扣血: 選擇張數/.test(pr)){ const nums=p.options.map(o=>({i:o.i,v:H.numOf(o)})).sort((a,b)=>a.v-b.v); const x=Math.min(3,Math.max(1,B._zfX||3)); const pick=nums.filter(n=>n.v<=x).pop()||nums[0]; H.L('周魴: 棄 '+pick.v+' 張'); return [pick.i]; }
      if(/周魴/.test(pr)&&/棄/.test(pr)&&p.options.some(o=>o.card)&&p.kind!=='count'&&p.kind!=='skill'){ const co=p.options.filter(o=>o.card).slice().sort((a,b)=>junkRank(a.card,H)-junkRank(b.card,H)); const n=Math.max(1,Math.min(p.max||p.min||1,co.length)); return co.slice(0,n).map(o=>o.i); }
      return null; } });
  return 'patch b16 loaded (周魴: 有不要的牌就棄牌扣血)'; }