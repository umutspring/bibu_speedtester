document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startButton");
    const pingEl = document.getElementById("pingResult");
    const downEl = document.getElementById("downloadResult");
    const upEl = document.getElementById("uploadResult");
    const statusEl = document.getElementById("status");

    const TEST_TIME = 10; // seconds
    const DL_THREADS = 6;
    const UL_THREADS = 6; //3

    const toMbps = (bytes, seconds) => (bytes * 8) / (seconds * 1e6);

    startBtn.onclick = async () => {
        startBtn.disabled = true;
        pingEl.textContent = downEl.textContent = upEl.textContent = "--";
        statusEl.textContent = "Testing...";

        try {
            const ping = await testPing();
            pingEl.textContent = ping.toFixed(1) + " ms";

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
        for (let i = 0; i < 5; i++) {
            const t0 = performance.now();
            await fetch("/api/ping?ts=" + Math.random(), { cache: "no-store" });
            times.push(performance.now() - t0);
        }
        return times.reduce((a, b) => a + b, 0) / times.length;
    }

	// -------------------------
	// ACCURATE DOWNLOAD (STREAM READER)
	// - Use long-running streams and abort exactly at TEST_TIME
	// -------------------------
	async function streamDownload(bytes, signal) {
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
				total += chunk.value.length;
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
			const bytes = await streamDownload(BIG_SIZE, c.signal);
			totalBytes += bytes;
		});

		// Abort precisely at TEST_TIME
		setTimeout(() => controllers.forEach(c => c.abort()), TEST_TIME * 1000);

		await Promise.allSettled(tasks);

		// Use the intended test window to avoid tail effects
		const elapsed = TEST_TIME;
		return toMbps(totalBytes, elapsed);
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

        await Promise.all(Array(UL_THREADS).fill(0).map(worker));

        const elapsed = (performance.now() - start) / 1000;
        return toMbps(total, elapsed);
    }
});
