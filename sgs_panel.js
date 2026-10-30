// 三國殺機器人控制面板 v2: 你負責「進房 / 參戰 / 接受邀請 / 開始 / 自動連打」, 出牌與選將由 SGSBOT 自己處理。
// 需要先載入 sgs_bot.js (window.SGSBOT)。在已登入的遊戲頁面內執行; 不讀取、不顯示任何 token / 密碼。
// v2 修正: 面板只更新文字/狀態, 不再每 1.5 秒整個重建 (按鈕不會閃爍或吃掉點擊, 局數輸入框不會被清掉);
//         自動連打預設開「公開房間」(其他人可以觀戰), 不再偷偷用單人房; 開始前清掉特訓用的暫存設定 (指定武將 / 對手 / 佇列)。
(() => {
  const old = window.SGSPANEL;
  const keepOld = old ? { auto: old.auto, autoAcc: old.autoAcc, join: old.join } : {};
  if (old && old.destroy) old.destroy();
  const B = window.SGSBOT;
  const P = window.SGSPANEL = Object.assign({ auto: true, autoAcc: false, join: true, ranked: true, pub: true, n: 10, speed: 0.35, lastClaim: 0, series: 0, snap: null, social: null, busy: false, timers: [] }, keepOld);
  const $e = (t, a, ...kids) => { const e = document.createElement(t); if (a) for (const k in a) { if (k === "style") Object.assign(e.style, a[k]); else if (k === "text") e.textContent = a[k]; else if (k.startsWith("on")) e[k] = a[k]; else if (a[k] === false || a[k] == null) continue; else e.setAttribute(k, a[k]); } kids.forEach((c) => e.append(c)); return e; };
  const css = $e("style", { text: `
#bp{position:fixed;top:64px;right:8px;z-index:9000;width:268px;background:rgba(24,12,20,.95);color:#f4e6ee;border:1px solid #e58ab4;border-radius:10px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.5)}
#bp .h{display:flex;justify-content:space-between;align-items:center;padding:6px 10px;cursor:pointer;font-weight:700;border-bottom:1px solid #5a2a43}
#bp .b{padding:8px 10px;display:flex;flex-direction:column;gap:6px;max-height:72vh;overflow:auto}
#bp.c .b{display:none}
#bp button{background:#3a1d2d;color:#f4e6ee;border:1px solid #e58ab4;border-radius:6px;padding:5px 8px;cursor:pointer;font:inherit;text-align:left}
#bp button.p{background:#c64d86;border-color:#ffb3d4}
#bp button:disabled{opacity:.4;cursor:default}
#bp .r{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
#bp .m{color:#c9a9ba;font-size:12px}
#bp hr{border:0;border-top:1px solid #5a2a43;margin:2px 0;width:100%}
#bp input[type=number],#bp select{background:#1a0d15;color:#f4e6ee;border:1px solid #e58ab4;border-radius:4px;padding:2px 4px;font:inherit}
#bp input[type=number]{width:56px}
#bp label{display:flex;gap:4px;align-items:center}
` });
  const root = $e("div", { id: "bp" });
  const tog = $e("span", { text: "—" });
  const head = $e("div", { class: "h" }, $e("span", { text: "🤖 機器人控制" }), tog);
  const body = $e("div", { class: "b" });
  root.append(head, body);
  head.onclick = () => { root.classList.toggle("c"); tog.textContent = root.classList.contains("c") ? "＋" : "—"; };
  document.head.append(css); document.body.append(root);
  const say = (m) => { try { toast(m); } catch (e) {} };
  const nick = () => (typeof myNick === "function" ? myNick() : "");
  const freeSeat = (s) => (s.humans || []).find((i) => !(s.claims || []).includes(i));
  const phase = (s) => !s || (!s.players && !s.lobby) ? "—" : s.over ? "已結束" : s.lobby ? "大廳 (等待開始)" : s.pick || s.picking ? "選將中" : s.ready ? "進行中" : "—";

  // ---------- 靜態元件 (只建一次, 之後只改文字 / 狀態) ----------
  const stRoom = $e("div", { class: "m" }), stMe = $e("div", { class: "m" }), stBot = $e("div", { class: "m" });
  const bJoin = $e("button", { onclick: async () => { P.join = !P.join; const sn = P.snap || {}; if (sn.lobby) { if (P.join) { const f = freeSeat(sn); if (sn.mine == null && f != null) await api("/api/claim", { seat: f, name: nick() }); } else if (sn.mine != null) await api("/api/claim", { seat: null }); } tick(); } });
  const bAuto = $e("button", { onclick: () => { P.auto = !P.auto; if (!P.auto && B.running && !P.series) B.stop(); update(); } });
  const bAcc = $e("button", { onclick: () => { P.autoAcc = !P.autoAcc; update(); } });
  const invT = $e("div", { class: "m" });
  const invBox = $e("div", { class: "r", style: { flexDirection: "column", alignItems: "stretch" } });
  let invKey = "";
  const bSeat = $e("button", { onclick: async () => { const s = P.snap || {}; if (s.mine != null) await api("/api/claim", { seat: null }); else { const f = freeSeat(s); if (f == null) { say("座位已滿"); return; } await api("/api/claim", { seat: f, name: nick() }); } tick(); } });
  const bStart = $e("button", { class: "p", text: "開始遊戲", onclick: async () => { const r = await api("/api/start", {}); if (r && r.ok === false) say(r.error || "不能開始"); tick(); } });
  const lobbyNote = $e("div", { class: "m" });
  const lobbyBox = $e("div", { class: "r", style: { flexDirection: "column", alignItems: "stretch" } }, $e("hr"), $e("div", { class: "m", text: "大廳" }), bSeat, bStart, lobbyNote);
  const bRematch = $e("button", { text: "🔁 再來一局", onclick: async () => { const r = await api("/api/rematch", {}); if (r && r.ok === false) say(r.error || "不能再來一局"); tick(); } });
  // 自動連打
  const selType = $e("select", { onchange: () => { P.ranked = selType.value === "ranked"; } }, $e("option", { value: "ranked", text: "🏅 段位" }), $e("option", { value: "casual", text: "🎮 休閒" }));
  const inN = $e("input", { type: "number", min: "1", max: "100", value: String(P.n), oninput: () => { P.n = Math.max(1, +inN.value || 10); } });
  const cbPub = $e("input", { type: "checkbox", onchange: () => { P.pub = cbPub.checked; } });
  const selSpd = $e("select", { onchange: () => { P.speed = +selSpd.value; } }, $e("option", { value: "0.15", text: "快" }), $e("option", { value: "0.35", text: "一般" }), $e("option", { value: "0.6", text: "慢 (適合觀戰)" }));
  const bRun = $e("button", { class: "p", text: "▶ 開始自動連打", onclick: () => startAuto() });
  const bStop = $e("button", { text: "⏹ 打完這局後停止", onclick: () => { B.cfg.autoNext = false; P.series = 0; say("打完目前這局後停止"); update(); } });
  const bLobby = $e("button", { text: "🚪 回大廳", onclick: () => { const b = document.getElementById("bRooms"); if (b) b.click(); } });
  const run = $e("div", { class: "r", style: { flexDirection: "column", alignItems: "stretch" } },
    $e("div", { class: "m", text: "自動連打 (自己開房, 機器人出牌)" }),
    $e("div", { class: "r" }, selType, $e("span", { text: "局數" }), inN),
    $e("label", {}, cbPub, $e("span", { text: "公開房間 (其他人可進來觀戰)" })),
    $e("div", { class: "r" }, $e("span", { text: "速度" }), selSpd),
    bRun, bStop, bLobby);
  body.append(stRoom, stMe, stBot, $e("hr"), bJoin, bAuto, $e("div", { class: "m", text: "自動出牌開啟時, 只要我在對局中, 機器人就幫我選將和出牌。" }), $e("hr"), invT, invBox, bAcc, lobbyBox, $e("hr"), bRematch, run);

  async function acceptInvite(inv, accept) {
    try {
      const r = await api("/api/invite_reply", { id: inv.id, accept });
      const d = document.getElementById("invdlg"); if (d) d.remove();
      if (!r.ok) { say(r.error || "邀請已失效"); return; }
      if (accept && r.room) { enterRoom(r.room, r.rname); say("已加入房間「" + (r.rname || "") + "」"); }
    } catch (e) { say("邀請處理失敗: " + e); }
  }
  function resetCfg() {   // 清掉特訓用的暫存設定, 避免強制武將 / 對手 / 佇列混進正式對局
    B.cfg.queue = null; B.cfg.vs = null; B.cfg.forceChar = null; B.cfg.lord = null; B.cfg.queueLord = null; B.cfg.useRotate = false; B.cfg.seeds = null;
    if (B._capTimer) { clearInterval(B._capTimer); B._capTimer = null; }
  }
  async function startAuto() {
    try {
      if (B.running) { say("機器人正在對局中, 請先等這局結束或按「打完這局後停止」"); return; }
      const n = Math.max(1, +inN.value || P.n || 10), ranked = selType.value === "ranked";
      const pub = cbPub.checked;
      const payload = pub ? { tok: TOK, name: (ranked ? "段位練習" : "休閒練習") + " (LoneAChess)", password: "", cap: 0 } : { tok: TOK, name: "單人模式", solo: true };
      const r = await (await fetch("/api/room_create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })).json();
      if (!r.ok) { say("開房失敗: " + r.error); return; }
      enterRoom(r.room, r.name);
      resetCfg();
      B.stats = { games: 0, wins: 0, losses: 0, errors: 0, answered: 0, byChar: {}, byRole: {}, rpStart: null, rpNow: null };
      B.cfg.ranked = ranked; B.cfg.autoNext = true; B.cfg.maxGames = n; B.cfg.difficulty = 1; P.series = n; P.auto = true; P.speed = +selSpd.value;
      B.start(); say((ranked ? "段位" : "休閒") + "連打 " + n + " 局開始" + (pub ? " (公開房間, 可觀戰)" : " (單人房)"));
    } catch (e) { say("開始失敗: " + e); }
  }
  // 自動連打時, /api/new 套用觀戰速度 (只裝一次)
  if (!window.__panelSpeedWrap) { const prev = window.api; window.api = async function (path, body) { if (typeof path === "string" && path === "/api/new" && body && window.SGSPANEL && window.SGSPANEL.series) body = Object.assign({}, body, { speed: window.SGSPANEL.speed || body.speed }); return prev.call(this, path, body); }; window.__panelSpeedWrap = true; }

  function update() {
    const s = P.snap || {}, d = P.social || {}, m = s.players && s.viewer != null ? s.players[s.viewer] : null;
    stRoom.textContent = "房間: " + (ROOM || "(大廳)") + " ｜ " + phase(s) + (s.ranked ? " ｜ 段位局" : "");
    stMe.textContent = m ? "我: 座位 " + s.viewer + " ｜ " + (m.role || "?") + " ｜ " + (m.char || "?") + " ｜ 體力 " + m.hp : "我: 觀戰 / 尚未入座";
    stBot.textContent = "機器人: " + (B.running ? "運作中" : "待命") + " ｜ " + B.stats.wins + "勝" + B.stats.losses + "敗" + (P.series ? " ｜ 連打剩 " + Math.max(0, B.cfg.maxGames - B.stats.games) + " 局" : "") + (B.stats.rpNow ? " ｜ rp " + B.stats.rpNow.rp + " " + B.stats.rpNow.rank : "");
    bJoin.textContent = P.join ? "⚔ 模式: 參戰 (進大廳自動入座)" : "👁 模式: 觀戰"; bJoin.className = P.join ? "p" : "";
    bAuto.textContent = P.auto ? "🤖 自動出牌: 開" : "🤖 自動出牌: 關 (我手動)"; bAuto.className = P.auto ? "p" : "";
    bAcc.textContent = P.autoAcc ? "✅ 自動接受邀請: 開" : "自動接受邀請: 關"; bAcc.className = P.autoAcc ? "p" : "";
    const inv = d.invites || []; const key = inv.map((v) => v.id).join(",") + "|" + !!d.busy;
    invT.textContent = "邀請" + (inv.length ? " (" + inv.length + ")" : " (無)");
    if (key !== invKey) { invKey = key; invBox.textContent = ""; inv.forEach((v) => invBox.append($e("div", { class: "r" }, $e("span", { text: v.from + " →「" + (v.rname || "房間") + "」" }), $e("button", { class: "p", text: "加入", disabled: !!d.busy, onclick: () => acceptInvite(v, true) }), $e("button", { text: "拒絕", onclick: () => acceptInvite(v, false) })))); }
    lobbyBox.style.display = s.lobby ? "" : "none";
    if (s.lobby) { const seated = s.mine != null; bSeat.textContent = seated ? "⚔ 已參戰 (點擊取消)" : "⚔ 我要參戰"; bSeat.className = seated ? "" : "p"; bStart.disabled = !s.is_host; lobbyNote.textContent = s.is_host ? "" : "只有房主能按開始" + (s.host_name ? " (房主: " + s.host_name + ")" : ""); }
    bRematch.style.display = (s.over && !s.lobby) ? "" : "none";
    bRun.disabled = !!B.running; bStop.disabled = !B.running;
    if (document.activeElement !== inN) inN.value = String(P.n); if (document.activeElement !== selType) selType.value = P.ranked ? "ranked" : "casual"; cbPub.checked = !!P.pub; if (document.activeElement !== selSpd) selSpd.value = String(P.speed);
    if (!B.running && P.series && B.stats.games >= B.cfg.maxGames) P.series = 0;
  }
  async function tick() {
    if (P.busy) return; P.busy = true;
    try {
      const s = await api("/api/state?log=99999999&th=99999999&peek=0&chat=0");
      if (s && (s.players !== undefined || s.lobby)) P.snap = s;
      try { const d = await (await fetch("/api/social?tok=" + encodeURIComponent(TOK))).json(); if (d && d.ok) P.social = d; } catch (e) {}
      const inv = P.social && P.social.invites || [];
      if (P.autoAcc && inv.length && !P.social.busy) await acceptInvite(inv[0], true);
      const sn = P.snap || {};
      if (P.join && sn.lobby && sn.mine == null && Date.now() - P.lastClaim > 2500) {   // 參戰模式: 進大廳自動按「我要參戰」
        const f = freeSeat(sn); P.lastClaim = Date.now();
        if (f != null) { const r = await api("/api/claim", { seat: f, name: nick() }); if (r && r.ok !== false) say("已自動參戰"); }
      }
      const live = !sn.over && (sn.pick || (sn.players && sn.ready && sn.viewer != null));
      if (P.auto && live && !B.running) { if (!P.series) B.cfg.autoNext = false; B.start(); }
      update();
    } catch (e) {} finally { P.busy = false; }
  }
  P.tick = tick; P.update = update;
  P.timers.push(setInterval(() => { if (!document.getElementById("bp")) { document.head.append(css); document.body.append(root); } tick(); }, 1500));
  // 選將畫面: 快速偵測 (有倒數), 一出現就叫機器人起來選
  P.timers.push(setInterval(async () => { try { if (!P.auto || B.running) return; const s = await api("/api/state?log=99999999&th=99999999&peek=0&chat=0"); if (s && s.pick && !s.over) { P.snap = s; if (!P.series) B.cfg.autoNext = false; B.start(); } } catch (e) {} }, 700));
  // 結算視窗 (勝利 / 落敗 / 段位變動) 自動按「確定」
  P.timers.push(setInterval(() => { try { const b = document.querySelector("#cardinfo .dlg.rankup button.primary"); if (b && !b.dataset.clicked) { b.dataset.clicked = "1"; setTimeout(() => b.click(), 900); } } catch (e) {} }, 500));
  P.destroy = () => { P.timers.forEach(clearInterval); root.remove(); css.remove(); };
  update(); tick();
})();
