async function(){ const B=window.SGSBOT;
  /* 全部武將 (outermost): 傷害相關 3 條: 1) (反擊/調虎離山)+發憤圖強 在手時除非致死硬吃傷害留爆發 2) 敵人要受傷且我有強化 -> 幫傷害來源上強化 3) 自己要受傷且有弱化 -> 幫來源上弱化 (來源不是自己, 優先度最低) */
  (B.roster||[]).forEach((c)=>{ B.layer(c,{ decide(s,p,H){ const pr=p.prompt||''; if(p.kind!=='skill'||!/即將受到/.test(pr)) return null; const mt=/P(\d)\([^)]*\) 即將受到 (\d+) 點傷害/.exec(pr); if(!mt) return null; const victim=+mt[1], N=+mt[2]; const m=H.me(s); const lord=H.lordOf(s);
      const opt=(name,tgt)=>p.options.find(o=>o.card&&H.full(o.card)===name&&(tgt==null||H.pIdx(o)===tgt));
      const planHold=H.has(m,'發憤圖強')>0&&(H.has(m,'反擊')+H.has(m,'調虎離山'))>0;
      if(victim===s.viewer){ const selfDmg=(s.cur===s.viewer&&B.sbPhase===s.round); if(selfDmg||m.char==='蔣幹') return null;
        const lethal=N>=m.hp; const hasR=!!(opt('反擊')||opt('調虎離山'));
        if(lethal){ if(hasR||opt('占卜')) return null; if(s.cur!==s.viewer){ const ww=opt('弱化',s.cur); if(ww){ H.L('弱化: 致死傷害, 幫 P'+s.cur+' 上弱化'); return [ww.i]; } } return null; }
        if(planHold){ const bl=p.options.find(x=>!x.card&&/曹真/.test(x.label||'')&&/^使用|^發動/.test(x.label||'')); if(bl) return [bl.i];
          if(s.cur!==s.viewer){ const ww=opt('弱化',s.cur); if(ww){ H.L('弱化: 幫 P'+s.cur+' 上弱化 (硬吃 '+N+' 點留爆發)'); return [ww.i]; } }
          const no=H.passOpt(p); H.L('發憤圖強+轉傷牌在手: 硬吃 '+N+' 點傷害 (血 '+m.hp+') 留爆發'); return no?[no.i]:null; }
        if(hasR&&H.enemies(s).length) return null;
        if(s.cur!==s.viewer&&N>=1){ const ww=opt('弱化',s.cur); if(ww){ H.L('弱化: 幫 P'+s.cur+' 的傷害上弱化 (自己受 '+N+' 點)'); return [ww.i]; } }
        return null; }
      if(H.targetScore(s,victim)>-100&&!planHold){ const src=s.cur; const allySrc=(src===s.viewer)||(lord&&src===lord.idx&&(m.role==='主公'||m.role==='忠臣')); if(allySrc){ const q=opt('強化',src); if(q){ H.L('強化: 幫 P'+src+' 對 P'+victim+' 的傷害上強化'); return [q.i]; } } }
      return null; } }); });
  return 'patch b18 loaded (硬吃留爆發 / 幫來源上強化 / 自己受傷上弱化)'; }