// 三國殺機器人控制面板「重新整理後自動還原」載入器
// 用法 (只需做一次, 網站擁有者操作): 把這個檔案放到網站根目錄 (跟 fx.js / friends.js 放一起),
// 並在 index.html 的 </body> 之前加一行:  <script src="/sgs_autoload.js"></script>
//
// 安全設計: 只有在「機器人專用的瀏覽器」才會啟動 —— 該瀏覽器的 localStorage 要有 sgs_bot_enable = "1"
// (我已經在機器人的瀏覽器設定好)。其他人 (朋友、一般玩家) 載入頁面時完全不會有任何變化。
// 機器人程式本體存在機器人瀏覽器自己的 localStorage (sgs_b1 ~ sgs_b6, 載入器 sgs_loader), 這個檔案只負責在載入後叫它們起來。
(function () {
  try { if (localStorage.getItem("sgs_bot_enable") !== "1") return; } catch (e) { return; }
  if (window.__sgsAutoLoaded) return;
  var tries = 0;
  var timer = setInterval(async function () {
    tries++;
    if (tries > 120) { clearInterval(timer); return; }                    // 最多等 2 分鐘 (等登入完成)
    try {
      if (typeof api !== "function" || typeof TOK !== "string" || !TOK) return;
      var s = await api("/api/state?log=99999999&th=99999999&peek=0&chat=0");
      if (!s || s.auth === false) return;                                  // 還沒登入
      clearInterval(timer);
      if (window.__sgsAutoLoaded) return;
      window.__sgsAutoLoaded = true;
      var loader = localStorage.getItem("sgs_loader");
      if (!loader) return;
      (0, eval)(loader);                                                    // 還原 SGSBOT / 各武將策略 / SGSPANEL / 補丁
    } catch (e) { /* 失敗就等下一次 */ }
  }, 1000);
})();
