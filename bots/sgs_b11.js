async function(){ const B=window.SGSBOT;
  // 全部武將 (outermost): 反擊 + 回合出牌順序 + 裝備規則
  const WS={'流星錘':100,'青釭劍':90,'孔雀羽扇':85}; const AS={'緩衝盾':100,'藤甲':80,'八卦陣':60,'仁王盾':50,'火盾':40};
  const wScore=(n,handN)=>n==='丈八蛇矛'?(handN>=5?70:20):(WS[n]!=null?WS[n]:(n==='諸葛連弩'?30:10));   // 好武器: 流星錘 / 無視防具的劍 / 火攻扇 / 手牌多時丈八蛇矛
  const aScore=(n)=>AS[n]!=null?AS[n]:10;                                                              // 緩衝盾 > 藤甲 > 八卦陣 > 仁王盾 > 火盾 > 其他
  const DUAL=new Set(['甘寧','夏侯淵','周瑜']);                                                         // 可以裝 2 件, 新裝的才不會蓋掉舊的
  const rank=(c,H)=>{ const o=c.o; const card=o&&o.card; const n=card?H.full(card):''; const lab=(c.n||'')+(o&&o.label||''); const d=card?H.desc(card):'';
    if(n==='偽裝'||n==='發憤圖強') return 0;
    if(card&&/^裝備|^武器/.test(d)) return 1;
    if(/^(無中生有|增兵減灶|未雨綢繆|五穀豐登)$/.test(n)||(!card&&/抽/.test(lab))) return 2;
    if(n==='桃'||n==='強化'||n==='桃園結義'||(!card&&/回血|回復/.test(lab))) return 3;
    if(/重鑄/.test(lab)) return 4; return 5; };
  (B.roster||[]).forEach((c)=>{ B.layer(c,{
    act(s,p,cands,H){ const m=H.me(s); let list=cands;
      if(m.char!=='諸葛亮'&&!(m.char==='蔣幹'&&B.owed>0&&(m.hand||[]).length<=3)){   // 諸葛亮要把手牌出光, 不套用裝備規則
        const isEq=(x)=>x.o&&x.o.card&&/^裝備|^武器/.test(H.desc(x.o.card)); list=list.filter(x=>!isEq(x));
        if(!s.players.some(q=>q.alive&&q.char==='太史慈')){   // 太史慈在場: 全場裝備無效
          const hand=m.hand||[]; const eq=m.equip||{}; const dual=DUAL.has(m.char); const P=B.cardPri||{}; const pv=(x)=>P[H.full(x)]!=null?P[H.full(x)]:30; const curW=eq.weapon?(dual&&eq.weapon2?Math.min(pv(eq.weapon),pv(eq.weapon2)):pv(eq.weapon)):-1; const curA=eq.armor?(dual&&eq.armor2?Math.min(pv(eq.armor),pv(eq.armor2)):pv(eq.armor)):-1; const willDiscard=hand.length>m.hp;
          const adds=[]; const seen=new Set();
          for(const o of p.options){ if(!o.card) continue; const d=H.desc(o.card); if(!/^裝備|^武器/.test(d)) continue; const n=H.full(o.card); if(seen.has(n)) continue; seen.add(n);
            if(/^武器/.test(d)){ const sc=H.keepVal(o.card); if(sc>curW||(dual&&!eq.weapon2)) adds.push({pri:90,o,n,sc:(typeof sc==='number'?sc:0)}); }
            else if(/^裝備\(防具\)/.test(d)){ if(m.char==='典韋') continue; const sc=pv(o.card); if(sc>curA||(dual&&!eq.armor2)) adds.push({pri:90,o,n,sc:(typeof sc==='number'?sc:0)}); }
            else if(/^裝備\(坐騎\)/.test(d)){ const minus=/-1馬/.test(n); if(eq[minus?'h-':'h+']) continue; const noTarget=H.shaCnt(m)>0&&!p.options.some(x=>x.card&&H.isSha(H.full(x.card))&&x.target&&x.target.kind==='player'); if((minus&&noTarget)||willDiscard) adds.push({pri:90,o,n,sc:(typeof sc==='number'?sc:0)}); } }   // 馬: 打不到敵人 或 快被棄掉才裝
          adds.sort((x,y)=>y.sc-x.sc); list=adds.concat(list); } }
      if(list.length<2) return list.length===cands.length&&list.every((x,i)=>x===cands[i])?null:list;
      const ranked=list.map((x,i)=>({x,i,r:rank(x,H)})); ranked.sort((a,b)=>a.r-b.r||a.i-b.i); return ranked.map(e=>e.x); },
    decide(s,p,H){ const pr=p.prompt||''; if(p.kind!=='skill'||!/即將受到/.test(pr)) return null; const v=/P(\d)\(/.exec(pr); if(!v||+v[1]!==s.viewer) return null; const m=H.me(s); if(m.char==='蔣幹') return null; const N=+((/受到 (\d+) 點/.exec(pr)||[0,1])[1]); if(!H.enemies(s).length) return null;
      const hold=B.owed>0&&s.cur===s.viewer&&B.sbPhase!==s.round&&H.redirectCnt(m)<=1&&N<m.hp; if(hold) return null;
      const rf=p.options.find(o=>o.card&&H.full(o.card)==='反擊'); if(rf){ H.L('反擊: 轉移 '+N+' 點傷害'); return [rf.i]; }
      const th=p.options.find(o=>o.card&&H.full(o.card)==='調虎離山'); if(th&&(N>=2||m.hp<=2)){ H.L('調虎離山: 轉移 '+N+' 點傷害'); return [th.i]; } return null; } }); });
  return 'patch b11 v2 loaded (偽裝/發憤圖強最先 -> 裝備規則 -> 抽牌 -> 回血強化 -> 重鑄)'; }