# 三國殺重製版 API 筆記（機器人用）

來源：前端原始碼（`/`）與實際讀取 `/api/state`（只讀，已隱藏 token）。

## 驗證
- 前端用 `TOK`（存在 localStorage 的 `sgs_tok`）識別會話；登入後這個 TOK 綁到帳號。
- 同一帳號在另一個裝置登入，舊裝置會被踢（`auth:false`）。**機器人帳號不能同時在別處開著。**
- 所有請求帶 `tok` 和 `room`：
  - GET：`/api/state?log=..&th=..&peek=..&chat=..&tok=<TOK>&room=<房間>`
  - POST：JSON body，`{tok, room, ...}`

## 端點
| 用途 | 端點 | body / 備註 |
|---|---|---|
| 卡牌資料（公開） | `GET /api/cardcat` | 64 張牌的 desc |
| 武將資料（公開） | `GET /api/roster` | `chars`（90 位）與 `roles`（各人數身分配置） |
| 開新局 | `POST /api/new` | `{players:4, human:"0", humans:[0], chars:[], variant:0, lord:"random", mode:"normal", role_mode:"normal", base_hp:4, ranked:false, difficulty:1, diffs:[], seed:"", speed:0.35}` |
| 選武將 | `POST /api/pick` | `{name:"張角"}` |
| 開始（多人房） | `POST /api/start` | |
| 入座 / 離座 | `POST /api/claim` | `{seat:N}` 或 `{seat:null}` |
| 回答待處理項目 | `POST /api/answer` | `{id, choice:[選項編號...]}` |
| 暫停/速度 | `POST /api/control` | `{pause:bool}`、`{speed:秒}` |
| 認輸 | `POST /api/forfeit` | **段位局會扣分，機器人不要呼叫** |
| 再來一局 | `POST /api/rematch` | |
| 戰績 | `GET /api/profile?tok=` | `rp`（段位積分）、`rgames`、`rwins` 等 |

## `/api/state` 重點欄位
- 遊戲層：`ready, round, cur(目前出牌座位), over, winner, deck, discard, discard_top, ranked, paused, speed`
- 我：`viewer`（我的座位）、`players[i]`
  - `players[i]`：`idx, name, char, faction, role, hp, maxhp, alive, hand_n, hand[](只有我看得到), equip{weapon,armor,h+,h-,weapon2,armor2}, judge[], chained, flipped, marks, nick, human`
  - 牌物件：`{id, name, color, kind(trick/basic/horse/...), full(全名), text(含顏色), desc}`
- 選將階段：`pick:{seat, offers:[{name,faction,maxhp,skills[]}...]}`、`pick_left`
- **待回應項目 `pending`**（為 null 時代表不用我操作）：
  - `{id, seat, kind, prompt, options[], min, max, deadline, left}`
  - `kind`：我看過 `act`（出牌階段）、`skill`（連鎖 ⚡ 詢問、技能詢問）、`respond`（要不要出閃/殺/桃）
  - `options[i]`：`{i, label, card, group, gl, target}`
    - 出牌階段 `act`：每個選項是一張可打的牌；`min:0` 表示可以不選，**`choice: []` 就是結束出牌**。
    - `skill`：選項如 `使用 X`、`不發動`、`不發動,這類選項本回合不再詢問`。
    - `respond`：選項是可打出的牌，加一個 `不出`。
  - 回答後，狀態會立刻更新（例如裝備後馬上出現新的 `act`，手牌少一張）。
- 其他：`logs[]`（編碼過的紀錄行，例如 `\u0001DRAW|0|5`）、`events[]`、`online[]`
- **`thoughts[]`、`peek`**：會洩漏電腦 AI 的思考與（旁觀者）手牌。**機器人不使用這兩項**，避免變成作弊。

## 我實測過的
1. 讀 `/api/state`：選將階段與進行中的格式（見上）。
2. `/api/new` 開休閒局、`/api/pick` 選武將、`/api/answer` 答 `skill` / `respond` / `act`（裝備八卦陣、`choice: []` 結束出牌）都成功。
3. 還沒看過的：有目標的牌（殺、決鬥）選目標時 `options` 的 `target` 欄位長相；多選牌（需要選 2 張，如丈八蛇矛、聲東擊西）的 `min/max`。

## 機器人設計
- **執行位置**：在已登入機器人帳號的瀏覽器頁面內，用頁面自己的 `api()` 與 `TOK`，不需要把 token 或密碼交給任何外部程式。
- **迴圈**：每 300ms 讀一次 `/api/state`；`pending` 有東西就依規則回答；`over` 時印結果並（可選）`/api/rematch`。
- **每個決策都有逾時保護**（`left` 剩少於 3 秒就選保守選項）。
- **預設只跑休閒模式**。段位模式需要你明確同意。
- 決策規則見「爆發傷害報告」與先前的復盤：有殺就打低血敵人、桃先補血、內奸必救主公、避開怕火的藤甲、連鎖牌盡快用掉、等等。
