/* 顏色主題 + 頭像框 / 頭像特效 + 成就。
   主題: 把頁面 CSS 裡的藍青色系 (主色 / 底色 / 邊框) 依使用者選的顏色重新上色 (紅 / 金 / 綠等功能色與牌圖不受影響),存在 localStorage (sgs_theme)。
   頭像框 / 特效 / 部分主題要段位或成就解鎖 (目錄與條件由伺服器 /api/cosmetics 提供,玩家的解鎖狀態在 S.prof)。 */
(function () {
  const DEF = { a: "#3fd2ff", b: "#0c1830" };
  let cur = null, CAT = null;
  try { cur = JSON.parse(localStorage.getItem("sgs_theme") || "null"); } catch (e) {}

  /* ---------- 顏色運算 ---------- */
  const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, s, l];
  }
  function hsl2rgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r, g, b].map(v => Math.max(0, Math.min(255, Math.round((v + m) * 255))));
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function mapper(t) {
    const A = rgb2hsl(...hex2rgb(t.a)), B = rgb2hsl(...hex2rgb(t.b)), RB = rgb2hsl(...hex2rgb(DEF.b)), RA = rgb2hsl(...hex2rgb(DEF.a));
    return (r, g, b) => {
      const [h, s, l] = rgb2hsl(r, g, b);
      if (s < 0.2 || h < 165 || h > 255 || l > 0.85) return null;   // 灰 / 白字 / 紅 / 金 / 綠: 不動
      if (l < 0.2) return hsl2rgb(B[0], clamp(s * (B[1] / RB[1]), 0, 1), clamp(l * (B[2] / RB[2]), 0.01, 0.5));   // 底色系
      if (l < 0.45) return hsl2rgb(A[0], clamp(s * (A[1] / RA[1]), 0, 1), l);   // 邊框 / 線條系
      return hsl2rgb(A[0], clamp(s * (A[1] / RA[1]), 0, 1), clamp(l + (A[2] - RA[2]), 0.05, 0.95));   // 主色系
    };
  }
  const origs = new WeakMap();
  function apply(t) {
    const els = [...document.querySelectorAll("style")].filter(e => !e.dataset.cos);
    const off = !t || !t.a || !t.b || (t.a.toLowerCase() === DEF.a && t.b.toLowerCase() === DEF.b);
    const mp = off ? null : mapper(t), hx = v => v.toString(16).padStart(2, "0");
    curMp = mp;
    for (const el of els) {
      if (!origs.has(el)) origs.set(el, el.textContent);
      const o0 = origs.get(el);
      el.textContent = off ? o0 : o0
        .replace(/#([0-9a-fA-F]{6})\b/g, (m, c) => { const o = mp(...hex2rgb("#" + c)); return o ? "#" + o.map(hx).join("") : m; })
        .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)/g, (m, r, g, b, a) => { const o = mp(+r, +g, +b); return o ? (a ? "rgba(" + o.join(",") + a + ")" : "rgb(" + o.join(",") + ")") : m; });
    }
    if (document.body) inlAll(document.body);
  }
  /* 程式動態產生的元素 (玩家資訊 / 排行榜等) 把顏色寫在 style 屬性裡: 同樣依主題重新上色,原始值記在 data-ost */
  let curMp = null;
  const reHex = /#([0-9a-fA-F]{6})/g, reRgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)/g;
  function mapStr(s) {
    return s.replace(reHex, (m, c) => { const o = curMp(...hex2rgb("#" + c)); return o ? "#" + o.map(v => v.toString(16).padStart(2, "0")).join("") : m; })
      .replace(reRgb, (m, r, g, b, a) => { const o = curMp(+r, +g, +b); return o ? (a ? "rgba(" + o.join(",") + a + ")" : "rgb(" + o.join(",") + ")") : m; });
  }
  function inl(el) {
    if (!el.getAttribute) return;
    if (el.hasAttribute("data-nm")) return;   // 主題色塊預覽: 顯示它自己的顏色,不隨目前主題變色
    const cur0 = el.getAttribute("style");
    if (!cur0 && el.dataset.ost == null) return;
    if (el.dataset.ost != null && el.dataset.osm !== cur0) { /* 被程式改過: 以新值為準 */ delete el.dataset.ost; }
    const orig = el.dataset.ost != null ? el.dataset.ost : cur0;
    if (!orig) return;
    if (!curMp) { if (el.dataset.ost != null) { el.setAttribute("style", el.dataset.ost); delete el.dataset.ost; delete el.dataset.osm; } return; }
    if (!/#[0-9a-fA-F]{6}|rgb/.test(orig)) return;
    const nv = mapStr(orig);
    el.dataset.ost = orig; el.dataset.osm = nv; el.setAttribute("style", nv);
  }
  function inlAll(root) { if (root.nodeType === 1) inl(root); (root.querySelectorAll ? root.querySelectorAll("[style],[data-ost]") : []).forEach(inl); }
  new MutationObserver(ms => { if (!curMp) return; ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) inlAll(n); })); }).observe(document.documentElement, { childList: true, subtree: true });
  function themeId(t) { const h = CAT && t && t.a && CAT.themes.find(x => x.a && x.a.toLowerCase() === t.a.toLowerCase() && x.b.toLowerCase() === t.b.toLowerCase()); return h ? h.id : ""; }
  function save(t, silent) { cur = t; if (!silent && CAT && typeof api === "function" && prof()) { const id = themeId(t); api("/api/cosmetic", { theme: id }).then(r => { if (r && r.sel && prof()) S.prof.sel = r.sel; }).catch(() => {}); } try { if (t) localStorage.setItem("sgs_theme", JSON.stringify(t)); else localStorage.removeItem("sgs_theme"); } catch (e) {} apply(t); }

  /* ---------- 解鎖狀態 ---------- */
  const prof = () => (typeof S !== "undefined" && S.prof) || null;
  const has = (kind, id) => { const p = prof(); return !!(p && p.cos && (p.cos[kind] || []).includes(id)); };
  const themeAllowed = t => {   // 目前存的顏色是不是這個玩家有權用的
    if (!CAT || !prof()) return true;
    const hit = CAT.themes.find(x => x.a && x.a.toLowerCase() === (t.a || "").toLowerCase() && x.b.toLowerCase() === (t.b || "").toLowerCase());
    return has("themes", hit ? hit.id : "custom");
  };

  /* ---------- 頭像框 / 特效 ---------- */
  const svgURI = body => "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#21497d"/><stop offset="1" stop-color="#0d2140"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/>${body}</svg>`);
  const AV_USER = svgURI(`<circle cx="32" cy="24" r="10.5" fill="#8fbfe8"/><path d="M11 64v-6c0-11 9-18 21-18s21 7 21 18v6z" fill="#8fbfe8"/>`);   // 預設頭像: 置中的人形剪影
  const AV_BOT = svgURI(`<line x1="32" y1="10" x2="32" y2="18" stroke="#8fd0ff" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="9" r="3" fill="#ffd24a"/><rect x="13" y="18" width="38" height="30" rx="8" fill="#8fd0ff"/><circle cx="24" cy="31" r="4.5" fill="#0d2140"/><circle cx="40" cy="31" r="4.5" fill="#0d2140"/><circle cx="25" cy="30" r="1.4" fill="#7ff0ff"/><circle cx="41" cy="30" r="1.4" fill="#7ff0ff"/><rect x="22" y="40" width="20" height="3" rx="1.5" fill="#0d2140"/><rect x="8" y="27" width="4" height="10" rx="2" fill="#5aa6dc"/><rect x="52" y="27" width="4" height="10" rx="2" fill="#5aa6dc"/><path d="M18 64v-4c0-5 4-8 14-8s14 3 14 8v4z" fill="#5aa6dc"/>`);   // 電腦的預設頭像: 機器人
  window.hasSt = st => !!(st && (st.fr || st.fx));
  window.avEl = function (src, st, props, size) {
    st = st || {};
    const img = h("img", Object.assign({ src: src === "bot" ? AV_BOT : (src || AV_USER) }, props || {}));
    return h("span", { class: "avw" + (size ? " " + size : "") + (st.fr ? " fr-" + st.fr : "") + (st.fx ? " fx-" + st.fx : "") }, img, ...(st.fx ? [h("i", { class: "fxa" }), h("i", { class: "fxb" })] : []));
  };
  const css = document.createElement("style"); css.dataset.cos = "1";
  css.textContent = `
.avw{position:relative;display:inline-block;vertical-align:middle;border-radius:50%;line-height:0;isolation:isolate;margin-right:5px;--fp:2px}
.avw.big{--fp:5px;margin-right:0}
.avw[class*=" fr-"]{padding:var(--fp)}
.avw>img{position:relative;z-index:1;margin:0!important;transform:translateZ(0)}   /* 手機 WebKit: 轉動中的框不要蓋住頭貼 */
.avw[class*=" fr-"]>img{border:0!important}
.profchip .avw>img.av{margin:0!important;vertical-align:baseline!important}
.profchip .avw{margin:-4px 6px -4px -4px;flex:0 0 auto;vertical-align:middle}
/* 小頭貼 (上方個人資訊、聊天室、成員列表): 特效半徑照比例縮小,不要超出去 */
.profchip .avw>i,.profchip .avw::before,.profchip .avw::after,.cm .avw>i,.cm .avw::before,.cm .avw::after,.mr .avw>i,.mr .avw::before,.mr .avw::after{zoom:.55}
.who .avw>img.av{margin:0!important}
.avw[class*=" fr-"]::before{content:"";position:absolute;inset:0;border-radius:50%;background:var(--fb);z-index:-1}
.fr-0{--fb:linear-gradient(135deg,#e29a58,#7a4a1c)}
.fr-1{--fb:linear-gradient(135deg,#f4f8fc,#8c9bad 60%,#dfe7ef)}
.fr-2{--fb:linear-gradient(135deg,#fff0a0,#d89a14 55%,#ffe27a);box-shadow:0 0 5px rgba(255,210,80,.55)}
.fr-3{--fb:linear-gradient(135deg,#e6fdff,#58c8dc 55%,#bff6ff);box-shadow:0 0 7px rgba(150,240,255,.7)}
.fr-4{--fb:linear-gradient(135deg,#aef0ff,#2f6cff 55%,#7ad8ff);box-shadow:0 0 8px rgba(90,170,255,.85)}
.fr-5{--fb:linear-gradient(135deg,#f0b6ff,#6a2bd1 55%,#d68bff);box-shadow:0 0 9px rgba(190,110,255,.9)}
.fr-6::before{background:conic-gradient(#ff5d73,#ffd24a,#46e0a0,#3fd2ff,#9b6bff,#ff5d73)!important;animation:frspin 4s linear infinite}
.fr-6{box-shadow:0 0 10px rgba(255,255,255,.55)}
.fr-vic{--fb:linear-gradient(135deg,#ffb27a,#d8321e 55%,#ffd24a);box-shadow:0 0 7px rgba(255,120,60,.7)}
.fr-hund{--fb:linear-gradient(135deg,#a5f5c0,#1f9d5a 55%,#d8ffe6);box-shadow:0 0 7px rgba(70,224,160,.6)}
.fr-coll{--fb:linear-gradient(135deg,#ffc2e4,#3fd2ff 50%,#ffe27a);box-shadow:0 0 7px rgba(255,160,220,.6)}
@keyframes frspin{to{transform:rotate(360deg)}}
.avw[class*=" fx-"]::after{content:"";position:absolute;pointer-events:none;border-radius:50%}
.fx-glow::after{inset:0;z-index:-1;animation:fxglow 2.2s ease-in-out infinite}
@keyframes fxglow{0%,100%{box-shadow:0 0 3px 1px rgba(120,230,255,.45)}50%{box-shadow:0 0 12px 4px rgba(120,230,255,.9)}}
.fx-spark::after{inset:-5px;z-index:2;background:radial-gradient(circle,#fff 0 1.4px,transparent 2.4px) 8% 18%/14px 14px no-repeat,radial-gradient(circle,#ffe9a0 0 1.2px,transparent 2.2px) 88% 30%/14px 14px no-repeat,radial-gradient(circle,#fff 0 1.2px,transparent 2.2px) 70% 92%/14px 14px no-repeat,radial-gradient(circle,#ffe9a0 0 1.3px,transparent 2.3px) 14% 80%/14px 14px no-repeat;animation:fxtw 1.6s ease-in-out infinite}
@keyframes fxtw{0%,100%{opacity:.15;transform:scale(.9)}50%{opacity:1;transform:scale(1.05)}}
.fx-ring::after{inset:-5px;z-index:2;border:1.5px dashed rgba(190,245,255,.95);animation:frspin 3s linear infinite}
.fx-flame::after{inset:-6px;z-index:-1;background:radial-gradient(circle at 50% 90%,#ffd05a 0,#ff6a2a 38%,rgba(255,60,20,0) 72%);filter:blur(1.5px);animation:fxfl .7s ease-in-out infinite alternate}
@keyframes fxfl{from{transform:scale(.92) translateY(1px);opacity:.75}to{transform:scale(1.08) translateY(-1px);opacity:1}}
.fx-aurora::after{inset:-6px;z-index:-1;background:conic-gradient(#46e0a0,#3fd2ff,#9b6bff,#ff7ad9,#46e0a0);filter:blur(4px);opacity:.95;animation:frspin 3.4s linear infinite}
.fx-rainbow::after{inset:-7px;z-index:-1;background:conic-gradient(#ff5d73,#ffd24a,#46e0a0,#3fd2ff,#9b6bff,#ff5d73);filter:blur(5px);opacity:1;animation:frspin 2.2s linear infinite}
.fx-bolt::after{inset:-4px;z-index:2;border:2px solid rgba(255,240,120,.95);box-shadow:0 0 8px #ffe45a,inset 0 0 6px #ffe45a;animation:fxbolt 1.8s steps(1) infinite}
@keyframes fxbolt{0%,62%,70%,78%,100%{opacity:0}64%,74%{opacity:1}}
.fx-petal::after{inset:-8px;z-index:2;background:radial-gradient(circle,#ffb7d5 0 2px,transparent 3px) 15% 0/30px 30px no-repeat,radial-gradient(circle,#ff8fc0 0 1.6px,transparent 2.6px) 78% 0/34px 34px no-repeat,radial-gradient(circle,#ffd0e4 0 1.4px,transparent 2.4px) 45% 0/38px 38px no-repeat;animation:fxpt 2.6s linear infinite;border-radius:0}
@keyframes fxpt{from{background-position:15% -8%,78% -40%,45% -70%}to{background-position:15% 108%,78% 80%,45% 54%}}

.avw>i{position:absolute;pointer-events:none;display:block}
.fr-sam{--fb:linear-gradient(135deg,#f4f4f4,#111 45%,#111 55%,#f4f4f4);box-shadow:0 0 0 1px #000,0 0 6px rgba(255,255,255,.35)}
.fr-neon{--fb:linear-gradient(135deg,#ff4fd8,#3ff0ff);box-shadow:0 0 6px #ff4fd8,0 0 12px rgba(63,240,255,.8)}
.fx-katana>.fxa,.fx-katana>.fxb{left:-18%;top:calc(50% - 1.5px);width:136%;height:3px;border-radius:2px;background:linear-gradient(90deg,transparent,#fff 18%,#fff 82%,transparent);box-shadow:0 0 5px #fff,0 2px 0 #000,0 -1px 0 #000;transform-origin:50% 50%;opacity:0;z-index:4}
.fx-katana>.fxa{transform:rotate(-38deg) scaleX(0);animation:katA 3.4s ease-out infinite}
.fx-katana>.fxb{transform:rotate(36deg) scaleX(0);animation:katB 3.4s ease-out infinite}
@keyframes katA{0%,8%{opacity:0;transform:rotate(-38deg) scaleX(0)}11%{opacity:1;transform:rotate(-38deg) scaleX(1)}26%{opacity:0;transform:rotate(-38deg) scaleX(1)}100%{opacity:0}}
@keyframes katB{0%,16%{opacity:0;transform:rotate(36deg) scaleX(0)}19%{opacity:1;transform:rotate(36deg) scaleX(1)}34%{opacity:0;transform:rotate(36deg) scaleX(1)}100%{opacity:0}}
.fx-katana::after{inset:0;z-index:3;background:#fff;mix-blend-mode:difference;opacity:0;animation:katF 3.4s linear infinite}
@keyframes katF{0%,10%{opacity:0}11%{opacity:.95}15%{opacity:0}18%{opacity:0}19%{opacity:.95}23%{opacity:0}100%{opacity:0}}
.fx-katana>img{animation:katS 3.4s linear infinite}
@keyframes katS{0%,10%,24%,100%{transform:none}12%{transform:translate(-1.5px,1px)}20%{transform:translate(1.5px,-1px)}}
.fx-orbit>.fxa,.fx-orbit>.fxb{inset:-6px;border-radius:50%;z-index:3}
.fx-orbit>.fxa{animation:frspin 2.6s linear infinite}
.fx-orbit>.fxb{inset:-10px;animation:frspin 4.2s linear infinite reverse}
.fx-orbit>.fxa::before,.fx-orbit>.fxb::before{content:"";position:absolute;left:50%;top:-3px;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:#fff;box-shadow:0 0 6px 2px #7ff0ff,0 0 12px 4px rgba(127,240,255,.6)}
.fx-orbit>.fxb::before{background:#ffe9a0;box-shadow:0 0 6px 2px #ffd24a,0 0 12px 4px rgba(255,210,74,.6);width:5px;height:5px}
.fx-ripple>.fxa,.fx-ripple>.fxb{inset:0;border-radius:50%;border:2px solid rgba(120,220,255,.9);z-index:-1;opacity:0;animation:fxrip 2.4s ease-out infinite}
.fx-ripple>.fxb{animation-delay:1.2s}
@keyframes fxrip{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.9);opacity:0}}
.fx-shadow>.fxa{inset:-9px;border-radius:50%;z-index:-1;background:radial-gradient(circle,rgba(30,0,50,.95) 38%,rgba(120,40,200,.7) 62%,transparent 74%);filter:blur(3px);animation:fxsh 2.6s ease-in-out infinite}
.fx-shadow>.fxb{inset:-4px;border-radius:50%;z-index:2;border:1.5px solid rgba(170,90,255,.85);box-shadow:0 0 8px #8a2be2,inset 0 0 6px rgba(140,60,220,.8);animation:fxsh2 2.6s ease-in-out infinite}
@keyframes fxsh{0%,100%{transform:scale(.92);opacity:.7}50%{transform:scale(1.1);opacity:1}}
@keyframes fxsh2{0%,100%{opacity:.35}50%{opacity:.95}}
.fx-dust>.fxa,.fx-dust>.fxb{left:-6px;right:-6px;top:-8px;bottom:-4px;border-radius:50%;z-index:3;overflow:hidden;background:radial-gradient(circle,#ffe27a 0 1.6px,transparent 2.6px) 14% 100%/22px 22px no-repeat,radial-gradient(circle,#fff6c4 0 1.3px,transparent 2.3px) 52% 100%/26px 26px no-repeat,radial-gradient(circle,#ffd24a 0 1.5px,transparent 2.5px) 86% 100%/20px 20px no-repeat;animation:fxdu 2.2s linear infinite}
.fx-dust>.fxb{animation-delay:-1.1s;background-position:30% 100%,70% 100%,96% 100%}
@keyframes fxdu{from{transform:translateY(8px);opacity:1}to{transform:translateY(-22px);opacity:0}}
/* 內奸標籤的藍色是身分色,不跟著主題變 */
.role.內奸{background:linear-gradient(#4a8be8,#2a5aa8)}
/* ===== 新頭像框 (15) ===== */
.fr-rookie{--fb:linear-gradient(135deg,#e8f1ff,#6fb3ff 45%,#2b6fd8 75%,#cfe3ff);box-shadow:0 0 0 1px #fff,0 0 6px rgba(111,179,255,.7)}
.fr-ink{--fb:linear-gradient(135deg,#050505,#2b3a2f 55%,#0c0c0c);box-shadow:0 0 0 1px #c9a24a,0 0 6px rgba(201,162,74,.5)}
.fr-blossom{--fb:linear-gradient(135deg,#ffe3f0,#ff7fb5 55%,#ffc2dc);box-shadow:0 0 7px rgba(255,130,180,.7)}
.fr-frost{--fb:linear-gradient(135deg,#ffffff,#9fe8ff 45%,#4aa8ff 75%,#e6fbff);box-shadow:0 0 8px rgba(150,230,255,.85)}
.fr-forest{--fb:linear-gradient(135deg,#d8ff9a,#2f8f3a 50%,#0f4a22 80%,#8be06b);box-shadow:0 0 6px rgba(90,200,90,.6)}
.avw.fr-ocean::before{background:linear-gradient(120deg,#0a3d7a,#2fd0d8,#0a3d7a,#2fd0d8,#0a3d7a);background-size:300% 100%;animation:frwave 3.5s linear infinite}
.fr-ocean{box-shadow:0 0 7px rgba(47,208,216,.7)}
.fr-sunset{--fb:linear-gradient(160deg,#ffd05a,#ff7a45 35%,#e0408a 65%,#6a3ad0);box-shadow:0 0 7px rgba(255,120,100,.6)}
.fr-jade{--fb:linear-gradient(135deg,#d2ffe6,#0e8a5c 50%,#5dffb0);box-shadow:0 0 6px rgba(60,220,160,.7)}
.avw.fr-ember::before{background:linear-gradient(0deg,#ff2a00,#ff9a1a 55%,#ffe27a);animation:frember 1.1s ease-in-out infinite alternate}
.fr-ember{box-shadow:0 0 9px rgba(255,100,20,.8)}
.avw.fr-storm::before{background:conic-gradient(#ffe45a,#23234a,#ffe45a,#23234a,#ffe45a,#23234a,#ffe45a,#23234a,#ffe45a);animation:frspin 2.4s linear infinite}
.fr-storm{box-shadow:0 0 8px rgba(255,228,90,.7)}
.avw.fr-gear::before{background:repeating-conic-gradient(#d9a65a 0 9deg,#5a3d17 9deg 18deg)}
.fr-gear{box-shadow:0 0 0 1px #2a1a08,0 0 5px rgba(217,166,90,.5)}
.avw.fr-royal::before{background:conic-gradient(#ffe27a,#6a2bd1,#ffe27a,#6a2bd1,#ffe27a)}
.fr-royal{box-shadow:0 0 8px rgba(160,100,255,.7),0 0 0 1px #ffe27a}
.avw.fr-crystal::before{background:conic-gradient(from 20deg,#f4fbff,#a8c8ff,#fff,#d8b8ff,#f4fbff,#9fe8ff,#fff,#ffc8ec,#f4fbff);filter:saturate(1.2)}
.fr-crystal{box-shadow:0 0 8px rgba(200,220,255,.85)}
.avw.fr-galaxy::before{background:radial-gradient(circle at 20% 25%,#fff 0 1px,transparent 2px),radial-gradient(circle at 75% 20%,#fff 0 1px,transparent 2px),radial-gradient(circle at 60% 80%,#cfe 0 1px,transparent 2px),radial-gradient(circle at 15% 70%,#fff 0 1px,transparent 2px),linear-gradient(135deg,#1a0f4a,#6a2bd1 50%,#0a1a5a);animation:frtw 2.2s ease-in-out infinite alternate}
.fr-galaxy{box-shadow:0 0 8px rgba(120,90,255,.8)}
.avw.fr-lava::before{background:linear-gradient(100deg,#1a0500,#ff4a00,#ffcf3a,#ff4a00,#1a0500,#ff4a00);background-size:300% 100%;animation:frwave 2.6s linear infinite}
.fr-lava{box-shadow:0 0 9px rgba(255,90,0,.85)}
.avw.fr-yinyang::before{background:conic-gradient(#fff 0 50%,#000 50% 100%);animation:frspin 6s linear infinite}
.fr-yinyang{box-shadow:0 0 0 1px #888,0 0 6px rgba(255,255,255,.4)}
@keyframes frwave{to{background-position:300% 0}}
@keyframes frember{from{filter:brightness(.9) hue-rotate(-8deg)}to{filter:brightness(1.3) hue-rotate(8deg)}}
@keyframes frtw{from{filter:brightness(.85)}to{filter:brightness(1.35)}}
/* ===== 新頭像特效 (15) ===== */
.fx-arc>.fxa{inset:-5px;border-radius:50%;border:2px solid transparent;border-top-color:#bfe9ff;border-bottom-color:#ffe45a;z-index:3;filter:drop-shadow(0 0 4px #7fd0ff);animation:frspin .9s linear infinite,fxarc .45s steps(2) infinite}
.fx-arc>.fxb{inset:-8px;border-radius:50%;border:1.5px solid transparent;border-left-color:#fff;z-index:3;filter:drop-shadow(0 0 3px #bfe9ff);animation:frspin 1.5s linear infinite reverse}
@keyframes fxarc{50%{opacity:.45}}
.fx-ice>.fxa{inset:-6px;border-radius:50%;border:3px dotted rgba(190,240,255,.95);z-index:3;animation:frspin 6s linear infinite;filter:drop-shadow(0 0 4px #7fe0ff)}
.fx-ice>.fxb{inset:-2px;border-radius:50%;z-index:-1;box-shadow:0 0 10px 3px rgba(150,230,255,.7);animation:fxglow 2s ease-in-out infinite}
.fx-toxic>.fxa,.fx-toxic>.fxb{left:-4px;right:-4px;top:-6px;bottom:-2px;border-radius:50%;overflow:hidden;z-index:3;background:radial-gradient(circle,rgba(160,255,120,.9) 0 2px,rgba(80,200,60,.3) 3.5px,transparent 4.5px) 20% 100%/24px 24px no-repeat,radial-gradient(circle,rgba(190,120,255,.9) 0 1.5px,rgba(130,60,200,.3) 3px,transparent 4px) 62% 100%/28px 28px no-repeat,radial-gradient(circle,rgba(160,255,120,.9) 0 1.5px,transparent 3px) 88% 100%/20px 20px no-repeat;animation:fxdu 2.6s linear infinite}
.fx-toxic>.fxb{animation-delay:-1.3s;background-position:45% 100%,80% 100%,8% 100%}
.fx-heart>.fxa,.fx-heart>.fxb{inset:0;z-index:3}
.fx-heart>.fxa::before,.fx-heart>.fxb::before{content:"♥";position:absolute;left:12%;bottom:0;font-size:11px;line-height:1;color:#ff6fa8;text-shadow:0 0 5px #ff9ac2;animation:fxheart 2.4s ease-in infinite}
.fx-heart>.fxb::before{left:68%;font-size:9px;color:#ff8fc0;animation-delay:-1.2s}
@keyframes fxheart{0%{transform:translateY(4px) scale(.6);opacity:0}25%{opacity:1}100%{transform:translateY(-34px) scale(1.1);opacity:0}}
.fx-snow>.fxa,.fx-snow>.fxb{left:-6px;right:-6px;top:-10px;bottom:-2px;overflow:hidden;z-index:3;background:radial-gradient(circle,#fff 0 1.6px,transparent 2.6px) 15% 0/22px 22px no-repeat,radial-gradient(circle,#e8f8ff 0 1.3px,transparent 2.3px) 55% 0/26px 26px no-repeat,radial-gradient(circle,#fff 0 1.5px,transparent 2.5px) 90% 0/24px 24px no-repeat;animation:fxsn 2.8s linear infinite}
.fx-snow>.fxb{animation-delay:-1.4s;background-position:35% 0,75% 0,3% 0}
@keyframes fxsn{from{transform:translateY(-8px);opacity:1}to{transform:translateY(34px);opacity:0}}
.fx-firefly>.fxa,.fx-firefly>.fxb{inset:-4px;z-index:3}
.fx-firefly>.fxa::before,.fx-firefly>.fxb::before{content:"";position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2px;border-radius:50%;background:#e8ff7a;box-shadow:0 0 6px 2px #c8ff3a,0 0 12px 4px rgba(200,255,60,.5);animation:fxff 4.5s ease-in-out infinite}
.fx-firefly>.fxb::before{animation-duration:6s;animation-delay:-2s;background:#fff6a0}
@keyframes fxff{0%{transform:translate(-120%,-90%);opacity:.2}25%{transform:translate(110%,-60%);opacity:1}50%{transform:translate(90%,100%);opacity:.3}75%{transform:translate(-100%,70%);opacity:1}100%{transform:translate(-120%,-90%);opacity:.2}}
.fx-pulse>.fxa,.fx-pulse>.fxb{inset:0;border-radius:50%;border:2px solid rgba(255,120,170,.95);z-index:-1;opacity:0;animation:fxpl 1.6s ease-out infinite}
.fx-pulse>.fxb{animation-delay:.22s}
@keyframes fxpl{0%{transform:scale(1);opacity:.95}60%,100%{transform:scale(1.7);opacity:0}}
.fx-vortex>.fxa{inset:-7px;border-radius:50%;z-index:-1;background:conic-gradient(rgba(10,0,30,.95),rgba(150,60,255,.8),rgba(10,0,30,.95) 50%,rgba(150,60,255,.8),rgba(10,0,30,.95));filter:blur(3px);animation:frspin 1.6s linear infinite}
.fx-vortex>.fxb{inset:-3px;border-radius:50%;z-index:3;border:1.5px dashed rgba(200,140,255,.9);animation:frspin 3s linear infinite reverse}
.fx-radar>.fxa{inset:0;border-radius:50%;z-index:3;background:conic-gradient(from 0deg,transparent 0 70%,rgba(110,255,190,.75) 100%);animation:frspin 2.2s linear infinite}
.fx-radar>.fxb{inset:-3px;border-radius:50%;z-index:3;border:1px solid rgba(110,255,190,.9);box-shadow:0 0 6px rgba(110,255,190,.7)}
.fx-comet>.fxa{inset:-7px;border-radius:50%;z-index:3;animation:frspin 1.8s linear infinite;background:conic-gradient(from 0deg,transparent 0 78%,rgba(120,220,255,.1) 84%,rgba(255,255,255,.95) 100%);-webkit-mask:radial-gradient(circle,transparent 62%,#000 64%,#000 72%,transparent 74%);mask:radial-gradient(circle,transparent 62%,#000 64%,#000 72%,transparent 74%)}
.fx-comet>.fxb{inset:0;border-radius:50%;z-index:-1;box-shadow:0 0 8px 2px rgba(120,220,255,.5)}
.fx-beam>.fxa{left:18%;right:18%;top:-70%;bottom:50%;z-index:-1;background:linear-gradient(0deg,rgba(255,240,170,.9),rgba(255,240,170,.15) 70%,transparent);filter:blur(2px);animation:fxbm 2.4s ease-in-out infinite}
.fx-beam>.fxb{inset:-2px;border-radius:50%;z-index:-1;box-shadow:0 0 12px 3px rgba(255,235,150,.8);animation:fxglow 2.4s ease-in-out infinite}
@keyframes fxbm{0%,100%{opacity:.55;transform:scaleY(.85)}50%{opacity:1;transform:scaleY(1.1)}}
.fx-sun>.fxa{inset:-11px;border-radius:50%;z-index:-1;background:repeating-conic-gradient(rgba(255,210,70,.95) 0 5deg,transparent 5deg 15deg);-webkit-mask:radial-gradient(circle,transparent 40%,#000 44%);mask:radial-gradient(circle,transparent 40%,#000 44%);animation:frspin 9s linear infinite}
.fx-sun>.fxb{inset:-3px;border-radius:50%;z-index:-1;box-shadow:0 0 12px 4px rgba(255,200,60,.7);animation:fxglow 2s ease-in-out infinite}
.fx-ki>.fxa{inset:-8px;z-index:-1;border-radius:50% 50% 45% 45%;background:radial-gradient(ellipse at 50% 80%,#fff6a8 0,#ffd23a 40%,rgba(255,170,0,0) 75%);filter:blur(2px);animation:fxki .35s ease-in-out infinite alternate}
.fx-ki>.fxb{inset:-4px;z-index:-1;border-radius:50%;box-shadow:0 0 10px 3px rgba(255,220,70,.9);animation:fxki .5s ease-in-out infinite alternate-reverse}
@keyframes fxki{from{transform:scale(.94,.9);opacity:.75}to{transform:scale(1.08,1.16) translateY(-2px);opacity:1}}
.fx-glitch>img{animation:fxgl 2.4s steps(1) infinite}
.fx-glitch>.fxa,.fx-glitch>.fxb{inset:0;border-radius:50%;z-index:3;opacity:0}
.fx-glitch>.fxa{background:linear-gradient(0deg,transparent 40%,rgba(255,0,100,.55) 40% 48%,transparent 48%);mix-blend-mode:screen;animation:fxgl2 2.4s steps(1) infinite}
.fx-glitch>.fxb{background:linear-gradient(0deg,transparent 62%,rgba(0,255,230,.55) 62% 70%,transparent 70%);mix-blend-mode:screen;animation:fxgl2 2.4s steps(1) infinite .12s}
@keyframes fxgl{0%,60%,70%,100%{transform:none;filter:none}62%{transform:translate(-2px,0);filter:drop-shadow(2px 0 0 rgba(255,0,90,.85)) drop-shadow(-2px 0 0 rgba(0,255,230,.85))}66%{transform:translate(2px,1px);filter:drop-shadow(-2px 0 0 rgba(255,0,90,.85)) drop-shadow(2px 0 0 rgba(0,255,230,.85))}}
@keyframes fxgl2{0%,60%,70%,100%{opacity:0}62%,66%{opacity:1}}
.fx-meteor>.fxa,.fx-meteor>.fxb{left:-30%;top:-30%;width:2px;height:16px;z-index:3;border-radius:2px;background:linear-gradient(180deg,rgba(255,255,255,0),#fff);box-shadow:0 0 5px #bfe9ff;transform:rotate(-40deg);opacity:0;animation:fxmt 2.2s ease-in infinite}
.fx-meteor>.fxb{left:10%;top:-45%;animation-delay:-1.1s;height:12px}
@keyframes fxmt{0%{transform:translate(0,0) rotate(-40deg);opacity:0}10%{opacity:1}60%{opacity:1}100%{transform:translate(70px,60px) rotate(-40deg);opacity:0}}
#cosdlg .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 12px}
#cosdlg .tabs button.on{background:linear-gradient(180deg,#46d6ff,#1b9fd6);color:#021c2a;font-weight:700}
#cosdlg .grid{display:flex;gap:10px;flex-wrap:wrap}
#cosdlg .tile{width:92px;padding:10px 4px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;border-radius:10px;position:relative}
#cosdlg .tile.sel{box-shadow:inset 0 0 0 2px var(--accent)}
#cosdlg .tile.lock{opacity:.5}
#cosdlg .tile .tn{font-size:12px;line-height:1.25}
#cosdlg .tile .rq{font-size:10px;color:var(--dim);line-height:1.2}
#cosdlg .ach{display:flex;gap:10px;align-items:flex-start;padding:7px 4px;border-bottom:1px solid rgba(120,160,200,.18)}
#cosdlg .ach.lock{opacity:.5}
#cosdlg .ach .ic{font-size:20px;width:26px;text-align:center}
#cosdlg .ach .ad{font-size:12px;color:var(--dim)}
#cosdlg .ach .au{font-size:11px;color:var(--accent)}
.achtoast{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:9700;background:linear-gradient(160deg,#13264a,#0a152b);border:1px solid var(--accent);box-shadow:0 0 24px rgba(63,210,255,.4);border-radius:10px;padding:12px 18px;max-width:92vw;text-align:center;cursor:pointer;animation:tin .4s ease-out}
@keyframes tin{from{opacity:0;transform:translate(-50%,-14px)}}
.achtoast b{color:var(--gold)}`;
  document.head.append(css);

  /* ---------- 對話框 ---------- */
  const PH = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='72' height='72'><rect width='72' height='72' fill='%23123058'/><text x='36' y='48' font-size='34' text-anchor='middle' fill='%233fd2ff'>👤</text></svg>";
  const unlockOf = id => {   // 這個成就會解鎖哪些外觀
    if (!CAT) return [];
    const out = [];
    [["themes", "主題"], ["frames", "頭像框"], ["fx", "特效"]].forEach(([k, lab]) => CAT[k].forEach(x => { if (x.req.t === "ach" && x.req.v === id) out.push(lab + "「" + x.n + "」"); }));
    return out;
  };
  async function post(body) {
    try { const r = await api("/api/cosmetic", body); if (r && r.cos && prof()) Object.assign(S.prof, { cos: r.cos, sel: r.sel, ach: r.ach, ach_new: r.ach_new, ach_prog: r.ach_prog }); } catch (e) {}
    if (typeof loadProfile === "function") loadProfile();
  }
  function progBar(pg) {   // 未完成成就的進度條: 目前 / 目標
    const pct = Math.max(0, Math.min(100, pg[0] / pg[1] * 100));
    return h("div", { style: { display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" } },
      h("div", { style: { flex: 1, height: "6px", background: "rgba(120,160,200,.2)", borderRadius: "99px", overflow: "hidden" } }, h("div", { style: { width: pct + "%", height: "100%", background: "var(--accent)" } })),
      h("span", { class: "meta", style: { fontSize: "11px", whiteSpace: "nowrap" }, text: pg[0] + " / " + pg[1] }));
  }
  function openDlg(tab) {
    const M = document.getElementById("modal"); if (!M) return;
    const mode = tab === "ach" ? "ach" : "look";
    tab = tab === "ach" ? "ach" : (tab === "frame" || tab === "fx") ? tab : "theme";
    const render = () => {
      M.textContent = ""; if (typeof S !== "undefined") S.modalOpen = "theme";
      const close = () => { M.textContent = ""; if (typeof S !== "undefined") S.modalOpen = null; };
      const p = prof() || {}, sel = p.sel || {}, mine = p.avatar || null;
      const achMode = mode === "ach";   // 成就和外觀是兩個分開的視窗
      const tabs = achMode ? [] : [["theme", "🎨 主題"], ["frame", "🖼 頭像框"], ["fx", "✨ 頭像特效"]];
      let body;
      if (!CAT) body = h("div", { class: "meta", text: "載入中…" });
      else if (tab === "theme") {
        const sw = CAT.themes.map(x => {
          const ok = has("themes", x.id);
          return h("button", {
            class: "tile" + (ok ? "" : " lock"), title: ok ? x.n : x.req_text,
            onclick: () => { if (!ok) return; if (!x.a) { save(null); } else { save({ a: x.a, b: x.b }); } render(); },
          }, h("span", { "data-nm": "1", style: { width: "58px", height: "40px", borderRadius: "9px", background: `linear-gradient(135deg,${x.b || DEF.b} 50%,${x.a || DEF.a} 50%)`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" } }),
          h("span", { class: "tn", text: (ok ? "" : "🔒 ") + x.n }), ok ? null : h("span", { class: "rq", text: "需要 " + x.req_text }));
        });
        body = h("div", {}, h("div", { class: "grid" }, ...sw),
          h("div", { style: { display: "flex", justifyContent: "flex-end" } }, h("button", { text: "恢復預設", onclick: () => { save(null); render(); } })));
      } else if (tab === "ach") {
        const got = p.ach || {}, list = CAT.achs;
        body = h("div", {}, h("div", { class: "meta", style: { marginBottom: "6px" }, text: `已完成 ${list.filter(a => got[a.id]).length} / ${list.length}` }),
          ...list.map(a => {
            const ok = !!got[a.id], un = unlockOf(a.id);
            return h("div", { class: "ach" + (ok ? "" : " lock") }, h("div", { class: "ic", text: ok ? "🏅" : "🔒" }),
              h("div", { style: { flex: 1 } }, h("div", { text: a.n, style: { fontWeight: 700 } }), h("div", { class: "ad", text: a.d }), (!ok && (p.ach_prog || {})[a.id]) ? progBar(p.ach_prog[a.id]) : null, un.length ? h("div", { class: "au", text: "解鎖: " + un.join("、") }) : null),
              ok ? h("div", { class: "meta", text: new Date(got[a.id] * 1000).toLocaleDateString() }) : null);
          }));
      } else {
        const isFx = tab === "fx", L = isFx ? CAT.fx : CAT.frames, kind = isFx ? "fx" : "frames", curv = isFx ? (sel.fx || "") : (sel.frame || "");
        body = h("div", {}, h("div", { class: "grid" }, ...L.map(x => {
          const ok = has(kind, x.id), st = isFx ? { fr: sel.frame, fx: x.id } : { fr: x.id, fx: sel.fx };
          return h("button", {
            class: "tile" + (ok ? "" : " lock") + (curv === x.id ? " sel" : ""), title: ok ? x.n : "需要 " + x.req_text,
            onclick: async () => { if (!ok) return; await post(isFx ? { fx: x.id } : { frame: x.id }); render(); },
          }, h("span", { style: { padding: "6px" } }, avEl(mine, st, { style: { width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover" } })),
          h("span", { class: "tn", text: (ok ? "" : "🔒 ") + x.n }), ok ? null : h("span", { class: "rq", text: "需要 " + x.req_text }));
        })), h("div", { class: "meta", style: { marginTop: "10px" }, text: "頭像框和特效會顯示在座位、聊天室、排行榜上,所有玩家都看得到。" }));
      }
      M.append(h("div", { class: "modal", onclick: e => { if (e.target.classList.contains("modal")) close(); } },
        h("div", { class: "dlg", id: "cosdlg", style: { maxWidth: "520px" } },
          h("div", { class: "dh" }, h("div", {}, h("h3", { text: achMode ? "🏅 成就" : "🎨 外觀" }), h("div", { class: "meta", text: achMode ? "完成成就可以解鎖主題、頭像框與特效" : "主題 / 頭像框 / 特效,有些要段位或成就解鎖" })), h("button", { class: "x", text: "✕", onclick: close })),
          h("div", { style: { padding: "6px 22px 18px", maxHeight: "70vh", overflowY: "auto" } },
            achMode ? null : h("div", { class: "tabs" }, ...tabs.map(([k, n]) => h("button", { class: k === tab ? "on" : "", text: n, onclick: () => { tab = k; render(); } }))),
            body, h("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: "14px" } }, h("button", { class: "primary", text: "完成", onclick: close }))))));
    };
    render();
  }

  /* ---------- 新成就通知 / 資料載入 ---------- */
  function onProfile(p) {
    if (CAT && !S.themeSynced && p.sel) {   // 登入後依帳號存的主題換色;帳號還沒存過的話,把這台瀏覽器目前的主題存上去
      S.themeSynced = true;
      const sid = p.sel.theme, th = sid ? CAT.themes.find(x => x.id === sid) : null;
      if (th && th.a) save({ a: th.a, b: th.b }, true);
      else if (sid === "") save(null, true);
      else if (cur) save(cur);
    }
    if (CAT && cur && !themeAllowed(cur)) save(null);   // 沒資格用的自訂顏色 (例如手動改 localStorage) 還原
    const nw = (p.ach_new || []).filter(id => CAT && CAT.achs.some(a => a.id === id));
    if (!nw.length || S.achShown) return;
    S.achShown = true;
    const names = nw.map(id => CAT.achs.find(a => a.id === id)), un = nw.flatMap(unlockOf);
    const t = h("div", { class: "achtoast", onclick: () => { t.remove(); SGS_THEME.open("ach"); } },
      h("div", {}, "🏅 達成成就: ", ...names.map((a, i) => h("b", { text: (i ? "、" : "") + a.n }))),
      un.length ? h("div", { class: "meta", text: "解鎖 " + un.join("、") + " (點此查看)" }) : null);
    document.body.append(t); setTimeout(() => t.remove(), 9000);
    api("/api/ach_ack", {}).then(() => { S.achShown = false; if (S.prof) S.prof.ach_new = []; }).catch(() => {});
  }
  window.SGS_COS = { onProfile };
  window.SGS_THEME = { open: openDlg, apply };
  apply(cur);
  window.addEventListener("load", () => apply(cur));
  fetch("/api/cosmetics").then(r => r.json()).then(c => { CAT = c; if (prof()) onProfile(prof()); }).catch(() => {});
  window.addEventListener("DOMContentLoaded", () => {
    const side = document.getElementById("bSide"), top = document.getElementById("top");
    if (!top || document.getElementById("bTheme")) return;
    const b = document.createElement("button"); b.id = "bTheme"; b.textContent = "🎨"; b.title = "外觀 (主題、頭像框、特效)"; b.style.padding = "5px 9px";
    b.onclick = () => openDlg("theme"); top.insertBefore(b, side || null);
    const board = document.getElementById("bBoard");   // 成就按鈕放在排行榜旁邊
    if (board && !document.getElementById("bAch")) {
      const c = document.createElement("button"); c.id = "bAch"; c.textContent = "🏅 成就"; c.title = "成就與解鎖進度";
      c.onclick = () => openDlg("ach"); board.after(c);
    }
  });
})();
