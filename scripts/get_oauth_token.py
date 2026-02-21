#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Twitch OAuth アクセストークン取得スクリプト（Windows用）
Qiita: https://qiita.com/pasta04/items/2ff86692d20891b65905
Authorization Code Flow でブラウザ認証 → コードをトークンに交換 → .env を更新
"""

import http.server
import json
import re
import socket
import sys
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

# プロジェクトルート（scripts の親）
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
ENV_PATH = PROJECT_ROOT / ".env"

REDIRECT_URI = "http://localhost:8888"
OAUTH_AUTHORIZE = "https://id.twitch.tv/oauth2/authorize"
OAUTH_TOKEN = "https://id.twitch.tv/oauth2/token"
SCOPES = "channel:read:redemptions channel:manage:redemptions user:write:chat"

# グローバルに渡す用
SERVER_STATE = {"client_id": "", "client_secret": "", "done": False, "result": None}


def load_env():
    """ .env から VITE_TWITCH_CLIENT_ID と VITE_TWITCH_CLIENT_SECRET を読み込む """
    if not ENV_PATH.exists():
        print(f"❌ .env が見つかりません: {ENV_PATH}")
        sys.exit(1)
    config = {}
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"([A-Za-z_][A-Za-z0-9_]*)=(.*)", line)
            if m:
                key, value = m.group(1), m.group(2).strip()
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                config[key] = value
    client_id = config.get("VITE_TWITCH_CLIENT_ID", "").strip()
    client_secret = config.get("VITE_TWITCH_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        print("❌ .env に VITE_TWITCH_CLIENT_ID と VITE_TWITCH_CLIENT_SECRET を設定してください")
        sys.exit(1)
    return client_id, client_secret


def update_env(access_token: str, refresh_token: str):
    """ .env の VITE_TWITCH_ACCESS_TOKEN / VITE_TWITCH_REFRESH_TOKEN を更新 """
    with open(ENV_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    # 既存行を置換、なければ末尾に追加
    if "VITE_TWITCH_ACCESS_TOKEN=" in content:
        content = re.sub(
            r"VITE_TWITCH_ACCESS_TOKEN=.*",
            f"VITE_TWITCH_ACCESS_TOKEN={access_token}",
            content,
            count=1,
        )
    else:
        content = content.rstrip() + f"\nVITE_TWITCH_ACCESS_TOKEN={access_token}\n"
    if "VITE_TWITCH_REFRESH_TOKEN=" in content:
        content = re.sub(
            r"VITE_TWITCH_REFRESH_TOKEN=.*",
            f"VITE_TWITCH_REFRESH_TOKEN={refresh_token}",
            content,
            count=1,
        )
    else:
        content = content.rstrip() + f"\nVITE_TWITCH_REFRESH_TOKEN={refresh_token}\n"
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.write(content)
    print("✅ .env を更新しました")


def exchange_code_for_token(code: str, client_id: str, client_secret: str):
    """ 認証コードをアクセストークン・リフレッシュトークンに交換 """
    data = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": REDIRECT_URI,
    }).encode("utf-8")
    req = urllib.request.Request(
        OAUTH_TOKEN,
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req) as res:
            body = res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            obj = json.loads(body)
            msg = obj.get("message", obj.get("error_description", body))
        except json.JSONDecodeError:
            msg = body or str(e)
        raise RuntimeError(f"トークン取得に失敗しました: {msg}")
    obj = json.loads(body)
    return obj.get("access_token"), obj.get("refresh_token")


def html_page(title: str, body_content: str) -> str:
    style = """
    body { font-family: Arial, sans-serif; background: #000; color: #fff;
           display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .container { text-align: center; padding: 2rem; background: #1a1a1a;
                 border: 1px solid #fff; border-radius: 8px; }
    """
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{title}</title>
  <style>{style}</style>
</head>
<body><div class="container">{body_content}</div></body>
</html>"""


class OAuthHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # コンソールログを減らす

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        code_list = qs.get("code")
        error_list = qs.get("error")

        if error_list:
            err = error_list[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                html_page(
                    "OAuth認証エラー",
                    f"<h1>❌ 認証エラー</h1><p>エラー: {err}</p><p>このウィンドウを閉じてください。</p>",
                ).encode("utf-8")
            )
            SERVER_STATE["done"] = True
            SERVER_STATE["result"] = ("error", err)
            return

        if code_list:
            code = code_list[0]
            cid = SERVER_STATE["client_id"]
            csec = SERVER_STATE["client_secret"]
            try:
                access_token, refresh_token = exchange_code_for_token(code, cid, csec)
                if access_token and refresh_token:
                    update_env(access_token, refresh_token)
                    body = """
                    <h1>✅ 認証成功</h1>
                    <p class="success">トークンを取得しました！</p>
                    <p class="info">.env が自動的に更新されました。</p>
                    <p class="info">このウィンドウを閉じて、開発サーバーを再起動してください。</p>
                    """
                    SERVER_STATE["result"] = ("ok", None)
                else:
                    body = "<h1>❌ エラー</h1><p>トークンの取得に失敗しました。</p><p>このウィンドウを閉じてください。</p>"
                    SERVER_STATE["result"] = ("error", "No token in response")
            except Exception as e:
                body = f"<h1>❌ エラー</h1><p>{e}</p><p>このウィンドウを閉じてください。</p>"
                SERVER_STATE["result"] = ("error", str(e))
            SERVER_STATE["done"] = True
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html_page("認証結果", body).encode("utf-8"))
            return

        # ルートなど: 待機中ページ
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(
            html_page("認証待機中", "<h1>認証待機中...</h1><p>ブラウザで認証を完了してください。</p>").encode("utf-8")
        )


def main():
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  OAuth認証トークン取得ツール（Python / Windows）")
    print("  Qiita: https://qiita.com/pasta04/items/2ff86692d20891b65905")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()

    client_id, client_secret = load_env()
    SERVER_STATE["client_id"] = client_id
    SERVER_STATE["client_secret"] = client_secret

    # Twitch は scope をスペース区切りで受け取る（+ は invalid scope になる）
    scope_encoded = urllib.parse.quote(SCOPES)
    auth_url = (
        f"{OAUTH_AUTHORIZE}?client_id={urllib.parse.quote(client_id)}"
        f"&redirect_uri={urllib.parse.quote(REDIRECT_URI)}"
        f"&response_type=code&scope={scope_encoded}"
    )

    print(f"Client ID: {client_id[:10]}...")
    print()
    print("ブラウザで認証URLを開いています...")
    print()

    # 先にサーバーを起動してからブラウザを開く（リダイレクト時に接続できるように）
    # 127.0.0.1 にバインド（Windows で "" だと IPv6 のみになり REFUSED になることがある）
    try:
        server = http.server.HTTPServer(("127.0.0.1", 8888), OAuthHandler)
    except OSError as e:
        if getattr(e, "winerror", None) == 10048 or "Address already in use" in str(e):
            print("❌ ポート 8888 が使用中です。")
            print("   他のアプリ（Node の get-oauth-token など）を終了するか、")
            print("   タスクマネージャーでポート 8888 を使っているプロセスを確認してください。")
        else:
            print(f"❌ サーバー起動エラー: {e}")
        sys.exit(1)
    server.socket.settimeout(1.0)
    print("✅ 認証サーバーを起動しました (http://localhost:8888)")
    print("   ブラウザで Twitch にログインし「許可する」を押してください...")
    print()

    webbrowser.open(auth_url)

    timeout_sec = 5 * 60  # 5分
    waited = 0
    while not SERVER_STATE["done"]:
        if waited >= timeout_sec:
            print()
            print("❌ タイムアウト: 5分以内に認証を完了してください")
            print()
            server.server_close()
            sys.exit(1)
        try:
            server.handle_request()
        except socket.timeout:
            waited += 1
            continue
        except OSError:
            break
    server.server_close()

    status, msg = SERVER_STATE["result"] or ("error", "Unknown")
    if status == "ok":
        print()
        print("✅ トークンの取得が完了しました！")
        print()
        print("次のステップ:")
        print("1. Twitch 開発者コンソールでリダイレクト URL に http://localhost:8888 を追加してください")
        print("2. 開発サーバーを再起動してください")
        print("3. アプリケーションが正常に動作することを確認してください")
        print()
    else:
        print()
        print(f"❌ エラー: {msg}")
        print()
        sys.exit(1)


if __name__ == "__main__":
    main()
