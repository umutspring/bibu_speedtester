import os
import sys
import json
import urllib.parse
import socket
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

        if path == "/api/info":
            # Derive client IP (prefer proxy headers if present)
            client_ip = ""
            try:
                xff = self.headers.get("X-Forwarded-For")
                xri = self.headers.get("X-Real-IP")
                cfc = self.headers.get("CF-Connecting-IP")
                if xff:
                    client_ip = xff.split(",")[0].strip()
                elif xri:
                    client_ip = xri.strip()
                elif cfc:
                    client_ip = cfc.strip()
                else:
                    client_ip = self.client_address[0]
            except Exception:
                client_ip = ""

            # Derive server outward IP (avoid loopback if possible)
            server_ip = ""
            try:
                server_ip = self.connection.getsockname()[0]
            except Exception:
                server_ip = ""
            try:
                # Attempt to get the outward-facing IP (LAN/public) via UDP trick
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                try:
                    s.connect(("8.8.8.8", 80))
                    outbound_ip = s.getsockname()[0]
                    if outbound_ip and outbound_ip != "127.0.0.1":
                        server_ip = outbound_ip
                finally:
                    s.close()
            except Exception:
                pass
            self._json({
                "client_ip": client_ip,
                "server_ip": server_ip,
                "server_location": "Frankfurt"
            })
            return

        if path == "/api/download":
            size = int(params.get("bytes", ["5000000"])[0])
            chunk = b"0" * (4 * 1024 * 1024)
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Connection", "keep-alive")
            self.send_header("Content-Length", str(size))
            self.end_headers()
            # Disable Nagle's algorithm to reduce latency for streaming writes
            try:
                self.connection.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            except Exception:
                pass
            sent = 0
            while sent < size:
                n = min(len(chunk), size - sent)
                self.wfile.write(chunk[:n])
                self.wfile.flush()  # ensure chunks are pushed promptly
                sent += n
            return

        return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
    	parsed = urllib.parse.urlparse(self.path)
    	if parsed.path == "/api/upload":
            length = int(self.headers.get("Content-Length", 0))
            data = self.rfile.read(length) if length > 0 else b""
            total = len(data)
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
