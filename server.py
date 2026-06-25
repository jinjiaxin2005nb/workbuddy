#!/usr/bin/env python3
"""爱物理 - 力与运动仿真平台 本地静态服务器 (端口 3001)"""
import http.server
import socketserver
import os
import sys
from pathlib import Path

PORT = 3001
ROOT = Path(__file__).resolve().parent

EXTS = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in EXTS:
            return EXTS[ext]
        return super().guess_type(path)

    def log_message(self, fmt, *args):
        sys.stderr.write("[srv] " + (fmt % args) + "\n")


class ReuseServer(socketserver.TCPServer):
    allow_reuse_address = True


def main():
    os.chdir(str(ROOT))
    with ReuseServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"爱物理 力与运动仿真平台 已启动: http://localhost:{PORT}")
        print(f"静态根目录: {ROOT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n服务已停止")


if __name__ == "__main__":
    main()
