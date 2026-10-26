/* 好友系統: 好友清單 / 好友請求 / 私訊 / 邀請到房間 (被邀請時如果在對戰中,等對戰結束才會問) */
(() => {
  const F = {data: null, dlg: null, chat: null, invOpen: false, seenUnread: {}, seenReq: -1, ready: false, busyTick: 0};
  const css = document.createElement("style");
  css.textContent = `
#bFr,#bFr2{position:relative}.fb{display:none;width:9px;height:9px;border-radius:50%;background:#ff3b4e;position:absolute;top:2px;right:2px}.fb.on{display:block}
#frdlg .tabs{display:flex;gap:6px;margin:12px 0 4px}#frdlg .tabs button{flex:1;padding:6px 4px;font-size:13px;position:relative}#frdlg .tabs .rd{display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff3b4e;margin-left:4px}
#frdlg .dlg{max-width:520px;display:flex;flex-direction:column;max-height:86vh;padding:0}
#frdlg .sec{margin:12px 0 4px;color:var(--dim);font-size:12px;letter-spacing:.5px}
#frdlg .addrow{display:flex;gap:8px;margin-top:10px}#frdlg .addrow input{flex:1;min-width:0}
#frdlg .frow{display:flex;align-items:center;gap:8px;padding:8px 6px;border-bottom:1px solid var(--line)}
#frdlg .frow .dot{width:9px;height:9px;border-radius:50%;background:#59657a;flex:none}
#frdlg .frow .dot.on{background:var(--green);box-shadow:0 0 6px var(--green)}
#frdlg .frow .nm{font-weight:600}#frdlg .frow .st{font-size:12px;color:var(--dim)}
#frdlg .frow .grow{flex:1;min-width:0}
#frdlg .frow button{padding:4px 9px;font-size:13px}
#frdlg .frow .ub{background:#ff5d73;color:#fff;border-radius:9px;font-size:11px;padding:0 6px;margin-left:4px}
#frdlg .msgs{height:46vh;overflow:auto;padding:6px 2px;display:flex;flex-direction:column;gap:6px}
#frdlg .msg{max-width:78%;padding:6px 10px;border-radius:10px;background:var(--panel2);word-break:break-word;white-space:pre-wrap}
#frdlg .msg.me{align-self:flex-end;background:var(--accent);color:#06121f}
#frdlg .msg small{display:block;font-size:10px;opacity:.6;margin-top:2px}
#frdlg .sendrow{display:flex;gap:8px;margin-top:8px}#frdlg .sendrow input{flex:1;min-width:0}
#invdlg .dlg{max-width:380px;text-align:center}#invdlg .btns{display:flex;gap:10px;justify-content:center;margin-top:14px}
`;
  document.head.append(css);

  const el = (tag, props, ...kids) => h(tag, props, ...kids);
  const post = async (path, body) => {
    try { return await (await fetch(path, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(Object.assign({tok: TOK, room: ROOM || "main"}, body))})).json(); }
    catch (e) { return {ok: false, error: "連線失敗"}; }
  };
  function fmtSeen(ts, now) {
    if (!ts) return "從未上線";
    const d = Math.max(0, (now || Date.now() / 1000) - ts);
    if (d < 60) return "剛剛";
    if (d < 3600) return Math.floor(d / 60) + " 分鐘前";
    if (d < 86400) return Math.floor(d / 3600) + " 小時前";
    return Math.floor(d / 86400) + " 天前";
  }
  const fmtTime = t => { const d = new Date(t * 1000); return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0"); };

  // ---------- 按鈕與徽章 ----------
  function mountBtn() {
    if (document.getElementById("bFr")) return;
    const anchor = document.getElementById("bBoard");
    if (!anchor) return;
    const b = el("button", {id: "bFr", title: "好友、私訊、邀請朋友進房間"}, "👥 好友", el("span", {class: "fb"}));
    b.onclick = openDlg;
    anchor.parentNode.insertBefore(b, anchor);
    const rb = document.querySelector("#rooms .rbox");   // 大廳畫面會蓋住上方工具列,大廳裡也放一顆
    if (rb && !document.getElementById("bFr2")) {
      const b2 = el("button", {id: "bFr2", title: "好友、私訊、邀請朋友進房間", style: {float: "right"}}, "👥 好友", el("span", {class: "fb"}));
      b2.onclick = openDlg;
      rb.insertBefore(b2, rb.firstChild);
    }
  }
  function badge() {
    const d = F.data; if (!d) return;
    const n = d.friends.reduce((s, f) => s + f.unread, 0) + d.req_in.length;   // 未讀私訊或待審核的好友請求 -> 紅點
    document.querySelectorAll("#bFr .fb, #bFr2 .fb").forEach(b => b.classList.toggle("on", n > 0));
  }

  // ---------- 輪詢 ----------
  async function poll() {
    if (!S.user) return;
    let d;
    try { d = await (await fetch("/api/social?tok=" + encodeURIComponent(TOK))).json(); } catch (e) { return; }
    if (!d || !d.ok) return;
    mountBtn();
    F.data = d; badge();
    // 新訊息 / 新請求提示
    for (const f of d.friends) {
      const prev = F.seenUnread[f.id] || 0;
      if (f.unread > prev && !(F.chat === f.id && F.dlg)) toast("💬 " + f.user + " 傳來私訊", "host");
      F.seenUnread[f.id] = f.unread;
    }
    if (F.seenReq >= 0 && d.req_in.length > F.seenReq) toast("👥 " + d.req_in[d.req_in.length - 1].user + " 想加你為好友", "host");
    F.seenReq = d.req_in.length;
    if (F.dlg) { if (F.chat) refreshChat(false); else renderList(); }
    // 邀請: 對戰中先不跳出來,對戰結束才問
    if (d.invites.length && !d.busy && !F.invOpen) showInvite(d.invites[0]);
  }

  // ---------- 邀請視窗 ----------
  function showInvite(inv) {
    F.invOpen = true;
    const close = () => { const m = document.getElementById("invdlg"); if (m) m.remove(); F.invOpen = false; };
    const reply = async accept => {
      const r = await post("/api/invite_reply", {id: inv.id, accept});
      close();
      if (!r.ok) { toast(r.error || "邀請已失效"); return; }
      if (accept && r.room) { const d = document.getElementById("frdlg"); if (d) d.remove(); F.dlg = null; enterRoom(r.room, r.rname); }
    };
    const dlg = el("div", {class: "dlg"},
      el("h3", {text: "🎮 房間邀請"}),
      el("p", {text: inv.from + " 邀請你加入房間「" + (inv.rname || "房間") + "」,要加入嗎?"}),
      el("div", {class: "btns"}, el("button", {text: "拒絕", onclick: () => reply(false)}), el("button", {class: "primary", text: "加入", onclick: () => reply(true)})));
    document.body.append(el("div", {class: "modal", id: "invdlg", style: {zIndex: 7600}}, dlg));
  }

  // ---------- 好友視窗 ----------
  function openDlg() {
    if (F.dlg) return;
    F.chat = null;
    const close = () => { const m = document.getElementById("frdlg"); if (m) m.remove(); F.dlg = null; F.chat = null; };
    const body = el("div", {class: "dbody", id: "frbody"});
    const dlg = el("div", {class: "dlg"},
      el("div", {class: "dh"}, el("div", {}, el("h3", {text: "👥 好友"})), el("button", {class: "x", text: "✕", onclick: close})),
      body);
    const m = el("div", {class: "modal", id: "frdlg", style: {zIndex: 7500}}, dlg);
    m.onclick = e => { if (e.target === m) close(); };
    document.body.append(m);
    F.dlg = m;
    renderList(true);
    poll();
  }

  function renderList(force) {
    const body = document.getElementById("frbody"); if (!body || F.chat) return;
    const d = F.data || {friends: [], req_in: [], req_out: [], now: Date.now() / 1000};
    const typing = body.querySelector("input");
    const keep = typing ? typing.value : "";
    const hadFocus = typing && document.activeElement === typing;
    body.textContent = "";
    const inp = el("input", {type: "text", maxlength: 20, placeholder: "輸入對方的 UID (8 位數字)", value: keep});
    const add = async () => {
      const r = await post("/api/friend_add", {name: inp.value});
      if (!r.ok) { toast(r.error || "失敗"); return; }
      toast(r.msg, "ok"); inp.value = ""; poll();
    };
    inp.onkeydown = e => { if (e.key === "Enter") add(); };
    const myUid = S.prof && S.prof.uuid;
    if (myUid) body.append(el("div", {class: "meta", style: {marginTop: "8px"}}, "我的 UID: ", el("b", {text: myUid}), " ",
      el("button", {text: "複製", style: {padding: "1px 8px", fontSize: "12px"}, onclick: e => { const b = e.target, ok = () => { b.textContent = "已複製"; }; if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(myUid).then(ok); else { const t = document.createElement("textarea"); t.value = myUid; document.body.append(t); t.select(); try { document.execCommand("copy"); ok(); } catch (x) {} t.remove(); } }}),
      "  (把這組 UID 給朋友,他就能加你)"));
    body.append(el("div", {class: "addrow"}, inp, el("button", {class: "primary", text: "加好友", onclick: add})));
    const tab = F.tab || "list";
    const T = (k, label, red) => el("button", {class: tab === k ? "primary" : "", onclick: () => { F.tab = k; renderList(true); }}, label, red ? el("span", {class: "rd"}) : "");
    body.append(el("div", {class: "tabs"}, T("list", "好友列表 (" + d.friends.length + ")", d.friends.some(f => f.unread)),
      T("out", "已送出 (" + (d.req_out || []).length + ")"), T("in", "待審核 (" + d.req_in.length + ")", d.req_in.length)));
    if (tab === "in") {
      if (!d.req_in.length) body.append(el("div", {class: "meta", style: {padding: "10px 4px"}, text: "沒有等待審核的好友請求。"}));
      for (const r of d.req_in) {
        body.append(el("div", {class: "frow"}, el("span", {class: "grow nm", text: r.user}),
          el("button", {class: "primary", text: "接受", onclick: async () => { const x = await post("/api/friend_accept", {name: r.id}); if (!x.ok) toast(x.error); poll(); }}),
          el("button", {text: "拒絕", onclick: async () => { await post("/api/friend_decline", {name: r.id}); poll(); }})));
      }
      if (hadFocus) inp.focus();
      return;
    }
    if (tab === "out") {
      if (!(d.req_out || []).length) body.append(el("div", {class: "meta", style: {padding: "10px 4px"}, text: "沒有已送出的好友請求。"}));
      for (const u of (d.req_out || [])) body.append(el("div", {class: "frow"}, el("span", {class: "grow nm", text: u}), el("span", {class: "st", text: "等對方接受"})));
      if (hadFocus) inp.focus();
      return;
    }
    if (!d.friends.length) body.append(el("div", {class: "meta", style: {padding: "10px 4px"}, text: "還沒有好友。輸入朋友的 UID 送出請求吧。"}));
    for (const f of d.friends) {
      const prev = F.seenUnread[f.id] || 0;
      if (f.unread > prev && !(F.chat === f.id && F.dlg)) toast("💬 " + f.user + " 傳來私訊", "host");
      F.seenUnread[f.id] = f.unread;
    }
    if (F.seenReq >= 0 && d.req_in.length > F.seenReq) toast("👥 " + d.req_in[d.req_in.length - 1].user + " 想加你為好友", "host");
    F.seenReq = d.req_in.length;
    if (F.dlg) { if (F.chat) refreshChat(false); else renderList(); }
    // 邀請: 對戰中先不跳出來,對戰結束才問
    if (d.invites.length && !d.busy && !F.invOpen) showInvite(d.invites[0]);
  }

  // ---------- 邀請視窗 ----------
  function showInvite(inv) {
    F.invOpen = true;
    const close = () => { const m = document.getElementById("invdlg"); if (m) m.remove(); F.invOpen = false; };
    const reply = async accept => {
      const r = await post("/api/invite_reply", {id: inv.id, accept});
      close();
      if (!r.ok) { toast(r.error || "邀請已失效"); return; }
      if (accept && r.room) { const d = document.getElementById("frdlg"); if (d) d.remove(); F.dlg = null; enterRoom(r.room, r.rname); }
    };
    const dlg = el("div", {class: "dlg"},
      el("h3", {text: "🎮 房間邀請"}),
      el("p", {text: inv.from + " 邀請你加入房間「" + (inv.rname || "房間") + "」,要加入嗎?"}),
      el("div", {class: "btns"}, el("button", {text: "拒絕", onclick: () => reply(false)}), el("button", {class: "primary", text: "加入", onclick: () => reply(true)})));
    document.body.append(el("div", {class: "modal", id: "invdlg", style: {zIndex: 7600}}, dlg));
  }

  // ---------- 好友視窗 ----------
  function openDlg() {
    if (F.dlg) return;
    F.chat = null;
    const close = () => { const m = document.getElementById("frdlg"); if (m) m.remove(); F.dlg = null; F.chat = null; };
    const body = el("div", {class: "dbody", id: "frbody"});
    const dlg = el("div", {class: "dlg"},
      el("div", {class: "dh"}, el("div", {}, el("h3", {text: "👥 好友"})), el("button", {class: "x", text: "✕", onclick: close})),
      body);
    const m = el("div", {class: "modal", id: "frdlg", style: {zIndex: 7500}}, dlg);
    m.onclick = e => { if (e.target === m) close(); };
    document.body.append(m);
    F.dlg = m;
    renderList(true);
    poll();
  }

  function renderList(force) {
    const body = document.getElementById("frbody"); if (!body || F.chat) return;
    const d = F.data || {friends: [], req_in: [], req_out: [], now: Date.now() / 1000};
    const typing = body.querySelector("input");
    const keep = typing ? typing.value : "";
    const hadFocus = typing && document.activeElement === typing;
    body.textContent = "";
    const inp = el("input", {type: "text", maxlength: 20, placeholder: "輸入對方的 UID (8 位數字)", value: keep});
    const add = async () => {
      const r = await post("/api/friend_add", {name: inp.value});
      if (!r.ok) { toast(r.error || "失敗"); return; }
      toast(r.msg, "ok"); inp.value = ""; poll();
    };
    inp.onkeydown = e => { if (e.key === "Enter") add(); };
    const myUid = S.prof && S.prof.uuid;
    if (myUid) body.append(el("div", {class: "meta", style: {marginTop: "8px"}}, "我的 UID: ", el("b", {text: myUid}), " ",
      el("button", {text: "複製", style: {padding: "1px 8px", fontSize: "12px"}, onclick: e => { const b = e.target, ok = () => { b.textContent = "已複製"; }; if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(myUid).then(ok); else { const t = document.createElement("textarea"); t.value = myUid; document.body.append(t); t.select(); try { document.execCommand("copy"); ok(); } catch (x) {} t.remove(); } }}),
      "  (把這組 UID 給朋友,他就能加你)"));
    body.append(el("div", {class: "addrow"}, inp, el("button", {class: "primary", text: "加好友", onclick: add})));
    if (d.req_in.length) {
      body.append(el("div", {class: "sec", text: "好友請求"}));
      for (const r of d.req_in) {
        body.append(el("div", {class: "frow"}, el("span", {class: "grow nm", text: r.user}),
          el("button", {class: "primary", text: "接受", onclick: async () => { const x = await post("/api/friend_accept", {name: r.id}); if (!x.ok) toast(x.error); poll(); }}),
          el("button", {text: "拒絕", onclick: async () => { await post("/api/friend_decline", {name: r.id}); poll(); }})));
      }
    }
    if (d.req_out && d.req_out.length) body.append(el("div", {class: "sec", text: "已送出請求 (等對方接受): " + d.req_out.join("、")}));
    body.append(el("div", {class: "sec", text: "好友 (" + d.friends.length + ")"}));
    if (!d.friends.length) body.append(el("div", {class: "meta", style: {padding: "10px 4px"}, text: "還沒有好友。輸入朋友的 UID 送出請求吧。"}));
    for (const f of d.friends) {
      const st = f.online ? ("在線" + (f.where ? " · " + f.where : "")) : ("最後上線: " + fmtSeen(f.seen, d.now));
      body.append(el("div", {class: "frow"},
        el("span", {class: "dot" + (f.online ? " on" : "")}),
        el("div", {class: "grow"}, el("div", {class: "nm"}, f.user, f.dev ? el("span", {class: "rk", style: {background: "#7a3cff", color: "#fff", marginLeft: "4px"}, text: "開發者"}) : ""), el("div", {class: "st", text: st})),
        el("button", {title: "私訊", onclick: () => openChat(f)}, "💬", f.unread ? el("span", {class: "ub", text: f.unread}) : ""),
        ROOM ? el("button", {title: "邀請到目前的房間", text: "邀請", onclick: async () => { const r = await post("/api/invite", {to: f.id}); toast(r.ok ? "已邀請 " + f.user : (r.error || "邀請失敗"), r.ok ? "ok" : undefined); }}) : "",
        el("button", {title: "刪除好友", text: "🗑", onclick: async () => { if (confirm("確定要刪除好友「" + f.user + "」嗎?")) { await post("/api/friend_remove", {name: f.id}); poll(); } }})));
    }
    if (hadFocus) inp.focus();
  }

  // ---------- 私訊 ----------
  function openChat(f) {
    F.chat = f.id; F.chatName = f.user; F.chatKey = "";
    const body = document.getElementById("frbody"); if (!body) return;
    body.textContent = "";
    const msgs = el("div", {class: "msgs", id: "frmsgs"});
    const inp = el("input", {type: "text", maxlength: 200, placeholder: "輸入訊息…"});
    const send = async () => {
      const t = inp.value.trim(); if (!t) return;
      const r = await post("/api/dm_send", {to: F.chat, text: t});
      if (!r.ok) { toast(r.error || "傳送失敗"); return; }
      inp.value = ""; refreshChat(true);
    };
    inp.onkeydown = e => { if (e.key === "Enter") send(); };
    body.append(
      el("div", {class: "addrow", style: {alignItems: "center"}}, el("button", {text: "← 返回", onclick: () => { F.chat = null; renderList(); }}), el("b", {text: F.chatName})),
      msgs, el("div", {class: "sendrow"}, inp, el("button", {class: "primary", text: "傳送", onclick: send})));
    refreshChat(true);
    setTimeout(() => inp.focus(), 50);
  }
  async function refreshChat(scroll) {
    if (!F.chat) return;
    let r;
    try { r = await (await fetch("/api/dm?tok=" + encodeURIComponent(TOK) + "&with=" + encodeURIComponent(F.chat))).json(); } catch (e) { return; }
    const box = document.getElementById("frmsgs"); if (!box || !r.ok) return;
    const key = r.msgs.length + ":" + (r.msgs.length ? r.msgs[r.msgs.length - 1].t + r.msgs[r.msgs.length - 1].x : "");
    if (key === F.chatKey) return;
    F.chatKey = key;
    const atEnd = scroll || box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.textContent = "";
    if (!r.msgs.length) box.append(el("div", {class: "meta", text: "還沒有訊息,打個招呼吧。"}));
    for (const m of r.msgs) box.append(el("div", {class: "msg" + (m.me ? " me" : "")}, m.x, el("small", {text: fmtTime(m.t)})));
    if (atEnd) box.scrollTop = box.scrollHeight;
    F.seenUnread[F.chat] = 0;
  }

  setInterval(poll, 4000);
  setTimeout(poll, 1500);
})();
