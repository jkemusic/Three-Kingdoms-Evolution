async function () {
  const P0 = window.SGSPANEL; const autoWas = P0 && P0.auto; if (P0) P0.auto = false;
  const old = window.SGSBOT; if (old && old.stop) old.stop();
  await new Promise((r) => setTimeout(r, old ? 1800 : 0));
  const keep = (k, d) => (old && old[k]) || d;
  const B = window.SGSBOT = old || {};
  Object.assign(B, {
    cfg: keep("cfg", { pollMs: 200, autoNext: true, maxGames: 1000, difficulty: 1, players: 4, ranked: false, useRotate: false, forceChar: null, seeds: null, lord: null, rotate: [] }),
    running: false, stats: keep("stats", { games: 0, wins: 0, losses: 0, errors: 0, answered: 0, byChar: {}, byRole: {}, rpStart: null, rpNow: null }), logs: keep("logs", []), seen: keep("seen", {}), skillLabels: keep("skillLabels", {}), evt: keep("evt", []),
    lastId: -1, tries: {}, logN: 0, thN: 0, gi: keep("gi", 0), me: null, reflectN: 0, history: keep("history", []), susp: {}, lethal: false, lethalInfo: null, lethalSeen: keep("lethalSeen", 0), buffRound: -1, buffCnt: 0, owed: 0, turnRound: -1, strat: keep("strat", {}), qstats: keep("qstats", {}), games: keep("games", []), cur: [], stale: keep("stale", []),
    stop() { this.running = false; }, status() { return { running: this.running, stats: this.stats, last: this.logs.slice(-12), history: this.history.slice(-12) }; },
  });
  window.GARCH = B.games;
  const L = (m) => { B.logs.push(new Date().toISOString().slice(11, 19) + " " + m); if (B.logs.length > 3000) B.logs.shift(); };
  const sleep = (ms) => (window.SGSWT ? window.SGSWT.sleep(ms) : new Promise((r) => setTimeout(r, ms)));
  const S = () => api(`/api/state?log=${B.logN}&th=${B.thN}&peek=0&chat=0`);
  const ans = async (p, idxs) => { B.lastId = p.id; B.stats.answered++; return api("/api/answer", { id: p.id, choice: idxs }); };
  const full = (c) => (c && (c.full || c.name)) || "";
  const desc = (c) => (c && c.desc) || "";
  const isSha = (n) => /殺$/.test(n);
  const KEEP = (B.cardPri = {
    "發憤圖強": 444, "緩衝盾": 100, "反擊": 99, "調虎離山": 98, "偽裝": 97, "無中生有": 95, "增兵減灶": 95, "未雨綢繆": 94, "聲東擊西": 93, "降雷": 92, "隔岸觀火": 92, "拋磚引玉": 91, "五穀豐登": 90,
    "過河拆橋": 85, "順手牽羊": 84, "酒": 81, "桃": 80, "流星錘": 80, "閃": 75, "占卜": 74, "飢餓": 74, "鴻門宴": 74, "強化": 73, "萬箭齊發": 73, "南蠻入侵": 72,
    "決鬥": 71, "樂不思蜀": 71, "殺": 70, "無懈可擊": 70, "無懈": 70, "突襲": 70, "兵糧寸斷": 70, "藤甲": 70, "青釭劍": 70, "火攻": 69, "笑裡藏刀": 68,
    "諸葛連弩": 65, "孔雀羽扇": 65, "孤注一擲": 65, "鐵索連環": 60, "八卦陣": 60, "貫石斧": 60, "火盾": 60, "仁王盾": 55,
    "弱化": 50, "桃園結義": 50, "轉移": 50, "方天畫戟": 50, "丈八蛇矛": 50, "+1馬": 50, "-1馬": 50, "借刀殺人": 45, "出其不意": 40, "草木皆兵": 40, "毒": 35,
    "雷盾": 30, "冰盾": 30, "投桃報李": 30, "閃電": 30, "青龍偃月刀": 20, "寒冰劍": 0, "麒麟弓": 0
  });
  let curS = null;
  const DUAL_W = { "甘寧": 1, "夏侯淵": 1 }, DUAL_A = { "周瑜": 1, "甘寧": 1, "夏侯淵": 1 };
  const slotKeys = (n, kind, ch) => { if (n === "+1馬") return ["h+"]; if (n === "-1馬") return ["h-"]; if (kind === "weapon") return DUAL_W[ch] ? ["weapon", "weapon2"] : ["weapon"]; if (kind === "armor") return DUAL_A[ch] ? ["armor", "armor2"] : ["armor"]; return null; };
  const keepVal = (c) => {
    const n = full(c); const eqk = c && (c.kind === "weapon" || c.kind === "armor" || c.kind === "horse");
    let v = isSha(n) ? KEEP["殺"] : (KEEP[n] != null ? KEEP[n] : ((eqk || /^裝備|^武器/.test(desc(c))) ? 30 : 50));
    const m = curS && curS.players && curS.players[curS.viewer];
    if (m && m.char === "蔣幹" && n === "偽裝") return -444;
    if (m && m.hand) { const hn = (x) => m.hand.some((h) => full(h) === x); if (n === "諸葛連弩" && m.hand.filter((h) => isSha(full(h))).length >= 2 && !["weapon", "weapon2"].some((k) => m.equip && m.equip[k] && full(m.equip[k]) === "諸葛連弩")) v += 19;
      if (hn("發憤圖強")) { if (n === "反擊" || n === "調虎離山") v += 100; if ((hn("反擊") || hn("調虎離山")) && (n === "強化" || n === "鐵索連環")) v += 40; } }
    const sl = m && m.equip && slotKeys(n, c && c.kind, m.char);
    if (sl) { const cur = sl.map((k) => m.equip[k]); if (cur.every(Boolean) && !cur.some((x) => c && x.id === c.id)) { const low = Math.min(...cur.map((x) => (KEEP[full(x)] != null ? KEEP[full(x)] : 30))); if (low >= v) v -= 50; } }
    return v;
  };
  const me = (s) => s.players[s.viewer];
  const alive = (s) => s.players.filter((p) => p.alive);
  const lordOf = (s) => s.players.find((p) => p.role === "主公");
  const has = (m, name) => (m.hand || []).filter((c) => full(c) === name).length;
  const shaCnt = (m) => (m.hand || []).filter((c) => isSha(full(c))).length;
  const pIdx = (o) => { if (o.target && o.target.idx != null) return o.target.idx; const m = /P(\d)/.exec(o.label || ""); return m ? +m[1] : null; };
  const hpOfLabel = (o) => { const m = /體力 (-?\d+)\//.exec(o.label || ""); return m ? +m[1] : null; };
  const note = (kind, p) => { const k = kind + "|" + (p.prompt || "").replace(/\d+/g, "#").replace(/P#\([^)]*\)/g, "P#").slice(0, 70); if (!B.seen[k]) B.seen[k] = { n: 0, opts: p.options.slice(0, 5).map((o) => o.label), min: p.min, max: p.max }; B.seen[k].n++; };
  const TIER = { "陳群": 82, "張昭": 96, "張角": 94, "董卓": 93, "許褚": 92, "曹彰": 90, "華雄": 88, "呂布": 66, "張飛": 84, "郭圖&逢紀": 84, "鄧艾": 82, "司馬昭": 80, "華佗": 60, "荀彧": 76, "蔣幹": 76, "甘寧": 74, "夏侯淵": 74, "張遼": 74, "司馬懿": 72, "曹操": 72, "黃忠": 70, "劉諶": 70, "馬超": 70, "姜維": 72, "楊修": 50, "孫權": 58, "周魴": 72, "張紘": 55, "曹植": 40, "張郃": 40, "典韋": 62, "劉協": 60, "劉備": 66, "曹沖": 30 };
  const SURV = ["曹植", "劉協", "典韋", "諸葛亮", "孔融", "呂蒙", "曹真", "董卓", "華雄", "龐統", "蔣幹"];
  const pickScore = (o) => { if (o.name === "吳懿") return -1000; if (o.name === "劉禪" || o.name === "楊修") return -500;  /* 使用者指定: 整場技能只能用一次的武將優先度最低 (只適合偽裝) */   /* 使用者指定: 開局不選吳懿, 只在偽裝時用 */ const i = SURV.indexOf(o.name); if (i >= 0) return 1000 - i * 5; return (TIER[o.name] != null ? TIER[o.name] : 62) + (o.maxhp >= 6 ? 5 : 0); };
  const deduceRole = (s, idx) => {
    const m = me(s); if (m.role !== "內奸" || s.players.length !== 4) return null;
    const o = s.players.filter((p) => p.idx !== s.viewer && p.role !== "主公"); if (o.length !== 2) return null;
    const other = o.find((p) => p.idx !== idx); if (!other) return null;
    return other.role === "忠臣" ? "反賊" : other.role === "反賊" ? "忠臣" : null;
  };
  function targetScore(s, idx) {
    const m = me(s), p = s.players[idx];
    if (!p || !p.alive || idx === s.viewer) return -999;
    const isLord = p.role === "主公";
    const lord = lordOf(s);
    const sp0 = B.susp[idx] || { rebel: 0, loyal: 0 }, dr = deduceRole(s, idx);
    const sp = { rebel: sp0.rebel + (dr === "反賊" ? 6 : 0), loyal: sp0.loyal + (dr === "忠臣" ? 6 : 0) };
    const others = alive(s).filter((o) => o.idx !== s.viewer && o.role !== "主公");
    let sc = 50 - p.hp * 5 - p.hand_n * 0.3 + (p.hp <= 1 ? 25 : 0);
    if (m.role === "反賊") {
      if (isLord) sc += B.lethal ? 300 : (p.hp <= 2 ? 50 : 15);
      else sc += sp.loyal * 8 - sp.rebel * 4;
    } else if (m.role === "主公") {
      sc += sp.rebel * 10 - sp.loyal * 10;
    } else if (m.role === "忠臣") {
      if (isLord) return -999;
      sc += sp.rebel * 12 - sp.loyal * 12;
    } else {
      if (isLord) return others.length ? -999 : (B.lethal ? 200 : 100);
      const lh = lord ? lord.hp : 4;
      if (others.length === 1) sc += 40;
      else if (lh <= 3) sc += sp.rebel * 12 - sp.loyal * 4;
      else sc += sp.loyal * 10 - sp.rebel * 3;
    }
    return sc;
  }
  const bestTarget = (s, opts) => { let best = null, bs = -1e9; for (const o of opts) { const i = pIdx(o); if (i == null) continue; const sc = targetScore(s, i); if (sc > bs) { bs = sc; best = o; } } return best ? { o: best, sc: bs } : null; };
  const AOE = ["南蠻入侵", "萬箭齊發", "飢餓", "突襲"];
  const armorsOf = (p) => [p.equip && p.equip.armor, p.equip && p.equip.armor2].filter(Boolean).map(full);
  const effDmg = (s) => { const be = burstEstimate(s); return (1 + be.hammer) * Math.pow(2, Math.min(3, be.buff + (B.buffRound === s.round ? B.buffCnt : 0))); };
  function atkAdj(s, label, n, idx) {
    const m = me(s), t = s.players[idx]; if (!t) return 0;
    const sha = isSha(n);
    const dmgCard = sha || AOE.includes(n) || ["決鬥", "火攻", "笑裡藏刀", "降雷"].includes(n);
    if (!dmgCard) return 0;
    const ar = armorsOf(t); if (!ar.length) return 0;
    const col = (/^(紅|黑)/.exec(label || "") || [])[1] || "";
    const myW = m.equip && m.equip.weapon ? full(m.equip.weapon) : "";
    const attr = sha ? (/火殺/.test(n) || myW === "孔雀羽扇" ? "火" : /冰殺/.test(n) ? "冰" : /雷殺/.test(n) ? "雷" : "") : (n === "火攻" ? "火" : n === "降雷" ? "雷" : "");
    const ignore = sha && myW === "青釭劍";
    const dmg = effDmg(s);
    let adj = 0;
    for (const a of ar) {
      if (ignore && sha) break;
      if (a === "仁王盾" && sha && col === "黑") return -999;
      if (a === "藤甲") { if (attr === "火") adj += 12; else if ((sha && !attr) || AOE.includes(n)) return -999; }
      if (a === "火盾" && attr === "火") return -999;
      if (a === "冰盾" && attr === "冰") return -999;
      if (a === "雷盾" && attr === "雷") return -999;
      if (a === "緩衝盾" && dmg <= 1 && !AOE.includes(n)) return -999;
      if (a === "八卦陣" && sha) adj -= 12;
    }
    return adj;
  }
  const bestTargetFor = (s, opts, label, n) => { let best = null, bs = -1e9; for (const o of opts) { const i = pIdx(o); if (i == null) continue; const ts = targetScore(s, i); if (ts <= -100) continue; const a = atkAdj(s, label, n, i); if (a <= -100) continue; const sc = ts + a; if (sc > bs) { bs = sc; best = o; } } return best ? { o: best, sc: bs } : null; };
  const enemies = (s) => alive(s).filter((o) => targetScore(s, o.idx) > -100);
  const allyScore = (s, idx) => { const m = me(s), p = s.players[idx]; if (!p || !p.alive) return -999; if (idx === s.viewer) return 10; if (m.role === "反賊") return p.role === "主公" ? -50 : 5; if (p.role === "主公") return 60; return 0; };
  function burstEstimate(s) {
    const m = me(s), hand = m.hand || [];
    const hammer = (m.equip.weapon && full(m.equip.weapon) === "流星錘") || has(m, "流星錘") ? 1 : 0;
    const dmgNames = ["決鬥", "南蠻入侵", "萬箭齊發", "飢餓", "突襲", "火攻", "笑裡藏刀"];
    const n = hand.filter((c) => dmgNames.includes(full(c))).length + Math.min(1, shaCnt(m));
    const buff = has(m, "強化");
    const per = (1 + hammer) * Math.pow(2, Math.min(buff, 3));
    return { n, buff, hammer, per, total: n * per };
  }
  function potentialDamage(s) {
    const m = me(s), hand = m.hand || [];
    const be = burstEstimate(s), mult = Math.pow(2, Math.min(be.buff, 3)), h = be.hammer;
    let d = be.total + (has(m, "酒") && shaCnt(m) ? mult : 0);
    if (has(m, "發憤圖強") && redirectCnt(m) > 0) d = Math.max(d, (5 + h) * mult * (m.char === "張昭" ? 2 : 1));
    if (m.char === "陳群" && m.hp === 4) d = Math.max(d, hand.length * (1 + h) * mult);
    if (m.char === "許褚") d = Math.max(d, shaCnt(m) * (1 + h) * 2 * mult);
    if (m.char === "張角") d = Math.max(d, shaCnt(m) * (1 + h) * mult);
    if (m.char === "劉諶") d = Math.max(d, Math.max(0, hand.length - 1) + (1 + h) * mult);
    if (m.char === "鄧艾") d = Math.max(d, (has(m, "南蠻入侵") + has(m, "萬箭齊發")) * (2 + h) * mult);
    return d;
  }
  function lethalOnLord(s) {
    const m = me(s), lord = lordOf(s);
    if (!lord || !lord.alive || lord.idx === s.viewer) return null;
    const dmg = potentialDamage(s);
    const hands = alive(s).filter((o) => o.idx !== s.viewer).reduce((a, o) => a + (o.hand_n || 0), 0);
    const peachEst = hands * 0.13;
    const needPeaches = dmg - lord.hp + 1;
    const ok = dmg >= lord.hp && needPeaches >= Math.max(1, Math.ceil(peachEst + 0.4));
    return { dmg, need: needPeaches, peachEst: +peachEst.toFixed(2), ok };
  }
  const redirectCnt = (m) => has(m, "反擊") + has(m, "調虎離山") + (m.char === "蔣幹" ? Math.max(0, (m.hand || []).length - 1) : 0);
  const selfBurstReady = (s) => { const m = me(s); return redirectCnt(m) > 0 && enemies(s).length > 0 && (m.hp >= 2 || has(m, "占卜") || has(m, "桃")); };
  function chainPlan(s) {
    const m = me(s); if (!has(m, "鐵索連環") || !has(m, "發憤圖強")) return null;
    const k = Math.min(5, m.hp - 1); if (k < 2) return null;
    const cand = enemies(s).filter((q) => q.hp <= k).sort((a, b) => targetScore(s, b.idx) - targetScore(s, a.idx))[0];
    return cand ? { idx: cand.idx, k } : null;
  }
  const chainedEnemy = (s) => { const m = me(s); if (!m.chained) return null; return enemies(s).filter((q) => q.chained).sort((a, b) => a.hp - b.hp)[0] || null; };
  function skillPri(s, label) {
    const m = me(s), hand = m.hand || [], en = enemies(s).length;
    B.skillLabels[label] = (B.skillLabels[label] || 0) + 1;
    if (/突襲/.test(label) && /陳群/.test(label)) return m.hp === 4 && hand.length >= 2 && en ? 93 : 0;
    if (/決鬥/.test(label) && /(劉諶|許褚)/.test(label)) return hand.length >= 1 && en ? 90 : 0;
    if (/南蠻/.test(label) && /張角/.test(label)) return shaCnt(m) >= 1 && en ? 89 : 0;
    if (/丈八蛇矛-雙牌當殺/.test(label)) { if (!en || hand.length < 2) return 0; const v = hand.map(keepVal).sort((a, b) => a - b); return v[0] < KEEP["殺"] && v[1] < KEEP["殺"] ? 60 : 0; }
    if (/殺殺/.test(label)) return shaCnt(m) >= 2 && en ? 86 : 0;
    if (/(周魴|素牌)/.test(label) && /扣血/.test(label)) return hand.length >= 3 && en ? 82 : 0;
    if (/逼出閃|令.*出閃/.test(label) && en) return 70;
    if (/重鑄/.test(label)) return hand.length <= 6 ? 26 : 0;
    if (/換牌/.test(label)) return hand.length >= 4 ? 30 : 0;
    if (/(回血|捨牌)/.test(label) && m.hp < m.maxhp && hand.length >= 3) return 55;
    if (/(抽|多抽)/.test(label) && hand.length <= 4) return 45;
    return 0;
  }
  function pickAct(s, p) {
    const m = me(s), hand = m.hand || [];
    const groups = {};
    for (const o of p.options) { const k = o.group != null ? o.group : "i" + o.i; (groups[k] = groups[k] || []).push(o); }
    const cands = [];
    const hurt = m.hp < m.maxhp;
    const cs = shaCnt(m);
    const haveWeapon = !!m.equip.weapon, haveArmor = !!m.equip.armor, haveHp = !!m.equip["h+"], haveHm = !!m.equip["h-"];
    const lord = lordOf(s);
    const lordLow = lord && lord.alive && lord.hp <= 2;
    const be = burstEstimate(s);
    const bestT = enemies(s).sort((a, b) => targetScore(s, b.idx) - targetScore(s, a.idx))[0];
    const killable = bestT && be.total >= bestT.hp;
    const sbr = selfBurstReady(s) && has(m, "發憤圖強");
    const cp = chainPlan(s);
    const chained = chainedEnemy(s);
    const comboOn = sbr || !!chained;
    const keepFloor = (B.owed > 0 && redirectCnt(m) === 0 && !chained && !cp && !B.lethal) ? B.owed : ((B.owed > 0 && m.char === "蔣幹" && !B.lethal && enemies(s).length) ? 3 : 0);
    const FREE = ["發憤圖強", "無中生有"];
    for (const k in groups) {
      const os = groups[k], o0 = os[0], c = o0.card;
      if (!c) { const pr = skillPri(s, o0.label); if (pr > 0) { const t = os.filter((o) => pIdx(o) != null); const ch = t.length ? (bestTargetFor(s, t, o0.label, /殺/.test(o0.label) ? "殺" : o0.label) || {}).o : o0; if (ch && !(keepFloor && hand.length - 2 < keepFloor && !/抽/.test(o0.label))) { const lm = /^〈[^〉]+〉 → [紅黑](.+)$/.exec(o0.label || ""); const adj = lm && KEEP[lm[1]] != null ? -KEEP[lm[1]] / 1000 : 0; cands.push({ pri: pr + adj, o: ch, n: o0.label }); } } continue; }
      const n = full(c), d = desc(c);
      const withT = os.filter((o) => o.target && o.target.kind === "player");
      let pri = 0, chosen = os[0];
      if (n === "桃") pri = hurt ? 100 : 0;
      else if (n === "發憤圖強") pri = 97;
      else if (n === "鐵索連環") pri = cp ? 98 : (hand.length <= 6 ? 22 : 0);
      else if (n === "無中生有") pri = 96;
      else if (n === "增兵減灶") pri = hand.length <= 7 ? 90 : 25;
      else if (n === "未雨綢繆") pri = 85;
      else if (n === "五穀豐登") pri = 55;
      else if (n === "桃園結義") pri = hurt ? 70 : 8;
      else if (n === "酒") pri = (cs >= 1 && enemies(s).length && !comboOn) ? 79.5 : 0;
      else if (n === "強化") { if (enemies(s).length && (be.n >= 1 || sbr)) { chosen = withT.find((o) => pIdx(o) === s.viewer) || os[0]; pri = sbr ? 99 : ((killable || be.buff >= 1 || B.lethal) ? 91 : 0); } }
      else if (n === "降雷") { const bt = bestTargetFor(s, withT, o0.label, n); if (bt && bt.sc > -100) { chosen = bt.o; pri = 40; } }
      else if (n === "出其不意") pri = (m.judge && m.judge.length) ? 77 : 0;
      else if (n === "轉移") { const bt = bestTarget(s, withT); if (bt && bt.sc > -100) { chosen = bt.o; const t = s.players[pIdx(chosen)]; pri = (t.equip && (t.equip.weapon || t.equip.armor) && !haveWeapon && !haveArmor) ? 45 : 0; } }
      else if (n === "投桃報李") { const bs = withT.slice().sort((a, b) => allyScore(s, pIdx(b)) - allyScore(s, pIdx(a)))[0]; if (bs) { chosen = bs; pri = 35; } }
      else if (n === "閃電" || n === "偽裝") pri = 0;
      else if (d.startsWith("⚡")) pri = 0;
      else if (/^武器/.test(d)) { const good = ["諸葛連弩", "流星錘"].includes(n); pri = !haveWeapon ? (n === "流星錘" && (sbr || B.lethal) ? 99.5 : good ? 82 : 60) : (n === "諸葛連弩" ? 40 : 0); }
      else if (/^裝備\(防具\)/.test(d)) { const rank = { "緩衝盾": 76, "八卦陣": 72, "仁王盾": 66, "火盾": 50, "冰盾": 50, "雷盾": 50, "藤甲": 45 }; pri = !haveArmor ? (rank[n] || 50) : 0; }
      else if (/^裝備\(坐騎\)/.test(d)) pri = (/\+1馬/.test(n) ? !haveHp : !haveHm) ? 40 : 0;
      else if (withT.length) {
        const bt = bestTargetFor(s, withT, o0.label, n); if (!bt || bt.sc < -100) continue; chosen = bt.o;
        const hp = s.players[pIdx(chosen)].hp;
        if (isSha(n)) pri = 80 + (hp <= 1 ? 5 : 0);
        else if (n === "決鬥") pri = cs >= 1 ? 78 : 30;
        else if (n === "火攻") pri = hand.length >= 3 ? 72 : 35;
        else if (n === "過河拆橋" || n === "順手牽羊") pri = 74;
        else if (["樂不思蜀", "兵糧寸斷", "毒", "草木皆兵"].includes(n)) pri = 73;
        else if (n === "拋磚引玉") pri = 50;
        else if (n === "鴻門宴") pri = 45;
        else if (n === "笑裡藏刀") pri = hp <= 1 ? 70 : 38;
        else if (n === "借刀殺人") pri = 30;
        else if (n === "聲東擊西") pri = 20;
        else pri = 25;
        if (B.lethal && pIdx(chosen) === (lord && lord.idx) && /殺|決鬥|火攻|笑裡藏刀/.test(n)) pri += 12;
      } else if (["南蠻入侵", "萬箭齊發", "飢餓", "突襲"].includes(n)) {
        const hitsAlly = m.role !== "反賊" && lord && lord.alive;
        const hit = enemies(s).filter((q) => atkAdj(s, o0.label, n, q.idx) > -100);
        pri = hit.length && !(hitsAlly && lordLow) ? 68 : 0;
        if (B.lethal && m.role === "反賊") pri += 12;
      } else pri = 10;
      if (pri > 0 && keepFloor && hand.length - 1 < keepFloor && !FREE.includes(n) && !(n === "桃" && m.hp <= 2)) continue;
      if (pri > 0) cands.push({ pri, o: chosen, n });
    }
    cands.sort((a, b) => b.pri - a.pri);
    return cands;
  }
  const passOpt = (p) => p.options.find((o) => /^不發動,這類選項/.test(o.label)) || p.options.find((o) => /不發動|不出|不救|取消|跳過|不要/.test(o.label));
  const numOf = (o) => parseInt((String(o.label).match(/\d+/) || [0])[0], 10);
  function decideChain(s, p) {
    const m = me(s), pr = p.prompt || "";
    const use = (name, tgt) => p.options.find((o) => o.card && full(o.card) === name && (tgt == null || pIdx(o) === tgt));
    const anyUse = (name) => p.options.find((o) => o.card && full(o.card) === name);
    const mt = /P(\d)\([^)]*\) 即將受到 (\d+) 點傷害(?: \(反擊轉出 (\d+) 點\))?/.exec(pr);
    if (mt) {
      const victim = +mt[1], N = +mt[2]; if (mt[3]) B.reflectN = +mt[3];
      if (victim === s.viewer) {
        const rf = anyUse("反擊"), th = anyUse("調虎離山"), dv = anyUse("占卜"), ww = anyUse("弱化");
        const selfInflicted = s.cur === s.viewer;
        const anyEnemy = enemies(s).length > 0;
        if (rf && anyEnemy && (N >= 2 || N >= m.hp || selfInflicted)) return [rf.i];
        if (th && anyEnemy && (N >= 2 || N >= m.hp || selfInflicted)) return [th.i];
        if (dv && N >= m.hp) return [dv.i];
        if (ww && N >= 2 && s.cur !== s.viewer) { const w = use("弱化", s.cur); if (w) return [w.i]; }
      } else {
        const ey = targetScore(s, victim) > -100;
        if (ey && s.cur === s.viewer) { const q = use("強化", s.viewer); if (q) return [q.i]; }
      }
      const gh = anyUse("隔岸觀火"); if (gh) return [gh.i];
    }
    const gh = anyUse("隔岸觀火"); if (gh && /受到|受傷/.test(pr)) return [gh.i];
    const wx = anyUse("無懈可擊") || anyUse("無懈");
    if (wx && s.cur !== s.viewer && /對你使用|南蠻|萬箭|飢餓|突襲|決鬥/.test(pr)) return [wx.i];
    const o = passOpt(p); return o ? [o.i] : [];
  }
  function decideRespond(s, p) {
    const m = me(s), pr = p.prompt || "";
    const pass = p.options.find((o) => /不出|不救|不發動|取消/.test(o.label));
    const cardOpts = p.options.filter((o) => o.card);
    if (/瀕死了/.test(pr)) {
      const victim = /你瀕死了/.test(pr) ? s.viewer : +((/P(\d)\(/.exec(pr) || [])[1] ?? -1);
      const v = s.players[victim]; if (!v || !cardOpts.length) return pass ? [pass.i] : [];
      let save = false;
      if (victim === s.viewer) save = true;
      else if (v.role === "主公") save = m.role === "主公" || m.role === "忠臣" || (m.role === "內奸" && alive(s).filter((o) => o.idx !== s.viewer && o.role !== "主公").length >= 1);
      if (!save) return pass ? [pass.i] : [];
      return [cardOpts.sort((a, b) => (full(a.card) === "桃" ? -1 : 1))[0].i];
    }
    if (!cardOpts.length) return pass ? [pass.i] : [];
    const armorM = /當作(\S+?)裝備嗎/.exec(pr);
    if (armorM) { const low = cardOpts.slice().sort((a, b) => keepVal(a.card) - keepVal(b.card))[0]; const ap = KEEP[armorM[1]] != null ? KEEP[armorM[1]] : 50; if (keepVal(low.card) < ap) { L("卡牌優先度: 棄 " + low.label + " (" + keepVal(low.card) + ") 當 " + armorM[1] + " (" + ap + ")"); return [low.i]; } return pass ? [pass.i] : []; }
    if (p.min > 1) return pass ? [pass.i] : cardOpts.slice().sort((a, b) => keepVal(a.card) - keepVal(b.card)).slice(0, p.min).map((o) => o.i);
    const names = cardOpts.map((o) => full(o.card));
    if (names.every((n) => n === "桃")) return m.hp <= 2 ? [cardOpts[0].i] : (pass ? [pass.i] : []);
    return [cardOpts.slice().sort((a, b) => keepVal(a.card) - keepVal(b.card))[0].i];
  }
  function decideSelfDamage(s, p) {
    const m = me(s);
    const opts = p.options.map((o) => ({ i: o.i, k: (/扣 (\d+) 點/.exec(o.label) || [0, 0])[1] * 1 })).sort((a, b) => a.k - b.k);
    const maxK = opts[opts.length - 1].k;
    const redirect = redirectCnt(m);
    const backup = has(m, "占卜") + has(m, "桃");
    const chainedE = chainedEnemy(s);
    let k = 0;
    if (chainedE) k = Math.min(maxK, m.hp - 1);
    else if (redirect > 0 && enemies(s).length) {
      k = (redirect >= 2 || backup >= 1 || m.hp > maxK) ? maxK : Math.min(maxK, m.hp - 1);
    }
    k = Math.min(k, Math.max(0, m.hp - 1));   // 自傷上限: 血量-1 (實測: 發憤圖強少棄 20 張會自殺)
    k = Math.max(0, Math.min(k, maxK));
    const pick = opts.filter((x) => x.k <= k).pop() || opts[0];
    L("發憤圖強結算: 少棄 " + pick.k + " 張 (待棄累計 " + B.owed + ", redirect=" + redirect + " chained=" + !!chainedE + " hp=" + m.hp + ")");
    return [pick.i];
  }
  function decideGeneric(s, p) {
    const m = me(s), pr = p.prompt || "";
    note(p.kind, p);
    { const st = B.strat[m.char]; if (st && st.decide) { const r = st.decide(s, p, B.H); if (r) return r; } }
    if (p.kind === "skill") {
      if (/^貫石斧/.test(pr)) { const y = p.options.find((o) => /^發動|^使用|^是/.test(o.label)); if (y) { L("貫石斧: 一律發動"); return [y.i]; } }
      if (/^寒冰劍/.test(pr)) { const n0 = passOpt(p); L("寒冰劍: 一律不發動"); return n0 ? [n0.i] : []; }
      if (/即將受到|使用了|要接連鎖|對你使用|回合開始|出牌階段結束/.test(pr)) return decideChain(s, p);
      const yes = p.options.find((o) => /^發動|^使用|^是/.test(o.label));
      const no = passOpt(p);
      if (/曹彰/.test(pr)) return (shaCnt(m) >= 2 || (m.hand || []).length >= 4) && yes ? [yes.i] : (no ? [no.i] : []);
      if (/劉諶/.test(pr)) return ((m.hand || []).length >= 5) && yes ? [yes.i] : (no ? [no.i] : []);
      if (/許褚/.test(pr)) return (shaCnt(m) >= 2) && yes ? [yes.i] : (no ? [no.i] : []);
      return no ? [no.i] : [];
    }
    if (p.kind === "respond") return decideRespond(s, p);
    if (/發憤圖強-少棄/.test(pr)) return decideSelfDamage(s, p);
    if (/結算方向/.test(pr)) {
      const n = s.players.length, v = s.viewer;
      const first = (dir) => { for (let k = 1; k < n; k++) { const q = s.players[(v + dir * k + n * 3) % n]; if (q.alive) return q; } return null; };
      const L1 = first(1), R1 = first(-1);
      const sl = L1 ? targetScore(s, L1.idx) : -999, sr = R1 ? targetScore(s, R1.idx) : -999;
      const o = p.options.find((x) => x.label.includes(sl >= sr ? "左" : "右")); return [(o || p.options[0]).i];
    }
    if (p.kind === "target" || /選擇目標/.test(pr)) {
      const po = p.options.filter((o) => pIdx(o) != null);
      let best = null, bs = -1e9;
      for (const o of po) { const i = pIdx(o); let sc = targetScore(s, i); if (sc <= -100) continue; if (armorsOf(s.players[i]).includes("緩衝盾")) sc -= 10; const hp = hpOfLabel(o); if (hp != null && B.reflectN >= hp) sc += 80 + Math.min(6, B.reflectN - hp) * 4; if (sc > bs) { bs = sc; best = o; } }
      return [(best || po[0] || p.options[0]).i];
    }
    if (p.kind === "chain") {
      const po = p.options.filter((o) => pIdx(o) != null);
      const cp = chainPlan(s);
      if (cp) { const a = po.find((o) => pIdx(o) === s.viewer), b = po.find((o) => pIdx(o) === cp.idx); const ids = [a, b].filter(Boolean).map((o) => o.i); if (ids.length === 2) return ids; }
      const en = po.filter((o) => targetScore(s, pIdx(o)) > -100).sort((a, b) => targetScore(s, pIdx(b)) - targetScore(s, pIdx(a)));
      const ids = en.slice(0, Math.max(1, p.max)).map((o) => o.i); return ids.length ? ids : [po[0].i];
    }
    if (p.kind === "count" || /選擇張數|要抽幾張/.test(pr)) {
      const nums = p.options.map((o) => ({ i: o.i, v: numOf(o) })).sort((a, b) => a.v - b.v);
      if (/捨牌回血/.test(pr)) { const need = m.maxhp - m.hp; const pick = nums.filter((x) => x.v <= need).pop() || nums[0]; return [pick.i]; }
      if (/換牌/.test(pr)) return [nums[nums.length - 1].i];
      if (/發憤圖強/.test(pr)) { const top = nums[nums.length - 1]; B.owed += top.v; L("發憤圖強: 抽 " + top.v + " 張, 本回合待棄累計 " + B.owed); return [top.i]; }
      return [nums[0].i];
    }
    if (p.kind === "mode") {
      if (/換裝/.test(pr)) { const pv = (o) => { const mm = /換掉 [紅黑]?(.+)$/.exec(o.label || ""); const n = mm ? mm[1] : ""; return KEEP[n] != null ? KEEP[n] : 30; }; return [p.options.slice().sort((a, b) => pv(a) - pv(b))[0].i]; }
      const sel = p.options.find((o) => /重鑄/.test(o.label));
      if (/鐵索連環/.test(pr)) { const cp = chainPlan(s); const h = p.options.find((o) => /橫置/.test(o.label)); if (cp && h) return [h.i]; if (sel) return [sel.i]; }
      return [p.options[0].i];
    }
    const cardOpts = p.options.filter((o) => o.card);
    if (p.min > 0 && cardOpts.length >= p.min) {
      const isDiscard = !(p.kind === "pile" || p.kind === "pick" || p.kind === "show" || /選一張牌/.test(pr));
      const sorted = cardOpts.slice().sort((a, b) => isDiscard ? keepVal(a.card) - keepVal(b.card) : keepVal(b.card) - keepVal(a.card));
      return sorted.slice(0, p.min).map((o) => o.i);
    }
    const playerOpts = p.options.filter((o) => pIdx(o) != null);
    if (playerOpts.length && p.min > 0) {
      const heal = /回血|\+1|回復/.test(pr) && !/扣|傷害/.test(pr);
      const pick = heal ? playerOpts.slice().sort((a, b) => allyScore(s, pIdx(b)) - allyScore(s, pIdx(a)))[0] : (bestTarget(s, playerOpts) || {}).o;
      return [(pick || playerOpts[0]).i];
    }
    if (p.min === 0) { const o = passOpt(p); return o ? [o.i] : []; }
    return p.options.slice(0, Math.max(1, p.min)).map((o) => o.i);
  }
  async function rp() { try { const r = await fetch("/api/profile?tok=" + encodeURIComponent(TOK)); const j = await r.json(); return { rp: j.rp, rank: j.rank, rgames: j.rgames, rwins: j.rwins }; } catch (e) { return null; } }
  async function newGame() {
    let chars = B.cfg.forceChar ? [B.cfg.forceChar] : (B.cfg.useRotate ? [B.cfg.rotate[B.gi % B.cfg.rotate.length]] : []);
    let lordSeat = B.cfg.lord || "random";
    if (B.cfg.queue) {
      const cur = B.cfg.queue.find((q) => { const e = B.qstats[q.c] || { g: 0, w: 0 }; return e.w < (q.need || 3) && e.g < (q.max || 8); });
      if (!cur) { L("練習佇列完成"); B.running = false; return { ok: false, done: true }; }
      chars = (B.cfg.queueLord != null) ? [cur.c, "", "", ""] : [cur.c]; if (B.cfg.queueLord != null) lordSeat = String(B.cfg.queueLord);
    }
    if (B.cfg.vs) { chars = [B.cfg.vs.me || "", B.cfg.vs.opp]; lordSeat = "0"; }
    B.curChar = chars[0] || "random"; B.gi++;
    const seed = B.cfg.seeds ? String(B.cfg.seeds[(B.gi - 1) % B.cfg.seeds.length]) : "";
    const spd = (window.SGSPANEL && window.SGSPANEL.series) ? (window.SGSPANEL.speed || 0.15) : 0.15;
    const nb = { players: B.cfg.players, human: "0", humans: [0], chars, variant: 0, lord: lordSeat, mode: "normal", role_mode: "normal", base_hp: 4, ranked: !!B.cfg.ranked, difficulty: B.cfg.difficulty, diffs: [], seed, speed: spd }; let r = await api("/api/new", nb);
    if (B.cfg.forceRole) { for (let t = 0; t < 60; t++) { const s0 = await api("/api/state?log=0&th=0&peek=0&chat=0"); const m0 = s0 && s0.players && s0.players[s0.viewer]; if (m0 && m0.role === B.cfg.forceRole) break; r = await api("/api/new", nb); } }
    L("new game " + (B.cfg.ranked ? "[段位] " : "[休閒] ") + B.curChar + ": " + JSON.stringify(r)); B.logN = 0; B.thN = 0; B.lastId = -1; B.tries = {}; B.me = null; B.reflectN = 0; B.susp = {}; B.lethal = false; B.lethalInfo = null; B.owed = 0; B.turnRound = -1; B.cur = []; B.disg = null;
    return r;
  }
  async function loop() {
    B.running = true; L("bot started ranked=" + !!B.cfg.ranked);
    if (B.stats.rpStart == null) { const r0 = await rp(); if (r0) { B.stats.rpStart = r0; B.stats.rpNow = r0; } }
    let overHandled = false, lastPl = null;
    while (B.running) {
      try {
        const s = await S();
        if (s.log_total != null) B.logN = s.log_total; if (s.thought_total != null) B.thN = s.thought_total;
        if (s.logs && s.logs.length) for (const ln of s.logs) { const t = ln.replace(/\u0001/g, "^"); B.cur.push(t); if (/發憤|反擊|調虎|少棄|同受傷害/.test(ln) && B.evt.length < 400) B.evt.push(t.slice(0, 120)); }
        if (s.players && s.viewer != null && s.players[s.viewer] && !s.over) {
          lastPl = s.players.map((p) => (p.role || "?") + "/" + p.char + ":" + p.hp);
          const lordP = lordOf(s);
          if (s.logs && lordP) for (const ln of s.logs) {
            const mt2 = /P(\d)\([^)]*\) 對 P(\d)\([^)]*\) 使用 (\S+)/.exec(ln);
            if (mt2) {
              const a = +mt2[1], b2 = +mt2[2], cn = mt2[3];
              const hostile = /殺|決鬥|火攻|笑裡藏刀|鴻門宴|過河拆橋|順手牽羊|樂不思蜀|兵糧寸斷|毒|草木皆兵|借刀殺人/.test(cn);
              const friendly = /桃|投桃報李/.test(cn);
              const sa = B.susp[a] = B.susp[a] || { rebel: 0, loyal: 0 }, sb = B.susp[b2] = B.susp[b2] || { rebel: 0, loyal: 0 };
              if (b2 === lordP.idx && a !== lordP.idx) { if (hostile) sa.rebel += 2; else if (friendly) sa.loyal += 2; }
              else if (a === lordP.idx && b2 !== lordP.idx) { if (hostile) sb.rebel += 1; else if (friendly) sb.loyal += 2; }
            }
          }
          const mr = me(s).role; const li = (mr === "反賊" || (mr === "內奸" && !alive(s).some((o) => o.idx !== s.viewer && o.role !== "主公"))) ? lethalOnLord(s) : null;
          B.lethalInfo = li; B.lethal = !!(li && li.ok);
        }
        if (!B.cfg.ranked && s.ranked === true && s.ready && !s.over) { L("偵測到段位局但設定為只跑休閒, 機器人停止"); B.running = false; break; }
        if (s.players && s.viewer != null && s.players[s.viewer]) { const mm = s.players[s.viewer]; B.me = { role: mm.role, char: mm.char }; }
        if (s.pick) {
          const key = s.pick.seat + ":" + s.pick.offers.map((x) => x.name).join();
          if (B.picked !== key) { B.picked = key; const offers = s.pick.offers.slice().sort((a, b) => pickScore(b) - pickScore(a)); await api("/api/pick", { name: offers[0].name }); L("pick " + offers[0].name + " (" + s.pick.offers.map((x) => x.name + ":" + pickScore(x)).join(" / ") + ")"); }
          await sleep(400); continue;
        }
        if (s.over) {
          if (!overHandled) {
            overHandled = true; B.stats.games++; const m = B.me || {}; const w = s.winner || "";
            const mine = (w === "主公陣營" && (m.role === "主公" || m.role === "忠臣")) || (w === "反賊" && m.role === "反賊") || (w === "內奸" && m.role === "內奸") || (!!m.char && w.indexOf(m.char + " (") === 0);
            if (mine) B.stats.wins++; else B.stats.losses++;
            const c = m.char || "?"; const bc = B.stats.byChar[c] = B.stats.byChar[c] || { g: 0, w: 0 }; bc.g++; if (mine) bc.w++;
            const rl = m.role || "?"; const br = B.stats.byRole[rl] = B.stats.byRole[rl] || { g: 0, w: 0 }; br.g++; if (mine) br.w++;
            if (B.cfg.queue) { const e = B.qstats[c] = B.qstats[c] || { g: 0, w: 0 }; e.g++; if (mine) e.w++; }
            const r1 = await rp(); if (r1) B.stats.rpNow = r1;
            B.history.push({ ranked: !!s.ranked, char: c, role: rl, win: !!mine, round: s.round, rp: r1 && r1.rp });
            B.games.push({ meta: { char: c, role: rl }, winner: w, round: s.round, ranked: !!s.ranked, pl: lastPl || [], logs: B.cur.slice() }); if (B.games.length > 300) B.games.shift();
            L("game over " + w + " me=" + c + "/" + rl + " round=" + s.round + (mine ? " WIN" : " LOSS") + (r1 ? " rp=" + r1.rp + " " + r1.rank : ""));
          }
          if (B.cfg.autoNext && B.stats.games < B.cfg.maxGames) { await sleep(1500); overHandled = false; B.picked = null; await newGame(); await sleep(800); continue; }
          B.running = false; break;
        }
        overHandled = false;
        if (!s.ready) { if (B.cfg.autoNext) await newGame(); await sleep(800); continue; }
        curS = s; const p = s.pending;
        if (!B.cfg.ranked && s.round > 40 && (!B.cfg.queue || B.cfg.queueDeadRestart !== false && !(s.players && s.players[s.viewer] && s.players[s.viewer].alive)) && !B.cfg.vs) { L(B.cfg.queue ? "訓練佇列: 我已死亡且 round>40, 休閒局放棄重開 (這局不計入)" : "round>40, 休閒局重開"); await newGame(); continue; }
        if (!p || p.id === B.lastId) { await sleep(B.cfg.pollMs); continue; }
        let choice;
        if (p.kind === "act") {
          if (B.turnRound !== s.round) { B.turnRound = s.round; B.owed = 0; }
          let cands = pickAct(s, p);
          { const st = B.strat[me(s).char]; if (st && st.act) { const r = st.act(s, p, cands, B.H); if (r) cands = r; } }
          if (me(s).char === "蔣幹") cands = cands.filter((c) => !(c.o && c.o.card && full(c.o.card) === "偽裝"));
          const tk = s.round + "|" + (cands[0] ? cands[0].o.label : "end");
          B.tries[tk] = (B.tries[tk] || 0) + 1;
          if (cands.length && B.tries[tk] <= 3) { choice = [cands[0].o.i]; if (/強化/.test(cands[0].o.label)) { if (B.buffRound !== s.round) { B.buffRound = s.round; B.buffCnt = 0; } B.buffCnt++; } if (B.lethal) B.lethalSeen++; L("act: " + cands[0].o.label + (B.lethal ? " [一擊必殺 " + JSON.stringify(B.lethalInfo) + "]" : "")); } else { choice = []; L("act: end"); }
        } else choice = decideGeneric(s, p);
        const r = await ans(p, choice);
        if (r && r.ok === false) { B.stats.errors++; L("answer failed: " + r.error + " kind=" + p.kind + " prompt=" + (p.prompt || "").slice(0, 50) + " choice=" + JSON.stringify(choice)); }
      } catch (e) { B.stats.errors++; L("exception: " + e); await sleep(800); }
    }
    L("bot stopped");
  }
  B.H = { me, has, full, shaCnt, alive, lordOf, enemies, targetScore, pIdx, bestTarget, bestTargetFor, passOpt, redirectCnt, keepVal, L, isSha, desc, burstEstimate, potentialDamage, effDmg, atkAdj, numOf };
  B.layer = (c, ext) => { const prev = B.strat[c] || {}; const o = Object.assign({}, prev); if (ext.act) o.act = (s, p, cands, H) => { const base = prev.act ? prev.act(s, p, cands, H) : cands; const r = ext.act(s, p, base, H); return r || base; }; if (ext.decide) o.decide = (s, p, H) => { const r = ext.decide(s, p, H); if (r) return r; return prev.decide ? prev.decide(s, p, H) : null; }; B.strat[c] = o; };
  B.start = () => { if (!B.running) loop(); return "started"; };
  if (P0) P0.auto = autoWas;
  return "bot core v6 loaded";
}