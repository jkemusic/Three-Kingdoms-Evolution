async function(){ const B=window.SGSBOT;
  /* b28: A 組主動技能 第二批 (使用者 2026-10-30)
     魯肅: 多抽 2 張 + 交 2 張手牌是自動的 (沒有發動提問, 無法不發動) → 交牌時不交 偽裝 / 發憤圖強 / (有發憤圖強時) 反擊 調虎離山 占卜; 優先交給隊友 (主公優先)
     周倉-再抽牌: 一律發動, 除非 (有血量=1、非蔣幹、殺打得到的敵人) 或 (血量<=2 且手上有桃 = 急需回血) 或 單挑 (場上只剩 2 人)
     曹仁 (棄牌階段後展示手牌, 全同色則抽 2 張再重複): 出牌階段盡量打掉少數顏色的牌, 棄牌時先棄少數顏色 */
  const gid=()=>B.history.length;
  const COL=(c)=>{ const x=c&&(c.color||(c.text||'')[0]); return x==='紅'||x==='黑'?x:null; };

  // ---------- 魯肅 ----------
  const COMBO=/^(反擊|調虎離山|占卜)$/;
  function luProtected(m,H){ const hasFj=H.has(m,'發憤圖強')>0; return (c)=>{ const n=H.full(c); return n==='偽裝'||n==='發憤圖強'||(hasFj&&COMBO.test(n)); }; }
  function luDecide(s,p,H){
    const m=H.me(s); if(!m||m.flipped) return null; const pr=p.prompt||'';
    if(p.kind==='target'&&/^選擇對象: 選擇目標/.test(pr)){
      const opts=(p.options||[]).filter((o)=>H.pIdx(o)!=null); if(!opts.length) return null;
      const en=new Set(H.enemies(s).map((q)=>q.idx)); const pl=(o)=>s.players[H.pIdx(o)];
      const ally=opts.filter((o)=>!en.has(H.pIdx(o)));
      let pick;
      if(ally.length){ pick=ally.find((o)=>pl(o).role==='主公')||ally.slice().sort((a,b)=>pl(a).hp-pl(b).hp)[0]; }
      else pick=opts.slice().sort((a,b)=>pl(b).hp-pl(a).hp)[0];
      H.L('魯肅: 交牌對象 → P'+H.pIdx(pick)+(ally.length?' (隊友)':' (全是敵人, 給血最多的)'));
      return [pick.i];
    }
    if(p.kind==='discard'&&/^選擇要給 P\d/.test(pr)){
      const cards=(p.options||[]).filter((o)=>o.card); const need=p.min||2; if(cards.length<need) return null;
      const prot=luProtected(m,H);
      const sorted=cards.slice().sort((a,b)=>((prot(a.card)?1:0)-(prot(b.card)?1:0))||(H.keepVal(a.card)-H.keepVal(b.card)));
      const give=sorted.slice(0,need); H.L('魯肅: 交出 '+give.map((o)=>o.label).join(',')+(give.some((o)=>prot(o.card))?' (保護牌不夠, 被迫交出)':''));
      return give.map((o)=>o.i);
    }
    return null;
  }
  B.layer('魯肅',{ decide:luDecide });

  // ---------- 周倉 ----------
  function reachSha(s,m,e,H){
    const al=s.players.filter((q)=>q.alive); const a=al.findIndex((q)=>q.idx===m.idx), b=al.findIndex((q)=>q.idx===e.idx); if(a<0||b<0) return false;
    if(m.char==='孫策'||m.char==='顏良&文醜') return true;
    const d0=Math.abs(a-b), d=Math.min(d0,al.length-d0);
    const eq=m.equip||{}; const rng=Math.max(1,...[eq.weapon,eq.weapon2].map((w)=>w&&+w.rng||1));
    const dist=Math.max(1,d+((e.equip||{})['h+']?1:0)-(eq['h-']?1:0));
    return rng>=dist;
  }
  function zcDecide(s,p,H){
    const m=H.me(s); if(!m||m.flipped||p.kind!=='skill'||!/^周倉-再抽牌/.test(p.prompt||'')) return null;
    const yes=(p.options||[]).find((o)=>/^發動/.test(o.label||'')), no=(p.options||[]).find((o)=>/^不/.test(o.label||'')); if(!yes||!no) return null;
    const kill=H.enemies(s).filter((e)=>e.alive&&e.hp===1&&e.char!=='蔣幹'&&reachSha(s,m,e,H));
    const heal=m.hp<=2&&H.has(m,'桃')>0;
    const duel=s.players.filter((q)=>q.alive).length===2;   // 單挑: 發動後不能出基本牌(殺), 收不了尾
    const skip=kill.length>0||heal||duel;
    H.L('周倉-再抽牌: '+(kill.length?'有血1敵人 P'+kill[0].idx+' 殺得到 → 不發動':heal?'血量 '+m.hp+' 且有桃 → 不發動(留基本牌回血)':duel?'單挑 (場上只剩 2 人) → 不發動':'→ 發動'));
    return [(skip?no:yes).i];
  }
  B.layer('周倉',{ decide:zcDecide });

  // ---------- 曹仁 ----------
  function wantColor(hand,H){ const sum={紅:0,黑:0}; hand.forEach((c)=>{ const k=COL(c); if(k) sum[k]+=H.keepVal(c)+1; }); return sum.紅>=sum.黑?'紅':'黑'; }
  const SELF_OK=/^(無中生有|增兵減灶|未雨綢繆)$/, ENEMY_OK=/殺$|^(順手牽羊|過河拆橋|樂不思蜀|兵糧寸斷|降雷|火攻|笑裡藏刀|突襲|拋磚引玉)$/;
  const cnt={};
  function crAct(s,p,cands,H){
    const m=H.me(s); if(!m||m.flipped||p.kind!=='act') return null;
    const hand=m.hand||[]; if(hand.length<=1) return null;
    if(new Set(hand.map(COL).filter(Boolean)).size<=1) return null;
    const k=gid()+':'+s.round; cnt[k]=(cnt[k]||0)+1; if(cnt[k]>14) return null;
    const keep=wantColor(hand,H); const en=new Set(H.enemies(s).map((q)=>q.idx));
    const others=s.players.filter((q)=>q.alive&&q.idx!==m.idx); const noAlly=others.every((q)=>en.has(q.idx));
    const extra=[];
    (p.options||[]).forEach((o)=>{
      if(!o.card||/^〈/.test(o.label||'')) return; const col=COL(o.card); if(!col||col===keep) return;
      const n=H.full(o.card); const kind=o.card.kind; const t=H.pIdx(o);
      let ok=false;
      if(n==='偽裝'||n==='發憤圖強') return;
      if(kind==='weapon'||kind==='armor'||kind==='horse') ok=t==null||t===m.idx;
      else if(t==null) ok=SELF_OK.test(n)||(/^(南蠻入侵|萬箭齊發|飢餓)$/.test(n)&&noAlly)||n==='五穀豐登';
      else if(t===m.idx) ok=SELF_OK.test(n)||(n==='桃'&&m.hp<(m.maxhp||4));
      else if(en.has(t)) ok=ENEMY_OK.test(n)||(n==='決鬥'&&m.hp>=2&&H.shaCnt(m)>=1);
      if(ok) extra.push({pri:(SELF_OK.test(n)?170:160),o,n:'曹仁-打掉'+col+n});
    });
    if(!extra.length) return null;
    if(cnt[k]===1) H.L('曹仁: 手牌顏色不一致, 保留 '+keep+' 色, 盡量打掉另一色 ('+extra.length+' 個可用選項)');
    return extra.concat(cands);
  }
  function crDecide(s,p,H){
    const m=H.me(s); if(!m||m.flipped||p.kind!=='discard'||!/^選擇要棄置的 \d+ 張/.test(p.prompt||'')) return null;
    const cards=(p.options||[]).filter((o)=>o.card); const need=p.min||0; if(need<=0||cards.length<need) return null;
    const hand=m.hand||[]; if(new Set(hand.map(COL).filter(Boolean)).size<=1) return null;
    const keep=wantColor(hand,H);
    const sorted=cards.slice().sort((a,b)=>(((COL(a.card)===keep)?1:0)-((COL(b.card)===keep)?1:0))||(H.keepVal(a.card)-H.keepVal(b.card)));
    const pick=sorted.slice(0,need); H.L('曹仁: 棄牌先棄非 '+keep+' 色 → '+pick.map((o)=>o.label).join(','));
    return pick.map((o)=>o.i);
  }
  B.layer('曹仁',{ act:crAct, decide:crDecide });
  return 'patch b28 loaded (魯肅/周倉/曹仁)'; }
