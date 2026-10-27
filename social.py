"""好友系統: 好友 / 好友請求 / 私訊 / 房間邀請。以帳號的使用者名稱 (小寫) 為鍵,存在 social.json。
不使用 UID (UID 是登入憑證,不能給別人)。"""
import json
import os
import re
import threading
import time

ONLINE_WITHIN = 15        # 秒: 最近這麼久有輪詢過就算在線
INVITE_TTL = 30 * 60      # 邀請有效時間
MAX_FRIENDS = 100
DM_KEEP = 200             # 每組對話最多保留幾則


class Social:
    def __init__(self, path, accounts):
        self.path = path
        self.acc = accounts           # Accounts: d (key -> {user, uuid}), uuids (uuid -> key)
        self.lock = threading.Lock()
        try:
            self.d = json.load(open(path, encoding="utf-8"))
        except (OSError, ValueError):
            self.d = {}
        self.d.setdefault("u", {})
        self.d.setdefault("dm", {})
        self.invites = {}             # 被邀請者 key -> [{id, frm, room, rname, t}]
        self.rate = {}                # (key, 動作) -> [時間]
        self.inv_id = 0
        self.card = lambda key: {}    # 函式: 帳號 key -> 頭貼 / 段位 / 等級 (由 server 設定)
        self.uid_key = None           # 函式: 8 位數字 UID -> 帳號 key (由 server 設定)

    # ---------- 基本 ----------
    def _save(self):
        try:
            tmp = self.path + ".tmp"
            json.dump(self.d, open(tmp, "w", encoding="utf-8"), ensure_ascii=False)
            os.replace(tmp, self.path)
        except OSError:
            pass

    def key_of(self, tok):
        return self.acc.uuids.get(tok)

    def _u(self, key):
        return self.d["u"].setdefault(key, {"fr": [], "in": [], "out": [], "seen": 0, "read": {}})

    def _name(self, key):
        a = self.acc.d.get(key)
        return a["user"] if a else key

    def _limit(self, key, act, n, per):
        now = time.time()
        L = [t for t in self.rate.get((key, act), []) if now - t < per]
        if len(L) >= n:
            self.rate[(key, act)] = L
            return True
        L.append(now)
        self.rate[(key, act)] = L
        return False

    @staticmethod
    def _pair(a, b):
        return "|".join(sorted((a, b)))

    def touch(self, key):
        with self.lock:
            u = self._u(key)
            now = time.time()
            if now - u.get("seen", 0) > 20:   # 不用每次輪詢都存檔
                u["seen"] = now
                self._save()
            else:
                u["seen"] = now

    # ---------- 好友 ----------
    def add(self, key, name):
        """name: 對方的 8 位數字 UID (也接受使用者名稱)。"""
        name = (name or "").strip()
        if name.isdigit() and len(name) == 8 and self.uid_key:
            name = self.uid_key(name) or ""
        else:
            name = name.lower()
        if not name or name not in self.acc.d:
            return {"ok": False, "error": "找不到這個 UID"}
        if name == key:
            return {"ok": False, "error": "不能加自己為好友"}
        with self.lock:
            me, other = self._u(key), self._u(name)
            if name in me["fr"]:
                return {"ok": False, "error": "已經是好友了"}
            if self._limit(key, "add", 20, 3600):
                return {"ok": False, "error": "送出太多好友請求了,請稍後再試"}
            if len(me["fr"]) >= MAX_FRIENDS or len(other["fr"]) >= MAX_FRIENDS:
                return {"ok": False, "error": "好友數量已達上限"}
            if name in me["in"]:   # 對方也剛好想加我: 直接成為好友
                return self._become(key, name)
            if key not in other["in"]:
                if len(other["in"]) >= 50:
                    return {"ok": False, "error": "對方的好友請求太多了"}
                other["in"].append(key)
            if name not in me["out"]:
                me["out"].append(name)
            self._save()
        return {"ok": True, "msg": "已送出好友請求"}

    def _become(self, a, b):   # 呼叫時已持有鎖
        for x, y in ((a, b), (b, a)):
            ux = self._u(x)
            if y not in ux["fr"]:
                ux["fr"].append(y)
            for k in ("in", "out"):
                if y in ux[k]:
                    ux[k].remove(y)
        self._save()
        return {"ok": True, "msg": "你們成為好友了"}

    def accept(self, key, name):
        name = (name or "").strip().lower()
        with self.lock:
            me = self._u(key)
            if name not in me["in"]:
                return {"ok": False, "error": "沒有這個好友請求"}
            if len(me["fr"]) >= MAX_FRIENDS:
                return {"ok": False, "error": "好友數量已達上限"}
            return self._become(key, name)

    def decline(self, key, name):
        name = (name or "").strip().lower()
        with self.lock:
            me, other = self._u(key), self._u(name)
            if name in me["in"]:
                me["in"].remove(name)
            if key in other["out"]:
                other["out"].remove(key)
            self._save()
        return {"ok": True}

    def cancel(self, key, name):   # 收回自己送出的好友請求
        name = (name or "").strip().lower()
        with self.lock:
            me, other = self._u(key), self._u(name)
            if name in me["out"]:
                me["out"].remove(name)
            if key in other["in"]:
                other["in"].remove(key)
            self._save()
        return {"ok": True}

    def remove(self, key, name):
        name = (name or "").strip().lower()
        with self.lock:
            for a, b in ((key, name), (name, key)):
                u = self._u(a)
                for k in ("fr", "in", "out"):
                    if b in u[k]:
                        u[k].remove(b)
            for a, b in ((key, name), (name, key)):
                self._u(a).get("rk", {}).pop(b, None)
            self.d["dm"].pop(self._pair(key, name), None)
            if key in self.invites:
                self.invites[key] = [i for i in self.invites[key] if i["frm"] != name]
            self._save()
        return {"ok": True}

    def set_remark(self, key, name, remark):
        """自訂好友暱稱 (只有自己看得到);留空就恢復原名。"""
        name = (name or "").strip().lower()
        remark = re.sub(r"[\s<>&\"']+", " ", str(remark or "")).strip()[:12]
        with self.lock:
            me = self._u(key)
            if name not in me["fr"]:
                return {"ok": False, "error": "不是好友"}
            rk = me.setdefault("rk", {})
            if remark:
                rk[name] = remark
            else:
                rk.pop(name, None)
            self._save()
        return {"ok": True, "remark": remark}

    def is_online(self, key):
        return time.time() - self._u(key).get("seen", 0) < ONLINE_WITHIN

    def mutual(self, a, b):
        """a 和 b 的共同好友 (帳號 key 列表)。"""
        with self.lock:
            if not a or not b or a == b:
                return []
            mine = set(self._u(a)["fr"])
            return [x for x in self._u(b)["fr"] if x in mine and x not in (a, b)]

    def is_friend(self, a, b):
        return b in self._u(a)["fr"]

    # ---------- 私訊 ----------
    def send(self, key, to, text):
        to = (to or "").strip().lower()
        text = re.sub(r"\s+", " ", str(text or "")).strip()[:200]
        if not text:
            return {"ok": False, "error": "訊息是空的"}
        with self.lock:
            if not self.is_friend(key, to):
                return {"ok": False, "error": "只能傳給好友"}
            if not self.is_online(to):
                return {"ok": False, "error": "對方目前離線,不能傳訊息"}
            if self._limit(key, "dm", 1, 0.5) or self._limit(key, "dm60", 40, 60):
                return {"ok": False, "error": "說話太快了"}
            L = self.d["dm"].setdefault(self._pair(key, to), [])
            L.append({"f": key, "t": int(time.time()), "x": text})
            del L[:-DM_KEEP]
            self._save()
        return {"ok": True}

    def thread(self, key, other, mark=True):
        other = (other or "").strip().lower()
        with self.lock:
            if not self.is_friend(key, other):
                return {"ok": False, "error": "不是好友"}
            L = self.d["dm"].get(self._pair(key, other), [])
            if mark:
                self._u(key)["read"][other] = int(time.time())
                self._save()
            return {"ok": True, "msgs": [{"me": m["f"] == key, "t": m["t"], "x": m["x"]} for m in L[-60:]]}

    # ---------- 邀請 ----------
    def invite(self, key, to, room, rname):
        to = (to or "").strip().lower()
        with self.lock:
            if not self.is_friend(key, to):
                return {"ok": False, "error": "只能邀請好友"}
            if not self.is_online(to):
                return {"ok": False, "error": "對方目前離線,不能邀請"}
            if self._limit(key, "inv", 10, 60):
                return {"ok": False, "error": "邀請太頻繁了"}
            now = time.time()
            L = [i for i in self.invites.get(to, []) if now - i["t"] < INVITE_TTL and not (i["frm"] == key and i["room"] == room)]
            self.inv_id += 1
            L.append({"id": self.inv_id, "frm": key, "room": room, "rname": rname, "t": now})
            self.invites[to] = L[-5:]
        return {"ok": True}

    def reply(self, key, inv_id, accept):
        with self.lock:
            L = self.invites.get(key, [])
            it = next((i for i in L if i["id"] == inv_id), None)
            self.invites[key] = [i for i in L if i["id"] != inv_id]
        if not it or time.time() - it["t"] > INVITE_TTL:
            return {"ok": False, "error": "邀請已過期"}
        return {"ok": True, "room": it["room"] if accept else None, "rname": it["rname"]}

    # ---------- 輪詢用的總覽 ----------
    def overview(self, key, where, busy):
        """where(key) -> 好友目前所在 (字串或空);busy: 我正在對戰中 (邀請先不跳出來)。"""
        now = time.time()
        with self.lock:
            me = self._u(key)
            mine = set(me["fr"])

            def extra(k):   # 共同好友
                com = [self._name(x) for x in self._u(k)["fr"] if x in mine and x != key]
                return dict(self.card(k), mutual=len(com), mutual_names=com[:8])
            fr = []
            for fi, f in enumerate(me["fr"]):   # fi = 成為好友的先後順序 (越小越早)
                uf = self._u(f)
                rd = me["read"].get(f, 0)
                unread = sum(1 for m in self.d["dm"].get(self._pair(key, f), []) if m["f"] == f and m["t"] > rd)
                on = now - uf.get("seen", 0) < ONLINE_WITHIN
                fr.append(dict(extra(f), user=self._name(f), id=f, remark=me.get("rk", {}).get(f, ""), online=on, seen=int(uf.get("seen", 0)),
                               where=where(f) if on else "", unread=unread, idx=fi))
            fr.sort(key=lambda x: (not x["online"], -x["seen"]))
            inv = [{"id": i["id"], "from": self._name(i["frm"]), "room": i["room"], "rname": i["rname"]}
                   for i in self.invites.get(key, []) if now - i["t"] < INVITE_TTL]
            return {"ok": True, "friends": fr, "req_in": [dict(extra(x), user=self._name(x), id=x) for x in me["in"]],
                    "req_out": [dict(extra(x), user=self._name(x), id=x) for x in me["out"]], "invites": inv, "busy": busy, "now": int(now)}
