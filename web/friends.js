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
#frdlg .frow .lvt{font-size:11px;color:var(--dim);font-weight:400}#frdlg .frow .mu{cursor:default}#frdlg .frow .nm{font-weight:600}#frdlg .frow .st{font-size:12px;color:var(--dim)}
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

  // 一個人的資料: 頭貼 (含框 / 特效) + 名字 + 等級 / 段位 / 開發者 + 共同好友
  function person(f, sub) {
    const mu = el("span", {class: "mu", title: (f.mutual_names || []).join("、"), text: f.mutual ? " · 共同好友 " + f.mutual : " · 無共同好友"});
    const open = () => window.showPlayer && window.showPlayer(f.id);
    return [avEl(f.avatar, f.style, {style: {width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover", flex: "none", cursor: "pointer"}, onclick: open}),
      el("div", {class: "grow", style: {cursor: "pointer"}, title: "查看個人資訊", onclick: open},
        el("div", {class: "nm"}, f.remark || f.user, f.remark ? el("span", {class: "lvt", text: " (" + f.user + ")"}) : "", " ", rkEl(f.rank), devEl(f.dev)),
        el("div", {class: "st"}, sub || "", mu))];
  }

  // ---------- 按鈕與徽章 ----------
  function mountBtn() {
    if (document.getElementById("bFr")) return;
    const anchor = document.getElementById("bBoard");
    if (!anchor) return;
    const b = el("button", {id: "bFr", title: "好友、私訊、邀請朋友進房間"}, "好友", el("span", {class: "fb"}));
    b.onclick = openDlg;
    anchor.parentNode.insertBefore(b, anchor);
    const rb = document.querySelector("#rooms .rbox");   // 大廳畫面會蓋住上方工具列,大廳裡也放一顆
    if (rb && !document.getElementById("bFr2")) {
      const b2 = el("button", {id: "bFr2", title: "好友、私訊、邀請朋友進房間", style: {float: "right"}}, "好友", el("span", {class: "fb"}));
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
    F.data = d; badge(); chOptions(); chBadge();
    // 新訊息 / 新請求提示
    for (const f of d.friends) {
      const prev = F.seenUnread[f.id] || 0;
      if (f.unread > prev && !(F.chat === f.id && F.dlg)) toast("💬 " + (f.remark || f.user) + " 傳來私訊", "host");
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
      el("div", {class: "dh"}, el("div", {}, el("h3", {text: "好友"})), el("button", {class: "x", text: "✕", onclick: close})),
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
    const sig = JSON.stringify([d.friends, d.req_in, d.req_out, F.tab, F.page]);
    if (!force && typing && (document.activeElement === typing || sig === F.sig)) return;   // 正在打字、或資料沒變: 不重畫 (重畫會讓游標跳回最前面)
    F.sig = sig;
    const keep = typing ? typing.value : "";
    const hadFocus = typing && document.activeElement === typing;
    const caret = typing ? typing.selectionStart : 0;
    body.textContent = "";
    const inp = el("input", {type: "text", maxlength: 20, placeholder: "輸入對方的 UID (8 位數字)", value: keep});
    const add = async () => {
      const r = await post("/api/friend_add", {name: inp.value});
      if (!r.ok) { toast(r.error || "失敗"); return; }
      toast(r.msg, "ok"); inp.value = ""; poll();
    };
    inp.onkeydown = e => { if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) add(); };
    const myUid = S.prof && S.prof.uuid;
    if (myUid) body.append(el("div", {class: "meta", style: {marginTop: "8px"}}, "我的 UID: ", el("b", {text: myUid}), " ",
      el("button", {text: "複製", style: {padding: "1px 8px", fontSize: "12px"}, onclick: e => { const b = e.target, ok = () => { b.textContent = "已複製"; }; if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(myUid).then(ok); else { const t = document.createElement("textarea"); t.value = myUid; document.body.append(t); t.select(); try { document.execCommand("copy"); ok(); } catch (x) {} t.remove(); } }})));
    body.append(el("div", {class: "addrow"}, inp, el("button", {class: "primary", text: "加好友", onclick: add})));
    const tab = F.tab || "list";
    const T = (k, label, red) => el("button", {class: tab === k ? "primary" : "", onclick: () => { F.tab = k; renderList(true); }}, label, red ? el("span", {class: "rd"}) : "");
    body.append(el("div", {class: "tabs"}, T("list", "好友列表 (" + d.friends.length + ")", d.friends.some(f => f.unread)),
      T("out", "已送出 (" + (d.req_out || []).length + ")"), T("in", "待審核 (" + d.req_in.length + ")", d.req_in.length)));
    if (tab === "in") {
      if (!d.req_in.length) body.append(el("div", {class: "meta", style: {padding: "10px 4px"}, text: "沒有等待審核的好友請求。"}));
      for (const r of d.req_in) {
        body.append(el("div", {class: "frow"}, ...person(r, "想加你為好友"),
          el("button", {class: "primary", text: "接受", onclick: async () => { const x = await post("/api/friend_accept", {name: r.id}); if (!x.ok) toast(x.error); poll(); }}),
          el("button", {text: "拒絕", onclick: async () => { await post("/api/friend_decline", {name: r.id}); poll(); }})));
      }
      if (hadFocus) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) {} }
      return;
    }
    if (tab === "out") {
      if (!(d.req_out || []).length) body.append(el("div", {class: "meta", style: {padding: "10px 4px"}, text: "沒有已送出的好友請求。"}));
      for (const u of (d.req_out || [])) body.append(el("div", {class: "frow"}, ...person(u, "等對方接受")));
      if (hadFocus) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) {} }
      return;
    }
    if (!d.friends.length) body.append(el("div", {class: "meta", style: {padding: "10px 4px"}, text: "還沒有好友。輸入朋友的 UID 送出請求吧。"}));
    const SORTS = [["time", "成為好友時間"], ["level", "等級"], ["playtime", "遊玩時間"], ["rank", "段位"], ["name", "名字 A-Z"], ["seen", "最近上線"]];
    const key = { time: f => f.idx || 0, level: f => f.level || 0, playtime: f => f.playtime || 0, rank: f => f.rp || 0, name: f => (f.remark || f.user || "").toLowerCase(), seen: f => f.online ? 1e12 : (f.seen || 0) };
    let sk = "seen", dir = -1; try { sk = localStorage.getItem("frSort") || "seen"; dir = localStorage.getItem("frDir") === "1" ? 1 : -1; } catch (e) {}
    if (!key[sk]) sk = "seen";
    const sorted = d.friends.slice().sort((a, b) => { const x = key[sk](a), y = key[sk](b); const c = typeof x === "string" ? x.localeCompare(y) : x - y; return c ? c * dir : (a.user || "").localeCompare(b.user || ""); });
    const PER = 10, pages = Math.max(1, Math.ceil(sorted.length / PER)); F.page = Math.min(Math.max(0, F.page || 0), pages - 1);
    const sel = el("select", {title: "排序方式", onchange: () => { try { localStorage.setItem("frSort", sel.value); } catch (e) {} F.page = 0; renderList(true); }}, SORTS.map(([v, n]) => el("option", {value: v, text: n})));
    sel.value = sk;
    const dirBtn = el("button", {type: "button", text: dir === 1 ? "由小到大" : "由大到小", title: "切換排序方向", onclick: () => { try { localStorage.setItem("frDir", dir === 1 ? "0" : "1"); } catch (e) {} F.page = 0; renderList(true); }});
    if (d.friends.length > 1) body.append(el("div", {class: "addrow", style: {alignItems: "center", margin: "6px 0"}}, el("span", {class: "meta", text: "排序"}), sel, dirBtn));
    for (const f of sorted.slice(F.page * PER, F.page * PER + PER)) {
      const st = f.online ? ("在線" + (f.where ? " · " + f.where : "")) : ("最後上線: " + fmtSeen(f.seen, d.now));
      body.append(el("div", {class: "frow"},
        el("span", {class: "dot" + (f.online ? " on" : "")}),
        ...person(f, st),
        el("button", {title: "自訂暱稱 (只有你看得到)", text: "✏️", onclick: async () => {
          const v = prompt("替「" + f.user + "」取個暱稱 (最多 12 字,留空恢復原名):", f.remark || "");
          if (v === null) return;
          const r = await post("/api/friend_nick", {name: f.id, nick: v});
          if (!r.ok) toast(r.error || "失敗"); else poll();
        }}),
        el("button", {title: f.online ? "私訊" : "對方離線,不能聊天", disabled: !f.online, onclick: () => openChat(f)}, "💬", f.unread ? el("span", {class: "ub", text: f.unread}) : ""),
        ROOM ? el("button", {title: !f.online ? "對方離線,不能邀請" : inRoom(f) ? "對方已經在這個房間裡" : "邀請到目前的房間", disabled: !f.online || inRoom(f), text: "邀請", onclick: async () => { const r = await post("/api/invite", {to: f.id}); toast(r.ok ? "已邀請 " + f.user : (r.error || "邀請失敗"), r.ok ? "ok" : undefined); }}) : "",
        el("button", {title: "刪除好友", text: "🗑", onclick: async () => { if (confirm("確定要刪除好友「" + f.user + "」嗎?")) { await post("/api/friend_remove", {name: f.id}); poll(); } }})));
    }
    if (pages > 1) body.append(el("div", {class: "addrow", style: {alignItems: "center", justifyContent: "center", margin: "8px 0"}},
      el("button", {type: "button", text: "上一頁", disabled: F.page <= 0, onclick: () => { F.page--; renderList(true); }}),
      el("span", {class: "meta", text: (F.page + 1) + " / " + pages}),
      el("button", {type: "button", text: "下一頁", disabled: F.page >= pages - 1, onclick: () => { F.page++; renderList(true); }})));
    if (hadFocus) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch (e) {} }
  }

  // ---------- 私訊 ----------
  const inRoom = f => ((typeof S !== "undefined" && S.online) || []).some(x => x.acc === f.id);   // 已經在目前房間的人不能再邀請
  function openChat(f) {
    if (ROOM && document.getElementById("cc")) {   // 在房間內: 用右側聊天欄的私訊頻道
      const m = document.getElementById("frdlg"); if (m) m.remove(); F.dlg = null; F.chat = null;
      window.SGSCH.openDM(f.id);
      return;
    }
    F.chat = f.id; F.chatName = f.remark || f.user; F.chatKey = "";
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
    inp.onkeydown = e => { if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) send(); };
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


  // ---------- 右側聊天欄的頻道: 房間頻道 / 公共頻道 / 好友私訊 ----------
  const CH = {cur: "room", pub: {last: 0, seen: 0, msgs: [], key: ""}, pubUnread: 0, sig: "", key: ""};
  const ccOpen = () => { const c = document.getElementById("cc"); return !!(c && c.classList.contains("on") && c.offsetParent); };
  function chMount() {
    const cc = document.getElementById("cc"); if (!cc) return false;
    if (document.getElementById("cchan")) return true;
    const sel = el("select", {id: "cchan", style: {margin: "6px 8px 0", padding: "5px"}});
    sel.onchange = () => { CH.cur = sel.value; chShow(); };
    const gl = el("div", {id: "gl"}), dml = el("div", {id: "dml"});
    const cl = document.getElementById("cl");
    cc.insertBefore(sel, cl); cc.insertBefore(gl, cl); cc.insertBefore(dml, cl);
    const st = document.createElement("style");
    st.textContent = "#gl,#dml{flex:1;overflow:auto;padding:10px;min-height:0;display:none}#cchan{max-width:calc(100% - 16px)}";
    document.head.append(st);
    return true;
  }
  function chOptions() {
    if (!chMount()) return;
    const d = F.data, sel = document.getElementById("cchan");
    const fr = d ? d.friends : [];
    const sig = JSON.stringify([fr.map(f => [f.id, f.user, f.remark, f.unread, f.online]), CH.pubUnread]);
    if (sig === CH.sig) return;
    CH.sig = sig;
    sel.textContent = "";
    sel.append(el("option", {value: "room", text: "🏠 房間頻道"}), el("option", {value: "pub", text: "🌐 公共頻道" + (CH.pubUnread ? " (" + CH.pubUnread + ")" : "")}));
    if (fr.length) {
      const g = el("optgroup", {label: "好友私訊"});
      for (const f of fr) g.append(el("option", {value: "dm:" + f.id, disabled: !f.online && CH.cur !== "dm:" + f.id, text: "💬 " + (f.remark || f.user) + (f.online ? " ●" : "") + (f.unread ? " (" + f.unread + ")" : "")}));
      sel.append(g);
    }
    if (![...sel.options].some(o => o.value === CH.cur)) CH.cur = "room";
    sel.value = CH.cur;
  }
  function chShow() {
    if (!chMount()) return;
    const cl = document.getElementById("cl"), gl = document.getElementById("gl"), dml = document.getElementById("dml");
    cl.style.display = CH.cur === "room" ? "" : "none";
    gl.style.display = CH.cur === "pub" ? "block" : "none";
    dml.style.display = CH.cur.startsWith("dm:") ? "block" : "none";
    const inp = document.getElementById("ctext");
    inp.placeholder = CH.cur === "room" ? "輸入訊息,Enter 送出" : CH.cur === "pub" ? "公共頻道: 所有人都看得到" : "私訊,Enter 送出";
    CH.key = "";
    if (CH.cur === "pub") { CH.pub.seen = CH.pub.last; CH.pubUnread = 0; renderPub(true); }
    if (CH.cur.startsWith("dm:")) renderDM(true);
    CH.sig = ""; chBadge(); chOptions();
  }
  function chBadge() {
    const d = F.data;
    const dm = d ? d.friends.reduce((s, f) => s + (CH.cur === "dm:" + f.id && ccOpen() ? 0 : f.unread), 0) : 0;
    S.dmUnread = dm + (CH.pubUnread || 0);
    if (window.updChatBadge) updChatBadge();
  }
  const cmLine = (m, mine, showAv) => el("div", {class: "cm" + (mine ? " mine" : "")},
    el("span", {class: "cn"}, showAv ? avEl(m.avatar, m.style, {style: {width: "22px", height: "22px", borderRadius: "50%", objectFit: "cover", verticalAlign: "middle"}}) : "",
      m.nick + (m.lv ? " · " + m.lv : "") + " " + fmtTime(m.t) + " ", devEl(m.dev)),
    el("span", {class: "ct", text: m.text}));
  function renderPub(scroll) {
    const box = document.getElementById("gl"); if (!box) return;
    const P = CH.pub, key = P.msgs.length ? P.msgs[P.msgs.length - 1].id : 0;
    if (key === P.key && !scroll) return;
    P.key = key;
    const atEnd = scroll || box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
    box.textContent = "";
    if (!P.msgs.length) box.append(el("div", {class: "meta", text: "公共頻道: 所有登入的玩家都看得到,不分房間。"}));
    for (const m of P.msgs) box.append(cmLine(m, m.who === S.myWho, true));
    if (atEnd) box.scrollTop = box.scrollHeight;
  }
  async function pollPub() {
    if (!S.user) return;
    let r;
    try { r = await (await fetch("/api/gchat?tok=" + encodeURIComponent(TOK) + "&since=" + CH.pub.last)).json(); } catch (e) { return; }
    if (!r || !r.ok) return;
    const P = CH.pub;
    if (r.last < P.last) { P.msgs = []; P.last = 0; P.seen = 0; }   // 伺服器重啟
    const first = P.last === 0 && !P.msgs.length;
    if (r.msgs.length) P.msgs = P.msgs.concat(r.msgs.filter(m => m.id > P.last)).slice(-200);
    P.last = r.last;
    if (first || (CH.cur === "pub" && ccOpen())) P.seen = P.last;   // 第一次載入的舊訊息、正在看的頻道不算未讀
    CH.pubUnread = P.msgs.filter(m => m.id > P.seen && m.who !== S.myWho).length;
    if (CH.cur === "pub") renderPub(false);
    chBadge(); chOptions();
  }
  async function renderDM(scroll) {
    const id = CH.cur.slice(3), box = document.getElementById("dml"); if (!box) return;
    let r;
    try { r = await (await fetch("/api/dm?tok=" + encodeURIComponent(TOK) + "&with=" + encodeURIComponent(id))).json(); } catch (e) { return; }
    if (!r.ok || CH.cur !== "dm:" + id) return;
    const key = r.msgs.length + ":" + (r.msgs.length ? r.msgs[r.msgs.length - 1].t + r.msgs[r.msgs.length - 1].x : "");
    F.seenUnread[id] = 0;
    if (key === CH.key && !scroll) return;
    CH.key = key;
    const f = (F.data ? F.data.friends : []).find(x => x.id === id) || {user: "好友"};
    const fn = f.remark || f.user;
    const atEnd = scroll || box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
    box.textContent = "";
    if (!r.msgs.length) box.append(el("div", {class: "meta", text: "和 " + fn + " 還沒有訊息,打個招呼吧。"}));
    for (const m of r.msgs) box.append(cmLine({nick: m.me ? "我" : fn, t: m.t, text: m.x}, m.me, false));
    if (atEnd) box.scrollTop = box.scrollHeight;
  }
  window.SGSCH = {
    handles: () => CH.cur !== "room",
    send: async t => {
      if (CH.cur === "pub") {
        const r = await post("/api/gchat", {text: t, nick: typeof myNick === "function" ? myNick() : ""});
        if (!r.ok) toast(r.error || "傳送失敗");
        pollPub();
      } else if (CH.cur.startsWith("dm:")) {
        const r = await post("/api/dm_send", {to: CH.cur.slice(3), text: t});
        if (!r.ok) toast(r.error || "傳送失敗");
        renderDM(true); poll();
      }
    },
    shown: () => { chOptions(); chShow(); },
    openDM: id => {   // 從好友視窗點 💬: 切到右側欄的私訊頻道
      CH.cur = "dm:" + id; CH.sig = ""; chOptions(); chShow();
      const b = document.querySelector("#tabs button[data-t=cc]") || document.querySelector("#mnav button[data-m=cc]");
      if (b && !ccOpen()) b.click();
      setTimeout(() => { const i = document.getElementById("ctext"); if (i) i.focus(); }, 100);
    },
  };
  setInterval(() => { pollPub(); if (CH.cur.startsWith("dm:") && ccOpen()) renderDM(false); }, 3000);
  setTimeout(pollPub, 1800);

  window.SGS_FRIENDS = { open: openDlg, data: () => F.data, add: async acc => { const r = await post("/api/friend_add", {name: acc}); if (r.ok) poll(); return r; } };
  setInterval(poll, 4000);
  setTimeout(poll, 1500);
})();
