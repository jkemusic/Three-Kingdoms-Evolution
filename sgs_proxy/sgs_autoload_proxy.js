// 三國殺機器人「本機代理版」自動載入器 (由 proxy.py 注入每個 HTML 頁面; 只在 127.0.0.1 / localhost 啟動)
// - 第一次: 如果這個網址的 localStorage 還沒有機器人 (sgs_loader), 從代理的 bundle.json 還原
// - 每次載入: 等登入完成 → eval localStorage 的 sgs_loader (機器人 / 各武將策略 / 面板 / 排程)
// - 每 60 秒把 sgs_* (不含登入 token sgs_tok) 備份回代理的 bundle.json
(function () {
  var KEY = "__SECRET__";
  if (!/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) return;
  if (window.__sgsProxyLoaded) return; window.__sgsProxyLoaded = true;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  async function seed() {
    if (ls("sgs_loader")) return;
    try {
      var r = await fetch("/__sgs/bundle", { headers: { "X-Sgs-Key": KEY } });
      if (!r.ok) return; var o = await r.json();
      for (var k in o) if (k !== "sgs_tok") ls(k, o[k]);
    } catch (e) {}
  }
  async function backup() {
    if (!ls("sgs_loader")) return;
    var o = {};
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("sgs_") === 0 && k !== "sgs_tok") o[k] = localStorage.getItem(k); } } catch (e) { return; }
    try { await fetch("/__sgs/save", { method: "POST", headers: { "X-Sgs-Key": KEY, "Content-Type": "text/plain" }, body: JSON.stringify(o) }); } catch (e) {}
  }
  (async function () {
    setInterval(backup, 60000);
    await seed();
    if (!ls("sgs_loader")) return;
    ls("sgs_bot_enable", "1");
    var tries = 0;
    var timer = setInterval(async function () {
      tries++; if (tries > 600) { clearInterval(timer); return; }   // 最多等 10 分鐘 (等你登入)
      try {
        if (typeof api !== "function" || typeof TOK !== "string" || !TOK) return;
        var s = await api("/api/state?log=99999999&th=99999999&peek=0&chat=0");
        if (!s || s.auth === false) return;
        clearInterval(timer);
        if (window.__sgsAutoLoaded) return; window.__sgsAutoLoaded = true;
        var loader = ls("sgs_loader"); if (!loader) return;
        (0, eval)(loader);
      } catch (e) {}
    }, 1000);
  })();
})();
