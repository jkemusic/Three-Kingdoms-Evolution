// 桌面版外殼: 啟動內建的 Python 伺服器 (sgs-server),再用視窗載入它。
const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");

let server = null, win = null, port = 8765, lan = false, quitting = false, remote = null;

function cfgPath() { return path.join(app.getPath("userData"), "desktop.json"); }
function loadCfg() { try { return JSON.parse(fs.readFileSync(cfgPath(), "utf8")); } catch (e) { return {}; } }
function saveCfg(o) { try { fs.writeFileSync(cfgPath(), JSON.stringify({ ...loadCfg(), ...o })); } catch (e) {} }

function normalizeUrl(s) {
  s = String(s || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "http://" + s;
  try { const u = new URL(s); if (!u.port && u.protocol === "http:") u.port = "8765"; return u.origin + "/"; } catch (e) { return null; }
}

function probe(url) {   // 確認對方真的是三國殺伺服器
  return new Promise(resolve => {
    const lib = url.startsWith("https") ? require("https") : require("http");
    const req = lib.get(url, { timeout: 4000 }, res => { res.resume(); resolve(res.statusCode === 200); });
    req.on("error", () => resolve(false)); req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

function openConnectDialog() {
  const d = new BrowserWindow({ parent: win, modal: true, width: 440, height: 280, resizable: false, minimizable: false, autoHideMenuBar: true, title: "連線到伺服器",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true } });
  d.setMenuBarVisibility(false);
  d.loadFile(path.join(__dirname, "connect.html"));
  const done = () => { ipcMain.removeHandler("sgs:last"); ipcMain.removeHandler("sgs:connect"); ipcMain.removeAllListeners("sgs:cancel"); };
  ipcMain.handle("sgs:last", () => loadCfg().lastServer || "");
  ipcMain.handle("sgs:connect", async (_e, raw) => {
    const url = normalizeUrl(raw);
    if (!url) return "網址格式不對";
    if (!(await probe(url))) return "連不上這個伺服器 (請確認網址、同一個網路,以及主機已開啟區網模式)";
    saveCfg({ lastServer: raw.trim() });
    remote = url; stopServer();
    await win.loadURL(url);
    Menu.setApplicationMenu(buildMenu());
    d.close();
    return "";
  });
  ipcMain.once("sgs:cancel", () => d.close());
  d.on("closed", done);
}

async function backToLocal() {
  remote = null; stopServer(); startServer();
  try { await waitReady(); await win.loadURL("http://127.0.0.1:" + port + "/"); } catch (e) {}
  Menu.setApplicationMenu(buildMenu());
}

function freePort(pref) {
  return new Promise(resolve => {
    const s = net.createServer();
    s.once("error", () => { const t = net.createServer(); t.listen(0, "127.0.0.1", () => { const p = t.address().port; t.close(() => resolve(p)); }); });
    s.listen(pref, "127.0.0.1", () => s.close(() => resolve(pref)));
  });
}

function assetsDir() {
  const d = path.join(app.getPath("userData"), "assets");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function startServer() {
  const env = { ...process.env, SGS_PORT: String(port), SGS_DATA: app.getPath("userData"), SGS_ASSETS: assetsDir(), PYTHONUTF8: "1" };
  const args = ["--no-browser"].concat(lan ? ["--lan"] : []);
  if (app.isPackaged) {
    const exe = path.join(process.resourcesPath, "server", process.platform === "win32" ? "sgs-server.exe" : "sgs-server");
    server = spawn(exe, args, { env, windowsHide: true });
  } else {   // 開發: 直接跑原始碼
    server = spawn(process.platform === "win32" ? "python" : "python3", [path.join(__dirname, "..", "server.py")].concat(args), { env, windowsHide: true });
  }
  server.stdout.on("data", () => {}); server.stderr.on("data", () => {});
  server.on("exit", code => { server = null; if (!quitting && code) dialog.showErrorBox("伺服器已停止", "內建伺服器結束了 (代碼 " + code + ")。請重新開啟程式。"); });
}

function stopServer() {
  if (server) { try { server.kill(); } catch (e) {} server = null; }
}

function waitReady(tries = 80) {
  return new Promise((resolve, reject) => {
    const tick = n => {
      const c = net.connect(port, "127.0.0.1");
      c.once("connect", () => { c.destroy(); resolve(); });
      c.once("error", () => { c.destroy(); n <= 0 ? reject(new Error("伺服器沒有啟動")) : setTimeout(() => tick(n - 1), 250); });
    };
    tick(tries);
  });
}

function buildMenu() {
  const t = [
    { label: "遊戲", submenu: [
      { label: "重新載入", accelerator: "CmdOrCtrl+R", click: () => win && win.reload() },
      { label: "全螢幕", accelerator: "F11", role: "togglefullscreen" },
      { label: "連線到朋友的伺服器…", click: openConnectDialog },
      ...(remote ? [{ label: "← 回到本機 (離開 " + remote.replace(/^https?:\/\//, "").replace(/\/$/, "") + ")", click: backToLocal }] : []),
      { label: lan ? "✔ 區網模式 (朋友可連線)" : "區網模式 (讓朋友連線)", enabled: !remote, click: async () => {
          lan = !lan; stopServer(); startServer();
          try { await waitReady(); win && win.reload(); } catch (e) {}
          if (lan) dialog.showMessageBox(win, { message: "區網模式已開啟", detail: "朋友用瀏覽器開 http://<你的區網 IP>:" + port + "/ 即可加入。\nWindows 防火牆若詢問,請允許私人網路。" });
          Menu.setApplicationMenu(buildMenu());
        } },
      { type: "separator" },
      { label: "開啟素材資料夾 (放卡牌 / 武將圖片)", click: () => shell.openPath(assetsDir()) },
      { label: "開啟玩家資料夾", click: () => shell.openPath(app.getPath("userData")) },
      { type: "separator" },
      { role: process.platform === "darwin" ? "close" : "quit", label: "結束" },
    ] },
    { label: "編輯", submenu: [{ role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "檢視", submenu: [{ role: "zoomIn" }, { role: "zoomOut" }, { role: "resetZoom" }, { role: "toggleDevTools" }] },
  ];
  return Menu.buildFromTemplate(t);
}

async function createWindow() {
  port = await freePort(8765);
  startServer();
  win = new BrowserWindow({ width: 1280, height: 860, title: "三國殺模擬器", backgroundColor: "#0e0f11", webPreferences: { contextIsolation: true } });
  Menu.setApplicationMenu(buildMenu());
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  try { await waitReady(); await win.loadURL("http://127.0.0.1:" + port + "/"); }
  catch (e) { dialog.showErrorBox("無法啟動", String(e.message || e)); app.quit(); }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(createWindow);
}
app.on("before-quit", () => { quitting = true; stopServer(); });
app.on("window-all-closed", () => app.quit());
