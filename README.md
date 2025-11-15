## Speed Test

A self‑hosted network measurement tool with a modern, minimal UI. It performs time‑boxed download and upload tests, reports latency metrics, and shows live progress on a single semicircular gauge.

### Key Capabilities
- Download and upload throughput with live gauge updates
- Latency (ping), jitter, and packet loss estimation
- Live “Data used” counters for both directions
- Server and client IP details (server location exposed as “Frankfurt”)
- Zero external Python dependencies (standard library only)

## System Requirements

- OS: Windows 10/11, macOS 11+, or a recent Linux distribution
- Browser: Modern browser (Chrome, Edge, Firefox, or Safari)
- Dependencies: None (no build step, no package installs)

### Architecture
- Frontend: static single‑page app (`public/`) served directly by the backend
- Backend: lightweight Python HTTP server (`server.py`) exposing minimal test endpoints
- Client public IP fallback via `api.ipify.org` (frontend) when headers are not available

### Directory Layout
```
public/
  index.html      # App shell and markup
  style.css       # Styles and layout
  app.js          # Measurement logic and UI updates
server.py          # HTTP server and API endpoints (ThreadingHTTPServer)
requirements.txt   # (intentionally empty – no external deps)
```

## Usage (Hosted)

Use the hosted deployment:

- Open: https://bibu-speedtester.onrender.com
- Click “Start” to begin. The system runs for download first, then upload.
- Results appear in the results panel; “Data used” totals remain after the run.

If you need to self‑host in the future, the backend is a single Python file (`server.py`) and can be run locally; see Architecture for details.

## Measurement Methodology

- Download
  - Multiple long‑running HTTP fetch streams are opened concurrently and aborted after a fixed test window.
  - Throughput is computed as total received bytes divided by the intended window.
- Upload
  - Fixed‑size binary payloads are posted in a loop for the same window, summing total bytes sent.
- Ping, Jitter, Packet Loss
  - Several HTTP pings are issued; round‑trip times are recorded.
  - Jitter is the mean absolute difference between consecutive RTTs.
  - Timeouts count as packet loss.
- IP Information
  - Backend prefers a non‑loopback outward IP for the server and accepts forwarded client IP headers when present.
  - Frontend optionally queries `https://api.ipify.org?format=json` to display the public client IP.

## API Reference

- GET `/api/ping`
  - Returns: `{ "pong": true }`

- GET `/api/download?bytes=<N>`
  - Streams `<N>` bytes for throughput testing.

- POST `/api/upload`
  - Accepts arbitrary bytes; responds with `{ "received": <bytes> }`.

- GET `/api/info`
  - Returns: `{ "client_ip": "...", "server_ip": "...", "server_location": "Frankfurt" }`

All endpoints are intended for local or controlled environments; no authentication or rate limiting is implemented.

## Configuration

Frontend (`public/app.js`)
- `TEST_TIME` (seconds): duration of each phase (download/upload)
- `DL_THREADS`, `UL_THREADS`: parallelism for download/upload
- `GAUGE_MAX_MBPS`: gauge maximum (default 300 Mbps for better visual resolution)

Backend (`server.py`)
- `server_location`: exposed by `/api/info` (default “Frankfurt”)
- Port: pass as an argument, e.g. `python server.py 8000`

## Deployment Notes
- When running behind a reverse proxy or CDN, forward client IP headers (`X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`) for accurate client IP detection.
- The server attempts to determine a non‑loopback address for the server IP using an outbound UDP socket (fallback to bound address).

## Limitations
- Browser, CPU, NIC, OS network stack, and server throughput can limit observed speeds.
- Local runs may show loopback addresses; public IP resolution depends on environment and forwarding headers.
- Results are indicative measurements, not calibrated benchmarks.

## Roadmap (Ideas)
- Historical runs and charts
- Server selection and georouting


