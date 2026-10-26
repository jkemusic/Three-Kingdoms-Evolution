# 部署到 Oracle Cloud 免費主機

## 1. 註冊
1. 到 https://www.oracle.com/cloud/free/ 註冊 (需要信用卡驗證,不會扣款,只會有小額預授權)
2. **Home Region 選離你最近的** (例如 Japan East (Tokyo)、Japan Central (Osaka)、South Korea (Seoul)),選了之後不能改,免費資源只能開在這個區域
3. **不要按「升級成 Pay As You Go」**。維持免費帳號,超過免費額度的資源只會開不起來,不會被收費

## 2. 建立主機
Compute → Instances → Create instance
- Image: **Ubuntu 22.04**
- Shape: **VM.Standard.E2.1.Micro** (標示 Always Free eligible);若有 Ampere A1 也可
- Networking: 選預設 VCN,**勾選 Assign a public IPv4 address**
- SSH keys: 產生並**下載私鑰** (遺失就進不去主機)
- 建立後記下「Public IP」

## 3. 開放連線埠 (Oracle 後台)
Networking → Virtual Cloud Networks → 你的 VCN → Subnet → Security List → Add Ingress Rules
- Source CIDR: `0.0.0.0/0`
- IP Protocol: TCP
- Destination Port Range: `8765`

## 4. 安裝
用 SSH 連進主機 (Windows 可用 PowerShell):

    ssh -i 你的私鑰檔 ubuntu@<Public IP>

在主機裡執行:

    git clone https://github.com/jkemusic/Threekingdoms.git
    bash Threekingdoms/deploy/setup.sh

完成後用瀏覽器開 `http://<Public IP>:8765/` 就能玩。
桌面版:選單「遊戲 → 連線到朋友的伺服器…」輸入 `<Public IP>:8765`。

## 5. 更新
    bash /opt/sgs/app/deploy/update.sh

## 備份
玩家資料在主機的 `/var/lib/sgs` (帳號 accounts.json、戰績 profiles.json、頭像 avatars/)。
