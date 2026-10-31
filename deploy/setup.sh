#!/usr/bin/env bash
# 在 Ubuntu 主機上安裝並常駐執行三國殺伺服器 (Oracle Cloud 免費主機適用)
# 用法: git clone https://github.com/jkemusic/Three-Kingdoms-Evolution.git && bash Three-Kingdoms-Evolution/deploy/setup.sh
set -e
PORT=8765
APP=/opt/sgs
DATA=/var/lib/sgs
REPO=https://github.com/jkemusic/Three-Kingdoms-Evolution.git

sudo apt-get update -y
sudo apt-get install -y python3 git iptables-persistent

id sgs >/dev/null 2>&1 || sudo useradd -r -m -d $APP sgs
sudo mkdir -p $DATA && sudo chown sgs:sgs $DATA
if [ -d $APP/app/.git ]; then
  sudo -u sgs git -C $APP/app pull --ff-only
else
  sudo -u sgs git clone $REPO $APP/app
fi
sudo chmod 755 $APP
sudo -u sgs python3 -m py_compile $APP/app/server.py

sudo tee /etc/systemd/system/sgs.service >/dev/null <<UNIT
[Unit]
Description=Sanguosha simulator server
After=network.target

[Service]
User=sgs
WorkingDirectory=$APP/app
Environment=SGS_DATA=$DATA SGS_ASSETS=$DATA/assets SGS_PORT=$PORT PYTHONUTF8=1
ExecStart=/usr/bin/python3 $APP/app/server.py --no-browser
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

# Oracle 的 Ubuntu 映像預設用 iptables 擋掉所有進入的連線,要放行遊戲埠
sudo iptables -C INPUT -p tcp --dport $PORT -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 5 -p tcp --dport $PORT -j ACCEPT
sudo netfilter-persistent save

sudo systemctl daemon-reload
sudo systemctl enable --now sgs
sleep 2
systemctl is-active sgs
echo "完成。本機測試: curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/"
echo "別忘了在 Oracle 後台的安全清單 (Security List) 開放 TCP $PORT。"
