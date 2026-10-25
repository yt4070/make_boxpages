"""ローカル開発用Webサーバー
静的HTML/JSをブラウザからBox APIと連携させるため、CORSエラーを回避するローカルオリジン (http://localhost:8000) を提供します。
"""
import http.server
import socketserver
import webbrowser

PORT = 8000
DIRECTORY = "."

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def start_server():
    # アドレスの即時再利用を許可
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"==================================================")
        print(f" Box メタデータビューア サーバー起動中")
        print(f" URL: {url}")
        print(f" 終了するには Ctrl + C を押してください")
        print(f"==================================================")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nサーバーを停止しました。")

if __name__ == "__main__":
    start_server()
