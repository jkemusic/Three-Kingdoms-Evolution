async function(){ const B=window.SGSBOT, P=window.SGSPANEL;
  /* b26: 機器人控制面板加「排程訓練」區塊: 勾選要排的訓練, 按「啟用排程」才開始 (自己開公開房間, 不碰使用者正在用的房間); 結果存 B.sched.res / localStorage sgs_sched_res */
  const $e=(t,a,...kids)=>{ const e=document.createElement(t); if(a) for(const k in a){ if(k==='style') Object.assign(e.style,a[k]); else if(k==='text') e.textContent=a[k]; else if(k.startsWith('on')) e[k]=a[k]; else if(a[k]===false||a[k]==null) continue; else e.setAttribute(k,a[k]); } kids.forEach((c)=>e.append(c)); return e; };
  const say=(m)=>{ try{ toast(m); }catch(e){} };
  const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms));
  const F=B.H.full;
  const S=B.sched=Object.assign(B.sched||{},{ running:false, cancel:false, status:'待命 (尚未啟用)', res:(B.sched&&B.sched.res)||[], prog:'', seed:100000+Math.floor(Math.random()*500000) });
  let sel={}; try{ sel=JSON.parse(localStorage.getItem('sgs_sched_sel')||'{}')||{}; }catch(e){}
  const saveSel=()=>{ try{ localStorage.setItem('sgs_sched_sel',JSON.stringify(sel)); }catch(e){} };
  const saveRes=()=>{ try{ localStorage.setItem('sgs_sched_res',JSON.stringify(S.res).slice(0,200000)); }catch(e){} };
  async function newRoom(name){ const r=await (await fetch('/api/room_create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tok:TOK,name,password:'',cap:0})})).json(); if(!r.ok) throw new Error('開房失敗: '+r.error); enterRoom(r.room,r.name); await sleep(1200); return r.room; }
  async function waitBotDone(maxMs){ const t0=Date.now(); await sleep(2500); while(B.running&&Date.now()-t0<maxMs) await sleep(2000); return !B.running; }
  const resetBot=()=>{ B.logN=0;B.thN=0;B.lastId=-1;B.tries={};B.me=null;B.reflectN=0;B.susp={};B.lethal=false;B.lethalInfo=null;B.owed=0;B.turnRound=-1;B.cur=[];B.disg=null;B.cts=null;B.jd=null; };
  const ATK=/殺$|^決鬥$|^火攻$|^笑裡藏刀$/, WR={'麒麟弓':5,'孔雀羽扇':4,'方天畫戟':4,'青龍偃月刀':3,'丈八蛇矛':3,'貫石斧':3,'寒冰劍':2,'流星錘':2,'青釭劍':2};
  const jobs=[
    { id:'jd', name:'偽裝對蔣幹: 劉禪/呂布 各 3 場 (蔣幹不是主公、坐對面, 優先挑手上有 -1馬/武器的開局)', def:true,
      async run(){
        const plan=['劉禪','呂布','劉禪','呂布','劉禪','呂布'];
        await newRoom('排程訓練 (LoneAChess)');
        for(let n=0;n<plan.length&&!S.cancel;n++){
          const as=plan[n]; B.jdForce=as; S.prog='偽裝對蔣幹 第 '+(n+1)+'/'+plan.length+' 場 ('+as+') 找開局中';
          let found=null; const t0=Date.now();
          while(!found&&!S.cancel&&Date.now()-t0<240000){
            const needEq=(Date.now()-t0)<150000;   // 前 150 秒只挑有 -1馬/武器的開局, 找不到再放寬
            for(let k=0;k<15&&!found;k++){
              const seed=S.seed++;
              await api('/api/new',{players:4,human:'0',humans:[0],chars:['荀彧','黃忠','蔣幹','孫策'],variant:0,lord:'1',mode:'normal',role_mode:'normal',base_hp:4,ranked:false,difficulty:2,diffs:[],seed:String(seed),speed:0.15});
              const s=await api('/api/state?log=0&chat=0&peek=0'); const me=(s.players||[])[s.viewer]; if(!me) continue;
              const nm=(me.hand||[]).map((c)=>F(c)); const sha=nm.filter((x)=>/殺$/.test(x)).length, atk=nm.filter((x)=>ATK.test(x)).length;
              const eq=nm.some((x)=>x==='-1馬'||WR[x]>=2);
              if(me.role==='反賊'&&nm.some((x)=>/偽裝/.test(x))&&(as==='呂布'?sha>=1:atk>=1)&&(!needEq||eq)) found={seed,hand:nm.join(',')};
            }
            await sleep(30);
          }
          if(!found){ S.res.push({job:'jd',as,err:'找不到合適開局'}); continue; }
          S.prog='偽裝對蔣幹 第 '+(n+1)+'/'+plan.length+' 場 ('+as+') 對局中';
          P.auto=false; B.cfg.ranked=false; B.cfg.autoNext=false; B.cfg.queue=null; resetBot(); const li=B.logs.length; B.start();
          const done=await waitBotDone(15*60000); if(!done){ B.running=false; }
          const L=B.logs.slice(li); const g=B.games[B.games.length-1]||{};
          S.res.push({job:'jd',as,seed:found.seed,hand:found.hand,over:(L.filter((l)=>/game over/.test(l)).pop()||null),pl:g.pl,tactic:L.filter((l)=>/偽裝|被翻面/.test(l)).slice(0,16)}); saveRes();
        }
        B.jdForce=null;
      } },
    { id:'kr', name:'孔融重練 5 場 (偽裝重鑄時保留)', def:false,
      async run(){
        S.prog='孔融重練 開房中'; B.stats={games:0,wins:0,losses:0,errors:0,answered:0,byChar:{},byRole:{},rpStart:null,rpNow:null};
        await B.startQueue([{c:'孔融',need:99,max:5}]); B.cfg.maxGames=5;
        const t0=Date.now(); while(!S.cancel&&Date.now()-t0<60*60000){ const e=(B.qstats||{})['孔融']||{g:0,w:0}; S.prog='孔融重練 '+e.g+'/5 場 ('+e.w+' 勝)'; if(e.g>=5&&!B.running) break; await sleep(3000); }
        B.cfg.autoNext=false; B.cfg.queue=null; P.series=0; P.auto=false;
        if(S.cancel){ while(B.running) await sleep(2000); }
        S.res.push({job:'kr',qstats:JSON.stringify(B.qstats||{})}); saveRes();
      } }
  ];
  jobs.forEach((j)=>{ if(sel[j.id]===undefined) sel[j.id]=j.def; });
  S.start=async()=>{
    if(S.running) return;
    if(B.running){ say('機器人正在對局中, 請先停止再啟用排程'); return; }
    const todo=jobs.filter((j)=>sel[j.id]); if(!todo.length){ say('沒有勾選任何排程'); return; }
    S.running=true; S.cancel=false; S.res=[]; P.auto=false; P.series=0; B.cfg.autoNext=false; B.cfg.queue=null; render();
    try{ B.strat={}; for(const i of [2,4,5,6,7,8,9,10,11,12,13,14,15,16,18,19,20,21,22,23,24,25]){ await (0,eval)('('+localStorage.getItem('sgs_b'+i)+')')(); } }catch(e){ S.running=false; S.status='載入策略失敗: '+e; render(); return; }   // 用最新存檔的策略 (含 b25 裝備縮距)
    try{ for(const j of todo){ if(S.cancel) break; S.status='執行中: '+j.name; render(); await j.run(); } S.status=S.cancel?'已取消':'排程完成 (結果在 B.sched.res)'; S.prog=''; }
    catch(e){ S.status='排程出錯: '+e; }
    finally{ S.running=false; B.jdForce=null; B.cfg.autoNext=false; saveRes(); render(); say(S.status); }
  };
  S.stop=()=>{ S.cancel=true; B.cfg.autoNext=false; S.status='取消中 (打完目前這局後停止)'; render(); };
  const old=document.getElementById('bpSched'); if(old) old.remove();
  const box=$e('div',{id:'bpSched',class:'r',style:{flexDirection:'column',alignItems:'stretch'}});
  const stT=$e('div',{class:'m'}), stP=$e('div',{class:'m'});
  const btn=$e('button',{class:'p',onclick:()=>{ if(S.running) S.stop(); else S.start(); }});
  box.append($e('hr'),$e('div',{class:'m',text:'📅 排程訓練 (按「啟用排程」才會自動開始)'}));
  jobs.forEach((j)=>{ const cb=$e('input',{type:'checkbox',onchange:()=>{ sel[j.id]=cb.checked; saveSel(); }}); cb.checked=!!sel[j.id]; box.append($e('label',{},cb,$e('span',{text:j.name}))); });
  box.append(stT,stP,btn);
  function render(){ stT.textContent='狀態: '+S.status; stP.textContent=S.prog||''; btn.textContent=S.running?'⏹ 取消排程 (打完這局後停止)':'▶ 啟用排程 (立刻自動開始)'; btn.className=S.running?'':'p'; }
  const body=document.querySelector('#bp .b'); if(!body) throw new Error('找不到機器人控制面板');
  body.append(box); render();
  if(S._rt) SGSWT.clearInterval(S._rt); S._rt=SGSWT.setInterval(()=>{ try{ render(); }catch(e){} },1500);
  return 'patch b26 loaded (排程訓練區塊)'; }
