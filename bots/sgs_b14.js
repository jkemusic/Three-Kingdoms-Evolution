async function(){ const B=window.SGSBOT;
  // 呂蒙: 瀕死時自動判定 5 次 (紅回血/黑抽牌, 一回合一次)。自己這個回合技能還沒觸發過時, 發憤圖強有轉傷牌 (反擊/調虎離山) 就可以自傷到 0 血 (少棄上限 = 血量, 不是 血量-1), 多轉 1 點傷害出去; 技能用過就照常 血量-1
  B.layer('呂蒙',{ decide(s,p,H){ const pr=p.prompt||''; if(!/發憤圖強-少棄/.test(pr)) return null; const m=H.me(s); if(m.chained) return null;
    const red=H.redirectCnt(m); if(!(red>0&&H.enemies(s).length>0)) return null;
    let st=-1; for(let i=B.cur.length-1;i>=0;i--){ if(/^--- 第\d+輪 P(\d)\(/.test(B.cur[i].trim())&&+/^--- 第\d+輪 P(\d)/.exec(B.cur[i].trim())[1]===s.viewer){ st=i; break; } }
    const used=st>=0&&B.cur.slice(st).some(l=>/\[呂蒙\]\s*判定五次/.test(l));
    const opts=p.options.map(o=>({i:o.i,k:(/扣 (\d+) 點/.exec(o.label)||[0,0])[1]*1})).sort((a,b)=>a.k-b.k); const maxK=opts[opts.length-1].k;
    const cap=used?Math.max(0,m.hp-1):m.hp; const pick=opts.filter(x=>x.k<=cap).pop()||opts[0];
    H.L('呂蒙: 發憤圖強 少棄 '+pick.k+'/'+maxK+' (血 '+m.hp+', 瀕死技能'+(used?'本回合已用':'可用')+', 轉傷牌 '+red+')'); return [pick.i]; } });
  return 'patch b14 loaded (呂蒙: 瀕死技能可用時發憤圖強可自傷到 0 血)'; }