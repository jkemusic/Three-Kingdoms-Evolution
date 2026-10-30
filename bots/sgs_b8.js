async function(){ const B=window.SGSBOT; const DELAY=/^(樂不思蜀|兵糧寸斷|閃電|毒|草木皆兵)$/; B.trk={round:-1,n:0};
  (B.roster||[]).forEach((c)=>{ B.layer(c,{ act(s,p,cands,H){ const m=H.me(s); const others=s.players.filter(q=>q.idx!==s.viewer&&q.alive).map(q=>q.char); const den=others.includes('鄧艾'), cc=others.includes('曹沖'), mh=m.char==='孟獲'; if(!den&&!cc&&!mh) return null;
      if(B.trk.round!==s.round) B.trk={round:s.round,n:0};
      const isTrick=(x)=>x&&x.o&&x.o.card&&x.o.card.kind==='trick'&&!DELAY.test(H.full(x.o.card));
      const hand=m.hand||[]; const shan=H.has(m,'閃'); const last=(m.char==='諸葛亮'&&hand.length===1); const safe=(m.hp>=3)||(m.hp===2&&shan>=1);
      // 鄧艾: 別人 (非延時) 錦囊 -1 血 (可閃); 曹沖: 每回合第 2 張起每張 -1 血 (可閃); 孟獲(我): 出過錦囊結束階段 -1 血。血量不夠就先不出錦囊 (手牌剩最後一張的諸葛亮除外: 打完手牌空 = 不扣血)
      const ok=(x)=>{ if(!isTrick(x)) return true; if(last) return true; if(den&&!safe) return false; if(cc&&B.trk.n>=1&&!safe) return false; if(mh&&m.hp<=2) return false; return true; };
      const out=cands.filter(ok); if(out.length&&isTrick(out[0])) B.trk.n++;
      if(out.length!==cands.length&&B._taxLog!==s.round){ B._taxLog=s.round; H.L('錦囊扣血武將在場 ('+(den?'鄧艾 ':'')+(cc?'曹沖 ':'')+(mh?'孟獲(我)':'')+') 血量 '+m.hp+(shan?' 有閃':'')+': 暫不出錦囊 '+(cands.length-out.length)+' 張'); }
      return out; } }); });
  return 'patch b8 loaded (鄧艾/曹沖在場或我是孟獲: 注意血量, 血低不出錦囊)'; }