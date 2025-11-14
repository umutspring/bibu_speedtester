document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("startButton");
    const pingEl = document.getElementById("pingResult");
    const downEl = document.getElementById("downloadResult");
    const upEl = document.getElementById("uploadResult");
    const statusEl = document.getElementById("status");

    const TEST_TIME = 10; // seconds
    const DL_THREADS = 6; //4
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
    // -------------------------
    async function streamDownload(bytes) {
        let total = 0;
        const res = await fetch(`/api/download?bytes=${bytes}&rand=${Math.random()}`, {
            cache: "no-store"
        });
        const reader = res.body.getReader();

        while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            total += chunk.value.length;
        }
        return total;
    }

    async function testDownloadAccurate() {
        statusEl.textContent = "Downloading...";

        let totalBytes = 0;
        const start = performance.now();

        const worker = async () => {
            while ((performance.now() - start) / 1000 < TEST_TIME) {
                totalBytes += await streamDownload(20_000_000); // 20 MB chunk
            }
        };

        await Promise.all(Array(DL_THREADS).fill(0).map(worker));

        const elapsed = (performance.now() - start) / 1000;
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
