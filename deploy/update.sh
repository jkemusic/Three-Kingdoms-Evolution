#!/usr/bin/env bash
# 更新到 GitHub 上的最新版並重啟伺服器
set -e
sudo -u sgs git -C /opt/sgs/app pull --ff-only
sudo systemctl restart sgs
systemctl is-active sgs
