## Speed Test

In this project, a speed testing application is implemented. The application presents a minimal UI, measures download and upload throughput, reports latency metrics (ping, jitter, packet loss), and visualizes live progress on a single semicircular gauge. Data usage and basic IP information (server and client) are also displayed; the server location is set to “Frankfurt”.

### Capabilities
- Live download and upload speed visualization on one gauge (download phase followed by upload phase)
- Ping, jitter, and packet loss metrics
- “Data used” indicators for both directions (values persist after the test)
- Server and client IP details (client public IP resolved via an ipify fallback when needed)
- No external Python dependencies

## System Requirements
- Modern operating system (Windows/macOS/Linux)
- Current web browser (Chrome, Edge, Firefox, Safari)
- No build step; no package installation required

### Project Structure
```
public/
  index.html    # Markup
  style.css     # Styles
  app.js        # Test logic and UI updates
server.py        # Minimal HTTP server and API endpoints
requirements.txt # Empty on purpose
```

## Usage (Hosted)
The hosted deployment is available at:
- https://bibu-speedtester.onrender.com
- Click “Start” to begin. The download phase runs first, then the upload phase.
- The gauge resets to 0 at the end; “Data used” totals remain visible.

For self‑hosting, the backend is a single Python file (`server.py`) and can be run locally if needed.

## Methodology (Summary)
- Download: multiple long‑running HTTP streams are opened in parallel and stopped after a fixed time window.
- Upload: fixed‑size binary payloads are posted repeatedly during the same window.
- Throughput is computed as total bytes divided by the intended test window.
- Ping/Jitter/Loss: multiple HTTP pings are issued; timeouts count as loss; jitter is the mean absolute difference between consecutive RTTs.
- IPs: the server reports a non‑loopback address when possible; the client public IP can be resolved via `https://api.ipify.org?format=json`.

## API Reference
- GET `/api/ping` → `{ "pong": true }`
- GET `/api/download?bytes=<N>` → streams `<N>` bytes
- POST `/api/upload` → `{ "received": <bytes> }`
- GET `/api/info` → `{ client_ip, server_ip, server_location }`

These endpoints are intended for local or controlled environments; no authentication or rate limiting is included.

## Configuration
`public/app.js`:
- `TEST_TIME` (seconds)
- `DL_THREADS`, `UL_THREADS`
- `GAUGE_MAX_MBPS` (default 300)

`server.py`:
- `server_location` (returned as “Frankfurt”)

## Notes
- Measured speeds depend on the browser, CPU, NIC, OS network stack, and server/network limits.
- Local runs may show loopback addresses; correct client IPs usually require forwarded headers from a proxy/CDN.
- The tool is intended for indicative measurements rather than laboratory‑grade benchmarking.

## Roadmap
- Historical runs and charts
- Server selection and georouting


