#!/usr/bin/env bash
# 把玩家資料 (/var/lib/sgs) 備份推到私有 GitHub 倉庫。由 sgs-backup.timer 每 12 小時執行一次。
# 倉庫裡有玩家帳號憑證,一定要是 private。
set -e
DATA=/var/lib/sgs
REPO_DIR=/var/lib/sgs-backup
REMOTE=git@github.com:jkemusic/Three-Kingdoms-Evolution-Save.git
KEY=/opt/sgs/.ssh/backup_key
export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

if [ ! -d "$REPO_DIR/.git" ]; then
  git clone -q "$REMOTE" "$REPO_DIR" 2>/dev/null || { git init -q "$REPO_DIR"; git -C "$REPO_DIR" remote add origin "$REMOTE"; }
fi
cd "$REPO_DIR"
git config user.name "sgs-backup"
git config user.email "sgs-backup@users.noreply.github.com"
git checkout -q -B main

cp -f "$DATA"/accounts.json "$DATA"/profiles.json "$DATA"/social.json . 2>/dev/null || true
rm -rf avatars && [ -d "$DATA/avatars" ] && cp -r "$DATA/avatars" avatars || true

git add -A
if git diff --cached --quiet; then
  echo "沒有變動,略過"
  exit 0
fi
git commit -q -m "backup $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q origin main
echo "已推送 $(date -u +%FT%TZ)"
