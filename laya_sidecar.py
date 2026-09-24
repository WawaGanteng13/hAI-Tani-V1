"""Laya intent sidecar stdlib only (tanpa fastapi).
Run: python laya_sidecar.py [--port 8787]
POST /decide {"text": "..."} -> {"intent","confidence","probabilities","model"}
GET /health -> {"status":"ok","loaded":bool}
Env: LAYA_PORT=8787 LAYA_MODEL=multilingual LAYA_PRELOAD=1 LAYA_THREADS=4
ponytail: ganti ke laya[serve] saat butuh batch/throughput.
"""
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("LAYA_PORT", "8787"))
MODEL = os.environ.get("LAYA_MODEL", "multilingual")
PRELOAD = os.environ.get("LAYA_PRELOAD", "1").strip().lower() in ("1", "true", "yes", "on")
try:
    THREADS = int(os.environ.get("LAYA_THREADS", str(os.cpu_count() or 4)))
except ValueError:
    THREADS = 4

QUESTIONS = {
    "intent": {
        "type": "choice",
        "instructions": "What does farmer want in `text`?",
        "criteria": {
            "daftar_lahan": "register farmer land, name, commodity, area hectare, village",
            "cek_harga": "market price, price anomaly, cheap market operation",
            "hama_pupuk": "pest, plant disease, fertilizer dosage, consultation",
            "supplier": "farm shop, kios, distributor, offtaker, cooperative",
            "lain": "greeting, thanks, other",
        },
    }
}

_router = None
_lock = threading.Lock()


def _cap_threads():
    try:
        import torch

        # Oversubscribe hyperthreads = regresi besar (lihat laya serve.py).
        # Cap ke physical cores, interop 1.
        n = max(1, min(THREADS, os.cpu_count() or 4))
        torch.set_num_threads(n)
        torch.set_num_interop_threads(1)
    except Exception:
        pass


def get_router():
    global _router
    if _router is not None:
        return _router
    with _lock:
        if _router is not None:
            return _router
        from laya import Router

        _cap_threads()
        _router = Router(preload=False)
        _router.load(MODEL)
        return _router


def warmup():
    r = get_router()
    try:
        r.predict({"text": "halo"}, QUESTIONS, model=MODEL)
    except Exception:
        pass


class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/health":
            loaded = (MODEL in (_router.loaded or [])) if _router else False
            self._send(200, {"status": "ok", "loaded": loaded, "model": MODEL})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/decide":
            self._send(404, {"error": "not found"})
            return
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        if n > 20000:
            self._send(413, {"error": "too large"})
            return
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            self._send(400, {"error": "bad json"})
            return
        text = str(body.get("text", ""))[:2000]
        if not text.strip():
            self._send(400, {"error": "empty text"})
            return
        model = str(body.get("model") or MODEL)
        if model not in ("multilingual", "english", "typed-decisions"):
            model = MODEL
        try:
            r = get_router()
            # torch agent tidak thread-safe -> serialize inferensi,
            # HTTP tetap threaded (health tidak starve).
            with _lock:
                out = r.predict({"text": text}, QUESTIONS, model=model)
            ans = (out.get("answers") or {}).get("intent") or {}
            choice = str(ans.get("choice") or "lain")
            probs = ans.get("probabilities") or {}
            conf = float(ans.get("confidence") or probs.get(choice) or 0.0)
            self._send(200, {
                "intent": choice,
                "confidence": round(conf, 4),
                "probabilities": probs,
                "model": (out.get("routing") or {}).get("model"),
            })
        except Exception as e:
            self._send(500, {"error": "inference failed", "detail": str(e)[:200]})

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=PORT)
    ap.add_argument("--no-preload", action="store_true")
    args = ap.parse_args()
    if PRELOAD and not args.no_preload:
        t0 = time.perf_counter()
        warmup()
        dt = time.perf_counter() - t0
        print(f"[laya-sidecar] warmed {MODEL} in {dt:.1f}s", flush=True)
    print(f"[laya-sidecar] listen 127.0.0.1:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), H).serve_forever()

assert QUESTIONS["intent"]["type"] == "choice"
