async function(){ const B=window.SGSBOT;
  // 全部武將: 「複製技能」選擇 (馬謖 / 韓當 / 陳群 2 血) 挑最強的
  const PREF=['劉協','典韋','曹植','諸葛亮','劉禪','孔融','曹真','董卓','華雄','龐統','蔣幹','陳群','許褚','張角','曹彰','劉諶','張昭','鄧艾','呂布'];
  (B.roster||[]).forEach((c)=>{ B.layer(c,{ decide(s,p,H){ const pr=p.prompt||''; if(p.kind==='mode'&&/複製技能/.test(pr)){ let best=null,bi=999; p.options.forEach((o)=>{ const k=PREF.indexOf(o.label); if(k>=0&&k<bi){ bi=k; best=o; } }); if(best){ H.L('複製技能: 選 '+best.label); return [best.i]; } } return null; } }); });
  // 孔融: 自己回合, 手牌 >=3 且 (受傷 或 手牌 >=5) 時重鑄全部手牌 (黑: 抽 1, 紅: 回 1 血); 數量選最多
  B.layer('孔融',{ decide(s,p,H){ const pr=p.prompt||''; const m=H.me(s);
    if(/孔融-重鑄手牌: 選擇張數/.test(pr)){ const nums=p.options.map(o=>({i:o.i,v:H.numOf(o)})).sort((a,b)=>a.v-b.v); return [nums[nums.length-1].i]; }
    if(p.kind==='skill'&&s.cur===s.viewer&&!/即將受到|使用了|要接連鎖|對你使用/.test(pr)){ const o=p.options.find(x=>/孔融-重鑄/.test(x.label||'')&&/^使用|^發動/.test(x.label||'')); const hand=(m.hand||[]).length; if(o&&hand>=3&&(m.hp<m.maxhp||hand>=5)){ H.L('孔融: 重鑄手牌 (手牌 '+hand+', 血 '+m.hp+'/'+m.maxhp+')'); return [o.i]; } }
    return null; } });
  // 劉備: 3 個「仁」=不會成為殺的對象; 盡量用多餘錦囊換仁, 自己/隊友急需回血時用仁回血
  const keepTricks=/^(無中生有|強化|反擊|調虎離山|占卜|無懈可擊|火攻|決鬥|南蠻入侵|萬箭齊發|突襲|飢餓|發憤圖強|鐵索連環|偽裝)$/;
  B.layer('劉備',{ act(s,p,cands,H){ const m=H.me(s); const lord=H.lordOf(s); const team=m.role==='主公'||m.role==='忠臣'; const allyLow=m.hp<=2||(team&&lord&&lord.alive&&lord.hp<=2);
    let ren=0; const mk=m.marks; if(mk&&typeof mk==='object'){ const v=mk['仁']!=null?mk['仁']:Object.values(mk).find(x=>typeof x==='number'); if(typeof v==='number') ren=v; } else { for(const l of B.cur.slice().reverse()){ const t=/獲得 1 個仁 \(共 (\d+)\)/.exec(l); if(t){ ren=+t[1]; break; } } }
    const tricks=(m.hand||[]).filter(c=>c.kind==='trick'); const spare=tricks.filter(c=>!keepTricks.test(H.full(c))).length;
    const extra=[];
    const heal=p.options.filter(o=>!o.card&&o.label&&o.label.includes('劉備')&&/回血|回復|仁回/.test(o.label));
    if(heal.length&&allyLow&&ren>=1){ let best=null,bs=-1e9; for(const o of heal){ const i=H.pIdx(o); if(i==null) continue; const q=s.players[i]; const sc=(100-q.hp*10)+(i===s.viewer?5:0)+(q.role==='主公'?8:0); if(sc>bs){bs=sc;best=o;} } if(best){ H.L('劉備: 用仁回血 → '+best.label+' (仁 '+ren+')'); extra.push({pri:150,o:best,n:best.label}); } }
    const get=p.options.filter(o=>!o.card&&/棄錦囊得仁/.test(o.label||'')); if(get.length&&((ren<3&&(spare>=1||tricks.length>=3))||(allyLow&&tricks.length>=1))){ extra.push({pri:88,o:get[0],n:get[0].label}); }
    return extra.concat(cands.filter(c=>!/棄錦囊得仁/.test(c.n||''))); } });
  // 呂蒙: 這回合沒出殺就不用棄牌 => 不出殺 (除非能直接殺死人), 手牌全留著
  B.layer('呂蒙',{ act(s,p,cands,H){ const kill=H.enemies(s).some(q=>q.hp<=1); if(kill||B.lethal) return null; return cands.filter(c=>!(c.o&&c.o.card&&H.isSha(H.full(c.o.card)))); } });
  return 'patch b9 loaded (孔融/劉備/呂蒙 專屬策略 + 複製技能選擇)'; }