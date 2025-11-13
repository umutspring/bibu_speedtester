Speed Test (Stdlib + Parallel Fetch)
====================================

A minimal network speed tester built with only the Python standard library on the backend and a small static frontend. It uses parallel fetch workers and duration-based measurement to produce continuous download/upload speeds without any frameworks or databases.

Key Features
- Single-file backend: `server.py` (Python standard library)
  - GET `/ping` → health/latency probe (JSON)
  - GET `/dw?size=NUMBER` → streams `size` bytes (octet-stream)
  - POST `/up` → consumes uploaded bytes and returns `{ uploaded_bytes }`
  - Serves static assets from `public/`
- Frontend: `public/index.html` + `public/app.js`
  - Parallel download/upload workers
  - Duration-based measurement (continuous, not one-off)
  - Live UI updates (Mbps and total transferred)
- No Django, no DB, no extra dependencies
- HTTP/1.1 keep-alive enabled + large server chunks for better throughput

Project Structure
```
speedtest_project/
  public/
    index.html
    app.js
    style.css
  server.py
  README.md
```

Quick Start (Local)
1) Requirements: Python 3.9+
2) Run the server:
   - Windows PowerShell:
     ```
     python .\server.py 8000
     ```
   - macOS/Linux:
     ```
     python3 server.py 8000
     ```
3) Open `http://localhost:8000` and click START.

AWS EC2 Deployment (Simple)
1) Create an EC2 instance (Ubuntu 22.04 recommended). Inbound rules: open TCP 80 or a custom port (e.g., 8080) for testing.
2) Copy files to the instance (from your local machine):
   ```
   scp -i your-key.pem -r public server.py ubuntu@EC2_PUBLIC_IP:~/speedtest/
   ```
3) Start the backend:
   ```
   cd ~/speedtest
   python3 server.py 8080
   ```
   - Verify locally on the instance:
     ```
     curl -I http://127.0.0.1:8080/
     curl -sS http://127.0.0.1:8080/ping
     ```
4) Optional: serve on port 80 via Nginx reverse proxy
   - Install and configure:
     ```
     sudo apt update && sudo apt install -y nginx
     ```
     Edit `/etc/nginx/sites-available/speedtest_project` (or `default`), ensure:
     ```
     server {
       listen 80 default_server;
       listen [::]:80 default_server;
       location / {
         proxy_pass http://127.0.0.1:8080;
         proxy_http_version 1.1;
         proxy_set_header Connection "";
         proxy_set_header Host $host;
         proxy_set_header X-Real-IP $remote_addr;
         proxy_buffering off;
         proxy_request_buffering off;
         gzip off;
       }
     }
     ```
     Then:
     ```
     sudo nginx -t
     sudo systemctl restart nginx
     ```
   - Open `http://EC2_PUBLIC_IP/`

Optional: systemd Service
Create `/etc/systemd/system/speedtest.service`:
```
[Unit]
Description=SpeedTest Server (stdlib)
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/speedtest
ExecStart=/usr/bin/python3 /home/ubuntu/speedtest/server.py 8080
Restart=always
User=ubuntu

[Install]
WantedBy=multi-user.target
```
Then:
```
sudo systemctl daemon-reload
sudo systemctl enable --now speedtest
sudo systemctl status speedtest --no-pager -l
```

Frontend Tuning
Update these constants in `public/app.js` to tune test intensity and duration:
```
const TEST_DURATION_SEC  = 15;       // total time per phase
const DOWNLOAD_THREADS   = 10;       // parallel download workers
const UPLOAD_THREADS     = 8;        // parallel upload workers
const DOWNLOAD_CHUNK_BYTES = 8_000_000; // bytes per download request
const UPLOAD_CHUNK_BYTES   = 1_000_000; // bytes per upload request
```

Backend Details
- `server.py` uses `ThreadingHTTPServer` and `SimpleHTTPRequestHandler`:
  - `protocol_version = "HTTP/1.1"` for persistent connections
  - `/dw` sets `Content-Length` and writes data in 1MB chunks
  - `/up` reads request body (binary), returns uploaded byte count
- Static files are served from `public/` (e.g., `/index.html`).

Why parallel fetch?
- Single-shot tests often measure latency plus setup overheads (TCP slow start), leading to unstable or low readings.
- Multiple concurrent workers over a fixed duration better saturate the link and stabilize the measured throughput.

Security and Git Hygiene
- No secrets needed. Do not commit private keys.
- Suggested `.gitignore` entries:
  ```
  venv/
  __pycache__/
  *.log
  *.pem
  db.sqlite3
  ```

Troubleshooting
- 502 Bad Gateway behind Nginx: ensure Nginx proxies to the correct port (8080) and that the backend is listening.
- Verify backend health on the instance:
  ```
  ss -ltnp | grep :8080
  curl -I http://127.0.0.1:8080/
  curl -sS http://127.0.0.1:8080/ping
  ```
- If you test directly via Nginx:
  ```
  curl -I http://127.0.0.1/
  curl -sS http://127.0.0.1/ping
  sudo tail -n 50 /var/log/nginx/error.log
  ```

License
This project is provided as-is without warranty. Add your preferred license here.


