document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startButton");
    const pingEl = document.getElementById("pingResult");
    const downEl = document.getElementById("downloadResult");
    const upEl = document.getElementById("uploadResult");
    const jitterEl = document.getElementById("jitterResult");
    const lossEl = document.getElementById("lossResult");
    const statusEl = document.getElementById("status");

		// Gauge elements 
		const gaugeArc = document.getElementById("gaugeArc");
		const gaugeValue = document.getElementById("gaugeValue");

    // Gauge helpers
    const GAUGE_MAX_MBPS = 1000; // scale up to 1000 Mbps
		let gaugeLen = 0;
    function initGauge(arc) {
        if (!arc) return 0;
        const len = arc.getTotalLength();
        arc.style.strokeDasharray = `${len} ${len}`;
        arc.style.strokeDashoffset = `${len}`;
        return len;
    }
    function setGauge(arc, arcLen, valueMbps, maxMbps = GAUGE_MAX_MBPS) {
        if (!arc) return;
        const v = Math.max(0, Math.min(valueMbps || 0, maxMbps));
        const f = v / maxMbps;
        arc.style.strokeDashoffset = String(arcLen * (1 - f));
    }

    const TEST_TIME = 10; // seconds
    const DL_THREADS = 6;
    const UL_THREADS = 6; //3

    const toMbps = (bytes, seconds) => (bytes * 8) / (seconds * 1e6);

    startBtn.onclick = async () => {
        startBtn.disabled = true;
        pingEl.textContent = downEl.textContent = upEl.textContent = "--";
        jitterEl.textContent = lossEl.textContent = "--";
        statusEl.textContent = "Testing...";

        // Initialize gauges
			gaugeLen = initGauge(gaugeArc);
			setGauge(gaugeArc, gaugeLen, 0);
			if (gaugeValue) gaugeValue.textContent = "0.0";

        try {
            const pingRes = await testPing();
            pingEl.textContent = pingRes.avg.toFixed(1) + " ms";
            jitterEl.textContent = pingRes.jitter.toFixed(1) + " ms";
            lossEl.textContent = pingRes.loss.toFixed(1) + " %";

            const dl = await testDownloadAccurate();
            downEl.textContent = dl.toFixed(1) + " Mbps";

            const ul = await testUploadAccurate();
            upEl.textContent = ul.toFixed(1) + " Mbps";

            statusEl.textContent = "Done!";
        } catch (err) {
            console.error(err);
            statusEl.textContent = "Error occurred!";
        } finally {
            startBtn.disabled = false;
        }
    };

    // -------------------------
    // PING TEST
    // -------------------------
    async function testPing() {
        statusEl.textContent = "Pinging...";
        const times = [];
        let sent = 0;
        let lost = 0;
        const ATTEMPTS = 20;
        const TIMEOUT_MS = 1200;
        for (let i = 0; i < ATTEMPTS; i++) {
            sent++;
            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
            const t0 = performance.now();
            try {
                await fetch("/api/ping?ts=" + Math.random(), { cache: "no-store", signal: ctrl.signal });
                times.push(performance.now() - t0);
            } catch (e) {
                // count timeouts as loss
                lost++;
            } finally {
                clearTimeout(timeoutId);
            }
        }
        const received = times.length;
        const avg = received ? times.reduce((a, b) => a + b, 0) / received : 0;
        let jitter = 0;
        if (times.length >= 2) {
            let sumAbsDiff = 0;
            for (let i = 1; i < times.length; i++) {
                sumAbsDiff += Math.abs(times[i] - times[i - 1]);
            }
            jitter = sumAbsDiff / (times.length - 1);
        }
        const loss = sent ? ((sent - received) / sent) * 100 : 0;
        return { avg, jitter, loss };
    }

	// -------------------------
	// ACCURATE DOWNLOAD (STREAM READER)
	// - Use long-running streams and abort exactly at TEST_TIME
	// -------------------------
	async function streamDownload(bytes, signal, onProgress) {
		let total = 0;
		try {
			const res = await fetch(`/api/download?bytes=${bytes}&rand=${Math.random()}`, {
				cache: "no-store",
				signal
			});
			const reader = res.body.getReader();
			while (true) {
				const chunk = await reader.read();
				if (chunk.done) break;
				const n = chunk.value.length;
				total += n;
				if (onProgress) onProgress(n);
			}
		} catch (e) {
			// Swallow abort errors; rethrow others
			if (!(e && e.name === "AbortError")) {
				throw e;
			}
		}
		return total;
	}

	async function testDownloadAccurate() {
		statusEl.textContent = "Downloading...";

		let totalBytes = 0;
		const start = performance.now();

		// Create one long-running stream per thread and abort at TEST_TIME
		const controllers = Array.from({ length: DL_THREADS }, () => new AbortController());
		const BIG_SIZE = 1_000_000_000; // 1 GB per stream, will be aborted

		const tasks = controllers.map(async (c) => {
			await streamDownload(BIG_SIZE, c.signal, (n) => {
				totalBytes += n;
			});
		});

		// Abort precisely at TEST_TIME
		setTimeout(() => controllers.forEach(c => c.abort()), TEST_TIME * 1000);

        // Live update gauge
        const uiTimer = setInterval(() => {
            const elapsed = Math.max(0.001, (performance.now() - start) / 1000);
            const mbps = toMbps(totalBytes, elapsed);
				if (gaugeValue) gaugeValue.textContent = mbps.toFixed(1);
				setGauge(gaugeArc, gaugeLen, mbps);
        }, 200);

		await Promise.allSettled(tasks);

		// Use the intended test window to avoid tail effects
		const elapsed = TEST_TIME;
        const mbps = toMbps(totalBytes, elapsed);
        clearInterval(uiTimer);
			if (gaugeValue) gaugeValue.textContent = mbps.toFixed(1);
			setGauge(gaugeArc, gaugeLen, mbps);
		return mbps;
	}

    // -------------------------
    // ACCURATE UPLOAD
    // -------------------------
    async function testUploadAccurate() {
        statusEl.textContent = "Uploading...";

        const payload = new Uint8Array(800 * 1024); // 800 KB
        let total = 0;

        const start = performance.now();

        const worker = async () => {
            while ((performance.now() - start) / 1000 < TEST_TIME) {
                await fetch(`/api/upload?nocache=${Math.random()}`, {
                    method: "POST",
                    body: payload,
                });
                total += payload.length;
            }
        };

        // Live update gauge
        const uiTimer = setInterval(() => {
            const elapsed = Math.max(0.001, (performance.now() - start) / 1000);
            const mbps = toMbps(total, elapsed);
				if (gaugeValue) gaugeValue.textContent = mbps.toFixed(1);
				setGauge(gaugeArc, gaugeLen, mbps);
        }, 200);

        await Promise.all(Array(UL_THREADS).fill(0).map(worker));

        const elapsed = (performance.now() - start) / 1000;
        const mbps = toMbps(total, elapsed);
        clearInterval(uiTimer);
			if (gaugeValue) gaugeValue.textContent = mbps.toFixed(1);
			setGauge(gaugeArc, gaugeLen, mbps);
        return mbps;
    }
});
