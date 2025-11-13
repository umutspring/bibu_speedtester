import os
import sys
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json


PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "public")


class SpeedTestHandler(SimpleHTTPRequestHandler):
	# Use HTTP/1.1 to enable persistent connections (keep-alive)
	protocol_version = "HTTP/1.1"
	# Serve from PUBLIC_DIR by default
	def translate_path(self, path):
		# Map "/" to PUBLIC_DIR/index.html
		parsed = urllib.parse.urlparse(path)
		request_path = parsed.path
		if request_path == "/":
			request_path = "/index.html"
		# Prevent path traversal
		request_path = os.path.normpath(request_path.lstrip("/"))
		return os.path.join(PUBLIC_DIR, request_path)

	def do_GET(self):
		parsed = urllib.parse.urlparse(self.path)
		path = parsed.path
		query = urllib.parse.parse_qs(parsed.query)

		if path == "/ping":
			self._send_json({"message": "pong"})
			return

		if path == "/dw":
			# Return a stream of zero bytes with the requested Content-Length
			size_param = query.get("size", ["1000000"])[0]
			try:
				total_size = int(size_param)
			except ValueError:
				self.send_error(400, "Invalid size")
				return

			if total_size < 0:
				self.send_error(400, "Size must be non-negative")
				return

			chunk = b"\0" * (1024 * 1024)  # 1MB server-side chunk
			self.send_response(200)
			self.send_header("Content-Type", "application/octet-stream")
			self.send_header("Content-Length", str(total_size))
			self.send_header("Cache-Control", "no-store")
			self.send_header("Connection", "keep-alive")
			self.end_headers()

			bytes_sent = 0
			# Write in fixed-size chunks until total_size reached
			while bytes_sent < total_size:
				to_write = min(len(chunk), total_size - bytes_sent)
				self.wfile.write(chunk[:to_write])
				bytes_sent += to_write
			return

		# Fallback to static file serving from PUBLIC_DIR
		return SimpleHTTPRequestHandler.do_GET(self)

	def do_POST(self):
		parsed = urllib.parse.urlparse(self.path)
		path = parsed.path

		if path in ("/up", "/upload"):
			# Read and discard request body, report uploaded bytes
			content_length = self.headers.get("Content-Length")
			total_read = 0
			if content_length is not None:
				try:
					remaining = int(content_length)
				except ValueError:
					self.send_error(400, "Invalid Content-Length")
					return

				# Read exactly Content-Length bytes in chunks
				while remaining > 0:
					chunk = self.rfile.read(min(65536, remaining))
					if not chunk:
						break
					total_read += len(chunk)
					remaining -= len(chunk)
			else:
				# No Content-Length; read until client closes (not typical for fetch)
				while True:
					chunk = self.rfile.read(65536)
					if not chunk:
						break
					total_read += len(chunk)

			self._send_json({"uploaded_bytes": total_read})
			return

		self.send_error(404, "Not Found")

	def _send_json(self, payload, status=200):
		data = json.dumps(payload).encode("utf-8")
		self.send_response(status)
		self.send_header("Content-Type", "application/json; charset=utf-8")
		self.send_header("Content-Length", str(len(data)))
		self.send_header("Cache-Control", "no-store")
		self.send_header("Connection", "keep-alive")
		self.end_headers()
		self.wfile.write(data)


def run(host="0.0.0.0", port=8000):
	server_address = (host, port)
	httpd = ThreadingHTTPServer(server_address, SpeedTestHandler)
	print(f"SpeedTest server running at http://{host}:{port}")
	print(f"Serving static files from: {PUBLIC_DIR}")
	try:
		httpd.serve_forever()
	except KeyboardInterrupt:
		pass
	finally:
		httpd.server_close()


if __name__ == "__main__":
	# Allow optional port argument
	selected_port = 8000
	if len(sys.argv) > 1:
		try:
			selected_port = int(sys.argv[1])
		except ValueError:
			print("Usage: python server.py [port]")
			sys.exit(1)
	run(port=selected_port)


