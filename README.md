# Speed Test

A lightweight, self-hosted internet speed test with a modern UI. It measures:

- Download and Upload throughput (live gauge updates)
- Ping latency, Jitter, and Packet Loss
- Data used during Download/Upload (live)
- Server and Client IP info (server location set to “Frankfurt”)

The frontend is a single-page app served by a minimal Python HTTP server (standard library only).

## Features

- Single semicircular gauge that live-updates for download, then upload
- Live “Data used: …” indicators for both download and upload
- Ping test with jitter and packet loss estimation
- Server/Client info row (compact). Client public IP is resolved via `api.ipify.org` as a fallback
- Gauge max set to 300 Mbps by default for better visual range

## Project Structure

```
public/
  index.html   # UI markup
  style.css    # Styling
  app.js       # Test logic and UI updates
server.py       # Python HTTP server with simple API endpoints
requirements.txt
```

## Quick Start

Prerequisites:
- Python 3.8+
- No third-party dependencies (uses standard library)

Run the server (Windows PowerShell or any shell):

```bash
python server.py 8000
```

Then open the app in your browser:

```text
http://localhost:8000
```

Click “Start” to run the test. The gauge will animate during download, then upload. Results are shown in the result boxes.

## How It Works

- Download: The frontend opens multiple long-running fetch streams and aborts them after a fixed test window. Throughput is computed as total bytes / elapsed time.
- Upload: The frontend posts fixed-size binary payloads in a loop for the test window and sums bytes sent.
- Ping/Jitter/Loss: Multiple HTTP pings are issued; jitter is computed as the mean absolute difference between consecutive RTTs; timeouts count toward packet loss.
- Server/Client Info: The backend reports server IP (preferring a non-loopback address) and the client IP (using headers when available). The frontend also calls `https://api.ipify.org?format=json` to display the public client IP.

## API Endpoints

- `GET /api/ping` → `{ "pong": true }`
- `GET /api/download?bytes=<N>` → streams `<N>` bytes
- `POST /api/upload` → echoes `{ "received": <bytes> }`
- `GET /api/info` → `{ client_ip, server_ip, server_location }` (location set to “Frankfurt”)

All endpoints are intended for local testing and are not authenticated.

## Configuration

Frontend (`public/app.js`):
- `TEST_TIME` (seconds) — length of each test phase
- `DL_THREADS`, `UL_THREADS` — concurrency for download/upload
- `GAUGE_MAX_MBPS` — gauge maximum (default 300)

Backend (`server.py`):
- `server_location` — returned as “Frankfurt” in `/api/info`

## Notes and Limitations

- Browser, CPU, network stack, and server limits can affect measured throughput.
- Running locally often shows `127.0.0.1` for server/client. The server attempts to resolve a non-loopback IP, and the frontend fetches a public client IP via ipify.
- If you deploy behind a reverse proxy/CDN, forward client IP headers (e.g., `X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`) to improve client IP detection.
- Results are indicative, not a calibrated benchmark.

## Customization Ideas

- Make the gauge max dynamic (e.g., 1.25× the measured peak)
- Add historical results and charts
- Add server selection and geo routing


