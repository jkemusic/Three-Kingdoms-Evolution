async function(){ const B=window.SGSBOT;
  /* b27: A 組主動技能 v1 (使用者 2026-10-30)
     司馬懿-奪牌 (放棄抽牌改抽別人一張手牌): 手牌 > 3 發動, 否則不發動; 場上只剩 2 人 (單挑) 且對方手牌 >= 2 也發動
     曹植 (每回合一次, 其他人手牌隨機交換): 一定發動
     公孫淵 (每回合一次, 展示手牌後抽 2 張): 一定發動 */
  const gid=()=>B.history.length;
  const tries={};
  const useSkill=(name)=>(s,p,cands,H)=>{
    const m=H.me(s); if(!m||m.flipped||!p||p.kind!=='act') return null;
    const o=(p.options||[]).find((x)=>x.label&&x.label.indexOf('〈'+name)===0);
    if(!o) return null;
    const k=name+':'+gid()+':'+s.round; tries[k]=(tries[k]||0)+1; if(tries[k]>2) return null;
    H.L(name+': 主動技能 → '+o.label);
    return [{pri:250,o,n:name+'技能'}].concat(cands);
  };
  B.layer('曹植',{ act:useSkill('曹植') });
  B.layer('公孫淵',{ act:useSkill('公孫淵') });
  B.layer('司馬懿',{ decide(s,p,H){
    const m=H.me(s); if(!m||m.flipped||p.kind!=='skill'||!/^司馬懿-奪牌/.test(p.prompt||'')) return null;
    const hand=(m.hand||[]).length, alive=s.players.filter((q)=>q.alive).length;
    const yes=(p.options||[]).find((o)=>/^發動/.test(o.label||'')), no=(p.options||[]).find((o)=>/^不/.test(o.label||''));
    const opp=s.players.find((q)=>q.alive&&q.idx!==m.idx), duel=alive===2&&opp&&(opp.hand_n||0)>=2;
    const go=hand>3||duel;
    H.L('司馬懿-奪牌: 手牌 '+hand+', 存活 '+alive+(alive===2&&opp?', 對手手牌 '+opp.hand_n:'')+' → '+(go?'發動':'不發動'));
    const pick=go?yes:no; return pick?[pick.i]:null;
  } });
  return 'patch b27 loaded (司馬懿/曹植/公孫淵)'; }