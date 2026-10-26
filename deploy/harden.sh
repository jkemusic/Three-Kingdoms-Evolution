#!/usr/bin/env bash
# 資安加固: HTTPS (Caddy + 免費憑證)、伺服器只聽本機、systemd 沙盒、自動安全更新、擋暴力登入 ssh
# 用法: bash /opt/sgs/app/deploy/harden.sh
set -e
PORT=8765
IP=$(curl -s https://api.ipify.org)
DOMAIN="${SGS_DOMAIN:-$IP.sslip.io}"   # 沒有自己的網域時,用 sslip.io (把 IP 變成網域名稱,可申請真的憑證)
echo "網域: $DOMAIN"

sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg unattended-upgrades fail2ban
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y caddy
fi

sudo tee /etc/caddy/Caddyfile >/dev/null <<CADDY
$DOMAIN {
    encode gzip
    request_body {
        max_size 1MB
    }
    header {
        Strict-Transport-Security "max-age=31536000"
        -Server
    }
    reverse_proxy 127.0.0.1:$PORT
}
CADDY

# 遊戲伺服器只聽本機 (不加 --lan),外面只能經由 Caddy 的 HTTPS 進來;並加上 systemd 沙盒
sudo tee /etc/systemd/system/sgs.service >/dev/null <<UNIT
[Unit]
Description=Sanguosha simulator server
After=network.target

[Service]
User=sgs
WorkingDirectory=/opt/sgs/app
Environment=SGS_DATA=/var/lib/sgs SGS_ASSETS=/var/lib/sgs/assets SGS_PORT=$PORT PYTHONUTF8=1
ExecStart=/usr/bin/python3 /opt/sgs/app/server.py --no-browser
Restart=always
RestartSec=3
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ReadWritePaths=/var/lib/sgs
ProtectKernelTunables=yes
ProtectControlGroups=yes
RestrictSUIDSGID=yes
MemoryMax=700M

[Install]
WantedBy=multi-user.target
UNIT

# 防火牆: 放行 80 / 443 (憑證申請與 HTTPS),不再對外開 8765
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 5 -p tcp --dport $p -j ACCEPT
done
while sudo iptables -D INPUT -p tcp --dport $PORT -j ACCEPT 2>/dev/null; do :; done
sudo netfilter-persistent save

# ssh: 只允許金鑰登入、不允許 root
sudo tee /etc/ssh/sshd_config.d/99-sgs.conf >/dev/null <<SSH
PasswordAuthentication no
PermitRootLogin no
SSH
sudo systemctl reload ssh || sudo systemctl reload sshd

sudo systemctl enable --now fail2ban unattended-upgrades
sudo systemctl daemon-reload
sudo systemctl restart sgs
sudo systemctl enable caddy
sudo systemctl restart caddy
sleep 3
systemctl is-active sgs caddy
echo "完成。請在 Oracle 後台安全清單開放 TCP 80 與 443 (並可移除 8765),然後開 https://$DOMAIN/"
