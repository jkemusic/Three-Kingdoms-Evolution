async function(){ const B=window.SGSBOT;
  /* 劉備 瀕死連鎖: 有人瀕死 (體力<=0) 時被詢問是否用仁救人 → 救自己/隊友; 沒有仁就先棄錦囊得仁; 敵人瀕死不救 */
  B.layer('劉備',{ decide(s,p,H){ if(p.kind==='act'||!p.options) return null; const heal=p.options.filter(o=>/仁回血/.test(o.label||'')); const get=p.options.filter(o=>/棄錦囊得仁/.test(o.label||'')); if(!heal.length&&!get.length) return null;
      const m=H.me(s); const en=new Set(H.enemies(s).map(q=>q.idx!=null?q.idx:s.players.indexOf(q)));
      const dying=(o)=>{ const i=H.pIdx(o); if(i==null) return false; const q=s.players[i]; return q&&q.alive!==false&&q.hp<=0&&(i===s.viewer||!en.has(i)); };
      const h=heal.filter(dying)[0]; if(h){ H.L('劉備: 有人瀕死, 用仁救 → '+h.label); return [h.i]; }
      const anyDying=s.players.some((q,i)=>q&&q.alive!==false&&q.hp<=0&&(i===s.viewer||!en.has(i)));
      if(anyDying&&get[0]&&(m.hand||[]).some(c=>c.kind==='trick')){ H.L('劉備: 有人瀕死但沒有仁, 先棄錦囊得仁'); return [get[0].i]; }
      return null; } });
  return 'patch b21 loaded (劉備 瀕死連鎖用仁救人)'; }