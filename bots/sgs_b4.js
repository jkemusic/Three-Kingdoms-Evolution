async function(){ const B=window.SGSBOT; const names=B.roster||[]; B.sbPhase=-1;
  names.forEach((c)=>{ B.layer(c,{ decide(s,p,H){ const pr=p.prompt||''; if(/發憤圖強-少棄/.test(pr)) B.sbPhase=s.round;
    // 發憤圖強進行中 (待棄 owed>0) 別人對我打傷害 (含反擊轉過來): 只剩最後一張轉傷牌時扣著, 留給最後的自爆, 除非這點傷害會害死我
    if(p.kind==='skill'&&/即將受到/.test(pr)&&B.owed>0&&s.cur===s.viewer&&B.sbPhase!==s.round&&c!=='蔣幹'){ const v=/P(\d)\(/.exec(pr); const m=H.me(s); if(v&&+v[1]===s.viewer){ const N=+((/受到 (\d+) 點/.exec(pr)||[0,1])[1]); const red=H.redirectCnt(m); if(red<=1&&N<m.hp){ const no=H.passOpt(p); if(no){ H.L('發憤圖強進行中: 留著最後一張轉傷牌 (傷害 '+N+' < 血量 '+m.hp+')'); return [no.i]; } } } } return null; } }); });
  return 'patch b4 loaded (保留最後一張轉傷牌)'; }