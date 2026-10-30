async function () {
  const B = window.SGSBOT; const roster = await (await fetch("/api/roster")).json(); const names = (roster.chars || []).map((c) => c.name); B.roster = names;
  // ---- 個別武將 ----
  B.nullRound = -1; B.yxRound = -1; B.yxN = 0;
  B.strat["呂布"] = { act(s, p, cands, H) { const m = H.me(s); const isNull = (c) => /無效全場/.test(c.n || ""); const nullOpt = p.options.find((o) => /無效全場/.test(o.label)); const ens = H.enemies(s); const k = H.shaCnt(m) + (H.has(m, "酒") ? 1 : 0);
    if (B.nullRound === s.round) { const out = []; const peach = p.options.find((o) => o.card && H.full(o.card) === "桃"); if (peach && m.hp < m.maxhp) out.push({ pri: 110, o: peach, n: "桃" }); const jiu = p.options.find((o) => o.card && H.full(o.card) === "酒"); if (jiu && H.shaCnt(m) >= 1) out.push({ pri: 105, o: jiu, n: "酒" }); let best = null, bh = 99; for (const o of p.options) { if (!(o.card && H.isSha(H.full(o.card)))) continue; const i = H.pIdx(o); if (i == null || H.targetScore(s, i) <= -100) continue; const hp = s.players[i].hp; if (hp < bh) { bh = hp; best = o; } } if (best) out.push({ pri: 100, o: best, n: H.full(best.card) }); return out; }
    if (nullOpt) { for (const e of ens) { const ar = e.equip.armor || e.equip.armor2; const need = e.hp + Math.round((e.hand_n || 0) * 0.3); if (ar && k >= need && k >= 2) { B.nullRound = s.round; H.L("呂布: 發動無效全場, 目標 P" + e.idx + " hp" + e.hp + " 殺=" + k); return [{ pri: 200, o: nullOpt, n: "〈呂布-無效全場〉" }]; } } }
    return cands.filter((c) => !isNull(c)); } };
  B.strat["楊修"] = { act(s, p, cands, H) { const m = H.me(s); const decl = p.options.find((o) => /宣告吸收傷害/.test(o.label)); const isD = (c) => /宣告吸收/.test(c.n || ""); const out = cands.filter((c) => !isD(c));
    if (decl && B.yxRound !== s.round) { const fj = H.has(m, "發憤圖強"); const ens = H.enemies(s); if (fj >= 1 && ens.length) { const pot = 5 * fj; const weakest = ens.slice().sort((a, b) => a.hp - b.hp)[0]; if (pot >= Math.min(4, weakest.hp) || pot >= weakest.hp) { B.yxRound = s.round; B.yxN = 0; H.L("楊修: 宣告吸收 (發憤圖強x" + fj + ", 預計自傷 " + pot + ")"); return [{ pri: 200, o: decl, n: "〈楊修-宣告吸收傷害〉" }].concat(out); } } }
    return out; },
    decide(s, p, H) { const pr = p.prompt || ""; const on = B.yxRound === s.round;
      if (on && /發憤圖強: 要抽幾張/.test(pr)) { const nums = p.options.map((o) => ({ i: o.i, v: H.numOf(o) })).sort((a, b) => a.v - b.v); const top = nums[nums.length - 1]; B.yxN += top.v; return [top.i]; }
      if (on && /發憤圖強-少棄/.test(pr)) { const o = p.options.map((o) => ({ i: o.i, k: (/扣 (\d+) 點/.exec(o.label) || [0, 0])[1] * 1 })).sort((a, b) => b.k - a.k)[0]; H.L("楊修: 少棄 " + o.k + " 張 (吸收)"); return [o.i]; }
      if (/楊修-轉移傷害/.test(pr)) { const po = p.options.filter((o) => H.pIdx(o) != null); let best = null, bs = -1e9; for (const o of po) { const i = H.pIdx(o); let sc = H.targetScore(s, i); if (sc <= -100) continue; const hp = s.players[i].hp; if (hp <= B.yxN) sc += 100; sc -= hp * 3; if (sc > bs) { bs = sc; best = o; } } return [(best || po[0] || p.options[0]).i]; }
      return null; } };
  B.strat["典韋"] = { act(s, p, cands, H) { return cands.filter((c) => !(c.o && c.o.card && /^裝備\(防具\)/.test(H.desc(c.o.card)))); } };
  B.strat["蔣幹"] = { decide(s, p, H) { const pr = p.prompt || ""; const m = H.me(s);
    if (/即將受到/.test(pr) && p.kind === "respond") { const co = p.options.filter((o) => o.card); if (co.length) { const pick = co.slice().sort((a, b) => H.keepVal(a.card) - H.keepVal(b.card))[0]; H.L("蔣幹: 調虎離山 擋傷害 用 " + pick.label); return [pick.i]; } H.L("蔣幹: 即將受傷但沒有可用牌"); return null; }
    if (/發憤圖強-少棄/.test(pr)) { const opts = p.options.map((o) => ({ i: o.i, k: (/扣 (\d+) 點/.exec(o.label) || [0, 0])[1] * 1 })).sort((a, b) => a.k - b.k); const cards = (m.hand || []).length; const pick = (H.enemies(s).length > 0 && cards >= 3) ? opts[opts.length - 1] : opts[0]; H.L("蔣幹: 發憤圖強 少棄 " + pick.k + "/" + opts[opts.length - 1].k + " (手牌 " + cards + ", 任何牌可當調虎離山)"); return [pick.i]; }
    if (p.kind === "skill" && /即將受到/.test(pr)) { const mt = /P(\d)\([^)]*\) 即將受到 (\d+) 點傷害/.exec(pr); if (mt && +mt[1] === s.viewer && H.enemies(s).length) { const co = p.options.filter((o) => o.card && H.pIdx(o) == null); const nat = co.find((o) => /^(反擊|調虎離山)$/.test(H.full(o.card))); const pool = co.filter((o) => !/^(強化|降雷|弱化|隔岸觀火|無懈可擊|無懈)$/.test(H.full(o.card))); const pick = nat || pool.slice().sort((a, b) => H.keepVal(a.card) - H.keepVal(b.card))[0]; if (pick) { H.L("蔣幹: 調虎離山(連鎖提問) 擋 " + mt[2] + " 點傷害 用 " + pick.label); return [pick.i]; } } }
    return null; } };
  // ---- 全部武將共用: 偽裝 / 對付蔣幹 / 場上有曹植 / 安全 ----
  const RX = { "陳群": /突襲/, "孔融": /重鑄/, "劉備": /棄錦囊|仁|回血|回復/, "劉禪": /劉禪/, "周魴": /扣血|棄牌/, "吳懿": /交換手牌/ };
  function chooseTarget(s, H, os, as) { let best = null, bs = -1e9; for (const o of os) { const i = H.pIdx(o); if (i == null) continue; const q = s.players[i]; let sc; if (as === "劉備") sc = (100 - q.hp * 10) + (i === s.viewer ? 5 : 0) + (q.role === "主公" ? 8 : 0); else sc = H.targetScore(s, i); if (sc > bs) { bs = sc; best = o; } } return best || os[0]; }
  function special(s, p, cands, H, d) { const m = H.me(s); const hand = m.hand || []; const base = cands.filter((x) => !(x.o && x.o.card && H.full(x.o.card) === "偽裝"));
    if (d.as === "周魴") { if (hand.length > 3) return base;   // 出到只剩 3 張手牌
      let best = null, bs = 1e9; for (const o of p.options) { if (o.card || !o.label || !o.label.includes("周魴")) continue; const i = H.pIdx(o); if (i == null) continue; const q = s.players[i]; if (q.hp > 3) continue; const sc = q.hp * 10 + (q.hand_n || 0); if (sc < bs) { bs = sc; best = o; } }
      if (best) { H.L("偽裝[周魴]: 手牌剩 " + hand.length + " 張, 棄牌扣血 → " + best.label); return [{ pri: 150, o: best, n: best.label }]; } return base; }
    if (d.as === "吳懿") { if (B.wySwap === s.round) return base;   /* 換完牌後可以盡量出牌: 偽裝的技能回合結束就失效, 不會有「下一回合扣 x 血」的懲罰 */ if (!(base.length === 0 || hand.length <= 1)) return base;   // 手牌盡量打空後才交換
      let best = null, bh = -1; for (const o of p.options) { if (o.card || !o.label || !/交換手牌/.test(o.label)) continue; const i = H.pIdx(o); if (i == null) continue; const q = s.players[i]; const sc = (q.hand_n || 0) + (H.targetScore(s, i) > -100 ? 0.5 : 0); if (sc > bh) { bh = sc; best = o; } }
      if (best) { B.wySwap = s.round; H.L("偽裝[吳懿]: 手牌打空, 和手牌最多的人交換 → " + best.label); return [{ pri: 150, o: best, n: best.label }]; } return base; }
    return base; }
  function disgAct(s, p, cands, H) {
    const m = H.me(s); if (m.char === "蔣幹") return null; const gid = B.history.length; const d = B.disg; const active = d && d.round === s.round && d.gid === gid;
    const disgOpt = p.options.find((o) => o.card && H.full(o.card) === "偽裝");
    if (active && (d.as === "周魴" || d.as === "吳懿")) return special(s, p, cands, H, d);
    if (active) { const rx = RX[d.as]; const groups = {}; p.options.forEach((o) => { if (o.card || !o.label || !o.label.includes(d.as) || !rx.test(o.label)) return; const k = o.group != null ? o.group : "i" + o.i; (groups[k] = groups[k] || []).push(o); }); const extra = []; for (const k in groups) { const os = groups[k]; const wt = os.filter((o) => H.pIdx(o) != null); const o = wt.length ? chooseTarget(s, H, wt, d.as) : os[0]; extra.push({ pri: 150, o, n: o.label }); } return extra.concat(cands.filter((c) => !(c.o && c.o.card && H.full(c.o.card) === "偽裝"))); }
    if (!disgOpt) return null;
    const onField = s.players.map((q) => q.char); const free = (n) => !onField.includes(n);
    const hand = m.hand || []; const handN = hand.length - hand.filter((c) => H.full(c) === "偽裝").length; const tricks = hand.filter((c) => c.kind === "trick" && H.full(c) !== "偽裝").length;
    const lord = H.lordOf(s); const team = m.role === "主公" || m.role === "忠臣"; const allyLow = m.hp <= 2 || (team && lord && lord.alive && lord.hp <= 2);
    let as = null, why = "";
    if (H.alive(s).length === 2 && free("劉禪") && B.ldGame !== gid) { as = "劉禪"; why = "1v1 單挑"; }
    else if (tricks >= 3 && allyLow && free("劉備")) { as = "劉備"; why = "錦囊" + tricks + "張, 急需回血"; }
    else if (m.hp === 4 && handN >= 4 && free("陳群")) { as = "陳群"; why = "4血 手牌" + handN; }
    else if (m.hp !== 4 && handN >= 4 && free("孔融")) { as = "孔融"; why = "血" + m.hp + " 手牌" + handN; }
    else if (handN >= 3 && free("周魴") && H.enemies(s).some((q) => q.hp <= 3 && !(q.equip && ((q.equip.armor && H.full(q.equip.armor) === "緩衝盾") || (q.equip.armor2 && H.full(q.equip.armor2) === "緩衝盾"))))) { as = "周魴"; why = "3 點傷害可殺死目標, 手牌" + handN; }
    else if (free("吳懿") && H.enemies(s).some((q) => (q.hand_n || 0) >= 5 && (q.hand_n || 0) >= handN + 2)) { as = "吳懿"; why = "對手手牌 " + Math.max(...H.enemies(s).map((q) => q.hand_n || 0)) + " 張, 我 " + handN; }
    if (!as) return null;
    B.disg = { round: s.round, as, gid, sel: false }; if (as === "劉禪") B.ldGame = gid; H.L("偽裝: 想變身 " + as + " (" + why + ")");
    return [{ pri: 160, o: disgOpt, n: "偽裝" }].concat(cands); }
  function disgDecide(s, p, H) { const d = B.disg; if (!d || d.round !== s.round || d.gid !== B.history.length) return null; const pr = p.prompt || "";
    if (!d.sel) { const hit = p.options.find((o) => (o.label || "").includes(d.as)); if (hit && (/偽裝/.test(pr) || /變身/.test(pr))) { d.sel = true; return [hit.i]; }
      if (/偽裝/.test(pr)) { for (const n of ["陳群", "孔融", "劉備", "劉禪"]) { const o = p.options.find((o) => (o.label || "").includes(n)); if (o) { d.sel = true; d.as = n; return [o.i]; } } } }
    if (p.kind === "skill" && RX[d.as]) { const op = p.options.find((x) => x.label && x.label.includes(d.as) && RX[d.as].test(x.label) && /^使用|^發動/.test(x.label)); if (op) { H.L("偽裝[" + d.as + "]: 技能提示發動 " + op.label); return [op.i]; } }
    if (d.as === "周魴" && p.kind === "count" && /周魴|棄牌|扣血/.test(pr)) { const nums = p.options.map((o) => ({ i: o.i, v: H.numOf(o) })).sort((a, b) => a.v - b.v); return [nums[nums.length - 1].i]; }
    if (d.as === "孔融" && /重鑄/.test(pr)) { if (p.kind === "count") { const nums = p.options.map((o) => ({ i: o.i, v: H.numOf(o) })).sort((a, b) => a.v - b.v); return [nums[nums.length - 1].i]; } const co = p.options.filter((o) => o.card); if (co.length && p.max > 1) return co.slice(0, p.max).map((o) => o.i); }
    return null; }
  const DMG = /殺$|^決鬥$|^火攻$|^笑裡藏刀$|^鴻門宴$/; const RXA = /殺$|^決鬥$|^火攻$|^笑裡藏刀$|^降雷$|^鴻門宴$|^南蠻入侵$|^萬箭齊發$|^飢餓$|^突襲$/;
  function jgAct(s, p, cands, H) { const jg = s.players.find((q) => q.char === "蔣幹" && q.alive && q.idx !== s.viewer); if (!jg) return null; const extra = [], seen = {}; const add = (o, n, pri) => { const k = n + "@" + H.pIdx(o); if (seen[k]) return; seen[k] = 1; extra.push({ pri, o, n: n + "→蔣幹" }); };
    for (const o of p.options) { if (!o.card || H.pIdx(o) !== jg.idx) continue; const nm = H.full(o.card); if (nm === "降雷") add(o, nm, 195); else if (nm === "過河拆橋" || nm === "順手牽羊") add(o, nm, 190); else if (DMG.test(nm) && H.atkAdj(s, o.label, nm, jg.idx) > -100) add(o, nm, 185); }
    return extra.concat(cands.filter((x) => !/強化|弱化/.test(x.n || ""))); }
  function ctAct(s, p, cands, H) { const ct = s.players.find((q) => q.char === "曹植" && q.alive && q.idx !== s.viewer); if (!ct || s.round > 8) return null;
    { const mp = H.me(s);   // 曹植是我方主公 (我是忠臣): 第 5 輪以前不打他, 優先在 5 輪內殺光反賊/內奸 (非主公, 血少優先); 第 6 輪起才集火他
      if (mp.role === "忠臣" && ct.role === "主公" && s.round <= 5) { const ex = [], sn = {};
        for (const o of p.options) { if (!o.card) continue; const nm = H.full(o.card); if (!RXA.test(nm) || /^(南蠻入侵|萬箭齊發|飢餓|突襲)$/.test(nm)) continue; const i = H.pIdx(o); if (i == null || i === ct.idx || i === s.viewer) continue; const q = s.players[i]; if (!q || !q.alive) continue; if (H.atkAdj(s, o.label, nm, i) <= -100) continue; const k = nm + "@" + i; if (sn[k]) continue; sn[k] = 1; ex.push({ pri: 165 - q.hp * 3, o, n: nm + "→敵(忠臣,5輪內殺反賊內奸)" }); }
        const keep = cands.filter((c) => !(c.o && c.o.card && H.pIdx(c.o) === ct.idx && RXA.test(H.full(c.o.card))));
        return ex.length ? ex.concat(keep) : keep; } }
    const extra = [], seen = {};
    for (const o of p.options) { if (!o.card) continue; const nm = H.full(o.card); if (!RXA.test(nm)) continue; const i = H.pIdx(o); const aoe = /^(南蠻入侵|萬箭齊發|飢餓|突襲)$/.test(nm); if (!aoe && i !== ct.idx) continue; const key = nm + (aoe ? "" : "@" + i); if (seen[key]) continue; if (!aoe && H.atkAdj(s, o.label, nm, ct.idx) <= -100) continue; seen[key] = 1; extra.push({ pri: aoe ? 120 : 190, o, n: nm + "→曹植" }); }
    return extra.length ? extra.concat(cands) : null; }
  names.forEach((c) => { B.layer(c, { act(s, p, cands, H) { let r = disgAct(s, p, cands, H) || cands; if (c !== "蔣幹") r = jgAct(s, p, r, H) || r; r = ctAct(s, p, r, H) || r; return r; },
    decide(s, p, H) { const d = disgDecide(s, p, H); if (d) return d; if (c !== "蔣幹") { const jg = s.players.find((q) => q.char === "蔣幹" && q.alive && q.idx !== s.viewer); if (jg && p.kind === "skill" && s.cur === s.viewer && /即將受到|使用了/.test(p.prompt || "")) { const no = H.passOpt(p); if (no) return [no.i]; } } return null; } }); });
  // ---- 僵局: 休閒練習佇列對局超過第 70 輪就重開同一隻武將 (不計入戰績) ----
  if (B._capTimer) SGSWT.clearInterval(B._capTimer); B._capBusy = false;
  B._capTimer = SGSWT.setInterval(async () => { if (B._capBusy || !B.cfg.queue || B.cfg.ranked || !B.running) return; B._capBusy = true; try { const s = await api("/api/state?log=99999999&th=99999999&peek=0&chat=0");
    if (s && !s.over && s.ready && s.round >= 70 && s.viewer != null) { const cur = B.cfg.queue.find((q) => { const e = B.qstats[q.c] || { g: 0, w: 0 }; return e.w < (q.need || 3) && e.g < (q.max || 8); });
      if (cur) { B.stale.push(cur.c + "@r" + s.round); B.logs.push("僵局 round " + s.round + ": 放棄這局重開 " + cur.c + " (不計入戰績)"); await api("/api/new", { players: 4, human: "0", humans: [0], chars: [cur.c, "", "", ""], variant: 0, lord: String(B.cfg.queueLord == null ? "0" : B.cfg.queueLord), mode: "normal", role_mode: "normal", base_hp: 4, ranked: false, difficulty: B.cfg.difficulty || 2, diffs: [], seed: "", speed: 0.15 }); B.logN = 0; B.thN = 0; B.lastId = -1; B.tries = {}; B.me = null; B.reflectN = 0; B.susp = {}; B.lethal = false; B.lethalInfo = null; B.owed = 0; B.turnRound = -1; B.cur = []; B.disg = null; } } } catch (e) {} B._capBusy = false; }, 3000);
  return "strategies loaded for " + names.length + " chars";
}