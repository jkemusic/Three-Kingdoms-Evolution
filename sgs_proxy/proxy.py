#!/usr/bin/env python3
"""本機代理: 把 http://127.0.0.1:8787 轉發到三國殺網站, 並在每個 HTML 頁面結尾自動插入 <script src="/sgs_autoload.js">,
讓機器人 (存在瀏覽器 localStorage) 在每次載入頁面後自動還原。只綁 127.0.0.1。
用法: python proxy.py [埠號]
"""
import http.client, http.server, json, os, re, secrets, socketserver, ssl, sys, threading
from urllib.parse import urlsplit

UP_HOST = "161.33.195.70.sslip.io"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
DIR = os.path.dirname(os.path.abspath(__file__))
SECRET_FILE = os.path.join(DIR, "secret.txt")
BUNDLE_FILE = os.path.join(DIR, "bundle.json")
AUTOLOAD_TPL = os.path.join(DIR, "sgs_autoload_proxy.js")
ALLOWED_HOSTS = {"127.0.0.1:%d" % PORT, "localhost:%d" % PORT}
UP_ORIGIN = "https://" + UP_HOST
HOP = {"connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers",
       "transfer-encoding", "upgrade", "host", "accept-encoding", "content-length", "content-encoding"}

if os.path.exists(SECRET_FILE):
    SECRET = open(SECRET_FILE, encoding="utf-8").read().strip()
else:
    SECRET = secrets.token_hex(24)
    open(SECRET_FILE, "w", encoding="utf-8").write(SECRET)

CTX = ssl.create_default_context()
TL = threading.local()
LOCK = threading.Lock()


def get_conn(fresh=False):
    c = getattr(TL, "conn", None)
    if fresh or c is None:
        if c is not None:
            try: c.close()
            except Exception: pass
        c = http.client.HTTPSConnection(UP_HOST, 443, timeout=60, context=CTX)
        TL.conn = c
    return c


def upstream(method, path, headers, body):
    for attempt in (0, 1):
        c = get_conn(fresh=(attempt == 1))
        try:
            c.request(method, path, body=body, headers=headers)
            r = c.getresponse()
            return r.status, r.reason, r.getheaders(), r.read()
        except (http.client.HTTPException, OSError):
            if attempt == 1:
                raise
    raise RuntimeError("unreachable")


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "sgs-proxy/1"

    def log_message(self, fmt, *a):
        pass

    # ---- 本機端點 ----
    def host_ok(self):
        return (self.headers.get("Host") or "").lower() in ALLOWED_HOSTS

    def key_ok(self):
        return secrets.compare_digest(self.headers.get("X-Sgs-Key") or "", SECRET)

    def origin_ok(self):
        o = self.headers.get("Origin")
        if not o:
            return True
        return o in ("http://127.0.0.1:%d" % PORT, "http://localhost:%d" % PORT, UP_ORIGIN)

    def send_bytes(self, status, body, ctype="text/plain; charset=utf-8", extra=None):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def cors(self):
        o = self.headers.get("Origin")
        if o == UP_ORIGIN:   # 只允許原網站頁面一次性匯出機器人程式 (需要正確的 secret)
            return {"Access-Control-Allow-Origin": o, "Access-Control-Allow-Headers": "X-Sgs-Key, Content-Type",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Private-Network": "true", "Vary": "Origin"}
        return {}

    def local(self):
        p = urlsplit(self.path).path
        if p == "/sgs_autoload.js":
            tpl = open(AUTOLOAD_TPL, encoding="utf-8").read().replace("__SECRET__", SECRET)
            self.send_bytes(200, tpl.encode("utf-8"), "application/javascript; charset=utf-8")
            return True
        if p.startswith("/__sgs/"):
            if not self.host_ok() or not self.origin_ok():
                self.send_bytes(403, b"forbidden")
                return True
            if self.command == "OPTIONS":
                self.send_bytes(204, b"", extra=self.cors())
                return True
            if not self.key_ok():
                self.send_bytes(403, b"bad key", extra=self.cors())
                return True
            if p == "/__sgs/ping":
                self.send_bytes(200, b"ok", extra=self.cors())
            elif p == "/__sgs/bundle" and self.command == "GET":
                data = open(BUNDLE_FILE, "rb").read() if os.path.exists(BUNDLE_FILE) else b"{}"
                self.send_bytes(200, data, "application/json; charset=utf-8", self.cors())
            elif p == "/__sgs/save" and self.command == "POST":
                n = int(self.headers.get("Content-Length") or 0)
                if n > 8_000_000:
                    self.send_bytes(413, b"too big", extra=self.cors()); return True
                try:
                    obj = json.loads(self.rfile.read(n).decode("utf-8"))
                    assert isinstance(obj, dict)
                except Exception:
                    self.send_bytes(400, b"bad json", extra=self.cors()); return True
                obj = {k: v for k, v in obj.items() if isinstance(k, str) and k.startswith("sgs_") and k != "sgs_tok" and isinstance(v, str)}
                with LOCK:
                    old = {}
                    if os.path.exists(BUNDLE_FILE):
                        try: old = json.load(open(BUNDLE_FILE, encoding="utf-8"))
                        except Exception: old = {}
                    old.update(obj)
                    tmp = BUNDLE_FILE + ".tmp"
                    json.dump(old, open(tmp, "w", encoding="utf-8"), ensure_ascii=False)
                    os.replace(tmp, BUNDLE_FILE)
                self.send_bytes(200, json.dumps({"ok": True, "keys": len(obj)}).encode(), "application/json", self.cors())
            else:
                self.send_bytes(404, b"not found", extra=self.cors())
            return True
        return False

    # ---- 轉發 ----
    def proxy(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n) if n else None
        h = {}
        for k, v in self.headers.items():
            kl = k.lower()
            if kl in HOP or kl in ("origin", "referer"):
                continue
            h[k] = v
        h["Host"] = UP_HOST
        h["Accept-Encoding"] = "identity"
        if self.headers.get("Origin"):
            h["Origin"] = UP_ORIGIN
        if self.headers.get("Referer"):
            h["Referer"] = re.sub(r"^https?://[^/]+", UP_ORIGIN, self.headers["Referer"])
        if body is not None:
            h["Content-Length"] = str(len(body))
        try:
            status, reason, hdrs, data = upstream(self.command, self.path, h, body)
        except Exception as e:
            self.send_bytes(502, ("upstream error: %s" % e).encode("utf-8"))
            return
        local = "http://%s" % (self.headers.get("Host") or "127.0.0.1:%d" % PORT)
        ctype = ""
        out = []
        for k, v in hdrs:
            kl = k.lower()
            if kl in HOP or kl in ("strict-transport-security", "alt-svc"):
                continue
            if kl == "content-type":
                ctype = v
            if kl == "location":
                v = v.replace(UP_ORIGIN, local)
            if kl == "set-cookie":
                v = re.sub(r";\s*Secure", "", v, flags=re.I)
                v = re.sub(r";\s*Domain=[^;]*", "", v, flags=re.I)
                v = re.sub(r"SameSite=None", "SameSite=Lax", v, flags=re.I)
            out.append((k, v))
        if "text/html" in ctype.lower():
            tag = b'<script src="/sgs_autoload.js"></script>\n'
            i = data.rfind(b"</body>")
            data = data[:i] + tag + data[i:] if i >= 0 else data + tag
        self.send_response(status, reason)
        for k, v in out:
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def handle_any(self):
        try:
            if self.local():
                return
            self.proxy()
        except (BrokenPipeError, ConnectionResetError):
            pass

    do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = do_HEAD = do_OPTIONS = handle_any


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    srv = Server(("127.0.0.1", PORT), Handler)
    print("sgs proxy on http://127.0.0.1:%d -> %s" % (PORT, UP_ORIGIN), flush=True)
    srv.serve_forever()
