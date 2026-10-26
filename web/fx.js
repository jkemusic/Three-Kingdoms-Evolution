/* 音效 (WebAudio 即時合成,不需音檔) + 出牌動畫。由 index.html 的 addLogs 呼叫 SGS_FX.onLine。 */
(function () {
  let ctx = null, muted = false, vol = 0.5;
  let tts = false, fs = 1;
  try { muted = localStorage.getItem("sgs_snd") === "off"; const v = parseFloat(localStorage.getItem("sgs_vol")); if (v >= 0 && v <= 1) vol = v; tts = localStorage.getItem("sgs_tts") === "on"; const f = parseFloat(localStorage.getItem("sgs_fs")); if (f >= 0.8 && f <= 1.5) fs = f; } catch (e) {}
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  document.documentElement.style.setProperty("--fs", fs);
  function ac() {
    if (muted) return null;
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(f0, dur, type, v, f1, delay) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((v || 0.3) * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, v, f0, f1, delay, q) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + (delay || 0), n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b;
    const fl = c.createBiquadFilter(); fl.type = "bandpass"; fl.Q.value = q || 1.2; fl.frequency.setValueAtTime(f0, t);
    if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime((v || 0.3) * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(c.destination); s.start(t);
  }
  const SFX = {
    card() { noise(0.06, 0.5, 2200, 1200); tone(320, 0.07, "triangle", 0.18, 180); },
    slash() { noise(0.28, 0.7, 500, 5000, 0, 0.8); tone(220, 0.2, "sawtooth", 0.08, 90); },
    dodge() { noise(0.16, 0.4, 900, 3200); tone(420, 0.14, "sine", 0.15, 900); },
    hit() { tone(170, 0.2, "sine", 0.55, 50); noise(0.12, 0.6, 700, 200); },
    fire() { noise(0.45, 0.6, 3000, 800, 0, 0.6); tone(150, 0.3, "sawtooth", 0.15, 70); },
    thunder() { noise(0.35, 0.8, 4500, 300, 0, 0.5); tone(90, 0.4, "square", 0.2, 40); },
    heal() { [523, 659, 784].forEach((f, i) => tone(f, 0.28, "sine", 0.22, 0, i * 0.09)); },
    equip() { tone(880, 0.1, "triangle", 0.25); tone(1320, 0.14, "triangle", 0.18, 0, 0.06); noise(0.05, 0.3, 4000, 4000); },
    trick() { tone(600, 0.25, "sine", 0.2, 1300); tone(900, 0.2, "triangle", 0.1, 1700, 0.08); },
    duel() { noise(0.1, 0.7, 3500, 2500); noise(0.1, 0.7, 3000, 2000, 0.16); tone(700, 0.1, "square", 0.1, 400, 0.02); },
    ping() { tone(988, 0.12, "sine", 0.28); tone(1319, 0.2, "sine", 0.24, 0, 0.1); },   // 輪到你操作
    turn() { tone(660, 0.22, "sine", 0.22); tone(880, 0.3, "sine", 0.15, 0, 0.1); },
    death() { tone(320, 0.7, "sawtooth", 0.3, 60); noise(0.5, 0.4, 600, 100); },
    judgeR() { [0, 0.06, 0.12].forEach(d => noise(0.03, 0.35, 3000, 2000, d)); tone(988, 0.22, "sine", 0.28, 0, 0.2); tone(1319, 0.3, "sine", 0.2, 0, 0.26); },   // 判定翻牌: 嘰嘰嘰 + 叮 (紅色: 亮)
    judgeB() { [0, 0.06, 0.12].forEach(d => noise(0.03, 0.35, 3000, 2000, d)); tone(247, 0.3, "triangle", 0.3, 0, 0.2); tone(185, 0.35, "sine", 0.22, 0, 0.26); },   // 黑色: 低沉
    draw() { noise(0.08, 0.45, 1400, 3000); tone(520, 0.07, "triangle", 0.16, 760); tone(660, 0.06, "triangle", 0.1, 900, 0.05); },   // 抽牌: 唰地滑進手裡
    discard() { noise(0.11, 0.55, 2400, 500); tone(260, 0.12, "triangle", 0.2, 120); tone(170, 0.1, "sine", 0.14, 90, 0.05); },   // 棄牌: 啪地丟掉
    flip() { noise(0.09, 0.5, 1800, 600); tone(520, 0.09, "triangle", 0.22, 240); tone(300, 0.12, "triangle", 0.18, 520, 0.09); },   // 武將牌翻面
    disguise() { noise(0.3, 0.35, 700, 3200, 0, 0.7); [392, 523, 784].forEach((f, i) => tone(f, 0.16, "sine", 0.14, f * 0.8, i * 0.07)); },   // 偽裝: 變身
    rankup() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, "triangle", 0.26, 0, i * 0.11)); tone(2093, 0.6, "sine", 0.12, 0, 0.55); noise(0.4, 0.2, 5000, 9000, 0.5, 2); },   // 升段: 上行琶音 + 閃光
    rankdown() { [523, 440, 349, 262].forEach((f, i) => tone(f, 0.35, "sawtooth", 0.14, f * 0.97, i * 0.16)); tone(110, 0.7, "sine", 0.3, 55, 0.5); },   // 降段: 下行低沉
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, "triangle", 0.28, 0, i * 0.14)); },
  };
  function sfx(k) { if (!muted && SFX[k]) SFX[k](); }

  /* ----- 動畫 ----- */
  function layer() { return document.getElementById("tablewrap"); }
  function center() { const w = layer(); return w ? [w.clientWidth / 2, w.clientHeight / 2] : null; }
  function cardOf(str) {   // 從「使用 / 打出 / 裝備 … 牌名」找出牌圖
    if (typeof S === "undefined" || !S.cat || !S.catRe) return null;
    S.catRe.lastIndex = 0; let m;
    while ((m = S.catRe.exec(str))) {
      const c = m[3] ? catCard(m[1], m[2], m[3]) : m[4] ? catCard("", "", m[4]) : m[5] ? catCard("", "", m[5]) : null;
      if (c && c.img) return c;
    }
    return null;
  }
  function fly(A, B, c) {
    const w = layer(); if (!w || !A || !B || !c) return;
    const e = document.createElement("div"); e.className = "fxcard";
    const im = document.createElement("img"); im.src = c.img; e.append(im); w.append(e);
    const T = p => `translate(${p[0]}px,${p[1]}px) translate(-50%,-50%)`;
    const an = e.animate([
      { transform: T(A) + " scale(.5)", opacity: 0 },
      { transform: T(A) + " scale(.9)", opacity: 1, offset: .15 },
      { transform: T(B) + " scale(1)", opacity: 1, offset: .75 },
      { transform: T(B) + " scale(1.15)", opacity: 0 },
    ], { duration: 950, easing: "ease-out" });
    an.onfinish = () => e.remove();
  }
  function burst(P, cls, txt) {
    const w = layer(); if (!w || !P) return;
    const e = document.createElement("div"); e.className = "fxburst " + cls; e.style.left = P[0] + "px"; e.style.top = P[1] + "px"; if (txt) e.textContent = txt;
    w.append(e); setTimeout(() => e.remove(), 900);
  }
  const pos = i => (typeof playerPos === "function" ? playerPos(i) : null);

  let budget = { snd: 0, fly: 0 }, lastFly = { key: "", t: 0 };
  let hintD = null;   // 引擎先送一行隱藏的「出牌者|目標|種類」,緊接著的 [Chain] 使用 行就知道牌要飛向誰
  let skipD = null;   // 已經照提示飛過了: 之後同一張牌的「對 P#」/「放入」行不要再飛第二次
  let healSeen = null;   // 引擎的隱藏回血行已經播過特效: 緊接著的「回 N 點體力」文字行不要再播一次
  function hint(s0, quiet) {
    const jm = s0.match(/^JUDGE\|(-?\d+)\|(\S*)/);
    if (jm) { if (!quiet && budget.snd++ < 6) sfx(jm[2] === "紅" ? "judgeR" : "judgeB"); return; }
    const dm = s0.match(/^\x01DRAW\|(\d+)\|(\d+)/);
    if (dm) { if (!quiet && budget.snd++ < 6) sfx("draw"); return; }
    const hm = s0.match(/^HEAL\|(\d+)/);
    if (hm) { if (!quiet) { healSeen = +hm[1]; burst(pos(+hm[1]), "heal", "+"); if (budget.snd++ < 6) sfx("heal"); } return; }
    const m = s0.match(/^\x01FX\|(\d+)\|(-?\d+)\|(\w*)/);
    hintD = !quiet && m ? { who: +m[1], tgt: +m[2], kind: m[3] } : null;
  }
  function speak(s) {   // 朗讀: 去掉連鎖符號與身分括號,太多排隊時丟掉舊的
    if (!tts || !window.speechSynthesis) return;
    const txt = s.replace(/\[Chain \d+\]/g, "").replace(/\([^)]*\)/g, "").replace(/[↳\-=*|]+/g, " ").replace(/\s+/g, " ").trim();
    if (!txt) return;
    try {
      const ss = window.speechSynthesis;
      if (ss.pending) ss.cancel();
      const u = new SpeechSynthesisUtterance(txt); u.lang = (window.SGS_I18N && SGS_I18N.lang === "en") ? "en-US" : (window.SGS_I18N && SGS_I18N.lang === "ja") ? "ja-JP" : "zh-TW"; u.rate = 1.15;
      ss.speak(u);
    } catch (e) {}
  }
  function onLine(s0, quiet) {
    if (!quiet && s0.charCodeAt(0) !== 1) speak(s0);
    const hd = hintD, sk = skipD; hintD = null; if (skipD && --skipD.ttl < 0) skipD = null;   // 重複行可能隔幾行才出現 (例如中間夾著響應紀錄),所以多留幾行
    if (quiet) return;
    const chain = /^\s*\[Chain \d+\]/.test(s0);
    const s = s0.replace(/\[Chain \d+\]\s*/, "").trim();
    const cm = chain && s.match(/^(P(\d+)\([^)]*\)) (?:使用|打出) (\S+)$/);
    if (cm && hd && hd.who === +cm[2]) {
      if (hd.kind === "eq") return handle(s, hd);   // 裝備牌: 等「裝備」那一行在自己身上播
      skipD = { who: cm[1], card: cm[3].replace(/^(紅|黑)/, ""), ttl: 4 };
      return handle(s, hd);
    }
    if (sk && s.startsWith(sk.who) && s.includes(sk.card) && /(?:使用|打出|放入)/.test(s)) { skipD = null; return; }   // 同一張牌的第二行: 動畫與音效都已播過,不重播
    handle(s);
  }
  function handle(s, hd, noFly) {
    const playSfx = k => { if (budget.snd++ < 5) sfx(k); };
    const doFly = (a, b, c) => {
      if (noFly || !c) return;
      const key = (a && a.join()) + "|" + c.name, now = Date.now();   // 同一個人的同一張牌 1.5 秒內只飛一次 (同一次出牌的兩行紀錄不重播)
      if (lastFly.key === key && now - lastFly.t < 1500) return;
      if (budget.fly++ < 4) { lastFly = { key, t: now }; fly(a, b, c); }
    };
    let m;
    if (/^---/.test(s)) return playSfx("turn");
    if (/^===.*勝利/.test(s)) return playSfx("win");
    if (/\*\*\*.*陣亡/.test(s)) { m = s.match(/P(\d+)/); if (m) burst(pos(+m[1]), "die", "☠"); return playSfx("death"); }
    if ((m = s.match(/P(\d+)\([^)]*\) 受到 (\d+) 點(\S*?)傷害/))) {
      burst(pos(+m[1]), "hit");
      return playSfx(/火/.test(m[3]) ? "fire" : /雷/.test(m[3]) ? "thunder" : "hit");
    }
    if ((m = s.match(/P(\d+)\([^)]*\)[^\n]*回 (\d+) 點體力/))) { if (healSeen === +m[1]) { healSeen = null; return; } burst(pos(+m[1]), "heal", "+"); return playSfx("heal"); }
    if (/武將牌翻(?:面|成)/.test(s) && !/不會翻面|不能被降雷翻回/.test(s)) return playSfx("flip");
    if (/偽裝成/.test(s)) return playSfx("disguise");
    if (/棄置|棄掉|棄\s*[\d兩]|丟掉|棄牌|棄光/.test(s) && !/放棄|不依體力棄牌/.test(s)) return playSfx("discard");   // 棄牌 / 被棄置
    const who = (s.match(/^P(\d+)\(/) || [])[1];
    const tgt = (s.match(/對 P(\d+)\(/) || s.match(/放入 P(\d+)\(/) || [])[1];
    if (!who || !/使用|打出|裝備|放入|發動/.test(s) || /使用〈/.test(s)) return;
    const c = cardOf(s.slice(s.search(/使用|打出|裝備|放入|發動/)));
    if (c && S.cat && S.cat[c.name] && S.cat[c.name].eq && !/裝備/.test(s)) return;   // 裝備牌的「使用」不飛; 等「裝備」那行在自己身上播
    const A = pos(+who), B = hd ? (hd.kind === "self" ? pos(+who) : hd.tgt >= 0 ? pos(hd.tgt) : center()) : tgt ? pos(+tgt) : center();
    if (/(?:使用|打出) ?(?:紅|黑)?閃(?!電)/.test(s)) { doFly(A, center(), c); return playSfx("dodge"); }
    if (/(?:使用|打出) ?(?:紅|黑)?(?:火|冰|雷)?殺/.test(s)) { doFly(A, B, c); return playSfx("slash"); }
    if (/裝備/.test(s)) { doFly(A, A, c); return playSfx("equip"); }
    if (/(?:使用|打出) ?(?:紅|黑)?決/.test(s)) { doFly(A, B, c); return playSfx("duel"); }
    if (/(?:使用|打出) ?(?:紅|黑)?桃/.test(s)) { doFly(A, B || center(), c); return playSfx("card"); }
    doFly(A, B, c);
    return playSfx(/放入/.test(s) || /(?:使用|打出) ?(?:紅|黑)?(?:順|過|南|萬|無|桃園|五|借|火攻|飢|突|樂|兵|草|閃電|毒|調|占|轉|反)/.test(s) ? "trick" : "card");
  }
  window.SGS_FX = {
    onLine, hint, sfx, begin() { budget = { snd: 0, fly: 0 }; healSeen = null; },
    get muted() { return muted; },
    get vol() { return vol; }, setVol(v) { vol = v; store("sgs_vol", v); },
    get tts() { return tts; }, setTts(on) { tts = !!on; store("sgs_tts", on ? "on" : "off"); if (!on && window.speechSynthesis) window.speechSynthesis.cancel(); },
    get fs() { return fs; }, setFs(v) { fs = v; store("sgs_fs", v); document.documentElement.style.setProperty("--fs", v); },
    setMuted(m) { muted = !!m; store("sgs_snd", muted ? "off" : "on"); if (!muted) sfx("card"); },
    toggle() { muted = !muted; try { localStorage.setItem("sgs_snd", muted ? "off" : "on"); } catch (e) {} if (!muted) sfx("card"); return !muted; },
  };

  const css = document.createElement("style");
  css.textContent = `.fxcard{position:absolute;left:0;top:0;width:64px;z-index:9;pointer-events:none;will-change:transform}
.fxcard img{width:64px;display:block;border-radius:5px;box-shadow:0 6px 18px rgba(0,0,0,.65),0 0 14px rgba(63,210,255,.55)}
.fxburst{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;z-index:9;pointer-events:none;animation:fxb .85s ease-out forwards;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900}
.fxburst.hit{border:4px solid #ff5d73;box-shadow:0 0 18px #ff5d73}.fxburst.heal{border:4px solid #46e0a0;box-shadow:0 0 18px #46e0a0;color:#46e0a0}.fxburst.die{border:4px solid #bbb;box-shadow:0 0 22px #fff}
@keyframes fxb{0%{transform:scale(.3);opacity:1}100%{transform:scale(6);opacity:0}}
#bSnd{padding:5px 9px!important}
#log,#thl,#chl,#cl,#bar,#members,.dlg{zoom:var(--fs,1)}
.setrow{display:flex;align-items:center;gap:12px;margin:12px 0}.setrow .sl{width:96px;font-weight:700}.setrow input[type=range]{flex:1}.setrow .sv{width:46px;text-align:right;color:var(--dim)}`;
  document.head.append(css);
  window.addEventListener("DOMContentLoaded", () => {
    const top = document.getElementById("top"), side = document.getElementById("bSide");
    if (!top) return;
    const b = document.createElement("button"); b.id = "bSnd"; b.title = "設定"; b.textContent = "⚙";
    b.onclick = () => {
      if (document.getElementById("setdlg")) return;
      const el = (tag, props, ...kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); kids.forEach(k => e.append(k)); return e; };
      const close = () => { const m = document.getElementById("setdlg"); if (m) m.remove(); };
      const row = (label, ctl, val) => el("div", { className: "setrow" }, el("span", { className: "sl", textContent: label }), ctl, val || "");
      const cb = (checked, on) => { const i = el("input", { type: "checkbox", checked }); i.onchange = () => on(i.checked); return i; };
      const vv = el("span", { className: "sv", textContent: Math.round(vol * 100) + "%" });
      const vs = el("input", { type: "range", min: 0, max: 100, value: Math.round(vol * 100) }); vs.oninput = () => { SGS_FX.setVol(vs.value / 100); vv.textContent = vs.value + "%"; };
      vs.onchange = () => sfx("card");
      const fv = el("span", { className: "sv", textContent: Math.round(fs * 100) + "%" });
      const fsl = el("input", { type: "range", min: 80, max: 150, step: 5, value: Math.round(fs * 100) }); fsl.oninput = () => { SGS_FX.setFs(fsl.value / 100); fv.textContent = fsl.value + "%"; };
      const ttsRow = window.speechSynthesis ? row("朗讀", cb(tts, v => SGS_FX.setTts(v)), el("span", { className: "meta", textContent: "唸出對局紀錄" })) : row("朗讀", el("span", { className: "meta", textContent: "這個瀏覽器不支援朗讀" }));
      const aboutRow = () => {
        const v = el("span", { className: "meta", textContent: "…" });
        const box = el("div", { className: "setrow" }, el("span", { className: "sl", textContent: "版本" }), v);
        fetch("/api/about").then(r => r.json()).then(a => {
          v.textContent = "v" + a.version + " ";
          const gh = el("a", { href: a.repo, target: "_blank", rel: "noopener", textContent: "GitHub", style: "margin:0 8px" });
          const lg = el("button", { textContent: "更新日誌" });
          lg.onclick = () => {
            const d2 = el("div", { className: "dlg", style: "max-width:560px" },
              el("div", { className: "dh" }, el("div", {}, el("h3", { textContent: "更新日誌 · v" + a.version })), el("button", { className: "x", textContent: "✕", onclick: () => m2.remove() })),
              el("div", { className: "dbody" }, el("pre", { textContent: a.changelog || "(沒有更新日誌)", style: "white-space:pre-wrap;font:inherit;max-height:60vh;overflow:auto;margin:0" })));
            const m2 = el("div", { className: "modal" }, d2); m2.onclick = e => { if (e.target === m2) m2.remove(); };
            document.body.append(m2);
          };
          v.append(gh, lg);
        }).catch(() => { v.textContent = ""; });
        return box;
      };
      let cm = "me"; try { cm = localStorage.getItem("sgs_chain") === "all" ? "all" : "me"; } catch (e) {}
      const cs = el("select", {}, el("option", { value: "me", textContent: "只有影響到我才問" }), el("option", { value: "all", textContent: "每個動作都問" }));
      cs.value = cm; cs.onchange = () => { try { localStorage.setItem("sgs_chain", cs.value); } catch (e) {} };
      const dlg = el("div", { className: "dlg", style: "max-width:420px" },
        el("div", { className: "dh" }, el("div", {}, el("h3", { textContent: "⚙ 設定" })), el("button", { className: "x", textContent: "✕", onclick: close })),
        el("div", { className: "dbody" },
          row("音效", cb(!muted, v => SGS_FX.setMuted(!v)), el("span", { className: "meta", textContent: "開 / 關" })),
          row("音量", vs, vv), row("字體大小", fsl, fv), ttsRow, row("⚡連鎖詢問", cs), aboutRow()));
      const m = el("div", { className: "modal", id: "setdlg" }, dlg);
      m.onclick = e => { if (e.target === m) close(); };
      document.body.append(m);
    };
    top.insertBefore(b, side || null);
    if (!/Electron/i.test(navigator.userAgent)) {   // 網頁版: 引導下載桌面版 (在桌面版裡不顯示)
      const d = document.createElement("button"); d.id = "bDl"; d.textContent = "⬇ 下載桌面版"; d.title = "到 GitHub 下載 Windows / Mac 本地版";
      d.onclick = () => window.open("https://github.com/jkemusic/Threekingdoms/releases/latest", "_blank", "noopener");
      top.insertBefore(d, b);
    }
  });
  ["pointerdown", "keydown"].forEach(ev => window.addEventListener(ev, () => { if (!muted && !ctx) ac(); }, { passive: true }));
})();
