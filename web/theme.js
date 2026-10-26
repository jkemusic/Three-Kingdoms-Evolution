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
  /* ---------- 古風三國 外觀: 絳紅 / 墨黑 / 金線,整個牌桌換成書卷風 (主題選「古風三國」時啟用) ---------- */
  const GF_A = "#d4a64a", GF_B = "#1b120c";   // 預設主題 = 古風三國
  const gf = document.createElement("style"); gf.dataset.cos = "1";
  gf.textContent = `
html.gf{--gold:#d9ad4f;--red:#d2412f;--felt1:#3a281a;--felt2:#140d08;--ser:var(--ff,serif)}
html.gf,html.gf body{background:radial-gradient(ellipse at 50% -10%,#3a2316 0,#150d08 62%)}
html.gf #top{background:linear-gradient(90deg,#1c120b,#26180e 50%,#1c120b);border-bottom:1px solid #8a6a30;box-shadow:0 1px 0 rgba(217,173,79,.3),0 4px 18px rgba(0,0,0,.55)}
html.gf #top .title{font-family:var(--ser);letter-spacing:.3em;color:#e8c872;text-shadow:0 0 12px rgba(217,173,79,.45)}
html.gf #tablewrap::before{border:3px double #b88a3a;background:repeating-linear-gradient(45deg,rgba(217,173,79,.045) 0 2px,transparent 2px 16px),repeating-linear-gradient(-45deg,rgba(217,173,79,.045) 0 2px,transparent 2px 16px),radial-gradient(ellipse at 50% 42%,#4a3322 0,#26180f 58%,#120a06 100%);box-shadow:0 0 0 5px #1a0f08,0 0 0 6px rgba(217,173,79,.55),0 0 40px rgba(217,173,79,.12),inset 0 0 80px rgba(0,0,0,.7)}
html.gf #tablewrap::after{box-shadow:inset 0 0 0 1px rgba(217,173,79,.3);margin:30px}
html.gf #center .big{font-family:var(--ser);color:#e8c872;text-shadow:0 0 16px rgba(217,173,79,.5)}
html.gf #center{color:#c9b48a}
html.gf #roundtag{font-family:var(--ser);color:#e8c872;text-shadow:0 0 12px rgba(217,173,79,.45)}
html.gf #roundtag .rtdeck{color:#c9b48a}
html.gf .pl{border-radius:6px;background:linear-gradient(160deg,#2c2016,#17100b);box-shadow:inset 0 0 0 1px #8a6a30,inset 0 0 0 4px #17100b,inset 0 0 0 5px rgba(217,173,79,.3),0 6px 14px rgba(0,0,0,.5)}
html.gf #cosdlg .pvseat{background:linear-gradient(160deg,#2c2016,#17100b);box-shadow:inset 0 0 0 1px #8a6a30}
html.px #cosdlg .pvseat{background:var(--pxbg);box-shadow:inset 0 0 0 3px var(--pxfg)}
html.gf .pl:hover{box-shadow:inset 0 0 0 1px #d9ad4f,inset 0 0 0 4px #17100b,inset 0 0 0 5px rgba(217,173,79,.45),0 6px 14px rgba(0,0,0,.5)}
html.gf .pl.cur{box-shadow:inset 0 0 0 2px #e8c872,inset 0 0 0 4px #17100b,0 0 22px rgba(217,173,79,.55);animation:none}
html.gf .pl.cur::after{content:"出牌";font-family:var(--ser);color:#f6e7c1;background:linear-gradient(#c43a28,#8e2118);border-radius:2px;letter-spacing:.2em;box-shadow:0 0 0 1px #e8c872,0 2px 8px rgba(0,0,0,.5)}
html.gf .pl.sel{box-shadow:inset 0 0 0 2px #e8c872}
html.gf .pl .ph{border-radius:3px;border:1px solid #8a6a30;box-shadow:inset 0 0 8px rgba(0,0,0,.6),0 0 0 1px #17100b}
html.gf .pl .nm{font-family:var(--ser);color:#f3e6c4}
html.gf .role{border-radius:2px;font-family:var(--ser);box-shadow:0 0 0 1px rgba(246,231,193,.55);letter-spacing:.05em}
html.gf .hp{color:#e0533d;text-shadow:0 0 6px rgba(224,83,61,.45)}
html.gf .hp .e{color:#4a3a2c}
html.gf .tag{border-radius:2px;background:rgba(217,173,79,.08);border-color:#6a5230}
html.gf .bubble{background:#f1e4c3;color:#2b2415;border:1px solid #8a6a30;border-radius:3px;box-shadow:0 4px 12px rgba(0,0,0,.5)}
html.gf .bubble::after{border-top-color:#f1e4c3}
html.gf .pl.bb .bubble::after{border-bottom-color:#f1e4c3}
html.gf .card{border-radius:5px;border:1px solid #8a6a30;box-shadow:0 4px 12px rgba(0,0,0,.6)}
html.gf .card.ok{border:2px solid #e8c872;box-shadow:0 0 14px rgba(217,173,79,.55),0 4px 10px rgba(0,0,0,.6)}
html.gf .card.picked{border-color:#fff1b8;box-shadow:0 0 22px #e8c872,0 10px 18px rgba(0,0,0,.6)}
html.gf #side{background:linear-gradient(180deg,#22160d,#130b07);border-left:1px solid #8a6a30}
html.gf #tabs{background:rgba(0,0,0,.28)}
html.gf #tabs button.on{background:rgba(217,173,79,.1);color:#e8c872;box-shadow:inset 0 -2px 0 #d9ad4f}
html.gf #log .turn{background:linear-gradient(90deg,rgba(217,173,79,.2),transparent);color:#e8c872;border-left-color:#d9ad4f}
html.gf .th,html.gf .cc{border-radius:3px;background:rgba(44,32,22,.8);border-color:#5a4426}
html.gf #bar .pr{color:#e8c872;text-shadow:0 0 8px rgba(217,173,79,.35)}
html.gf button{background:linear-gradient(180deg,#3a281a,#24170f);box-shadow:inset 0 0 0 1px #8a6a30;border-radius:4px}
html.gf button:hover{background:linear-gradient(180deg,#4a3322,#2e1e13);box-shadow:inset 0 0 0 1px #e8c872,0 0 10px rgba(217,173,79,.3)}
html.gf button.primary{background:linear-gradient(180deg,#c43a28,#8e2118);color:#f6e7c1;box-shadow:inset 0 0 0 1px #e8c872}
html.gf #status{border-radius:3px;background:#24170f;border-color:#6a5230;color:#e8c872}
html.gf .dlg,html.gf .ci{border-radius:5px;background:linear-gradient(160deg,#2c2016,#17100b);border:1px solid #8a6a30;box-shadow:0 0 0 4px #17100b,0 0 0 5px rgba(217,173,79,.35),0 18px 50px rgba(0,0,0,.7)}
html.gf .dlg h3,html.gf .ci h3{font-family:var(--ser);color:#e8c872;letter-spacing:.12em}
html.gf .modal{background:rgba(10,5,2,.72)}
html.gf .pickbar{background:linear-gradient(160deg,#2c2016,#17100b);border:1px solid #d9ad4f;box-shadow:0 0 24px rgba(217,173,79,.35)}
`;
  document.head.appendChild(gf);
  /* ---------- 每個主題自己的字體 (只用系統內建字體,不下載): 依主題色對應字體,再依語言挑中 / 日 / 英的字型 ---------- */
  const FONT_OF = {"#d4a64a": "ming", "#3fd2ff": "tech", "#c3ccd8": "hei", "#46e0a0": "kai", "#b58cff": "round", "#ff8fc0": "kai", "#ff7a45": "bold", "#f0c95c": "ming", "#9b8cff": "tech", "#7fffd4": "round", "#4d8dff": "hei", "#bfe9ff": "round", "#d9a066": "kai", "#7ed957": "kai", "#b8c0cc": "mono", "#ff5d73": "bold", "#ffb347": "round", "#b6ff3a": "mono", "#ff4de0": "tech", "#ffffff": "mono", "#c9a7ff": "round", "#ffd700": "ming", "#ff77a8": "pixel", "#9bbc0f": "pixel", "#29adff": "pixel", "#ffa300": "pixel", "#83769c": "pixel", "#ff004d": "pixel", "#c2c3c7": "pixel"};
  const FAM = {
    ming:  ['"Noto Serif TC","Source Han Serif TC","Songti TC","STSong","PMingLiU","MingLiU",serif', '"Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","MS PMincho",serif', 'Georgia,"Times New Roman","Noto Serif",serif'],
    kai:   ['"DFKai-SB","BiauKai","Kaiti TC","KaiTi","STKaiti","Noto Serif TC",serif', '"Yu Kyokasho","Hiragino Mincho ProN","Yu Mincho",serif', '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif'],
    round: ['"Yuanti TC","Microsoft JhengHei UI","Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif', '"Hiragino Maru Gothic ProN","Yu Gothic UI","Meiryo","Noto Sans JP",sans-serif', '"Varela Round",Nunito,"Trebuchet MS","Segoe UI",sans-serif'],
    tech:  ['"Segoe UI","Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif', '"Yu Gothic UI","Hiragino Sans","Meiryo","Noto Sans JP",sans-serif', 'Bahnschrift,"Segoe UI","Roboto Condensed",Roboto,"Helvetica Neue",sans-serif'],
    bold:  ['"Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif', '"Yu Gothic","Hiragino Sans","Meiryo","Noto Sans JP",sans-serif', '"Arial Black",Impact,"Segoe UI",sans-serif'],
    mono:  ['"Cascadia Mono",Consolas,"Microsoft JhengHei","PingFang TC","Noto Sans TC",monospace', '"Cascadia Mono",Consolas,"Yu Gothic UI","Hiragino Sans",monospace', '"Cascadia Mono",Consolas,"SF Mono",Menlo,"Courier New",monospace'],
    pixel: ['"SGS Pixel TW","SGS Pixel JA","Microsoft JhengHei",monospace', '"SGS Pixel JA","SGS Pixel TW","Yu Gothic UI",monospace', '"SGS Pixel TW","SGS Pixel JA","Courier New",monospace'],
    hei:   ['-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","Microsoft JhengHei","PingFang TC","Noto Sans TC",sans-serif', '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic UI","Yu Gothic",Meiryo,"Noto Sans JP",sans-serif', '-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Inter,Roboto,"Helvetica Neue",Arial,sans-serif'],
  };
  const fontCss = document.createElement("style"); fontCss.dataset.cos = "1";
  fontCss.textContent = Object.entries(FAM).map(([k, [zh, ja, en]]) => `html[data-font=${k}]{--ff:${zh}}
html[data-font=${k}]:lang(ja){--ff:${ja}}
html[data-font=${k}]:lang(en){--ff:${en}}`).join(" ")
    + " html[data-font],html[data-font] body,html[data-font] button,html[data-font] input,html[data-font] select,html[data-font] textarea,html[data-font] #side *,html[data-font] .dlg *,html[data-font] #log *{font-family:var(--ff)}";   // 遊戲紀錄、側邊欄、對話框裡的每個元素都跟著主題字體
  document.head.appendChild(fontCss);
  const fontOn = t => { document.documentElement.dataset.font = FONT_OF[(t.a || "").toLowerCase()] || "hei"; };
  /* ---------- 像素主題: 方角、硬陰影、像素字體 (字體: Fusion Pixel Font,OFL 授權,檔案隨程式附上) ---------- */
  const PX_A = "#ff77a8";
  const px = document.createElement("style"); px.dataset.cos = "1";
  px.textContent = `
html.px{--gold:var(--pxacc);--red:#ff004d;--green:var(--pxok);--blue:#29adff;--accent:var(--pxacc);--text:var(--pxfg);--dim:var(--pxdim)}
html.px,html.px body{background:var(--pxbg) linear-gradient(45deg,rgba(255,255,255,.035) 25%,transparent 25% 75%,rgba(255,255,255,.035) 75%) 0 0/8px 8px;color:var(--pxfg);-webkit-font-smoothing:none;text-rendering:optimizeSpeed}
html.px *,html.px *::before,html.px *::after{border-radius:0!important;transition:none!important}
html.px input[type=checkbox],html.px input[type=radio]{-webkit-appearance:none;appearance:none;width:18px;height:18px;margin:0 6px 0 0;vertical-align:middle;background:#000;border:3px solid var(--pxfg);cursor:pointer;flex:none}
html.px input[type=checkbox]:checked,html.px input[type=radio]:checked{background:var(--pxok);box-shadow:inset 0 0 0 3px #000}
html.px .sw input{width:0;height:0;border:0}
html.px input[type=range]{-webkit-appearance:none;appearance:none;height:14px;background:#000;border:3px solid var(--pxfg);padding:0;cursor:pointer}
html.px input[type=range]::-webkit-slider-runnable-track{height:8px;background:transparent}
html.px input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:20px;margin-top:-6px;background:var(--pxacc);border:3px solid #000;border-radius:0;box-shadow:0 0 0 2px var(--pxfg)}
html.px input[type=range]::-moz-range-track{height:8px;background:transparent}
html.px input[type=range]::-moz-range-thumb{width:12px;height:20px;background:var(--pxacc);border:3px solid #000;border-radius:0;box-shadow:0 0 0 2px var(--pxfg)}
html.px .sw .knob{background:#000;box-shadow:inset 0 0 0 3px var(--pxfg)}
html.px .sw .knob::after{background:var(--pxdim);width:14px;height:14px;left:4px;top:4px}
html.px .sw input:checked+.knob{background:var(--pxok);box-shadow:inset 0 0 0 3px var(--pxfg)}
html.px .sw input:checked+.knob::after{background:var(--pxfg);left:22px}
html.px .av,html.px .ph,html.px .avw>img,html.px .hp img,html.px .eq img{image-rendering:pixelated}
html.px .avw,html.px .avw>img,html.px img.av,html.px .avw::before,html.px .avw::after,html.px .avw>i{border-radius:0!important}   /* 像素主題: 頭像、頭像框、特效統一方形 */
html.px img.av{border:0}
html.px #top{background:#000;border-bottom:4px solid var(--pxfg);box-shadow:0 4px 0 var(--pxbtn)}
html.px #top .title{color:var(--pxacc);letter-spacing:.2em;text-shadow:2px 2px 0 var(--pxbtn)}
html.px #tablewrap::before{border:8px solid var(--pxfg);background:var(--pxtbl) linear-gradient(45deg,rgba(0,0,0,.12) 25%,transparent 25% 75%,rgba(0,0,0,.12) 75%) 0 0/16px 16px;box-shadow:0 0 0 4px #000,8px 8px 0 4px rgba(0,0,0,.55);border-radius:0}
html.px #tablewrap::after{box-shadow:inset 0 0 0 2px rgba(255,241,232,.35);border-radius:0}
html.px #center .big{color:var(--pxacc);text-shadow:3px 3px 0 var(--pxbtn)}
html.px #center{color:var(--pxfg)}
html.px #roundtag{color:var(--pxacc);text-shadow:2px 2px 0 #000}
html.px #roundtag .rtdeck{color:var(--pxfg)}
html.px .pl{background:var(--pxbg);box-shadow:inset 0 0 0 3px var(--pxfg),0 0 0 3px #000,6px 6px 0 3px rgba(0,0,0,.55);animation:none}
html.px .pl:hover{box-shadow:inset 0 0 0 3px #29adff,0 0 0 3px #000,6px 6px 0 3px rgba(0,0,0,.55)}
html.px .pl.cur{box-shadow:inset 0 0 0 3px var(--pxacc),0 0 0 3px #000,6px 6px 0 3px rgba(0,0,0,.55);animation:none}
html.px .pl.cur::after{content:"出牌";color:#000;background:var(--pxacc);box-shadow:0 0 0 2px #000;letter-spacing:.1em}
html.px .pl.sel{box-shadow:inset 0 0 0 3px #ffa300,0 0 0 3px #000}
html.px .pl .ph{border:2px solid var(--pxfg);box-shadow:0 0 0 2px #000}
html.px .pl .nm{color:var(--pxfg)}
html.px .role{box-shadow:0 0 0 2px #000;padding:0 6px}
html.px .hp{color:#ff004d;text-shadow:2px 2px 0 #000}
html.px .tag{background:var(--pxbtn);border:2px solid #000}
html.px .bubble{background:var(--pxfg);color:var(--pxbg);border:3px solid #000;box-shadow:4px 4px 0 rgba(0,0,0,.5)}
html.px .bubble::after{border-top-color:#000}
html.px .pl.bb .bubble::after{border-bottom-color:#000}
html.px .card{border:3px solid #000;box-shadow:0 0 0 2px var(--pxfg),4px 4px 0 2px rgba(0,0,0,.55)}
html.px .card.ok{border:3px solid var(--pxok);box-shadow:0 0 0 2px var(--pxfg),4px 4px 0 2px rgba(0,0,0,.55)}
html.px .card.picked{border-color:var(--pxacc);box-shadow:0 0 0 2px var(--pxfg),6px 6px 0 2px rgba(0,0,0,.55)}
html.px #side{background:var(--pxbg);border-left:4px solid var(--pxfg)}
html.px #tabs{background:#000}
html.px #tabs button.on{background:var(--pxbtn);color:var(--pxacc);box-shadow:inset 0 -4px 0 var(--pxacc)}
html.px #log .turn{background:var(--pxbtn);color:var(--pxacc);border-left:4px solid var(--pxacc)}
html.px .th,html.px .cc{background:var(--pxbg2);border:2px solid #000;box-shadow:inset 0 0 0 2px var(--pxbg3)}
html.px #bar .pr{color:var(--pxacc);text-shadow:2px 2px 0 #000}
html.px button{background:var(--pxbtn);color:var(--pxfg);border:0;box-shadow:inset 0 0 0 3px var(--pxfg),0 0 0 2px #000,3px 3px 0 2px #000}
html.px button:hover{background:var(--pxbtnh);box-shadow:inset 0 0 0 3px var(--pxacc),0 0 0 2px #000,3px 3px 0 2px #000}
html.px button:not(:disabled):active{transform:translate(3px,3px);box-shadow:inset 0 0 0 3px var(--pxacc),0 0 0 2px #000}
html.px button.primary{background:var(--pxok);color:#000;box-shadow:inset 0 0 0 3px var(--pxfg),0 0 0 2px #000,3px 3px 0 2px #000}
html.px input,html.px select,html.px textarea{background:#000;color:var(--pxfg);border:3px solid var(--pxfg)}
html.px #status{background:#000;color:var(--pxacc);border:2px solid var(--pxfg)}
html.px .dlg,html.px .ci{background:var(--pxbg);border:4px solid var(--pxfg);box-shadow:0 0 0 3px #000,8px 8px 0 3px rgba(0,0,0,.6)}
html.px .dlg h3,html.px .ci h3{color:var(--pxacc);text-shadow:2px 2px 0 var(--pxbtn)}
html.px .modal{background:rgba(0,0,0,.72)}
html.px .pickbar{background:var(--pxbg);border:3px solid var(--pxacc);box-shadow:0 0 0 3px #000,6px 6px 0 3px rgba(0,0,0,.6)}
/* 方形頭像下的特效: 旋轉改成 90 度一格一格跳 (方形轉完還是方形,不會角突出來),放射狀 / 對稱圖樣另外處理 */
@keyframes pxblink{0%,49%{opacity:1}50%,100%{opacity:.3}}
@keyframes pxinv{50%{filter:invert(1)}}
@keyframes pxhue{to{filter:hue-rotate(360deg)}}
html.px .avw::before,html.px .avw::after,html.px .avw>i{animation-timing-function:steps(12)}   /* 一般特效 12 格,看起來像像素動畫但不會一頓一頓 */
html.px .fx-flame::after,html.px .fx-ki>.fxa,html.px .fx-shadow>.fxa,html.px .fx-beam>.fxa{filter:none}   /* 模糊濾鏡很吃效能,像素主題不需要 */
html.px .fx-arc>.fxa{border:3px dashed #ffe45a;filter:none;animation:pxblink .5s steps(1) infinite}
html.px .fx-arc>.fxb{border:3px dotted #fff;filter:none;animation:pxblink .5s steps(1) infinite .25s}
@keyframes pxstripe{to{background-position:16px 0}}
html.px .avw.fr-storm::before{background:linear-gradient(45deg,#ffec27 25%,#1d2b53 25% 50%,#ffec27 50% 75%,#1d2b53 75%) 0 0/16px 16px;animation:pxstripe .6s steps(4) infinite}
html.px .fx-comet>.fxa{-webkit-mask:none;mask:none;clip-path:polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,8px 8px,8px calc(100% - 8px),calc(100% - 8px) calc(100% - 8px),calc(100% - 8px) 8px,8px 8px)}
/* 旋轉特效: 元素本身不轉 (方形轉了角會突出來),改成轉裡面的漸層角度 / 虛線環,連續不卡頓又不會破形 */
@property --pxa{syntax:"<angle>";inherits:false;initial-value:0deg}
@keyframes pxrot{to{--pxa:360deg}}
@keyframes pxorb{0%,100%{left:0;top:0}25%{left:100%;top:0}50%{left:100%;top:100%}75%{left:0;top:100%}}
html.px .fx-ring::after,html.px .fx-ice>.fxa,html.px .fx-vortex>.fxb{border:0;padding:3px;filter:none;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);animation:pxrot 3s linear infinite}
html.px .fx-ring::after{background:repeating-conic-gradient(from var(--pxa),rgba(190,245,255,.95) 0 12deg,transparent 12deg 30deg)}
html.px .fx-ice>.fxa{background:repeating-conic-gradient(from var(--pxa),rgba(190,240,255,.95) 0 6deg,transparent 6deg 18deg);animation-duration:6s}
html.px .fx-vortex>.fxb{background:repeating-conic-gradient(from var(--pxa),rgba(200,140,255,.95) 0 10deg,transparent 10deg 24deg);animation-direction:reverse}
html.px .fx-orbit>.fxa,html.px .fx-orbit>.fxb{animation:none}
html.px .fx-orbit>.fxa::before,html.px .fx-orbit>.fxb::before{left:0;top:0;margin:-3px 0 0 -3px;box-shadow:none;animation:pxorb 2.6s linear infinite}
html.px .fx-orbit>.fxb::before{animation-duration:4.2s;animation-direction:reverse}
html.px .fr-6::before{background:conic-gradient(from var(--pxa),#ff5d73,#ffd24a,#46e0a0,#3fd2ff,#9b6bff,#ff5d73)!important;animation:pxrot 4s linear infinite}
html.px .fx-aurora::after{inset:-8px;padding:6px;background:conic-gradient(from var(--pxa),#46e0a0,#3fd2ff,#9b6bff,#46e0a0);opacity:.75;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);animation:pxrot 6s linear infinite reverse}
html.px .fx-rainbow::after{inset:-4px;padding:3px;background:conic-gradient(from var(--pxa),#ff5d73,#ffd24a,#46e0a0,#3fd2ff,#9b6bff,#ff5d73);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);animation:pxrot 2s linear infinite}
html.px .fx-vortex>.fxa{inset:-10px;padding:7px;background:conic-gradient(from var(--pxa),#14002a,#b04bff,#14002a 25%,#b04bff 50%,#14002a 75%,#b04bff);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);filter:none;animation:pxrot 1.6s linear infinite}
html.px .fx-radar>.fxa{background:conic-gradient(from var(--pxa),transparent 0 70%,rgba(110,255,190,.75) 100%);animation:pxrot 2.2s linear infinite}
html.px .fx-comet>.fxa{background:conic-gradient(from var(--pxa),transparent 0 78%,rgba(120,220,255,.1) 84%,rgba(255,255,255,.95) 100%);animation:pxrot 1.8s linear infinite}
html.px .fx-sun>.fxa{background:repeating-conic-gradient(from var(--pxa),#fff2a8 0 3deg,#ffc83a 3deg 6deg,transparent 6deg 30deg);animation:pxrot 16s linear infinite}
html.px .fx-sun::after{background:repeating-conic-gradient(from calc(15deg + var(--pxa)),#ff9a2e 0 4deg,transparent 4deg 30deg);animation:pxrot 22s linear infinite reverse}
html.px .fr-yinyang::before{background:conic-gradient(from var(--pxa),#fff 0 50%,#000 50% 100%);animation:pxrot 6s linear infinite}
@font-face{font-family:"SGS Pixel TW";src:url(/fonts/pixel-tw.woff2) format("woff2");font-display:swap}
@font-face{font-family:"SGS Pixel JA";src:url(/fonts/pixel-ja.woff2) format("woff2");font-display:swap}
`;
  document.head.appendChild(px);
  const PXV = {"#ff77a8": {"bg": "#1d2b53", "bg2": "#2a3a78", "bg3": "#5f6fb0", "btn": "#7e2553", "btnh": "#ab5236", "acc": "#ffec27", "fg": "#fff1e8", "tbl": "#008751", "ok": "#00e436", "dim": "#c2c3c7"}, "#9bbc0f": {"bg": "#0f380f", "bg2": "#1f5a1f", "bg3": "#306230", "btn": "#306230", "btnh": "#4a7a1a", "acc": "#9bbc0f", "fg": "#e0f8d0", "tbl": "#2a6a2a", "ok": "#8bac0f", "dim": "#a8c890"}, "#29adff": {"bg": "#0b1a3a", "bg2": "#17306a", "bg3": "#3d5fa8", "btn": "#1d4fa0", "btnh": "#2f6fd0", "acc": "#7fd8ff", "fg": "#eaf6ff", "tbl": "#0a5a8a", "ok": "#00e436", "dim": "#9fb8d8"}, "#ffa300": {"bg": "#2e1706", "bg2": "#5a2d10", "bg3": "#8a4a1a", "btn": "#b04a14", "btnh": "#d96a24", "acc": "#ffcc33", "fg": "#fff1e0", "tbl": "#8a5a20", "ok": "#00e436", "dim": "#d0b090"}, "#83769c": {"bg": "#1f1633", "bg2": "#3a2c5c", "bg3": "#6a5a9a", "btn": "#5a3f8a", "btnh": "#7a5aba", "acc": "#c9b6ff", "fg": "#f2ecff", "tbl": "#3d2e6a", "ok": "#00e436", "dim": "#b0a6c8"}, "#c2c3c7": {"bg": "#1a1a1a", "bg2": "#333333", "bg3": "#666666", "btn": "#444444", "btnh": "#666666", "acc": "#ffffff", "fg": "#f0f0f0", "tbl": "#3a3a3a", "ok": "#cfcfcf", "dim": "#aaaaaa"}, "#ff004d": {"bg": "#2a0a14", "bg2": "#55162a", "bg3": "#8a2a44", "btn": "#a00032", "btnh": "#d0204a", "acc": "#ffec27", "fg": "#fff1e8", "tbl": "#4a1a2a", "ok": "#00e436", "dim": "#d0a0b0"}};
  const pxOn = t => {
    const a = (t && t.a || "").toLowerCase(), v = PXV[a], r = document.documentElement;
    r.classList.toggle("px", !!v);
    Object.keys(PXV["#ff77a8"]).forEach(k => v ? r.style.setProperty("--px" + k, v[k]) : r.style.removeProperty("--px" + k));
  };
  /* ---------- 其他主題的整體造型: 每個主題各自的配色 / 邊框 / 圓角 / 陰影 / 背景紋路 / 開關 / 勾選框 / 拉桿 ----------
     用一份參數表產生樣式 (古風三國、像素另有專屬樣式)。參數: bg 頁面底 / p 面板漸層 / line 邊框色 / acc 重點色 / text 字色 / dim 次要字色 /
     felt 牌桌漸層 / tbl 牌桌邊框 / btn 按鈕 / pri 主要按鈕 + pric 字色 / rad 圓角 / lw 邊框粗 / bs 邊框樣式 / sh 陰影 / clip 斜角 / pat 頁面紋路 / tpat 牌桌紋路 */
  const SKINS = {
    "#c3ccd8": { bg: "#15171b", p: ["#23262c", "#1a1c21"], line: "#4a4f58", acc: "#d7dce4", text: "#e6e9ee", dim: "#9aa1ad", felt: ["#2c3036", "#16181c"], tbl: "#565c66", btn: ["#2f333a", "#23262c"], pri: ["#d7dce4", "#a9b0bc"], pric: "#14161a", rad: 3, lw: 1, bs: "solid", sh: "0 4px 10px rgba(0,0,0,.5)", tpat: "repeating-linear-gradient(0deg,rgba(255,255,255,.03) 0 1px,transparent 1px 6px)" },
    "#46e0a0": { bg: "#0a1f1a", p: ["#12362c", "#0b241d"], line: "#3fbf94", acc: "#6ff0c0", text: "#e4fff5", dim: "#8fc9b3", felt: ["#1d6b53", "#0b2e25"], tbl: "#46e0a0", btn: ["#17493a", "#0f3228"], pri: ["#46e0a0", "#1f9d72"], pric: "#04241a", rad: 12, lw: 2, bs: "solid", sh: "0 0 16px rgba(70,224,160,.18)", tpat: "repeating-linear-gradient(90deg,rgba(111,240,192,.06) 0 3px,transparent 3px 22px)" },
    "#b58cff": { bg: "#150f2e", p: ["#2a1d54", "#1a1238"], line: "#a07cf0", acc: "#d1b3ff", text: "#f2eaff", dim: "#b3a2dc", felt: ["#3d2a7a", "#150d33"], tbl: "#b58cff", btn: ["#33256a", "#241a4b"], pri: ["#b58cff", "#7c4ddb"], pric: "#14093a", rad: 6, lw: 2, bs: "solid", sh: "0 0 18px rgba(181,140,255,.2)", clip: 8, tpat: "linear-gradient(60deg,rgba(255,255,255,.05) 25%,transparent 25% 75%,rgba(255,255,255,.05) 75%) 0 0/34px 60px" },
    "#ff8fc0": { bg: "#26101e", p: ["#4a2038", "#331427"], line: "#ff9ec9", acc: "#ffc2de", text: "#fff0f7", dim: "#e0a6c0", felt: ["#8a3f66", "#3a1629"], tbl: "#ff8fc0", btn: ["#5b2645", "#431a33"], pri: ["#ff8fc0", "#e0568f"], pric: "#3a0f26", rad: 16, lw: 2, bs: "solid", sh: "0 6px 18px rgba(255,143,192,.16)", tpat: "radial-gradient(circle,rgba(255,200,225,.16) 0 2px,transparent 3px) 0 0/26px 26px" },
    "#ff7a45": { bg: "#240f0f", p: ["#4a1d12", "#2c0f0b"], line: "#ff7a45", acc: "#ffb27a", text: "#fff1e8", dim: "#e0a58a", felt: ["#6e2a14", "#260d08"], tbl: "#ff7a45", btn: ["#5d2412", "#3a150c"], pri: ["#ff7a45", "#d9361c"], pric: "#2a0a04", rad: 4, lw: 3, bs: "solid", sh: "0 0 18px rgba(255,122,69,.28)", clip: 10, tpat: "repeating-linear-gradient(135deg,rgba(255,140,60,.07) 0 6px,transparent 6px 18px)" },
    "#f0c95c": { bg: "#1d1608", p: ["#3a2c0e", "#241a08"], line: "#f0c95c", acc: "#ffe08a", text: "#fff6dc", dim: "#d9c18a", felt: ["#6b5314", "#241a06"], tbl: "#f0c95c", btn: ["#4a380f", "#2e220a"], pri: ["#f0c95c", "#c4961f"], pric: "#2a1d02", rad: 4, lw: 4, bs: "double", sh: "0 6px 16px rgba(0,0,0,.5)", tpat: "repeating-linear-gradient(45deg,rgba(255,224,138,.05) 0 2px,transparent 2px 14px)" },
    "#9b8cff": { bg: "#080824", p: ["#1a1850", "#0d0c33"], line: "#7f72ff", acc: "#c3b8ff", text: "#eeeaff", dim: "#a79fe0", felt: ["#1c1a60", "#05051b"], tbl: "#9b8cff", btn: ["#25236b", "#171550"], pri: ["#9b8cff", "#5b4de0"], pric: "#07061f", rad: 8, lw: 1, bs: "solid", sh: "0 0 20px rgba(155,140,255,.25)", pat: "radial-gradient(circle,rgba(255,255,255,.55) 0 1px,transparent 1.5px) 0 0/53px 53px,radial-gradient(circle,rgba(195,184,255,.4) 0 1px,transparent 1.5px) 17px 29px/71px 71px", tpat: "radial-gradient(circle,rgba(255,255,255,.5) 0 1px,transparent 1.5px) 0 0/37px 37px" },
    "#7fffd4": { bg: "#0b1f1d", p: ["#1a3f3a", "#10302c"], line: "#7fffd4", acc: "#aaffe6", text: "#eafff9", dim: "#8fd6c4", felt: ["#2a7f73", "#0d332f"], tbl: "#7fffd4", btn: ["#1f4d46", "#163a35"], pri: ["#7fffd4", "#3cc9a1"], pric: "#052420", rad: 14, lw: 1, bs: "solid", sh: "0 6px 18px rgba(127,255,212,.12)", tpat: "" },
    "#4d8dff": { bg: "#0a1330", p: ["#14306a", "#0b1d46"], line: "#4d8dff", acc: "#8fbaff", text: "#e8f0ff", dim: "#93acd9", felt: ["#1b4aa8", "#08163a"], tbl: "#4d8dff", btn: ["#1b3b80", "#12295c"], pri: ["#4d8dff", "#2456d6"], pric: "#ffffff", rad: 10, lw: 2, bs: "solid", sh: "0 6px 18px rgba(77,141,255,.18)", tpat: "repeating-radial-gradient(circle at 50% 120%,rgba(143,186,255,.08) 0 10px,transparent 10px 22px)" },
    "#bfe9ff": { bg: "#0c1a28", p: ["#2a4a66", "#18304a"], line: "#cfeeff", acc: "#e8f8ff", text: "#f4fbff", dim: "#a9c9de", felt: ["#3b6f94", "#0d2236"], tbl: "#bfe9ff", btn: ["#2f5878", "#21425c"], pri: ["#e8f8ff", "#9fd6f5"], pric: "#0a2236", rad: 14, lw: 1, bs: "solid", sh: "0 0 18px rgba(207,238,255,.2)", tpat: "linear-gradient(135deg,rgba(255,255,255,.1) 25%,transparent 25% 50%,rgba(255,255,255,.1) 50% 75%,transparent 75%) 0 0/40px 40px" },
    "#d9a066": { bg: "#21160e", p: ["#4a3321", "#2f1f13"], line: "#c9935a", acc: "#f0c08a", text: "#fbeedb", dim: "#cfae8a", felt: ["#6b4a2e", "#24160d"], tbl: "#d9a066", btn: ["#5a3d26", "#3c2818"], pri: ["#d9a066", "#a8692f"], pric: "#2a1708", rad: 6, lw: 2, bs: "dashed", sh: "0 6px 14px rgba(0,0,0,.5)", tpat: "repeating-linear-gradient(0deg,rgba(255,220,170,.05) 0 2px,transparent 2px 7px),repeating-linear-gradient(90deg,rgba(255,220,170,.05) 0 2px,transparent 2px 7px)" },
    "#7ed957": { bg: "#0c1f10", p: ["#1f4a26", "#12301a"], line: "#7ed957", acc: "#b4f08f", text: "#eefbe6", dim: "#9fcf8a", felt: ["#2f7a32", "#0e2c12"], tbl: "#7a5a2c", btn: ["#285c30", "#1a4022"], pri: ["#7ed957", "#3f9f2a"], pric: "#0a2208", rad: 10, lw: 3, bs: "solid", sh: "0 6px 16px rgba(0,0,0,.5)", tpat: "radial-gradient(ellipse at 20% 30%,rgba(180,240,143,.08) 0 6px,transparent 7px) 0 0/44px 38px" },
    "#b8c0cc": { bg: "#15181d", p: ["#242830", "#1a1d23"], line: "#8d97a6", acc: "#cfd6e0", text: "#dfe4ec", dim: "#98a1af", felt: ["#2b2f37", "#14161a"], tbl: "#9aa3b0", btn: ["#2d323b", "#21252c"], pri: ["#cfd6e0", "#8e98a8"], pric: "#12151a", rad: 0, lw: 1, bs: "dashed", sh: "none", pat: "repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px)", tpat: "repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0 1px,transparent 1px 4px)" },
    "#ff5d73": { bg: "#240c12", p: ["#4d1626", "#30101a"], line: "#ff5d73", acc: "#ff9aa8", text: "#fff0f2", dim: "#e0a0aa", felt: ["#7a1a2e", "#2a0a12"], tbl: "#ff5d73", btn: ["#5c1a2c", "#3d1019"], pri: ["#ff5d73", "#c41d3a"], pric: "#ffffff", rad: 2, lw: 2, bs: "solid", sh: "0 0 16px rgba(255,93,115,.25)", clip: 10, tpat: "repeating-linear-gradient(45deg,rgba(255,120,140,.06) 0 3px,transparent 3px 16px)" },
    "#ffb347": { bg: "#26160a", p: ["#5a2f1a", "#3a1d10"], line: "#ffb36b", acc: "#ffd09a", text: "#fff2e4", dim: "#e6b895", felt: ["#a04a2a", "#321638"], tbl: "#ffb36b", btn: ["#6b3820", "#47241a"], pri: ["#ffb347", "#e0742a"], pric: "#2a1204", rad: 14, lw: 2, bs: "solid", sh: "0 6px 18px rgba(255,179,71,.16)", tpat: "linear-gradient(180deg,rgba(255,200,120,.12),transparent 60%)" },
    "#b6ff3a": { bg: "#0f1a08", p: ["#233d10", "#162608"], line: "#b6ff3a", acc: "#d4ff7a", text: "#f2ffd9", dim: "#a6c97a", felt: ["#2e5a10", "#0c1604"], tbl: "#b6ff3a", btn: ["#2b4a12", "#1c3009"], pri: ["#b6ff3a", "#7ec21a"], pric: "#0d1704", rad: 0, lw: 3, bs: "solid", sh: "0 0 14px rgba(182,255,58,.22)", tpat: "repeating-linear-gradient(-45deg,rgba(182,255,58,.08) 0 10px,transparent 10px 20px)" },
    "#ff4de0": { bg: "#1a0828", p: ["#33104e", "#210a33"], line: "#ff4de0", acc: "#3dfff0", text: "#fff0ff", dim: "#d09ad8", felt: ["#3a0f5c", "#10041a"], tbl: "#3dfff0", btn: ["#3d1260", "#2a0b45"], pri: ["#ff4de0", "#b81da0"], pric: "#1a0420", rad: 0, lw: 2, bs: "solid", sh: "0 0 18px rgba(255,77,224,.3)", clip: 8, pat: "repeating-linear-gradient(0deg,rgba(61,255,240,.05) 0 1px,transparent 1px 3px)", tpat: "linear-gradient(rgba(61,255,240,.14) 1px,transparent 1px) 0 0/24px 24px,linear-gradient(90deg,rgba(255,77,224,.14) 1px,transparent 1px) 0 0/24px 24px" },
    "#ffffff": { bg: "#111111", p: ["#1c1c1c", "#0e0e0e"], line: "#ffffff", acc: "#ffffff", text: "#ffffff", dim: "#bdbdbd", felt: ["#262626", "#0a0a0a"], tbl: "#ffffff", btn: ["#2a2a2a", "#161616"], pri: ["#ffffff", "#cfcfcf"], pric: "#000000", rad: 0, lw: 3, bs: "solid", sh: "6px 6px 0 rgba(255,255,255,.35)", tpat: "repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 2px,transparent 2px 10px)" },
    "#c9a7ff": { bg: "#1a1230", p: ["#3a2c66", "#261b49"], line: "#c9a7ff", acc: "#e0ccff", text: "#f6efff", dim: "#b9a6e0", felt: ["#5a4a9a", "#1c1438"], tbl: "#c9a7ff", btn: ["#43357a", "#2f2459"], pri: ["#c9a7ff", "#8d63e0"], pric: "#170f33", rad: 16, lw: 2, bs: "solid", sh: "0 6px 18px rgba(201,167,255,.16)", tpat: "radial-gradient(circle,rgba(224,204,255,.14) 0 2px,transparent 3px) 0 0/30px 30px" },
    "#ffd700": { bg: "#1a0f3a", p: ["#33206b", "#1f1245"], line: "#ffd700", acc: "#ffe566", text: "#fff8d6", dim: "#cbb97a", felt: ["#3c2380", "#150a34"], tbl: "#ffd700", btn: ["#412b82", "#2b1b5c"], pri: ["#ffd700", "#c99a00"], pric: "#1a0f3a", rad: 6, lw: 4, bs: "double", sh: "0 0 18px rgba(255,215,0,.18)", tpat: "repeating-linear-gradient(45deg,rgba(255,215,0,.06) 0 2px,transparent 2px 14px),repeating-linear-gradient(-45deg,rgba(255,215,0,.06) 0 2px,transparent 2px 14px)" },
  };
  function skinCss(a, s) {
    const S = `html[data-skin="${a}"]`, lw = s.lw, B = `${lw}px ${s.bs} ${s.line}`, r = s.rad, cr = Math.min(r, 6), bs1 = s.bs === "double" ? "solid" : s.bs, lw1 = Math.max(1, Math.min(lw, 2));
    const cp = s.clip ? `clip-path:polygon(${s.clip}px 0,100% 0,100% calc(100% - ${s.clip}px),calc(100% - ${s.clip}px) 100%,0 100%,0 ${s.clip}px);` : "";
    const P = `linear-gradient(160deg,${s.p[0]},${s.p[1]})`, sh = s.sh;
    const round = r >= 10, kr = round ? 99 : cr, tr = round ? "50%" : Math.min(cr, 3) + "px";
    return `
${S}{--text:${s.text};--dim:${s.dim};--accent:${s.acc}}
${S},${S} body{background:${s.pat ? s.pat + "," : ""}${s.bg};color:${s.text}}
${S} #top{background:linear-gradient(90deg,${s.p[1]},${s.p[0]} 50%,${s.p[1]});border-bottom:${Math.max(1, lw)}px ${bs1} ${s.line}}
${S} #top .title,${S} #center .big,${S} #roundtag,${S} .dlg h3,${S} .ci h3,${S} #bar .pr{color:${s.acc}}
${S} #tablewrap::before{border:${Math.max(3, lw * 2)}px ${s.bs === "dashed" ? "solid" : s.bs} ${s.tbl};background:${s.tpat ? s.tpat + "," : ""}radial-gradient(ellipse at 50% 42%,${s.felt[0]} 0,${s.felt[1]} 100%);box-shadow:0 0 0 3px ${s.bg},0 0 0 4px ${s.line}${sh === "none" ? "" : "," + sh},inset 0 0 70px rgba(0,0,0,.6)}
${S} #tablewrap::after{box-shadow:inset 0 0 0 1px ${s.line}55}
${S} #center,${S} #roundtag .rtdeck{color:${s.dim}}
${S} #cosdlg .pvseat{background:${P};box-shadow:inset 0 0 0 1px ${s.line}}
${S} .pl{background:${P};border:${B};border-radius:${r}px;box-shadow:${sh};animation:none}
${S} .pl:hover{border-color:${s.acc}}
${S} .pl.cur{border-color:${s.acc};box-shadow:0 0 0 2px ${s.acc}55,0 0 22px ${s.acc}88;animation:none}
${S} .pl.cur::after{content:"出牌";background:${s.acc};color:${s.bg};box-shadow:none;letter-spacing:.15em;border-radius:${Math.min(r, 4)}px ${Math.min(r, 4)}px 0 0}
${S} .pl.sel{box-shadow:0 0 0 2px ${s.acc}}
${S} .pl .ph{border:1px solid ${s.line};border-radius:${Math.min(r, 6)}px}
${S} .role{border-radius:${round ? 99 : Math.min(r, 4)}px}
${S} .tag{background:${s.line}22;border-color:${s.line}88;border-radius:${round ? 99 : Math.min(r, 4)}px}
${S} .bubble{background:${s.text};color:${s.bg};border:${Math.max(1, lw)}px ${bs1} ${s.line};border-radius:${Math.min(r, 10)}px}
${S} .bubble::after{border-top-color:${s.text}}
${S} .pl.bb .bubble::after{border-bottom-color:${s.text}}
${S} .card{border:${lw1}px solid ${s.line};border-radius:${Math.min(r, 8)}px}
${S} .card.ok{border:2px solid ${s.acc};box-shadow:0 0 14px ${s.acc}88,0 4px 10px rgba(0,0,0,.6)}
${S} .card.picked{border-color:#fff;box-shadow:0 0 22px ${s.acc},0 10px 18px rgba(0,0,0,.6)}
${S} #side{background:linear-gradient(180deg,${s.p[0]},${s.p[1]});border-left:${Math.max(1, lw)}px ${bs1} ${s.line}}
${S} #tabs{background:rgba(0,0,0,.28)}
${S} #tabs button.on{background:${s.acc}1f;color:${s.acc};box-shadow:inset 0 -3px 0 ${s.acc}}
${S} #log .turn{background:linear-gradient(90deg,${s.acc}33,transparent);color:${s.acc};border-left-color:${s.acc}}
${S} .th,${S} .cc{background:${s.p[0]}cc;border:1px solid ${s.line}77;border-radius:${Math.min(r, 8)}px}
${S} button{background:linear-gradient(180deg,${s.btn[0]},${s.btn[1]});color:${s.text};border:0;box-shadow:inset 0 0 0 ${lw1}px ${s.line};border-radius:${r}px;${cp}}
${S} button:hover{background:linear-gradient(180deg,${s.btn[0]},${s.btn[0]});box-shadow:inset 0 0 0 2px ${s.acc},0 0 12px ${s.acc}55}
${S} button.primary{background:linear-gradient(180deg,${s.pri[0]},${s.pri[1]});color:${s.pric};box-shadow:inset 0 0 0 1px ${s.acc}}
${S} input:not([type=checkbox]):not([type=radio]):not([type=range]),${S} select,${S} textarea{background:${s.bg};color:${s.text};border:${lw1}px ${bs1} ${s.line};border-radius:${Math.min(r, 8)}px}
${S} #status{background:${s.p[1]};color:${s.acc};border-color:${s.line};border-radius:${Math.min(r, 8)}px}
${S} .dlg,${S} .ci{background:${P};border:${B};border-radius:${r}px;box-shadow:${sh === "none" ? "" : sh + ","}0 18px 50px rgba(0,0,0,.7)}
${S} .modal{background:rgba(0,0,0,.72)}
${S} .pickbar{background:${P};border:${B};box-shadow:0 0 24px ${s.acc}55}
${S} input[type=checkbox],${S} input[type=radio]{-webkit-appearance:none;appearance:none;width:18px;height:18px;margin:0 6px 0 0;vertical-align:middle;background:${s.bg};border:2px solid ${s.line};border-radius:${cr}px;cursor:pointer;flex:none}
${S} input[type=radio]{border-radius:${r === 0 ? 0 : 50}%}
${S} input[type=checkbox]:checked,${S} input[type=radio]:checked{background:${s.acc};box-shadow:inset 0 0 0 3px ${s.bg}}
${S} .sw input{width:0;height:0;border:0}
${S} .sw .knob{border-radius:${kr}px;background:${s.bg};box-shadow:inset 0 0 0 2px ${s.line}}
${S} .sw .knob::after{border-radius:${round ? "50%" : Math.min(cr, 3) + "px"};background:${s.dim}}
${S} .sw input:checked+.knob{background:linear-gradient(90deg,${s.pri[1]},${s.pri[0]});box-shadow:inset 0 0 0 2px ${s.line},0 0 10px ${s.acc}55}
${S} .sw input:checked+.knob::after{background:#fff}
${S} input[type=range]{-webkit-appearance:none;appearance:none;height:12px;background:${s.bg};border:2px solid ${s.line};border-radius:${kr}px;padding:0;cursor:pointer}
${S} input[type=range]::-webkit-slider-runnable-track{height:8px;background:transparent}
${S} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:${round ? 18 : 12}px;height:${round ? 18 : 20}px;margin-top:${round ? -5 : -6}px;background:${s.acc};border:2px solid ${s.bg};border-radius:${tr};box-shadow:0 0 0 1px ${s.line}}
${S} input[type=range]::-moz-range-track{height:8px;background:transparent}
${S} input[type=range]::-moz-range-thumb{width:${round ? 18 : 12}px;height:${round ? 18 : 20}px;background:${s.acc};border:2px solid ${s.bg};border-radius:${tr}}`;
  }
  const skinCssEl = document.createElement("style"); skinCssEl.dataset.cos = "1";
  skinCssEl.textContent = Object.entries(SKINS).map(([a, s]) => skinCss(a, s)).join("\n");
  document.head.appendChild(skinCssEl);
  const skinOn = t => { const a = (t && t.a || "").toLowerCase(); if (SKINS[a]) document.documentElement.dataset.skin = a; else delete document.documentElement.dataset.skin; };
  const gfOn = t => document.documentElement.classList.toggle("gf", !!(t && t.a && t.a.toLowerCase() === GF_A));

  const origs = new WeakMap();
  function apply(t) {
    const els = [...document.querySelectorAll("style")].filter(e => !e.dataset.cos);
    t = t && t.a && t.b ? t : { a: GF_A, b: GF_B };   // 沒選主題 = 預設的古風三國
    gfOn(t); pxOn(t); skinOn(t); fontOn(t);
    const off = t.a.toLowerCase() === DEF.a && t.b.toLowerCase() === DEF.b;   // 「電競藍」就是頁面原本的顏色
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
.fr-3{--fb:linear-gradient(135deg,#7ff0e0,#1f9e92 50%,#5fe6d2);box-shadow:0 0 8px rgba(60,230,200,.85)}
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
.fx-petal::after{inset:-8px;z-index:2;background:radial-gradient(circle,#ffb7d5 0 2px,transparent 3px) 15% 0/30px 30px no-repeat,radial-gradient(circle,#ff8fc0 0 1.6px,transparent 2.6px) 78% 0/34px 34px no-repeat,radial-gradient(circle,#ffd0e4 0 1.4px,transparent 2.4px) 45% 0/38px 38px no-repeat;animation:fxsn 2.6s linear infinite;border-radius:0;will-change:transform,opacity}
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
.fx-dust>.fxa,.fx-dust>.fxb{left:-6px;right:-6px;top:-8px;bottom:-4px;z-index:3;background:radial-gradient(circle,#ffe27a 0 1.6px,transparent 2.6px) 14% 100%/22px 22px no-repeat,radial-gradient(circle,#fff6c4 0 1.3px,transparent 2.3px) 52% 100%/26px 26px no-repeat,radial-gradient(circle,#ffd24a 0 1.5px,transparent 2.5px) 86% 100%/20px 20px no-repeat;animation:fxdu 2.2s linear infinite;will-change:transform,opacity}
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
.fx-ice>.fxb{inset:-2px;border-radius:50%;z-index:-1;box-shadow:0 0 10px 3px rgba(150,230,255,.7);animation:fxglow2 2s ease-in-out infinite}
.fx-toxic>.fxa,.fx-toxic>.fxb{left:-4px;right:-4px;top:-6px;bottom:-2px;z-index:3;background:radial-gradient(circle,rgba(160,255,120,.9) 0 2px,rgba(80,200,60,.3) 3.5px,transparent 4.5px) 20% 100%/24px 24px no-repeat,radial-gradient(circle,rgba(190,120,255,.9) 0 1.5px,rgba(130,60,200,.3) 3px,transparent 4px) 62% 100%/28px 28px no-repeat,radial-gradient(circle,rgba(160,255,120,.9) 0 1.5px,transparent 3px) 88% 100%/20px 20px no-repeat;animation:fxdu 2.6s linear infinite;will-change:transform,opacity}
.fx-toxic>.fxb{animation-delay:-1.3s;background-position:45% 100%,80% 100%,8% 100%}
.fx-heart>.fxa,.fx-heart>.fxb{inset:0;z-index:3}
.fx-heart>.fxa::before,.fx-heart>.fxb::before{content:"♥";position:absolute;left:12%;bottom:0;font-size:11px;line-height:1;color:#ff6fa8;text-shadow:0 0 5px #ff9ac2;animation:fxheart 2.4s ease-in infinite}
.fx-heart>.fxb::before{left:68%;font-size:9px;color:#ff8fc0;animation-delay:-1.2s}
@keyframes fxheart{0%{transform:translateY(4px) scale(.6);opacity:0}25%{opacity:1}100%{transform:translateY(-34px) scale(1.1);opacity:0}}
.fx-snow>.fxa,.fx-snow>.fxb{left:-6px;right:-6px;top:-10px;bottom:-2px;z-index:3;background:radial-gradient(circle,#fff 0 1.6px,transparent 2.6px) 15% 0/22px 22px no-repeat,radial-gradient(circle,#e8f8ff 0 1.3px,transparent 2.3px) 55% 0/26px 26px no-repeat,radial-gradient(circle,#fff 0 1.5px,transparent 2.5px) 90% 0/24px 24px no-repeat;animation:fxsn 2.8s linear infinite;will-change:transform,opacity}
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
.fx-beam>.fxb{inset:-2px;border-radius:50%;z-index:-1;box-shadow:0 0 12px 3px rgba(255,235,150,.8);animation:fxglow2 2.4s ease-in-out infinite}
@keyframes fxbm{0%,100%{opacity:.55;transform:scaleY(.85)}50%{opacity:1;transform:scaleY(1.1)}}
.fx-sun>.fxa{inset:-24px;border-radius:50%;z-index:-1;background:repeating-conic-gradient(#fff2a8 0 3deg,#ffc83a 3deg 6deg,transparent 6deg 30deg);-webkit-mask:radial-gradient(closest-side,transparent 62%,#000 69%,rgba(0,0,0,.5) 84%,transparent 100%);mask:radial-gradient(closest-side,transparent 62%,#000 69%,rgba(0,0,0,.5) 84%,transparent 100%);animation:frspin 16s linear infinite}
.fx-sun::after{inset:-14px;z-index:-1;background:repeating-conic-gradient(from 15deg,#ff9a2e 0 4deg,transparent 4deg 30deg);-webkit-mask:radial-gradient(closest-side,transparent 72%,#000 80%,transparent 100%);mask:radial-gradient(closest-side,transparent 72%,#000 80%,transparent 100%);animation:frspin 22s linear infinite reverse}
.fx-sun>.fxb{inset:-8px;border-radius:50%;z-index:-1;background:radial-gradient(closest-side,transparent 84%,rgba(255,226,110,.85) 90%,rgba(255,160,50,.4) 96%,transparent 100%);animation:fxglow2 2.6s ease-in-out infinite}
.fx-ki>.fxa{inset:-8px;z-index:-1;border-radius:50% 50% 45% 45%;background:radial-gradient(ellipse at 50% 80%,#fff6a8 0,#ffd23a 40%,rgba(255,170,0,0) 75%);filter:blur(2px);animation:fxki .35s ease-in-out infinite alternate}
.fx-ki>.fxb{inset:-4px;z-index:-1;border-radius:50%;box-shadow:0 0 10px 3px rgba(255,220,70,.9);animation:fxki .5s ease-in-out infinite alternate-reverse}
@keyframes fxki{from{transform:scale(.94,.9);opacity:.75}to{transform:scale(1.08,1.16) translateY(-2px);opacity:1}}
.fx-glitch>img{animation:fxgl 2.4s steps(1) infinite}
.fx-glitch>.fxa,.fx-glitch>.fxb{inset:0;border-radius:50%;z-index:3;opacity:0}
.fx-glitch>.fxa{background:linear-gradient(0deg,transparent 40%,rgba(255,0,100,.55) 40% 48%,transparent 48%);mix-blend-mode:screen;animation:fxgl2 2.4s steps(1) infinite}
.fx-glitch>.fxb{background:linear-gradient(0deg,transparent 62%,rgba(0,255,230,.55) 62% 70%,transparent 70%);mix-blend-mode:screen;animation:fxgl2 2.4s steps(1) infinite .12s}
@keyframes fxgl{0%,60%,70%,100%{transform:none;filter:none}62%{transform:translate(-2px,0);filter:drop-shadow(2px 0 0 rgba(255,0,90,.85)) drop-shadow(-2px 0 0 rgba(0,255,230,.85))}66%{transform:translate(2px,1px);filter:drop-shadow(-2px 0 0 rgba(255,0,90,.85)) drop-shadow(2px 0 0 rgba(0,255,230,.85))}}
@keyframes fxgl2{0%,60%,70%,100%{opacity:0}62%,66%{opacity:1}}
.fx-meteor>.fxa,.fx-meteor>.fxb{left:8%;top:-4%;width:2px;height:10px;z-index:3;border-radius:2px;background:linear-gradient(180deg,rgba(255,255,255,0),#fff);box-shadow:0 0 5px #bfe9ff;transform:rotate(-40deg);opacity:0;animation:fxmt 2.2s ease-in infinite}
.fx-meteor>.fxb{height:8px;left:40%;top:-6%;animation-name:fxmt2;animation-delay:-1.1s}
@keyframes fxmt{0%{transform:translate(0,0) rotate(-40deg);opacity:0}10%{opacity:1}60%{opacity:1}100%{transform:translate(34px,34px) rotate(-40deg);opacity:0}}
@keyframes fxmt2{0%{transform:translate(0,0) rotate(-40deg);opacity:0}10%{opacity:1}60%{opacity:1}100%{transform:translate(26px,30px) rotate(-40deg);opacity:0}}
#cosdlg .tabs{display:flex;gap:6px;flex-wrap:nowrap;margin:4px 0 12px}
#cosdlg .tabs button{flex:1 1 0;min-width:0;padding:6px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cosdlg .tabs button.on{background:linear-gradient(180deg,#46d6ff,#1b9fd6);color:#021c2a;font-weight:700}
#cosdlg .grid{display:flex;gap:10px;flex-wrap:wrap}
#cosdlg .tile{width:92px;padding:10px 4px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;border-radius:10px;position:relative}
#cosdlg .tile.sel{box-shadow:inset 0 0 0 2px var(--accent)}
/* 外觀視窗裡一次有幾十個頭像特效在跑會很卡: 只有滑鼠移到的 / 目前選的那一格才動,其他停住 (頭像動畫可以只暫停,不影響外觀) */
#cosdlg .tile .avw::before,#cosdlg .tile .avw::after,#cosdlg .tile .avw>i{animation-play-state:paused}
#cosdlg .tile:hover .avw::before,#cosdlg .tile:hover .avw::after,#cosdlg .tile:hover .avw>i,#cosdlg .tile.sel .avw::before,#cosdlg .tile.sel .avw::after,#cosdlg .tile.sel .avw>i,#cosdlg .tile.pvd .avw::before,#cosdlg .tile.pvd .avw::after,#cosdlg .tile.pvd .avw>i{animation-play-state:running}
#cosdlg .tile.sel::after{content:"✓";position:absolute;top:4px;right:6px;font-size:12px;font-weight:800;color:var(--accent)}
#cosdlg .tile.pvd{box-shadow:inset 0 0 0 2px var(--gold)}
#cosdlg .pv{margin:0 0 12px}
#cosdlg .pvseat{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;background:rgba(18,40,72,.9);box-shadow:inset 0 0 0 1px #24557d}
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
    [["themes", "主題"], ["frames", "頭像框"], ["fx", "特效"], ["boxes", "玩家框"]].forEach(([k, lab]) => (CAT[k] || []).forEach(x => { if (x.req.t === "ach" && x.req.v === id) out.push(lab + "「" + x.n + "」"); }));
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
  /* ---------- 玩家框 (牌桌上座位方塊的外觀,所有人都看得到): id 對應伺服器 cosmetics.BOXES ---------- */
  // c: 方塊底色 (上 / 下), bd: 邊線, gl: 光暈色, fl: 疊在底色上的花紋 (可省略)
  const pxc = (col, sz) => `linear-gradient(45deg,${col} 25%,transparent 25% 75%,${col} 75%) 0 0/${sz}px ${sz}px`;   // 像素格紋
  const strp = (col, sz) => `linear-gradient(135deg,${col} 25%,transparent 25% 50%,${col} 50% 75%,transparent 75%) 0 0/${sz}px ${sz}px`;   // 斜紋 (無縫)
  const dots = (col, sz) => `radial-gradient(${col} 1px,transparent 1.5px) 0 0/${sz}px ${sz}px`;
  const BOX = {
    classic: null,
    px_grass:   { px: 1, c: ["#2e8b3a", "#1f6a2c"], bd: "#8b5a2b", gl: "#8b5a2b", fl: pxc("rgba(0,0,0,.14)", 16) },
    px_dungeon: { px: 1, c: ["#5b5f6b", "#43464f"], bd: "#c2c3c7", gl: "#c2c3c7", fl: `linear-gradient(rgba(0,0,0,.28) 2px,transparent 2px) 0 0/32px 16px,linear-gradient(90deg,rgba(0,0,0,.28) 2px,transparent 2px) 0 0/32px 16px` },
    px_coin:    { px: 1, c: ["#e8b923", "#b8860b"], bd: "#fff1b0", gl: "#fff1b0", fl: pxc("rgba(255,255,255,.16)", 12) },
    px_lava:    { px: 1, c: ["#d9381e", "#7a1408"], bd: "#ffa300", gl: "#ffa300", fl: pxc("rgba(255,163,0,.22)", 16) },
    px_night:   { px: 1, c: ["#0a0e1f", "#000000"], bd: "#ffec27", gl: "#ffec27", fl: `linear-gradient(45deg,#ffec27 10%,transparent 10% 90%,#ffec27 90%) 0 0/36px 36px,linear-gradient(-45deg,rgba(255,255,255,.5) 8%,transparent 8% 92%,rgba(255,255,255,.5) 92%) 18px 18px/36px 36px` },
    felt:    { c: ["#1f6b52", "#0b2f25"], bd: "#c89b5e", gl: "#c89b5e", fl: dots("rgba(255,255,255,.1)", 10), mv: [1, 0.5] },
    wine:    { c: ["#6a1b2c", "#2a0a12"], bd: "#e5b26b", gl: "#e5b26b", fl: strp("rgba(229,178,107,.08)", 36), mv: [1, 0] },
    charcoal:{ c: ["#3a3f47", "#14171b"], bd: "#aeb8c6", gl: "#aeb8c6", fl: `linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px) 0 0/14px 14px,linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px) 0 0/14px 14px`, mv: [1, 1] },
    jade:    { c: ["#177a5a", "#073328"], bd: "#46e0a0", gl: "#46e0a0", fl: strp("rgba(70,224,160,.1)", 44) + ",linear-gradient(180deg,rgba(70,224,160,.14),transparent 40%)", mv: [1, 0] },
    ink:     { c: ["#5a5850", "#26241f"], bd: "#d9d3c0", gl: "#d9d3c0", fl: `repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 2px,transparent 2px 9px) 0 0/60px 9px`, mv: [0, -1] },
    tatami:  { c: ["#7d6d3f", "#2e2714"], bd: "#86b36f", gl: "#86b36f", fl: `linear-gradient(rgba(63,107,58,.25) 1px,transparent 1px) 0 0/22px 22px,linear-gradient(90deg,rgba(63,107,58,.25) 1px,transparent 1px) 0 0/22px 22px`, mv: [1, 1] },
    gold:    { c: ["#6b5314", "#241b05"], bd: "#f0c95c", gl: "#f0c95c", fl: dots("rgba(255,226,140,.55)", 16) + "," + dots("rgba(255,240,190,.4)", 11) + ",linear-gradient(180deg,rgba(240,201,92,.18),transparent 45%)", mv: [0, -1] },
    sakura:  { c: ["#8f3a62", "#33142a"], bd: "#ff8fc0", gl: "#ff8fc0", fl: dots("rgba(255,143,192,.4)", 18), mv: [-1, 1] },
    thunder: { c: ["#2c2a6e", "#0c0b26"], bd: "#ffe14d", gl: "#ffe14d", fl: `linear-gradient(135deg,rgba(255,225,77,.3) 25%,transparent 25%) -12px 0/24px 24px,linear-gradient(225deg,rgba(255,225,77,.3) 25%,transparent 25%) -12px 0/24px 24px`, mv: [-1, 0] },
    ice:     { c: ["#2f6a8f", "#12304a"], bd: "#dff4ff", gl: "#bfe9ff", fl: dots("rgba(255,255,255,.45)", 16), mv: [0, 1] },
    lava:    { c: ["#7a2410", "#2a0c04"], bd: "#ff7a45", gl: "#ff5a2a", fl: dots("rgba(255,170,70,.75)", 26) + "," + dots("rgba(255,120,40,.6)", 17) + ",linear-gradient(0deg,rgba(255,90,42,.28),transparent 55%)", mv: [0, -1] },
    royal:   { c: ["#4a2c86", "#170d33"], bd: "#f0c95c", gl: "#b58cff", fl: strp("rgba(240,201,92,.1)", 56) + ",linear-gradient(135deg,rgba(240,201,92,.12),transparent 50%)", mv: [1, 0] },
    sunset:  { c: ["#a04a2a", "#321638"], bd: "#ffb36b", gl: "#ff8f5a", fl: `repeating-linear-gradient(0deg,rgba(255,179,107,.15) 0 6px,transparent 6px 22px) 0 0/40px 22px,linear-gradient(180deg,rgba(255,179,107,.2),transparent 55%)`, mv: [0, 1] },
    crystal: { c: ["#1f7694", "#0b3040"], bd: "#9ff0ff", gl: "#5fe0ff", fl: `linear-gradient(45deg,rgba(159,240,255,.12) 25%,transparent 25% 75%,rgba(159,240,255,.12) 75%) 0 0/20px 20px`, mv: [1, 1] },
    galaxy:  { c: ["#3a2a8a", "#0a0828"], bd: "#c3b8ff", gl: "#9b8cff", fl: dots("rgba(255,255,255,.6)", 23) + "," + dots("rgba(195,184,255,.45)", 13), mv: [1, 0] },
    bamboo:  { c: ["#3f7a45", "#112a17"], bd: "#a6d38c", gl: "#7fc77a", fl: `repeating-linear-gradient(90deg,rgba(166,211,140,.14) 0 4px,transparent 4px 22px) 0 0/22px 40px`, mv: [1, 0] },
    scroll:  { c: ["#8d7140", "#33270f"], bd: "#5b3a22", gl: "#8d6a3a", fl: `linear-gradient(90deg,rgba(91,58,34,.14) 1px,transparent 1px) 0 0/18px 18px,linear-gradient(rgba(91,58,34,.14) 1px,transparent 1px) 0 0/18px 18px,linear-gradient(180deg,rgba(255,240,200,.18),transparent 50%)`, mv: [1, 0] },
    zen:     { c: ["#7a705a", "#2a251a"], bd: "#7a6f55", gl: "#9a9078", fl: `repeating-radial-gradient(circle at 50% 50%,rgba(255,255,255,.1) 0 2px,transparent 2px 16px) 0 0/64px 64px`, mv: [1, 1] },
    neon:    { c: ["#1a0a3a", "#06020f"], bd: "#ff3df0", gl: "#3dfff0", fl: `linear-gradient(rgba(61,255,240,.14) 1px,transparent 1px) 0 0/16px 16px,linear-gradient(90deg,rgba(255,61,240,.14) 1px,transparent 1px) 0 0/16px 16px`, mv: [0, 1] },
  };
  let boxStyle = null;
  function applyBox(el, id) {   // 給牌桌上的座位方塊 (.pl) 套上玩家框
    const sp = BOX[id]; if (!el) return;
    if (!boxStyle) {
      boxStyle = document.createElement("style");
      boxStyle.textContent = `.pl[data-bx],.pvseat[data-bx]{background-image:var(--bx-img)!important;background-size:var(--bx-sz)!important;background-repeat:repeat!important;background-position:var(--bx-p0)}   /* 位置不能加 !important,否則會蓋掉動畫 */
.pl[data-bx]:not(.cur):not(.target):not(.win),.pvseat[data-bx]{box-shadow:var(--bx-sh)!important}
.pl[data-bx][data-bxpx],.pvseat[data-bx][data-bxpx]{border-radius:0!important}
/* 玩家框會動: 底色漸層角度緩緩擺動,有格紋 / 圓點圖樣的再加上圖樣慢慢飄移 (像素款是一格一格跳) */
@keyframes bxmove{from{background-position:var(--bx-p0)}to{background-position:var(--bx-p1)}}
.pl[data-bxm],.pvseat[data-bxm]{animation:bxmove var(--bx-dur,12s) linear infinite!important}
@media (prefers-reduced-motion:reduce){.pl[data-bx],.pvseat[data-bx]{animation:none!important}}`;
      document.head.appendChild(boxStyle);
    }
    if (!sp) { el.removeAttribute("data-bx"); delete el.dataset.bxpx; delete el.dataset.bxm; return; }
    el.dataset.bx = id;
    if (sp.px) el.dataset.bxpx = "1"; else delete el.dataset.bxpx;
    const st = el.style;
    const L = []; { let d = 0, cur = "", f = (sp.fl || ""); for (const ch of f) { if (ch === "(") d++; if (ch === ")") d--; if (ch === "," && !d) { L.push(cur); cur = ""; } else cur += ch; } if (cur.trim()) L.push(cur); }
    const imgs = [], szs = [], p0 = [], p1 = [], mv = sp.mv || [1, 1]; let moves = false;   // 每一層拆成 圖 / 位置 / 大小,花紋依各自大小朝 mv 方向飄移一格,才能無縫循環
    for (const l of L) {
      let d = 0, e = -1; for (let i = 0; i < l.length; i++) { if (l[i] === "(") d++; if (l[i] === ")" && --d === 0) { e = i + 1; break; } }
      const rest = l.slice(e).trim(), sl = rest.indexOf("/"), pos = (sl < 0 ? rest : rest.slice(0, sl)).replace("no-repeat", "").trim() || "0 0", size = sl < 0 ? "auto" : rest.slice(sl + 1).replace("no-repeat", "").trim();
      imgs.push(l.slice(0, e)); szs.push(size); p0.push(pos);
      const m = /^(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?$/.exec(pos), z = /^(\d+)px\s+(\d+)px$/.exec(size);
      if (m && z) { p1.push((+m[1] + mv[0] * z[1]) + "px " + (+m[2] + mv[1] * z[2]) + "px"); moves = true; } else p1.push(pos);
    }
    imgs.push(`linear-gradient(160deg,${sp.c[0]}f2,${sp.c[1]}f5)`); szs.push("auto"); p0.push("0 0"); p1.push("0 0");
    st.setProperty("--bx-img", imgs.join(",")); st.setProperty("--bx-sz", szs.join(",")); st.setProperty("--bx-p0", p0.join(",")); st.setProperty("--bx-p1", p1.join(","));
    if (moves) { st.setProperty("--bx-dur", (sp.px ? 6 : 12) + "s"); el.dataset.bxm = "1"; } else delete el.dataset.bxm;
    st.setProperty("--bx-sh", sp.px ? `inset 0 0 0 3px ${sp.bd},0 0 0 3px #000,5px 5px 0 3px rgba(0,0,0,.5)` : `inset 0 0 0 1px ${sp.bd},inset 0 0 22px ${sp.gl}33,0 0 14px ${sp.gl}40`);
  }
  window.SGS_BOX = { apply: applyBox, spec: BOX };
  function pickBox(id) {
    if (CAT && typeof api === "function" && prof()) api("/api/cosmetic", { box: id }).then(r => { if (r && r.sel && prof()) S.prof.sel = r.sel; }).catch(() => {});
  }

  function openDlg(tab) {
    const M = document.getElementById("modal"); if (!M) return;
    const mode = tab === "ach" ? "ach" : "look";
    tab = tab === "ach" ? "ach" : (tab === "frame" || tab === "fx" || tab === "box") ? tab : "theme";
    let pv = null;   // 預覽: 點到還沒解鎖的項目時,只預覽、不套用
    const render = () => {
      M.textContent = ""; if (typeof S !== "undefined") S.modalOpen = "theme";
      const close = () => { M.textContent = ""; if (typeof S !== "undefined") S.modalOpen = null; };
      const p = prof() || {}, sel = p.sel || {}, mine = p.avatar || null;
      const achMode = mode === "ach";   // 成就和外觀是兩個分開的視窗
      const preview = () => {
        const g = k => (pv && pv[k] != null ? pv[k] : sel[k === "box" ? "box" : k]) || "";
        const seat = h("div", { class: "pvseat" }, avEl(mine, { fr: g("frame"), fx: g("fx") }, { style: { width: "54px", height: "54px", borderRadius: "50%", objectFit: "cover" } }),
          h("div", {}, h("div", { style: { fontWeight: 700 }, text: "預覽" }), h("div", { class: "meta", text: "頭像框、特效、玩家框的樣子" })));
        if (window.SGS_BOX) SGS_BOX.apply(seat, g("box"));
        return h("div", { class: "pv" }, seat, pv && pv.need ? h("div", { class: "meta", style: { color: "var(--gold)", marginTop: "6px" }, text: "🔒 還沒解鎖:需要 " + pv.need }) : null);
      };
      const lockProg = x => { const pg = x.req && x.req.t === "ach" ? (p.ach_prog || {})[x.req.v] : null; return pg ? progBar(pg) : null; };
      const ordered = L => [...L].sort((a, b) => (has(kindOf(L), b.id) ? 1 : 0) - (has(kindOf(L), a.id) ? 1 : 0));
      const kindOf = L => (L === CAT.boxes ? "boxes" : L === CAT.fx ? "fx" : "frames");
      const tabs = achMode ? [] : [["theme", "🎨 主題"], ["box", "🪟 玩家框"], ["frame", "🖼 頭像框"], ["fx", "✨ 頭像特效"]];
      let body;
      if (!CAT) body = h("div", { class: "meta", text: "載入中…" });
      else if (tab === "theme") {
        const sw = CAT.themes.map(x => {
          const ok = has("themes", x.id);
          const isSel = x.a ? !!(cur && cur.a && cur.a.toLowerCase() === x.a.toLowerCase()) : !(cur && cur.a && cur.a.toLowerCase() !== GF_A);   // 目前套用的主題 (預設 = 古風三國)
          return h("button", {
            class: "tile" + (ok ? "" : " lock") + (isSel ? " sel" : ""), title: ok ? x.n : x.req_text,
            onclick: () => { if (!ok) return; if (!x.a) { save(null); } else { save({ a: x.a, b: x.b }); } render(); },
          }, h("span", { "data-nm": "1", style: { width: "58px", height: "40px", borderRadius: "9px", background: `linear-gradient(135deg,${x.b || GF_B} 50%,${x.a || GF_A} 50%)`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" } }),
          h("span", { class: "tn", text: (ok ? "" : "🔒 ") + x.n }), ok ? null : h("span", { class: "rq", text: "需要 " + x.req_text }));
        });
        body = h("div", {}, h("div", { class: "grid" }, ...sw),
          h("div", { style: { display: "flex", justifyContent: "flex-end" } }, h("button", { text: "恢復預設", onclick: () => { save(null); render(); } })));
      } else if (tab === "box") {
        const curb = sel.box || "";
        const sw = ordered(CAT.boxes || []).map(x => {
          const ok = has("boxes", x.id), sp = BOX[x.id], on = (curb || "classic") === x.id;
          const bg = sp ? `${sp.fl ? sp.fl + "," : ""}linear-gradient(160deg,${sp.c[0]},${sp.c[1]})` : "linear-gradient(160deg,#12284a,#08122a)";
          return h("button", {
            class: "tile" + (ok ? "" : " lock") + (on ? " sel" : "") + (pv && pv.box === x.id ? " pvd" : ""), title: ok ? x.n : "需要 " + x.req_text, "aria-pressed": on ? "true" : "false",
            onclick: async () => { if (!ok) { pv = { box: x.id, need: x.req_text }; render(); return; } pv = null; const id = x.id === "classic" ? "" : x.id; sel.box = id; pickBox(id); render(); },
          }, h("span", { style: { width: "64px", height: "40px", borderRadius: "6px", background: bg, boxShadow: `inset 0 0 0 1px ${sp ? sp.bd : "#24557d"},0 0 8px ${sp ? sp.gl + "55" : "rgba(63,210,255,.25)"}` } }),
          h("span", { class: "tn", text: (ok ? "" : "🔒 ") + x.n }), ok ? null : h("span", { class: "rq", text: "需要 " + x.req_text }), ok ? null : lockProg(x));
        });
        body = h("div", {}, h("div", { class: "meta", style: { marginBottom: "6px" }, text: `已解鎖 ${(CAT.boxes || []).filter(x => has("boxes", x.id)).length} / ${(CAT.boxes || []).length}` }), h("div", { class: "grid" }, ...sw), h("div", { class: "meta", style: { marginTop: "10px" }, text: "玩家框是牌桌上你的座位方塊外觀,所有玩家都看得到。有些要成就解鎖。" }));
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
        body = h("div", {}, h("div", { class: "meta", style: { marginBottom: "6px" }, text: `已解鎖 ${L.filter(x => has(kind, x.id)).length} / ${L.length}` }), h("div", { class: "grid" }, ...ordered(L).map(x => {
          const ok = has(kind, x.id), st = isFx ? { fr: sel.frame, fx: x.id } : { fr: x.id, fx: sel.fx };
          return h("button", {
            class: "tile" + (ok ? "" : " lock") + (curv === x.id ? " sel" : "") + (pv && (isFx ? pv.fx : pv.frame) === x.id ? " pvd" : ""), title: ok ? x.n : "需要 " + x.req_text, "aria-pressed": curv === x.id ? "true" : "false",
            onclick: async () => { if (!ok) { pv = isFx ? { fx: x.id, need: x.req_text } : { frame: x.id, need: x.req_text }; render(); return; } pv = null; await post(isFx ? { fx: x.id } : { frame: x.id }); render(); },
          }, h("span", { style: { padding: "6px" } }, avEl(mine, st, { style: { width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover" } })),
          h("span", { class: "tn", text: (ok ? "" : "🔒 ") + x.n }), ok ? null : h("span", { class: "rq", text: "需要 " + x.req_text }), ok ? null : lockProg(x));
        })), h("div", { class: "meta", style: { marginTop: "10px" }, text: "頭像框和特效會顯示在座位、聊天室、排行榜上,所有玩家都看得到。" }));
      }
      M.append(h("div", { class: "modal", onclick: e => { if (e.target.classList.contains("modal")) close(); } },
        h("div", { class: "dlg", id: "cosdlg", style: { maxWidth: "520px" } },
          h("div", { class: "dh" }, h("div", {}, h("h3", { text: achMode ? "🏅 成就" : "🎨 外觀" }), h("div", { class: "meta", text: achMode ? "完成成就可以解鎖主題、頭像框與特效" : "主題 / 頭像框 / 特效,有些要段位或成就解鎖" })), h("button", { class: "x", text: "✕", onclick: close })),
          h("div", { style: { padding: "6px 22px 18px", maxHeight: "70vh", overflowY: "auto" } },
            achMode || tab === "theme" ? null : preview(),
            achMode ? null : h("div", { class: "tabs" }, ...tabs.map(([k, n]) => h("button", { class: k === tab ? "on" : "", text: n, onclick: () => { tab = k; pv = null; render(); } }))),
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

/* ---------- 介面可用性補強 (依 ui-ux-pro-max 檢查): 鍵盤焦點 / 減少動態 / 觸控目標 / 視窗關閉 / 螢幕閱讀器標籤 ---------- */
(function () {
  const st = document.createElement("style");
  st.textContent = `
/* 鍵盤焦點: 只在用鍵盤操作時顯示,不影響滑鼠點擊 */
button:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--accent,#3fd2ff);outline-offset:2px}
/* 按下回饋 (只用 transform,不改版面) + 去掉觸控 300ms 延遲 */
button,select,.tile{touch-action:manipulation}
button:not(:disabled):active{transform:scale(.97)}
button:disabled{cursor:not-allowed}
/* 觸控螢幕 (iPad 等): 視窗裡的按鈕 / 輸入框至少 40px 高,避免點錯 */
@media (pointer:coarse){.dlg button,.dlg select,.dlg input:not([type=checkbox]):not([type=radio]),#members .mr button{min-height:40px}}
/* 系統設定了「減少動態效果」: 關掉無限循環動畫和過場 */
@media (prefers-reduced-motion:reduce){*:not(.avw):not(.avw>*),:not(.avw)::before,:not(.avw)::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}`;
  st.textContent += `
/* 頭像動畫只動 opacity / transform (不動 box-shadow / filter),人多時才不會卡 */
.fx-glow::after{box-shadow:0 0 12px 4px rgba(120,230,255,.9);animation:fxglow2 2.2s ease-in-out infinite}
/* 效能: 動畫中的模糊 / 陰影濾鏡每一格都要重算,全部拿掉 (用較柔的漸層就夠) */
.fx-flame::after,.fx-aurora::after,.fx-rainbow::after,.fx-shadow>.fxa,.fx-vortex>.fxa,.fx-beam>.fxa,.fx-ki>.fxa,.fx-arc>.fxa,.fx-arc>.fxb,.fx-ice>.fxa{filter:none!important}
/* 極光 / 虹彩: 拿掉模糊後不能再是實心圓盤。極光 = 外圈柔和的光暈 (綠藍紫,反向慢轉); 虹彩 = 頭像外一圈細細的彩虹環 (正轉較快) */
.fx-aurora::after{inset:-12px;background:conic-gradient(#46e0a0,#3fd2ff,#9b6bff,#ff7ad9,#46e0a0);opacity:.9;-webkit-mask:radial-gradient(closest-side,#000 50%,rgba(0,0,0,.55) 72%,transparent 100%);mask:radial-gradient(closest-side,#000 50%,rgba(0,0,0,.55) 72%,transparent 100%);animation:frspin 6s linear infinite reverse}
.fx-rainbow::after{inset:-11px;background:conic-gradient(#ff5d73,#ffd24a,#46e0a0,#3fd2ff,#9b6bff,#ff5d73);opacity:1;-webkit-mask:radial-gradient(closest-side,#000 55%,rgba(0,0,0,.55) 76%,transparent 100%);mask:radial-gradient(closest-side,#000 55%,rgba(0,0,0,.55) 76%,transparent 100%);animation:frspin 2.2s linear infinite}
.fx-vortex>.fxa{inset:-13px;background:conic-gradient(rgba(10,0,30,.95),rgba(170,70,255,.9),rgba(10,0,30,.95) 25%,rgba(170,70,255,.9) 50%,rgba(10,0,30,.95) 75%,rgba(170,70,255,.9));-webkit-mask:radial-gradient(closest-side,#000 48%,rgba(0,0,0,.55) 70%,transparent 100%);mask:radial-gradient(closest-side,#000 48%,rgba(0,0,0,.55) 70%,transparent 100%)}
@keyframes fxglow2{0%,100%{opacity:.35;transform:scale(.96)}50%{opacity:1;transform:scale(1.04)}}
@keyframes frember{from{opacity:.8}to{opacity:1}}
@keyframes frtw{from{opacity:.75}to{opacity:1}}
/* 清單 (聊天室 / 成員 / 好友 / 排行榜) 裡一次出現很多頭像: 動畫先停住,滑鼠移上去那一列才動 (一個畫面只讓重點在動) */
.cm .avw::before,.cm .avw::after,.mr .avw::before,.mr .avw::after,.frow .avw::before,.frow .avw::after,.lbrow .avw::before,.lbrow .avw::after{animation-play-state:paused}
.cm:hover .avw::before,.cm:hover .avw::after,.mr:hover .avw::before,.mr:hover .avw::after,.frow:hover .avw::before,.frow:hover .avw::after,.lbrow:hover .avw::before,.lbrow:hover .avw::after{animation-play-state:running}`;
  document.head.appendChild(st);

  const label = () => {
    const L = (window.SGS_I18N && SGS_I18N.lang) || "zh";
    return L === "en" ? "Close" : L === "ja" ? "閉じる" : "關閉";
  };
  function tag(root) {   // 螢幕閱讀器: 關閉鈕有名字、對話框有角色
    if (!root.querySelectorAll) return;
    const bs = root.matches && root.matches("button.x") ? [root] : [];
    root.querySelectorAll("button.x").forEach(b => bs.push(b));
    bs.forEach(b => { if (!b.getAttribute("aria-label")) b.setAttribute("aria-label", label()); });
    const ds = root.matches && root.matches(".dlg") ? [root] : [];
    root.querySelectorAll(".dlg").forEach(d => ds.push(d));
    ds.forEach(d => { if (!d.getAttribute("role")) { d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); } });
  }
  tag(document.body);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) tag(n); }))).observe(document.body, { childList: true, subtree: true });

  // Esc 關閉最上層的視窗 (有「✕」的才關,選武將 / 必須回答的提示不會被關掉)
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const t = e.target;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && t.value) return;   // 正在輸入時不要吃掉 Esc
    const mods = [...document.querySelectorAll(".modal")].filter(m => m.querySelector("button.x"));
    const top = mods[mods.length - 1];
    if (top) { top.querySelector("button.x").click(); e.preventDefault(); }
  });
})();
