import os
import sys
import json
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

BASE_DIR = os.path.dirname(__file__)
PUBLIC_DIR = os.path.join(BASE_DIR, "public")

class SpeedServer(SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def translate_path(self, path):
        parsed = urllib.parse.urlparse(path)
        clean_path = parsed.path
        if clean_path == "/":
            clean_path = "/index.html"
        clean_path = os.path.normpath(clean_path.lstrip("/"))
        return os.path.join(PUBLIC_DIR, clean_path)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        if path == "/api/ping":
            self._json({"pong": True})
            return

        if path == "/api/download":
            size = int(params.get("bytes", ["5000000"])[0])
            chunk = b"0" * 65536
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(size))
            self.end_headers()
            sent = 0
            while sent < size:
                n = min(len(chunk), size - sent)
                self.wfile.write(chunk[:n])
                self.wfile.flush()  # important for streaming speed test
                sent += n
            return

        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/upload":
            total = 0
            while True:
                chunk = self.rfile.read(65536)
                if not chunk:
                    break
                total += len(chunk)
            self._json({"received": total})
            return
        self.send_error(404, "Not Found")

    def _json(self, obj):
        data = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

def run(port=8000):
    httpd = ThreadingHTTPServer(("0.0.0.0", port), SpeedServer)
    print(f"Server running at http://0.0.0.0:{port}")
    print(f"Serving static from {PUBLIC_DIR}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    run(port)
