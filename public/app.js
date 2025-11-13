document.addEventListener("DOMContentLoaded", () => {
	const startButton = document.getElementById("startButton");
	const pingResult = document.getElementById("pingResult");
	const downloadResult = document.getElementById("downloadResult");
	const uploadResult = document.getElementById("uploadResult");
	const downloadData = document.getElementById("downloadData");
	const uploadData = document.getElementById("uploadData");
	const statusDiv = document.getElementById("status");

	const TEST_DURATION_SEC = 15;
	const DOWNLOAD_THREADS = 10;
	const UPLOAD_THREADS = 8;
	const DOWNLOAD_CHUNK_BYTES = 8_000_000; // 8MB
	const UPLOAD_CHUNK_BYTES = 1_000_000; // 1MB

	function bytesToMbps(bytes, seconds) {
		if (seconds <= 0) return 0;
		return (bytes * 8) / (seconds * 1_000_000);
	}

	startButton.addEventListener("click", startSpeedTest);

	async function startSpeedTest() {
		startButton.disabled = true;
		statusDiv.textContent = "Test başlatılıyor...";
		pingResult.textContent = "--";
		downloadResult.textContent = "--";
		uploadResult.textContent = "--";
		downloadData.textContent = "";
		uploadData.textContent = "";

		try {
			await runPingTest();
			await runDownloadTest();
			await runUploadTest();
			statusDiv.textContent = "Test tamamlandı!";
		} catch (e) {
			statusDiv.textContent = "Hata oluştu.";
			console.error(e);
		} finally {
			startButton.disabled = false;
		}
	}

	async function runPingTest() {
		statusDiv.textContent = "Ping testi yapılıyor...";
		const attempts = 10;
		let times = [];
		for (let i = 0; i < attempts; i++) {
			const start = performance.now();
			try {
				const response = await fetch("/ping");
				if (!response.ok) throw new Error("Ping failed");
				await response.json();
				times.push(performance.now() - start);
			} catch {
				// lost packet, ignore
			}
		}
		if (times.length === 0) {
			pingResult.textContent = "Hata!";
			return;
		}
		const avg = times.reduce((a, b) => a + b, 0) / times.length;
		pingResult.textContent = `${avg.toFixed(2)} ms`;
	}

	async function runDownloadTest() {
		statusDiv.textContent = "İndirme testi (paralel) yapılıyor...";
		let totalBytes = 0;
		const startTime = performance.now();

		const worker = async () => {
			while ((performance.now() - startTime) / 1000 < TEST_DURATION_SEC) {
				const res = await fetch(`/dw?size=${DOWNLOAD_CHUNK_BYTES}`);
				if (!res.ok) break;
				const blob = await res.blob();
				totalBytes += blob.size;
				const elapsed = (performance.now() - startTime) / 1000;
				const mbps = bytesToMbps(totalBytes, elapsed);
				downloadResult.textContent = `${mbps.toFixed(2)} Mbps`;
				downloadData.textContent = `Data: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
			}
		};

		await Promise.all([...Array(DOWNLOAD_THREADS)].map(worker));

		const elapsed = (performance.now() - startTime) / 1000;
		const mbps = bytesToMbps(totalBytes, elapsed);
		downloadResult.textContent = `${mbps.toFixed(2)} Mbps`;
		downloadData.textContent = `Data: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	async function runUploadTest() {
		statusDiv.textContent = "Yükleme testi (paralel) yapılıyor...";
		let totalBytes = 0;
		const startTime = performance.now();
		const payload = new Uint8Array(UPLOAD_CHUNK_BYTES);

		const worker = async () => {
			while ((performance.now() - startTime) / 1000 < TEST_DURATION_SEC) {
				const res = await fetch("/up", {
					method: "POST",
					headers: {
						"Content-Type": "application/octet-stream"
					},
					body: payload
				});
				if (!res.ok) break;
				let uploaded = UPLOAD_CHUNK_BYTES;
				try {
					const data = await res.json();
					if (typeof data.uploaded_bytes === "number") {
						uploaded = data.uploaded_bytes;
					}
				} catch {
					// ignore parse error
				}
				totalBytes += uploaded;
				const elapsed = (performance.now() - startTime) / 1000;
				const mbps = bytesToMbps(totalBytes, elapsed);
				uploadResult.textContent = `${mbps.toFixed(2)} Mbps`;
				uploadData.textContent = `Data: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
			}
		};

		await Promise.all([...Array(UPLOAD_THREADS)].map(worker));

		const elapsed = (performance.now() - startTime) / 1000;
		const mbps = bytesToMbps(totalBytes, elapsed);
		uploadResult.textContent = `${mbps.toFixed(2)} Mbps`;
		uploadData.textContent = `Data: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
	}
});


