"""三國殺重製版 GUI 伺服器 (只用標準函式庫,瀏覽器開 http://127.0.0.1:8765)。

    python server.py          # 啟動並自動開啟瀏覽器
"""
import hashlib
import json
import math
import mimetypes
import os
import random
import re
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse, parse_qs

from ai import HeuristicAgent, LeveledAgent
from characters import ROSTER
from engine import Game, ROLES
from human import HumanAgent
from thinking import Observed, Recorder
from view import ROOT, DATA, snapshot
import cosmetics

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, "web")
CACHE = os.path.join(WEB, "cache") if DATA == HERE else os.path.join(DATA, "cache")
PORT = int(os.environ.get("SGS_PORT", "8765"))
os.makedirs(DATA, exist_ok=True)


class Profiles:
    """玩家檔案: UUID (= 玩家的帳號憑證, 存在瀏覽器) -> 經驗值 / 場數 / 勝場。存在 profiles.json。"""
    PATH = os.path.join(DATA, "profiles.json")
    XP_GAME, XP_WIN = 20, 30

    def __init__(self):
        self.lock = threading.Lock()
        try:
            self.d = json.load(open(self.PATH, encoding="utf-8"))
        except (OSError, ValueError):
            self.d = {}

    # 段位: 積分 (rp) 決定。每個段位 (傳說除外) 再分 3 / 2 / 1 三小段,1 最高
    RANKS = [("青銅", 0), ("白銀", 100), ("黃金", 250), ("白金", 450), ("鑽石", 700), ("大師", 1000), ("傳說", 1400)]
    WIN_RP = {1: 10, 2: 18, 3: 25, 4: 32}   # 段位模式贏: 依電腦難度加分 (全真人 25)
    LOSS_RP = 15                            # 段位模式輸: 扣分 (最低 0 分)

    @classmethod
    def rank(cls, rp):
        """回傳 (段位, 小段 3/2/1 或 None, 本段下限, 下一段門檻 或 None)。"""
        rp = max(0, int(rp or 0))
        for i, (nm, lo) in enumerate(cls.RANKS):
            hi = cls.RANKS[i + 1][1] if i + 1 < len(cls.RANKS) else None
            if hi is None or rp < hi:
                if hi is None:
                    return nm, None, lo, None
                step = (hi - lo) / 3
                k = min(2, int((rp - lo) // step))
                return nm, 3 - k, math.ceil(lo + k * step - 1e-9), math.ceil(lo + (k + 1) * step - 1e-9) if k < 2 else hi
        return cls.RANKS[0][0], 3, 0, 33

    @classmethod
    def rank_label(cls, rp):
        nm, sub, _, _ = cls.rank(rp)
        return nm if sub is None else f"{nm}{sub}"

    @staticmethod
    def level(xp):
        return 1 + int((xp / 50) ** 0.5)   # Lv2=50 Lv3=200 Lv4=450 Lv5=800 ...

    @staticmethod
    def xp_for(lv):
        return 50 * (lv - 1) ** 2

    def get(self, tok, create=True):
        if not tok:
            return None
        with self.lock:
            p = self.d.get(tok)
            if p is None and create:
                p = self.d[tok] = {"xp": 0, "games": 0, "wins": 0, "created": int(time.time())}
                self._save()
            return p

    def uid(self, tok):
        """對外顯示的 8 位數字 ID (登入憑證 tok 仍是長的隨機值,不能外洩)。"""
        import random
        with self.lock:
            p = self.d.get(tok)
            if p is None:
                return ""
            if not p.get("uid"):
                used = {q.get("uid") for q in self.d.values()}
                while True:
                    n = str(random.randint(10000000, 99999999))
                    if n not in used:
                        break
                p["uid"] = n
                self._save()
            return p["uid"]

    DEVS = {"jke", "lonea"}   # 開發者 (帳號名稱小寫)

    def dev(self, tok):
        return ACCOUNTS.uuids.get(tok) in self.DEVS

    def info(self, tok):
        p = self.get(tok)
        if not p:
            return None
        lv = self.level(p["xp"])
        rp = p.get("rp", 0)
        nm, sub, lo, hi = self.rank(rp)
        return {"uuid": self.uid(tok), "dev": self.dev(tok), "rank": self.rank_label(rp), "next_rank": self.rank_label(hi) if hi is not None else None, "tier": nm, "rp": rp, "rp_lo": lo, "rp_next": hi,
                "rgames": p.get("rgames", 0), "rwins": p.get("rwins", 0), "rank_note": p.get("rank_note"), "level": lv, "xp": p["xp"], "xp_cur": self.xp_for(lv), "xp_next": self.xp_for(lv + 1),
                "games": p["games"], "wins": p["wins"], "avatar": self.avatar_url(tok),
                "chars": sorted(([n, v[0], v[1]] for n, v in p.get("chars", {}).items()), key=lambda x: (-x[1], -x[2]))[:3],
                "roles": {n: v for n, v in p.get("roles", {}).items()},
                **self.cos_info(tok)}

    # ---------- 成就 / 外觀 (頭像框、頭像特效、顏色主題) ----------
    def tier_idx(self, rp):
        return cosmetics.TIER_NAMES.index(self.rank(rp)[0])

    def peak_tier(self, p):
        return self.tier_idx(max(p.get("peak_rp", 0), p.get("rp", 0)))

    def _check_ach(self, p, facts=None):
        new = cosmetics.check_achievements(p, self.level(p["xp"]), self.peak_tier(p), facts or {})
        if new:
            p.setdefault("ach_new", []).extend(new)
        return new

    def cos_info(self, tok):
        p = self.get(tok)
        with self.lock:
            if self._check_ach(p):   # 舊帳號第一次看資料時,依既有戰績補發成就
                self._save()
        tier, achs = self.peak_tier(p), p.get("ach", {})
        st = self.style(tok)
        return {"cos": cosmetics.unlocked_ids(tier, achs), "sel": {"frame": st["fr"], "fx": st["fx"], "theme": p.get("theme")},
                "ach": achs, "ach_new": list(p.get("ach_new", [])), "peak_tier": tier, "ach_prog": cosmetics.progress(p, self.level(p["xp"]), max(p.get("peak_rp", 0), p.get("rp", 0)))}

    def style(self, tok):
        """目前使用的頭像框 / 特效 (沒選過: 頭像框自動用最高段位的框)。"""
        p = self.d.get(tok)
        if not p:
            return {"fr": "", "fx": ""}
        tier, achs, sel = self.peak_tier(p), p.get("ach", {}), p.get("sel", {})
        ok = lambda L, v: any(x["id"] == v and cosmetics.is_unlocked(x["req"], tier, achs) for x in L)
        fr = sel["frame"] if "frame" in sel and ok(cosmetics.FRAMES, sel["frame"]) else cosmetics.auto_frame(tier)
        fx = sel.get("fx", "") if ok(cosmetics.EFFECTS, sel.get("fx", "")) else ""
        return {"fr": fr, "fx": fx}

    def set_style(self, tok, frame, fx, theme=None):
        p = self.get(tok)
        tier, achs = self.peak_tier(p), p.get("ach", {})
        ok = lambda L, v: any(x["id"] == v and cosmetics.is_unlocked(x["req"], tier, achs) for x in L)
        with self.lock:
            sel = p.setdefault("sel", {})
            if frame is not None and ok(cosmetics.FRAMES, frame):
                sel["frame"] = frame
            if fx is not None and ok(cosmetics.EFFECTS, fx):
                sel["fx"] = fx
            if theme is not None:
                p["theme"] = theme if (theme == "" or ok(cosmetics.THEMES, theme)) else p.get("theme")
            self._save()
        return {"ok": True, **self.cos_info(tok)}

    def ack_ach(self, tok):
        p = self.get(tok)
        with self.lock:
            p["ach_new"] = []
            self._save()
        return {"ok": True}

    AVATAR_DIR = os.path.join(DATA, "avatars")

    @staticmethod
    def _pid(tok):
        return hashlib.sha1(("sgs:" + str(tok)).encode()).hexdigest()[:10]

    def avatar_url(self, tok):
        p = self.d.get(tok)
        return f"/avatar/{self._pid(tok)}.jpg?v={p['avatar']}" if p and p.get("avatar") else None

    def set_avatar(self, tok, raw):
        """raw: JPEG 位元組 (前端已縮成 128x128); None = 移除。"""
        p = self.get(tok)
        if not p:
            return {"ok": False, "error": "no profile"}
        os.makedirs(self.AVATAR_DIR, exist_ok=True)
        fn = os.path.join(self.AVATAR_DIR, self._pid(tok) + ".jpg")
        with self.lock:
            if raw is None:
                p.pop("avatar", None)
                try: os.remove(fn)
                except OSError: pass
            else:
                if len(raw) > 120_000 or raw[:3] != bytes([0xFF, 0xD8, 0xFF]):
                    return {"ok": False, "error": "圖片格式不對或太大"}
                open(fn, "wb").write(raw)
                p["avatar"] = int(time.time())
            self._save()
        return {"ok": True, "url": self.avatar_url(tok)}

    def ack_rank(self, tok, nid):
        """玩家看過升降段視窗了: 清掉通知。"""
        p = self.d.get(tok)
        with self.lock:
            if p and p.get("rank_note") and p["rank_note"].get("id") == nid:
                p.pop("rank_note")
                self._save()
        return {"ok": True}

    def lv(self, tok):
        """顯示在名字旁邊的段位標籤 (例: 黃金2)。"""
        p = self.d.get(tok)
        return self.rank_label(p.get("rp", 0)) if p else self.rank_label(0)

    WIN_XP = {1: 15, 2: 30, 3: 45, 4: 70}   # 電腦難度 弱/中/強/很強: 打贏給的經驗值

    def award(self, tok, won, char=None, role=None, win_xp=None, ranked=False, win_rp=None, facts=None):
        """回傳 (段位積分變化, 之前段位, 之後段位);休閒模式積分不變 (變化 0)。"""
        p = self.get(tok)
        if not p:
            return None
        gain = self.XP_GAME + ((win_xp if win_xp is not None else self.XP_WIN) if won else 0)
        before = self.rank_label(p.get("rp", 0))
        with self.lock:
            p["xp"] += gain; p["games"] += 1; p["wins"] += 1 if won else 0
            delta = 0
            if ranked:
                old = p.get("rp", 0)
                p["rp"] = max(0, old + ((win_rp or 25) if won else -self.LOSS_RP))
                delta = p["rp"] - old
                p["rgames"] = p.get("rgames", 0) + 1; p["rwins"] = p.get("rwins", 0) + (1 if won else 0)
            p["peak_rp"] = max(p.get("peak_rp", 0), p.get("rp", 0))
            p["streak"] = p.get("streak", 0) + 1 if won else 0
            p["best_streak"] = max(p.get("best_streak", 0), p["streak"])
            after = self.rank_label(p.get("rp", 0))
            _, _, _, nxt = self.rank(p.get("rp", 0))
            # 每場結束都留一則結果通知 (積分變化 / 升降段 / 離下一段還差多少),玩家的瀏覽器讀到就跳出視窗
            p["rank_note"] = {"from": before, "to": after, "delta": delta, "rp": p.get("rp", 0), "up": delta > 0, "changed": after != before,
                              "ranked": bool(ranked), "won": bool(won), "next": self.rank_label(nxt) if nxt is not None else None,
                              "need": (nxt - p.get("rp", 0)) if nxt is not None else 0, "id": int(time.time() * 1000)}
            if char:
                c = p.setdefault("chars", {}).setdefault(char, [0, 0]); c[0] += 1; c[1] += 1 if won else 0
            if role:
                r = p.setdefault("roles", {}).setdefault(role, [0, 0]); r[0] += 1; r[1] += 1 if won else 0
            self._check_ach(p, dict(facts or {}, won=bool(won)))
            self._save()
        return delta, before, self.rank_label(p.get("rp", 0))

    def _save(self):
        try:
            tmp = self.PATH + ".tmp"
            json.dump(self.d, open(tmp, "w", encoding="utf-8"), ensure_ascii=False)
            os.replace(tmp, self.PATH)
        except OSError:
            pass


PROFILES = Profiles()


class Accounts:
    """帳號: 使用者名稱 + 密碼 (PBKDF2 雜湊) -> uuid (玩家檔案的鍵, 同時是連線憑證)。存在 accounts.json。"""
    PATH = os.path.join(DATA, "accounts.json")
    NAME_RE = re.compile(r"^[A-Za-z0-9_一-鿿぀-ヿ]{2,10}$")

    def __init__(self):
        self.lock = threading.Lock()
        self.fails = {}   # 使用者名稱/IP -> [時間...] (防暴力破解)
        try:
            self.d = json.load(open(self.PATH, encoding="utf-8"))
        except (OSError, ValueError):
            self.d = {}
        changed = False
        for a in self.d.values():   # 舊帳號 (原本只靠 UID 登入) 一律先給預設密碼,請使用者自己改
            if "pw" not in a:
                a["pw"] = self._mk(DEFAULT_PW)
                changed = True
        if changed:
            self._save()
        self.uuids = {a["uuid"]: k for k, a in self.d.items()}
        self.sess = {a["sess"]: a["uuid"] for a in self.d.values() if a.get("sess")}   # 登入階段碼 -> 帳號 uuid (同一帳號只留最新一個)
        self.kicked = set()   # 被新登入踢掉的舊階段碼

    def new_session(self, uuid):
        import secrets
        a = self.d[self.uuids[uuid]]
        if a.get("sess"):
            self.sess.pop(a["sess"], None)
            self.kicked.add(a["sess"])
        a["sess"] = secrets.token_hex(16)
        self.sess[a["sess"]] = uuid
        self._save()
        return a["sess"]

    def resolve(self, sess):
        """瀏覽器送來的是階段碼;換成帳號 uuid (無效就回空字串,視同沒登入)。"""
        return self.sess.get(sess or "", "")

    @staticmethod
    def _hash(pw, salt):
        return hashlib.pbkdf2_hmac("sha256", pw.encode("utf-8"), bytes.fromhex(salt), 200_000).hex()

    @classmethod
    def _mk(cls, pw):
        """密碼只存加鹽的 PBKDF2 雜湊,不存明文。d = 還在用預設密碼。"""
        salt = os.urandom(16).hex()
        return {"s": salt, "h": cls._hash(pw, salt), "d": pw == DEFAULT_PW}

    @classmethod
    def _verify(cls, rec, pw):
        import hmac
        return hmac.compare_digest(cls._hash(pw or "", rec["s"]), rec["h"])

    def default_pw(self, tok):
        k = self.uuids.get(tok)
        return bool(k and self.d[k].get("pw", {}).get("d"))

    def change_pw(self, tok, old, new):
        k = self.uuids.get(tok)
        if not k:
            return {"ok": False, "error": "請先登入"}
        if self._blocked("pw:" + k):
            return {"ok": False, "error": "嘗試次數太多,請 5 分鐘後再試"}
        new = new or ""
        if not (MIN_PW <= len(new) <= MAX_PW):
            return {"ok": False, "error": f"新密碼長度要 {MIN_PW}~{MAX_PW} 個字元"}
        if new == DEFAULT_PW:
            return {"ok": False, "error": "不能使用預設密碼"}
        with self.lock:
            a = self.d[k]
            if not self._verify(a["pw"], old):
                self.fails.setdefault("pw:" + k, []).append(time.time())
                time.sleep(0.5)
                return {"ok": False, "error": "舊密碼不正確"}
            a["pw"] = self._mk(new)
            self._save()
        return {"ok": True}

    def is_account(self, tok):
        return tok in self.uuids

    def username(self, tok):
        k = self.uuids.get(tok)
        return self.d[k]["user"] if k else None

    def _blocked(self, key, limit=6):
        now = time.time()
        L = [t for t in self.fails.get(key, []) if now - t < 300]
        self.fails[key] = L
        return len(L) >= limit

    def register(self, user, pw=None, adopt_tok=None, ip=""):
        user = (user or "").strip()
        if not self.NAME_RE.match(user):
            return {"ok": False, "error": "使用者名稱 2~10 字,只能用中英文、數字、底線"}
        pw = pw or DEFAULT_PW   # 沒設密碼就用預設密碼 (之後請在個人資訊修改)
        if not (MIN_PW <= len(pw) <= MAX_PW):
            return {"ok": False, "error": f"密碼長度要 {MIN_PW}~{MAX_PW} 個字元"}
        import uuid as _uuid
        now = time.time()
        with self.lock:
            L = [t for t in self.fails.get("reg:" + ip, []) if now - t < 3600]
            if len(L) >= 5:   # 同一個 IP 一小時最多註冊 5 個,避免灌帳號
                return {"ok": False, "error": "這個網路最近註冊太多帳號了,請稍後再試"}
            if len(self.d) >= MAX_ACCOUNTS:
                return {"ok": False, "error": "帳號數量已達上限"}
            if user.lower() in self.d:
                return {"ok": False, "error": "這個名稱已被使用"}
            # 若這個瀏覽器原本有舊的訪客檔案 (尚未綁帳號),直接沿用,等級不會丟
            u = adopt_tok if (adopt_tok and adopt_tok in PROFILES.d and adopt_tok not in self.uuids) else str(_uuid.uuid4())
            L.append(now)
            self.fails["reg:" + ip] = L
            self.d[user.lower()] = {"user": user, "uuid": u, "created": int(time.time()), "pw": self._mk(pw)}
            self.uuids[u] = user.lower()
            self._save()
        PROFILES.get(u)
        return {"ok": True, "tok": self.new_session(u), "user": user, "uid": PROFILES.uid(u), "default_pw": pw == DEFAULT_PW}

    def login(self, user, pw=None, ip=""):
        """使用者名稱 + 密碼登入。失敗一律回同一句話 (不透露帳號是否存在)。"""
        raw = (user or "").strip()
        key, via_uid = raw.lower(), False
        if key not in self.d and raw.isdigit() and len(raw) == 8:   # 也可以用 8 位數字 UID 登入 (還是要密碼)
            key = next((k for k, x in list(self.d.items()) if PROFILES.uid(x["uuid"]) == raw), raw)
            via_uid = key in self.d
        if self._blocked("ip:" + ip) or self._blocked("all", 60) or self._blocked("u:" + key, 8):
            return {"ok": False, "error": "嘗試次數太多,請 5 分鐘後再試"}
        a = self.d.get(key)
        if a:
            ok = self._verify(a["pw"], pw)
        else:
            self._hash(pw or "", "00" * 16)   # 帳號不存在也算一次雜湊,避免從回應時間猜出帳號是否存在
            ok = False
        if not ok:
            now = time.time()
            for k in ("ip:" + ip, "all", "u:" + key):
                self.fails.setdefault(k, []).append(now)
            time.sleep(0.5)
            return {"ok": False, "error": "帳號 / UID 或密碼不正確"}
        return {"ok": True, "tok": self.new_session(a["uuid"]), "user": a["user"], "default_pw": bool(a["pw"].get("d")), "via_uid": via_uid}

    def _save(self):
        try:
            tmp = self.PATH + ".tmp"
            json.dump(self.d, open(tmp, "w", encoding="utf-8"), ensure_ascii=False)
            os.replace(tmp, self.PATH)
            try:
                os.chmod(self.PATH, 0o600)   # 密碼雜湊檔只有擁有者能讀
            except OSError:
                pass
        except OSError:
            pass


import social
DEFAULT_PW = "12345"
MIN_PW, MAX_PW = 4, 64
MAX_ACCOUNTS = 2000
MAX_BODY = 400_000   # 請求本文上限 (頭像 base64 約 160KB)
ACCOUNTS = Accounts()
SOCIAL = social.Social(os.path.join(DATA, "social.json"), ACCOUNTS)
SOCIAL.uid_key = lambda uid: next((k for k, a in list(ACCOUNTS.d.items()) if PROFILES.uid(a["uuid"]) == uid), None)


def leaderboard(me=""):
    """玩家排行榜: 所有有帳號的玩家 (等級、勝場、勝率)。"""
    rows = []
    for acc in list(ACCOUNTS.d.values()):
        t = acc["uuid"]
        p = PROFILES.d.get(t)
        if not p:
            continue
        rows.append({"name": acc["user"], "me": t == me, "lv": PROFILES.rank_label(p.get("rp", 0)), "rp": p.get("rp", 0), "xp": p["xp"],
                     "games": p["games"], "wins": p["wins"], "avatar": PROFILES.avatar_url(t), "style": PROFILES.style(t), "dev": PROFILES.dev(t)})
    return {"rows": rows}
OPEN_API = {"/api/rooms", "/api/cardcat", "/api/cosmetics", "/api/i18n", "/api/roster", "/api/me", "/api/login", "/api/register"}


class AbortGame(Exception):
    pass


class Manager:
    def __init__(self):
        self.lock = threading.Lock()
        self.plock = threading.RLock()
        self.room_name, self.owner, self.created = "房間", None, time.time()
        self.game = None
        self.thread = None
        self.rec = Recorder()
        self.humans = set()
        self.claims = {}
        self.seen = {}    # tok -> 最後一次連線時間 (算目前在線人數)
        self.alive = {}   # tok -> 目前是否視為在線 (斷線偵測用)
        self.events = []  # 給所有人的通知 (斷線 / 重連 / 換房主)
        self.ev_id = 0
        self.nicks = {}   # tok -> 暱稱 (朋友入座時可自己取名)
        self.host = None
        self.public = False         # 公共房間: 房主下線就清空房主,不自動讓給別人
        self.host_cleared = False
        self.lobby = False
        self.picking, self.offers, self.picks = False, {}, {}
        self.chat, self.chat_id, self.chat_t = [], 0, {}   # 聊天室
        self.cfg = {}
        self.paused = False
        self.speed = 0.35
        self.error = None
        self.pending = None
        self.multi, self.multi_res, self.multi_win = {}, {}, None   # 同時詢問多人 (瀕死: 先出桃的人救)
        self._multi_ev = threading.Event()
        self.abort = False
        self._ans = None
        self._ans_ev = threading.Event()
        self._step_ev = threading.Event()
        self._req = 0

    # ---------- 建立新對局 ----------
    def is_host(self, tok):
        """尚無對局/無房主時任何人都可以;否則只有房主。"""
        return not self.host or tok == self.host

    def rematch(self, tok):
        """依照上一局的設定再來一局 (只換種子,武將若原本是隨機就重新抽)。"""
        if not self.is_host(tok):
            return {"ok": False, "error": "只有房主可以再來一局"}
        if not getattr(self, "cfg", None):
            return {"ok": False, "error": "還沒有上一局的設定"}
        cfg = {k: v for k, v in self.cfg.items() if k not in ("n", "want", "pool", "chars_", "seed")}
        cfg["tok"], cfg["seed"], cfg["speed"] = tok, None, self.speed
        return self.new_game(cfg)

    def new_game(self, cfg):
        if not self.is_host(cfg.get("tok")):
            return {"ok": False, "error": "only host"}
        if self.game_active() and (self.cfg or {}).get("ranked"):
            return {"ok": False, "error": "ranked game in progress"}   # 段位局打完前不能開新遊戲 (要先棄賽)
        if cfg.get("ranked"):   # 段位模式: 固定規則 (正常模式 / 4 體力 / 隨機主公 / 正常身分)
            cfg = dict(cfg, players=max(4, int(cfg.get("players", 5))), mode="normal", base_hp=4, lord="random", chars=["" for _ in (cfg.get("chars") or [])], role_mode="normal")
        self.abort = True
        self._ans_ev.set()
        self._step_ev.set()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=3)
        self.abort = False
        self._ans_ev.clear()
        self._step_ev.clear()
        n = int(cfg.get("players", 5))
        human = cfg.get("human")
        human = None if human in (None, "", "spectate") else int(human)
        seed = cfg.get("seed")
        seed = random.randrange(10 ** 6) if seed in (None, "") else int(seed)
        rng = random.Random(seed)
        # 武將: ''=隨機 / 'none'=無武將 / 名稱
        want = list(cfg.get("chars") or [""] * n) + [""] * n
        want = want[:n]
        used = {w for w in want if w in ROSTER}
        pool = [x for x in ROSTER if x not in used]
        rng.shuffle(pool)   # 隨機武將: 每人抽 3 張 (彼此不重複) 再選 1 張,見 start()
        self.picking, self.offers, self.picks = False, {}, {}
        self.rec = Recorder()
        humans = {int(x) for x in (cfg.get("humans") or []) if 0 <= int(x) < n}
        if human is not None and human < n:
            humans.add(human)
        self.humans = humans
        self.claims = {}
        self.host = cfg.get("tok")
        self.host_cleared = False
        if self.host and human is not None and human < n:
            self.claims[human] = self.host
        self.cfg = dict(cfg, seed=seed, n=n, want=want, pool=pool)
        self.paused = False
        self.speed = float(cfg.get("speed", 0.35))
        self.error = None
        self.pending = None
        self.game = None
        self.lobby = True
        if humans <= set(self.claims):  # 純觀戰或只有房主一人: 直接開始
            self.start(self.host, force=True)
        return {"ok": True, "seed": seed}

    def say(self, tok, text):
        name = self.nicks.get(tok)
        text = re.sub(r"\s+", " ", str(text or "")).strip()[:200]
        now = time.time()
        if not tok or not name:
            return {"ok": False, "error": "先取暱稱才能聊天"}
        if not text:
            return {"ok": False, "error": "訊息是空的"}
        if now - self.chat_t.get(tok, 0) < 0.5:
            return {"ok": False, "error": "說話太快了"}
        self.chat_t[tok] = now
        self.chat_id += 1
        self.chat.append({"id": self.chat_id, "nick": name, "seat": self.seat_of(tok), "host": tok == self.host,
                          "who": self.pid(tok), "text": text, "t": int(now),
                          "avatar": PROFILES.avatar_url(tok), "style": PROFILES.style(tok), "lv": PROFILES.lv(tok),
                          "spec": self._is_spec(tok)})
        del self.chat[:-200]
        return {"ok": True}

    def _is_spec(self, tok):
        """觀戰者: 開局後沒有座位的人,或座位上的武將已陣亡的人。"""
        seat = self.seat_of(tok)
        if self.game is None and not self.picking:
            return False
        if seat is None:
            return True
        if self.game is None:
            return False
        return 0 <= seat < len(self.game.players) and not self.game.players[seat].alive


    def chat_since(self, n, tok=None):
        return {"chat": [m for m in self.chat if m["id"] > n], "chat_total": self.chat_id, "me": self.pid(tok) if tok else None}

    def seat_of(self, tok):
        for s, t in self.claims.items():
            if tok and t == tok:
                return s
        return None

    def set_nick(self, tok, name):
        name = re.sub(r"[\s<>&\"']", "", str(name or ""))[:10]
        if tok:
            if self.game_active() and tok in self.nicks:   # 遊戲開始後不能改暱稱 (首次取名除外)
                return {"ok": False, "error": "遊戲進行中不能改暱稱", "name": self.nicks[tok]}
            if name:
                self.nicks[tok] = name
            else:
                self.nicks.pop(tok, None)
        return {"ok": True, "name": name}

    def touch(self, tok):
        if tok:
            now = time.time()
            self.seen[tok] = now
            if not self.host and not self.host_cleared:   # 最先連線的人成為房主 (公共房間房主下線後除外)
                self.host = tok
            self.presence()

    OFFLINE_AFTER = 25   # 超過幾秒沒連線視為斷線

    def leave(self, tok):
        """主動離開房間 (回大廳): 不算斷線,不通知房內其他人;房主離開時交給別人。"""
        with self.plock:
            if tok not in self.seen:
                return
            now = time.time()
            self.seen.pop(tok, None)
            self.alive.pop(tok, None)
            if tok == self.host:
                if self.public:
                    self.host, self.host_cleared = None, True
                else:
                    cand = [t for t, x in self.seen.items() if now - x < self.OFFLINE_AFTER]
                    if cand:
                        self.host = random.choice(cand)
                        self._event(f"👑 房主離開了,房主已隨機讓給 {self.nicks.get(self.host) or '未命名'}", "host")

    def _event(self, text, kind="info"):
        self.ev_id += 1
        self.events.append({"id": self.ev_id, "text": text, "kind": kind})
        del self.events[:-30]

    def _who(self, tok):
        seat = next((s for s, t in self.claims.items() if t == tok), None)
        nm = self.nicks.get(tok) or "未命名"
        return f"{nm}(座位 {seat})" if seat is not None else nm

    def presence(self):
        """偵測斷線 / 重連;房主斷線時隨機讓給一位仍在線的人。"""
        with self.plock:
            now = time.time()
            for tok, ts in list(self.seen.items()):
                up = now - ts < self.OFFLINE_AFTER
                was = self.alive.get(tok, True)
                if was and not up:
                    self.alive[tok] = False
                    self._event(f"⚠ {self._who(tok)} 斷線了", "warn")
                    if tok == self.host and self.public:
                        self.host, self.host_cleared = None, True
                        self._event("👑 房主下線,公共房間的房主已清空", "host")
                    elif tok == self.host:
                        cand = [t for t, x in self.seen.items() if t != tok and now - x < self.OFFLINE_AFTER]
                        if cand:
                            self.host = random.choice(cand)
                            self._event(f"👑 房主斷線,房主已隨機讓給 {self.nicks.get(self.host) or '未命名'}", "host")
                elif not was and up:
                    self.alive[tok] = True
                    self._event(f"✅ {self._who(tok)} 重新連線", "ok")

    def online(self):
        now = time.time()
        return [{"id": self.pid(t), "name": self.nicks.get(t, ""), "host": t == self.host, "lv": PROFILES.lv(t), "dev": PROFILES.dev(t), "avatar": PROFILES.avatar_url(t), "style": PROFILES.style(t),
                 "seat": self.seat_of(t), "spec": self._is_spec(t)}
                for t, ts in self.seen.items() if now - ts < 6]

    @staticmethod
    def pid(tok):   # 公開用代號 (不能洩漏 tok 本身,它等於身分憑證)
        return hashlib.sha1(("sgs:" + str(tok)).encode()).hexdigest()[:10]

    def transfer_host(self, tok, to_id):
        if tok != self.host:
            return {"ok": False, "error": "only host"}
        if self.pid(tok) == to_id:
            return {"ok": False, "error": "不能把房主讓給自己"}
        now = time.time()
        for t, ts in self.seen.items():
            if self.pid(t) == to_id and now - ts < 6 and t != tok:
                self.host = t
                return {"ok": True, "name": self.nicks.get(t, "")}
        return {"ok": False, "error": "對方已離線"}

    def host_name(self):
        return self.nicks.get(self.host, "") if self.host else None

    def forfeit(self, tok):
        """段位模式棄賽: 算輸 (扣分),座位交給電腦接手,這個人變成觀戰者。"""
        seat = self.seat_of(tok)
        if not tok or seat is None or not self.game_active() or not (self.cfg or {}).get("ranked"):
            return {"ok": False, "error": "cannot forfeit"}
        g = self.game
        pl = g.players[seat]
        r = PROFILES.award(tok, False, pl._char.name if getattr(pl, "_char", None) else None, pl.role, None, True, None, {"hp": pl.hp, "alive": pl.alive})
        who = self.nicks.get(tok) or "未命名"
        if r:
            d, b, a = r
            self._event(f"🏳 {who} 棄賽,段位積分 {d:+d} ({b}" + (f" → {a})" if a != b else ")"), "ok")
        del self.claims[seat]
        pl.agent = Observed(LeveledAgent(self._level(self.cfg, seat)), self.rec)
        with self.lock:   # 正卡在等這個人回答: 用預設答案放行
            if self.pending and self.pending.get("seat") == seat:
                self._ans = list(getattr(self, "_pend_default", None) or [])
                self._ans_ev.set()
        return {"ok": True}

    def game_active(self):
        return self.game is not None and not self.lobby and self.game.winner is None

    def seat_avatars(self):
        return {s: u for s, t in self.claims.items() if (u := PROFILES.avatar_url(t))}

    def seat_styles(self):
        return {s: PROFILES.style(t) for s, t in self.claims.items()}

    def set_chain_pref(self, tok, on):
        if not hasattr(self, "chain_pref"):
            self.chain_pref = {}
        self.chain_pref[tok] = bool(on)
        if self.game is not None:
            self.game.chain_all = {s for s, t in self.claims.items() if self.chain_pref.get(t)}

    def seat_levels(self):
        return {s: PROFILES.lv(t) for s, t in self.claims.items()}

    def seat_names(self):
        return {s: self.nicks[t] for s, t in self.claims.items() if t in self.nicks}

    def claim(self, tok, seat, name=None):
        if name is not None:
            self.set_nick(tok, name)
        if not tok or not self.lobby or self.game is not None or self.picking:
            return {"ok": False, "error": "not in lobby"}
        for s in [s for s, t in self.claims.items() if t == tok]:
            del self.claims[s]
        if seat is not None:
            seat = int(seat)
            if seat not in self.humans or seat in self.claims:
                return {"ok": False, "error": "seat unavailable"}
            self.claims[seat] = tok
        return {"ok": True}

    def start(self, tok, force=False):
        if not force and (self.game is not None or self.picking or tok != self.host):
            return {"ok": False, "error": "only host can start"}
        cfg, n = self.cfg, self.cfg["n"]
        self.humans = set(self.claims)   # 沒人坐的真人座位由 AI 接手
        pool = list(cfg["pool"])
        self.pick_rng = random.Random(cfg["seed"] + 1)
        lord = cfg.get("lord", "random")
        self.lord_seat = random.Random(cfg["seed"] + 2).randrange(n) if lord in (None, "", "random") else int(lord)
        # 隨機武將: 每人抽 3 張 (彼此不重複),大家同時選 1 張
        self.offers = {i: [pool.pop() for _ in range(min(3, len(pool)))] for i, w in enumerate(cfg["want"]) if w == ""}
        self.picks = {i: None for i, o in self.offers.items() if not o}
        self.picking = True
        self.pick_deadline = time.time() + self.PICK_SECONDS   # 選武將倒數: 時間到沒選的人隨機
        return self._advance()

    def _advance(self):
        """選武將: 大家同時選。AI 馬上選好;真人各自挑,全部選完就開始。"""
        for seat, offer in self.offers.items():
            if seat not in self.picks and seat not in self.claims:
                self.picks[seat] = self.pick_rng.choice(offer)
        if all(i in self.picks for i in self.offers):
            self.picking = False
            return self._launch()
        return {"ok": True, "picking": True}

    def pick(self, tok, name):
        seat = self.seat_of(tok)
        if not self.picking or seat is None or seat not in self.offers or seat in self.picks:
            return {"ok": False, "error": "不能選"}
        if name not in self.offers[seat]:
            return {"ok": False, "error": "不在你抽到的三張裡"}
        self.picks[seat] = name
        return self._advance()

    PICK_SECONDS = 60

    def _pick_expire(self):
        dl = getattr(self, "pick_deadline", None)
        if self.picking and dl and time.time() >= dl:
            self.pick_deadline = None
            for seat, offer in self.offers.items():
                if seat not in self.picks:
                    self.picks[seat] = random.choice(offer)
                    self._event(f"⏰ 座位 {seat} 選武將超時,已隨機選擇", "warn")
            self._advance()

    def pick_view(self, tok):
        """大廳狀態: 只有自己看得到自己抽到的三張;其他人只看得到還在等誰 (選了什麼要到開局才公開)。"""
        self._pick_expire()
        if not self.picking:
            return {}
        seat = self.seat_of(tok)
        data = {d["name"]: d for d in ROSTER_DATA}
        out = {"picking": True, "pick_wait": sorted(i for i in self.offers if i not in self.picks),
               "pick_left": max(0, round(getattr(self, "pick_deadline", None) - time.time(), 1)) if getattr(self, "pick_deadline", None) else None}
        if seat is not None and seat in self.offers and seat not in self.picks:
            out["pick"] = {"seat": seat, "offers": [data[n] for n in self.offers[seat] if n in data]}
        return out

    def _launch(self):
        cfg, n = self.cfg, self.cfg["n"]
        want = cfg["want"]
        chars = []
        for i, w in enumerate(want):
            if w == "none":
                chars.append(None)
            elif w in ROSTER:
                chars.append(ROSTER[w]())
            else:
                nm = self.picks.get(i)
                chars.append(ROSTER[nm]() if nm in ROSTER else None)
        cfg["chars_"] = chars
        agents = []
        for i in range(n):
            if i in self.claims:
                agents.append(HumanAgent(self, i))
            else:
                agents.append(Observed(LeveledAgent(self._level(cfg, i)), self.rec))
        g = Game(agents, seed=cfg["seed"], chars=cfg["chars_"], role_variant=int(cfg.get("variant", 0)), lord_seat=self.lord_seat,
                 mode="shuffle" if cfg.get("mode") == "shuffle" else "normal", role_mode=cfg.get("role_mode") or "normal", base_hp=int(cfg.get("base_hp") or 4))
        g.on_log = self.on_log
        self.game, self.lobby = g, False
        self.thread = threading.Thread(target=self._run, args=(g,), daemon=True)
        self.thread.start()
        return {"ok": True}

    @staticmethod
    def _level(cfg, i):
        """第 i 號座位的電腦難度 (1~4):個別設定優先,沒有就用整體難度。"""
        try:
            return max(1, min(4, int((cfg.get("diffs") or [])[i])))
        except (IndexError, TypeError, ValueError):
            return max(1, min(4, int(cfg.get("difficulty", 3) or 3)))

    def _award(self, g):
        """對局結束: 有入座的真人依勝負得經驗值。"""
        w = g.winner
        camp = lambda r: "主公陣營" if r in ("主公", "忠臣") else r
        noroles = getattr(g, "noroles", False)
        for seat, tok in self.claims.items():
            if seat in self.humans and seat < len(g.players):
                pl = g.players[seat]
                ai_present = any(i not in self.claims for i in range(len(g.players)))
                lv = [self._level(self.cfg, i) for i in range(len(g.players)) if i not in self.claims]
                wx = Profiles.WIN_XP.get(round(sum(lv) / len(lv)), 45) if ai_present else None   # 電腦難度取平均
                wrp = Profiles.WIN_RP.get(round(sum(lv) / len(lv)), 25) if ai_present else 25
                ranked = bool(self.cfg.get("ranked"))
                if len(g.players) <= 3:   # 2~3 人 (沒有隊友,只能靠自己): 贏的經驗加倍
                    wx = 2 * (wx if wx is not None else Profiles.XP_WIN)
                r = PROFILES.award(tok, (w == f"P{pl.idx}") if noroles else (camp(pl.role) == w and (pl.role != "內奸" or pl.alive)), pl._char.name, pl.role, wx, ranked, wrp, {"practice": bool(self.cfg.get("practice")), "hp": pl.hp, "alive": pl.alive, "rounds": g.round, "n": len(g.players), "noroles": noroles, "dmg": pl.dmg_total, "sha": pl.sha_n,
                                                                                                                  "maxhand": pl.max_hand, "chain11": pl.chain11, "same": len(g.players) >= 2 and len({q._char.name for q in g.players}) == 1})
                if r:
                    d, b, a = r
                    who = self.nicks.get(tok) or '未命名'
                    if not ranked:
                        self._event(f"🎮 休閒模式: {who} 段位積分不變 ({a})", "ok")
                    else:
                        self._event(f"🏅 {who} 段位積分 {d:+d} ({b}" + (f" → {a})" if a != b else ")") + (" 升段!" if d > 0 and a != b else " 降段" if d < 0 and a != b else ""), "ok")

    def _run(self, g):
        try:
            g.run()
            if not self.abort and g.winner:
                self._award(g)
        except AbortGame:
            pass
        except Exception as ex:  # 規則引擎錯誤: 顯示在 GUI 上
            import traceback
            traceback.print_exc()
            self.error = f"{type(ex).__name__}: {ex}"

    # ---------- 節奏控制 ----------
    def _humans_all_dead(self):
        """段位模式: 所有真人都陣亡後直接快轉到結算 (不再等每一步的延遲)。"""
        g = self.game
        if g is None or not (self.cfg or {}).get("ranked") or not self.claims:
            return False
        try:
            return all(not g.players[s].alive for s in self.claims if s < len(g.players))
        except Exception:
            return False

    def on_log(self, msg):
        if msg[:1] == chr(1):   # 動畫用的隱藏行: 不佔步驟延遲 / 單步
            return
        if self.abort:
            raise AbortGame()
        while self.paused and not self._step_ev.is_set() and not self.abort and not self._humans_all_dead():
            time.sleep(0.05)
        self._step_ev.clear()
        if self.abort:
            raise AbortGame()
        if self.speed > 0 and not self._humans_all_dead():
            time.sleep(self.speed)

    def control(self, d):
        if not self.is_host(d.get("tok")):
            return {"ok": False, "error": "only host"}
        if "pause" in d:
            self.paused = bool(d["pause"])
        if "speed" in d:
            self.speed = max(0.0, float(d["speed"]))
        if d.get("step"):
            self._step_ev.set()
        return {"ok": True}

    # ---------- 人類決策 ----------
    ASK_LONG = 90      # 出牌階段、偽裝選武將的時限
    ASK_SECONDS = 30   # 所有詢問 (出牌 / 響應 / 選擇) 的預設時限

    def ask(self, seat, kind, prompt, options, mn, mx, timeout=None, default=None):
        """timeout 秒內沒人回答就自動採用 default (選項 index 的 list)。沒指定時一律 30 秒:
        可以不選的 (出牌階段 = 結束出牌) 就不選;有「不出 / 不發動」就選它;否則自動選前 mn 個 (推薦的優先)。"""
        if not timeout:
            timeout = self.ASK_LONG if (kind == "act" or (kind == "mode" and str(prompt).startswith("偽裝"))) else self.ASK_SECONDS   # 出牌階段 / 偽裝選武將 90 秒
            idx = [o["i"] for o in options]
            if mn == 0:
                default = []
            else:
                nopass = next((o["i"] for o in options if str(o.get("label", "")).startswith(("不出", "不發動", "不使用"))), None)
                rec = [o["i"] for o in options if o.get("rec")]
                default = [nopass] if nopass is not None else ((rec + [i for i in idx if i not in rec])[:mn])
        with self.lock:
            self._req += 1
            rid = self._req
            self.pending = {"id": rid, "seat": seat, "kind": kind, "prompt": prompt,
                            "options": options, "min": mn, "max": mx}
            if timeout:
                self.pending["deadline"] = time.time() + timeout
            self._ans = None
            self._pend_default = default
            self._ans_ev.clear()
        while not self._ans_ev.wait(0.2):
            if self.abort:
                raise AbortGame()
            if timeout and self.paused and self.pending and self.pending.get("deadline"):
                self.pending["deadline"] += 0.2   # 暫停時不倒數
            if timeout and default is not None and not self.paused and time.time() > self.pending["deadline"]:
                with self.lock:
                    if self.pending and self.pending["id"] == rid:
                        self._ans = list(default)
                        self._ans_ev.set()
                        self._event(f"⏰ 座位 {seat} 操作逾時 ({prompt[:14]}…),已自動選擇", "warn")
        if self.abort:
            raise AbortGame()
        with self.lock:
            ans = self._ans
            self.pending = None
        return ans

    def ask_first(self, reqs):
        """同時問好幾個人,第一個選了「真的動作」(不是不出) 的人勝出。回傳 (seat, choice) 或 None (全部不出)。
        reqs: [(seat, kind, prompt, options, mn, mx, pass_i)]"""
        with self.lock:
            multi = {}
            for seat, kind, prompt, options, mn, mx, pass_i in reqs:
                self._req += 1
                multi[seat] = {"id": self._req, "seat": seat, "kind": kind, "prompt": prompt, "options": options, "min": mn, "max": mx, "pass_i": pass_i}
            self.multi_res, self.multi_win = {}, None
            self._multi_ev.clear()
            self.multi = multi
        while not self._multi_ev.wait(0.2):
            if self.abort:
                self.multi = {}
                raise AbortGame()
        if self.abort:
            self.multi = {}
            raise AbortGame()
        with self.lock:
            win = self.multi_win
            self.multi = {}
        return win

    def answer(self, rid, choice, tok=None):
        with self.lock:
            if self.multi:
                ent = next((e for e in self.multi.values() if e["id"] == rid), None)
                if not ent or self.multi_win is not None:
                    return {"ok": False, "error": "no such request"}
                if self.seat_of(tok) != ent["seat"]:
                    return {"ok": False, "error": "not your seat"}
                try:
                    ch = [int(x) for x in choice]
                except (TypeError, ValueError):
                    return {"ok": False, "error": "bad choice"}
                valid = {o["i"] for o in ent["options"]}
                if len(set(ch)) != len(ch) or any(c not in valid for c in ch) or not (ent["min"] <= len(ch) <= ent["max"]):
                    return {"ok": False, "error": "invalid selection"}
                if ch == [ent["pass_i"]]:
                    self.multi_res[ent["seat"]] = None
                    if len(self.multi_res) >= len(self.multi):
                        self._multi_ev.set()
                else:
                    self.multi_win = (ent["seat"], ch)
                    self._multi_ev.set()
                return {"ok": True}
            p = self.pending
            if not p or p["id"] != rid:
                return {"ok": False, "error": "no such request"}
            if self.seat_of(tok) != p["seat"]:
                return {"ok": False, "error": "not your seat"}
            try:
                ch = [int(x) for x in choice]
            except (TypeError, ValueError):
                return {"ok": False, "error": "bad choice"}
            valid = {o["i"] for o in p["options"]}
            if len(set(ch)) != len(ch) or any(c not in valid for c in ch) or not (p["min"] <= len(ch) <= p["max"]):
                return {"ok": False, "error": "invalid selection"}
            self._ans = ch
            self._ans_ev.set()
        return {"ok": True}


MGR = Manager()
MGR.room_name = "公共房間"
MGR.public = True
ROOMS = {"main": MGR}   # 房間 id -> Manager; main 永遠存在 (舊網址 / 沒指定房間時用)
ROOMS_LOCK = threading.Lock()


def friend_where(fkey):
    """好友目前在哪個房間 (給好友清單顯示)。沒在任何房間回傳空字串。"""
    a = ACCOUNTS.d.get(fkey)
    if not a:
        return ""
    t, now = a["uuid"], time.time()
    for m in list(ROOMS.values()):
        if now - m.seen.get(t, 0) < 8:
            playing = m.game_active() and t in m.claims.values()
            return ("對戰中 · " if playing else "") + (m.room_name or "房間")
    return ""


def is_playing(tok):
    return any(m.game_active() and tok in m.claims.values() for m in list(ROOMS.values()))


def create_room(tok, name):
    name = (name or "").strip()[:20] or "新房間"
    if not tok:
        return {"ok": False, "error": "no token"}
    with ROOMS_LOCK:
        if sum(1 for m in ROOMS.values() if m.owner == tok) >= 3:
            return {"ok": False, "error": "一個人最多同時開 3 個房間"}
        if len(ROOMS) >= 30:
            return {"ok": False, "error": "房間太多了,請稍後再試"}
        rid = "".join(random.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(5))
        m = Manager()
        m.room_name, m.owner, m.host = name, tok, tok   # 建立者就是房主
        m.created = time.time()
        ROOMS[rid] = m
    return {"ok": True, "room": rid, "name": name}


def delete_room(tok, rid):
    m = ROOMS.get(rid)
    if rid == "main" or m is None:
        return {"ok": False, "error": "這個房間不能刪除"}
    if tok not in (m.owner, m.host):
        return {"ok": False, "error": "只有房主可以刪除房間"}
    m.abort = True; m._ans_ev.set(); m._step_ev.set()
    with ROOMS_LOCK:
        ROOMS.pop(rid, None)
    return {"ok": True}


def tok_can_manage(m, tok):
    return bool(tok) and m is not MGR and tok in (m.owner, m.host)


def rename_room(tok, rid, name):
    m = ROOMS.get(rid)
    name = (name or "").strip()[:20]
    if rid == "main" or m is None:
        return {"ok": False, "error": "這個房間不能改名"}
    if tok not in (m.owner, m.host):
        return {"ok": False, "error": "只有房主可以改房間名稱"}
    if not name:
        return {"ok": False, "error": "房間名稱不能是空的"}
    m.room_name = name
    return {"ok": True, "name": name}


def list_rooms(tok=None):
    now = time.time()
    out = []
    for rid, m in list(ROOMS.items()):
        on = m.online()
        st = ("進行中" if m.game_active() else "選武將" if m.picking else "等待玩家" if m.lobby else "空房")
        out.append({"id": rid, "name": m.room_name, "online": len(on), "state": st, "host": m.host_name() or "",
                    "n": m.cfg.get("n") if m.cfg else None, "main": rid == "main",
                    "can_delete": rid != "main" and tok in (m.owner, m.host)})
    out.sort(key=lambda r: (not r["main"], -r["online"]))
    return out


def reap_rooms():
    """沒人在線超過 10 分鐘的自訂房間: 停掉對局並刪除。"""
    now = time.time()
    for rid, m in list(ROOMS.items()):
        if rid == "main":
            continue
        last = max([m.created] + list(m.seen.values()))
        if now - last > 600:
            m.abort = True; m._ans_ev.set(); m._step_ev.set()
            with ROOMS_LOCK:
                ROOMS.pop(rid, None)


# ---------- 武將資料 ----------
def load_roster():
    imgs = json.load(open(os.path.join(HERE, "character_images.json"), encoding="utf-8"))
    skills, cur = {}, None
    for line in open(os.path.join(HERE, "characters.md"), encoding="utf-8"):
        line = line.rstrip("\n")
        if line.startswith("### "):
            cur = line[4:].strip()
            skills[cur] = []
        elif cur and re.match(r"\d+\.", line):
            skills[cur].append(line)
    out = []
    for name, cls in ROSTER.items():
        c = cls()
        src = os.path.join(ROOT, imgs[name]["image"].replace("/", os.sep)) if name in imgs and imgs[name].get("image") else None
        out.append({"name": name, "faction": c.faction, "maxhp": c.maxhp, "skills": skills.get(name, []),
                    "img": "/thumb/char/" + name if src and os.path.isfile(src) else None})   # 沒放素材圖片就只顯示文字
    return out, imgs


ROSTER_DATA, CHAR_IMGS = load_roster()


def make_thumb(name):
    rel = CHAR_IMGS.get(name, {}).get("image")
    if not rel:
        return None
    src = os.path.join(ROOT, rel.replace("/", os.sep))
    if not os.path.isfile(src):
        return None
    os.makedirs(CACHE, exist_ok=True)
    dst = os.path.join(CACHE, hashlib.md5(name.encode()).hexdigest() + ".jpg")
    if not os.path.exists(dst):
        from PIL import Image
        im = Image.open(src).convert("RGB")
        im.thumbnail((260, 360))
        im.save(dst, quality=85)
    return dst


# ---------- HTTP ----------
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store" if ctype.startswith(("application/json", "application/javascript", "text/")) else "max-age=3600")
        self.end_headers()
        self.wfile.write(body)

    def _file(self, path):
        if not path or not os.path.isfile(path):
            return self._send(404, {"error": "not found"})
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        with open(path, "rb") as f:
            self._send(200, f.read(), ctype)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        path = unquote(u.path)
        raw = q.get("tok", [""])[0]
        q["tok"] = [ACCOUNTS.resolve(raw)]
        try:
            if path == "/api/me":
                t = q["tok"][0]
                return self._send(200, {"ok": ACCOUNTS.is_account(t), "user": ACCOUNTS.username(t), "kicked": raw in ACCOUNTS.kicked, "default_pw": ACCOUNTS.default_pw(t)})
            if path.startswith("/api/") and path not in OPEN_API and not ACCOUNTS.is_account(q["tok"][0]):
                return self._send(200, {"auth": False, "ready": False, "kicked": raw in ACCOUNTS.kicked})
            if path.startswith("/avatar/"):
                fn = os.path.basename(path)
                full = os.path.join(Profiles.AVATAR_DIR, fn)
                if not fn.endswith(".jpg") or not os.path.isfile(full):
                    return self._send(404, {"error": "not found"})
                return self._file(full)
            if path == "/api/profile":
                return self._send(200, PROFILES.info(q.get("tok", [""])[0]) or {})
            if path == "/api/cosmetics":
                return self._send(200, cosmetics.catalog())
            if path == "/api/leaderboard":
                return self._send(200, leaderboard(q.get("tok", [""])[0]))
            if path == "/api/rooms":
                return self._send(200, list_rooms(q.get("tok", [""])[0]))
            if path == "/api/social":
                tk = q.get("tok", [""])[0]
                key = SOCIAL.key_of(tk)
                SOCIAL.touch(key)
                return self._send(200, SOCIAL.overview(key, friend_where, is_playing(tk)))
            if path == "/api/dm":
                tk = q.get("tok", [""])[0]
                return self._send(200, SOCIAL.thread(SOCIAL.key_of(tk), q.get("with", [""])[0]))
            M = ROOMS.get(q.get("room", ["main"])[0] or "main")
            if M is None and path.startswith("/api/") and path not in ("/api/cardcat", "/api/i18n", "/api/roster"):
                return self._send(200, {"gone": True, "ready": False})
            if path in ("/", "/index.html"):
                return self._file(os.path.join(WEB, "index.html"))
            if path == "/api/cardcat":   # 牌的目錄: 戰報把牌名換成圖片、滑過去顯示說明用
                from view import card_img
                from card_desc import DESC
                from view import full_name
                cat = {k: {"desc": v, "full": full_name(k), "img": {c: card_img(k, c) for c in ("紅", "黑")}} for k, v in DESC.items()}
                for nat in ("火", "冰", "雷"):
                    cat[nat + "殺"] = {"desc": nat + "屬性殺: " + DESC["殺"], "full": nat + "殺", "img": {c: card_img(nat, c) for c in ("紅", "黑")}}
                import cards as _cd
                for n in [x[0] for x in _cd.WEAPON] + [x[0] for x in _cd.ARMOR] + [x[0] for x in _cd.HORSE]:
                    if n in cat:
                        cat[n]["eq"] = True   # 裝備牌: 前端動畫不往場中央飛
                return self._send(200, cat)
            if path == "/api/i18n":   # 卡牌說明翻譯: {中文說明: 譯文}
                from i18n_cards import exact
                import i18n_skills
                lg = q.get("lang", ["en"])[0]
                d = exact(lg); d.update(i18n_skills.exact(lg))
                return self._send(200, d)
            if path == "/api/roster":
                return self._send(200, {"chars": ROSTER_DATA, "roles": {str(k): v for k, v in ROLES.items()}})
            if path == "/api/state":
                tok = q.get("tok", [""])[0]
                viewer = M.seat_of(tok)
                M.touch(tok)
                nk = q.get("nick", [None])[0]
                if nk is not None and M.nicks.get(tok, "") != nk[:10]:
                    M.set_nick(tok, nk)   # 伺服器重啟後暱稱會遺失,每次輪詢順便帶上
                M.set_chain_pref(tok, q.get("cm", [""])[0] == "all")   # 連鎖提示: 全部都問 / 只有影響到我才問
                if M.lobby:
                    return self._send(200, {"ready": True, "lobby": True, "n": M.cfg["n"],
                                            "humans": sorted(M.humans),
                                            "ranked": bool(M.cfg.get("ranked")), "claims": sorted(M.claims), "mine": viewer, "names": M.seat_names(), "levels": M.seat_levels(), "avatars": M.seat_avatars(),
                                            "host": bool(tok) and tok == M.host, "is_host": M.is_host(tok),
                                            "online": M.online(), "host_name": M.host_name(), "events": M.events, "locked": M.game_active(), "room_name": M.room_name, "can_manage": tok_can_manage(M, tok),
                                            **M.pick_view(tok), **M.chat_since(int(q.get("chat", ["0"])[0]), tok)})
                snap = snapshot(M, viewer, int(q.get("log", ["0"])[0]),
                                int(q.get("th", ["0"])[0]),
                                q.get("peek", ["0"])[0] == "1" and (len(M.humans) <= 1 or M.is_host(tok)))   # 多人遊戲只有房主能偷看
                snap["room_name"] = M.room_name
                snap["can_manage"] = tok_can_manage(M, tok)
                snap["is_host"] = M.is_host(tok)
                snap["online"] = M.online()
                snap["host_name"] = M.host_name()
                snap["events"] = M.events
                snap["avstyles"] = M.seat_styles(); snap["locked"] = M.game_active(); snap["ranked"] = bool((M.cfg or {}).get("ranked"))
                if M.cfg and "players" in snap:   # 每個電腦座位的難度 (1~4)
                    snap["ai_lv"] = [M._level(M.cfg, i) for i in range(len(snap["players"]))]
                snap.update(M.chat_since(int(q.get("chat", ["0"])[0]), tok))
                return self._send(200, snap)
            if path in ("/i18n.js", "/i18n_log.js", "/i18n_ui.js", "/i18n_log2.js", "/fx.js", "/theme.js", "/friends.js"):
                return self._file(os.path.join(WEB, path[1:]))
            if path == "/api/about":
                from version import VERSION, REPO
                try:
                    log = open(os.path.join(HERE, "CHANGELOG.md"), encoding="utf-8").read()
                except OSError:
                    log = ""
                return self._send(200, {"version": VERSION, "repo": REPO, "changelog": log})
            if path.startswith("/thumb/char/"):
                return self._file(make_thumb(path[len("/thumb/char/"):]))
            if path.startswith("/assets/sgs_sim/web/hp/"):   # 血量圖示 (隨程式附上,不在素材資料夾)
                return self._file(os.path.join(WEB, "hp", os.path.basename(path)))
            if path.startswith("/assets/"):
                full = os.path.normpath(os.path.join(ROOT, path[len("/assets/"):].replace("/", os.sep)))
                if os.path.commonpath([full, os.path.normpath(ROOT)]) != os.path.normpath(ROOT):
                    return self._send(403, {"error": "forbidden"})
                return self._file(full)
            self._send(404, {"error": "not found"})
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _ip(self):
        """連線來源 IP。只有本機反向代理 (Caddy) 轉來的連線才相信 X-Forwarded-For。"""
        ip = self.client_address[0]
        if ip in ("127.0.0.1", "::1"):
            xf = (self.headers.get("X-Forwarded-For") or "").split(",")[-1].strip()
            if xf:
                return xf
        return ip

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = -1
        if n < 0 or n > MAX_BODY:
            return self._send(413, {"error": "too large"})
        try:
            data = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return self._send(400, {"error": "bad json"})
        path = urlparse(self.path).path
        raw = data.get("tok")
        if path != "/api/register":
            data["tok"] = ACCOUNTS.resolve(raw)
        try:
            if path == "/api/register":
                return self._send(200, ACCOUNTS.register(data.get("user"), data.get("pw"), data.get("tok"), self._ip()))
            if path == "/api/login":
                return self._send(200, ACCOUNTS.login(data.get("user"), data.get("pw"), self._ip()))
            if path.startswith("/api/") and path not in OPEN_API and not ACCOUNTS.is_account(data.get("tok")):
                return self._send(200, {"ok": False, "auth": False, "kicked": raw in ACCOUNTS.kicked, "error": "請先登入"})
            if path == "/api/change_pw":
                return self._send(200, ACCOUNTS.change_pw(data.get("tok"), data.get("old"), data.get("new")))
            if path == "/api/ach_ack":
                return self._send(200, PROFILES.ack_ach(data.get("tok")))
            if path == "/api/cosmetic":
                return self._send(200, PROFILES.set_style(data.get("tok"), data.get("frame"), data.get("fx"), data.get("theme")))
            if path == "/api/rank_ack":
                return self._send(200, PROFILES.ack_rank(data.get("tok"), data.get("id")))
            if path == "/api/avatar":
                d = data.get("data") or ""
                if not d:
                    return self._send(200, PROFILES.set_avatar(data.get("tok"), None))
                if not d.startswith("data:image/jpeg;base64,"):
                    return self._send(200, {"ok": False, "error": "只接受 JPEG"})
                import base64
                try:
                    raw = base64.b64decode(d.split(",", 1)[1], validate=True)
                except ValueError:
                    return self._send(200, {"ok": False, "error": "圖片資料錯誤"})
                return self._send(200, PROFILES.set_avatar(data.get("tok"), raw))
            if path.startswith(("/api/friend_", "/api/dm_", "/api/invite")):
                key = SOCIAL.key_of(data.get("tok"))
                if path == "/api/friend_add":
                    return self._send(200, SOCIAL.add(key, data.get("name")))
                if path == "/api/friend_accept":
                    return self._send(200, SOCIAL.accept(key, data.get("name")))
                if path == "/api/friend_decline":
                    return self._send(200, SOCIAL.decline(key, data.get("name")))
                if path == "/api/friend_remove":
                    return self._send(200, SOCIAL.remove(key, data.get("name")))
                if path == "/api/dm_send":
                    return self._send(200, SOCIAL.send(key, data.get("to"), data.get("text")))
                if path == "/api/invite":
                    rid = data.get("room") or "main"
                    m = ROOMS.get(rid)
                    if m is None or time.time() - m.seen.get(data.get("tok"), 0) > 30:
                        return self._send(200, {"ok": False, "error": "你不在這個房間裡"})
                    return self._send(200, SOCIAL.invite(key, data.get("to"), rid, m.room_name or "房間"))
                if path == "/api/invite_reply":
                    r = SOCIAL.reply(key, int(data.get("id") or 0), bool(data.get("accept")))
                    if r.get("room") and ROOMS.get(r["room"]) is None:
                        return self._send(200, {"ok": False, "error": "那個房間已經不存在了"})
                    return self._send(200, r)
                return self._send(404, {"error": "not found"})
            if path == "/api/room_rename":
                return self._send(200, rename_room(data.get("tok"), data.get("target"), data.get("name")))
            if path == "/api/room_delete":
                return self._send(200, delete_room(data.get("tok"), data.get("target")))
            if path == "/api/room_create" and not ACCOUNTS.is_account(data.get("tok")):
                return self._send(200, {"ok": False, "auth": False, "error": "請先登入"})
            if path == "/api/room_create":
                return self._send(200, create_room(data.get("tok"), data.get("name")))
            M = ROOMS.get(data.get("room") or "main")
            if M is None:
                return self._send(200, {"ok": False, "gone": True, "error": "房間已不存在"})
            if path == "/api/leave":
                M.leave(data.get("tok"))
                return self._send(200, {"ok": True})
            if path == "/api/rematch":
                return self._send(200, M.rematch(data.get("tok")))
            if path == "/api/new":
                return self._send(200, M.new_game(data))
            if path == "/api/answer":
                return self._send(200, M.answer(data.get("id"), data.get("choice", []), data.get("tok")))
            if path == "/api/claim":
                return self._send(200, M.claim(data.get("tok"), data.get("seat"), data.get("name")))
            if path == "/api/forfeit":
                return self._send(200, M.forfeit(data.get("tok")))
            if path == "/api/transfer":
                return self._send(200, M.transfer_host(data.get("tok"), data.get("to")))
            if path == "/api/nick":
                return self._send(200, M.set_nick(data.get("tok"), data.get("name")))
            if path == "/api/chat":
                return self._send(200, M.say(data.get("tok"), data.get("text")))
            if path == "/api/pick":
                return self._send(200, M.pick(data.get("tok"), data.get("name")))
            if path == "/api/start":
                return self._send(200, M.start(data.get("tok")))
            if path == "/api/control":
                return self._send(200, M.control(data))
            self._send(404, {"error": "not found"})
        except Exception as ex:
            import traceback
            traceback.print_exc()   # 詳細錯誤只留在伺服器日誌,不回傳給使用者
            self._send(500, {"error": "伺服器發生錯誤"})


def main():
    lan = "--lan" in sys.argv
    try:
        srv = ThreadingHTTPServer(("0.0.0.0" if lan else "127.0.0.1", PORT), Handler)
    except OSError:
        print(f"!! 埠 {PORT} 已被占用 (可能有舊的伺服器視窗還開著)。請關掉舊視窗,或用啟動遊戲.bat 自動清掉舊的。")
        sys.exit(1)
    def _tick():   # 每 2 秒偵測一次誰斷線 / 重連
        while True:
            time.sleep(2)
            try:
                M.presence()
            except Exception:
                pass
    threading.Thread(target=_tick, daemon=True).start()
    url = f"http://127.0.0.1:{PORT}/"
    print("三國殺重製版 GUI:", url, "(Ctrl+C 結束)")
    if lan:
        import socket
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except OSError:
            ip = "<你的區網 IP>"
        print(f"區域網路: 朋友開 http://{ip}:{PORT}/  (Windows 防火牆若詢問請允許私人網路)")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
