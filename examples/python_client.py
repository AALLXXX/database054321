"""Contoh client Alex Database untuk Python 3.

    pip install requests
    ALEX_API_KEY=adb_xxx python examples/python_client.py
"""
import os
import requests

BASE = os.environ.get("ALEX_BASE_URL", "https://alex-database.vercel.app")
KEY = os.environ["ALEX_API_KEY"]  # buat di menu API Keys
S = requests.Session()
S.headers["Authorization"] = f"Bearer {KEY}"


def call(method: str, path: str, **kw):
    r = S.request(method, BASE + path, timeout=30, **kw)
    j = r.json()
    if not j.get("ok"):
        raise RuntimeError(f"{r.status_code} {j['error']['code']}: {j['error']['message']}")
    return j["data"]


def me():
    return call("GET", "/api/v1/me")


def bots(status=None, telegram_id=None, reveal=False):
    params = {}
    if status:
        params["status"] = status
    if telegram_id:
        params["telegramId"] = telegram_id
    if reveal:
        params["reveal"] = "1"
    return call("GET", "/api/v1/bots", params=params)


def add_bot(token: str, telegram_id: str, name: str | None = None, verify: bool = True):
    return call("POST", "/api/v1/bots", json={"token": token, "telegramId": telegram_id, "name": name, "verify": verify})


def reveal(bot_id: str):
    return call("GET", f"/api/v1/bots/{bot_id}/reveal")


def delete(bot_id: str):
    return call("DELETE", f"/api/v1/bots/{bot_id}")


if __name__ == "__main__":
    info = me()
    print("Login sebagai:", info["user"]["username"], f"({info['role']})")
    for b in bots(status="active", reveal=True):
        print("-", b["name"], "|", b["token"][:12] + "…", "| telegramId:", b["telegramId"])
