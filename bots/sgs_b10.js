async function(){ const B=window.SGSBOT; B.krRound=-1;
  const MUST=new Set(['發憤圖強','偽裝','反擊','調虎離山']);   // 孔融重鑄: 除非有一定要保留的牌, 否則盡量重鑄越多越好
  const mustCount=(m,H)=>{ const hand=m.hand||[]; let n=hand.filter(c=>MUST.has(H.full(c))).length;  return n; };
  B.layer('孔融',{ decide(s,p,H){ const pr=p.prompt||''; const m=H.me(s); const hand=m.hand||[]; const rec=Math.max(0,hand.length-mustCount(m,H));
    if(/孔融-重鑄手牌: 選擇張數/.test(pr)){ const nums=p.options.map(o=>({i:o.i,v:H.numOf(o)})).sort((a,b)=>a.v-b.v); const fit=nums.filter(x=>x.v<=Math.max(1,rec)); const pick=fit.length?fit[fit.length-1]:nums[0]; H.L('孔融: 重鑄 '+pick.v+' 張 (手牌 '+hand.length+', 保留 '+(hand.length-pick.v)+')'); return [pick.i]; }
    if(/孔融/.test(pr)&&/重鑄/.test(pr)&&p.kind!=='skill'&&p.options.some(o=>o.card)){ const co=p.options.filter(o=>o.card).slice().sort((a,b)=>((MUST.has(H.full(a.card))?1:0)-(MUST.has(H.full(b.card))?1:0))||(H.keepVal(a.card)-H.keepVal(b.card)));   /* 偽裝/發憤圖強/反擊/調虎離山 排最後, 重鑄時保留 */ const n=Math.max(1,Math.min(p.max||1,co.length)); return co.slice(0,n).map(o=>o.i); }
    if(p.kind==='skill'&&!/即將受到|使用了|要接連鎖|對你使用/.test(pr)){ const o=p.options.find(x=>/孔融-重鑄/.test(x.label||'')&&/^使用|^發動/.test(x.label||'')); if(o&&rec>=1){ H.L('孔融: 發動重鑄 (可重鑄 '+rec+' 張, 手牌 '+hand.length+', 血 '+m.hp+'/'+m.maxhp+')'); return [o.i]; } }
    return null; } });
  return 'patch b10 loaded (孔融: 重鑄越多越好, 只保留桃/無懈/反擊/調虎離山/1張閃)'; }