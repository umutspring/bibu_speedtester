document.addEventListener("DOMContentLoaded", () => {
	const startButton = document.getElementById("startButton");
	const pingResult = document.getElementById("pingResult");
	const downloadResult = document.getElementById("downloadResult");
	const uploadResult = document.getElementById("uploadResult");
	const downloadData = document.getElementById("downloadData");
	const uploadData = document.getElementById("uploadData");
	const statusDiv = document.getElementById("status");

	// sensible defaults (configurable)
	const TEST_DURATION_SEC = 12;            // per phase
	const DOWNLOAD_THREADS = 4;              // parallel download streams
	const UPLOAD_THREADS = 3;                // parallel upload streams
	const DOWNLOAD_CHUNK_BYTES = 1_000_000;  // 1 MB per request (requested size)
	const UPLOAD_CHUNK_BYTES = 1_000_000;    // 1 MB upload chunk

	// utility
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

	// ----------------------------
	// Ping test (unchanged logic but clearer error handling)
	// ----------------------------
	async function runPingTest() {
		statusDiv.textContent = "Ping testi yapılıyor...";
		const attempts = 10;
		let times = [];
		for (let i = 0; i < attempts; i++) {
			const start = performance.now();
			try {
				const response = await fetch("/ping", { cache: "no-store" });
				if (!response.ok) throw new Error("Ping failed");
				// server returns JSON {"message":"pong"} — parsing is optional
				await response.json();
				times.push(performance.now() - start);
			} catch {
				// failed ping -> treat as dropped packet
			}
			await new Promise(r => setTimeout(r, 120)); // slight spacing
		}
		if (times.length === 0) {
			pingResult.textContent = "Hata!";
			return;
		}
		// compute average
		const avg = times.reduce((a, b) => a + b, 0) / times.length;
		// compute jitter (std dev of RTT)
		let jitter = 0;
		if (times.length > 1) {
			const mean = avg;
			const sumsq = times.map(t => (t - mean) ** 2).reduce((a, b) => a + b, 0);
			jitter = Math.sqrt(sumsq / (times.length - 1));
		}
		pingResult.textContent = `${avg.toFixed(2)} ms`;
		// show jitter in the subtext under ping box if desired (not part of UI fields here)
		// but we can append to downloadData for debugging:
		downloadData.textContent = `Jitter: ${jitter.toFixed(2)} ms`;
	}

	// ----------------------------
	// Download test (streaming reader)
	// ----------------------------
	async function runDownloadTest() {
		statusDiv.textContent = "İndirme testi (paralel) yapılıyor...";
		let totalBytes = 0;
		const startTime = performance.now();

		// update UI at intervals (so the UI updates smoothly)
		let lastUpdate = performance.now();
		const updateIntervalMs = 200;

		// worker uses streaming reader if available
		const worker = async (workerId) => {
			// We'll request a reasonably sized transfer each iteration.
			while ((performance.now() - startTime) / 1000 < TEST_DURATION_SEC) {
				const url = `/dw?size=${DOWNLOAD_CHUNK_BYTES}`;
				try {
					const res = await fetch(url, { cache: "no-store" });
					if (!res.ok) break;

					// stream if possible
					if (res.body && res.body.getReader) {
						const reader = res.body.getReader();
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							if (value) {
								totalBytes += value.byteLength;
								const now = performance.now();
								if (now - lastUpdate >= updateIntervalMs) {
									const elapsed = (now - startTime) / 1000;
									const mbps = bytesToMbps(totalBytes, elapsed);
									downloadResult.textContent = `${mbps.toFixed(2)} Mbps`;
									downloadData.textContent = `Data: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
									lastUpdate = now;
								}
							}
						}
					} else {
						// fallback: blob (older environments). This is less incremental.
						const blob = await res.blob();
						totalBytes += blob.size;
						const now = performance.now();
						const elapsed = (now - startTime) / 1000;
						const mbps = bytesToMbps(totalBytes, elapsed);
						downloadResult.textContent = `${mbps.toFixed(2)} Mbps`;
						downloadData.textContent = `Data: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
					}
				} catch (err) {
					// single stream error: break loop or continue (we continue)
					console.warn("download worker error", err);
					await new Promise(r => setTimeout(r, 100)); // small backoff
				}
			}
		};

		// launch parallel workers
		await Promise.all([...Array(DOWNLOAD_THREADS)].map((_, i) => worker(i)));

		// finalize
		const elapsed = (performance.now() - startTime) / 1000;
		const mbps = bytesToMbps(totalBytes, elapsed);
		downloadResult.textContent = `${mbps.toFixed(2)} Mbps`;
		downloadData.textContent = `Data: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
		return mbps;
	}

	// ----------------------------
	// Upload test (XMLHttpRequest with upload.onprogress)
	// ----------------------------
	async function runUploadTest() {
		statusDiv.textContent = "Yükleme testi (paralel) yapılıyor...";
		let totalUploaded = 0;
		const startTime = performance.now();
		const durationMs = TEST_DURATION_SEC * 1000;

		// per-worker that repeatedly sends the payload using XHR to capture upload progress
		const uploaderWorker = (id) => {
			return new Promise((resolve) => {
				const payload = new Uint8Array(UPLOAD_CHUNK_BYTES);
				let running = true;

				async function loopSend() {
					if (!running) return resolve();
					const xhr = new XMLHttpRequest();
					xhr.open("POST", "/up?nocache=" + Math.random(), true);
					xhr.responseType = "json";

					let prev = 0;
					xhr.upload.onprogress = (ev) => {
						// ev.loaded is cumulative for this request
						const diff = ev.loaded - prev;
						if (diff > 0) {
							totalUploaded += diff;
							prev = ev.loaded;
						}
						// update simple UI frequently
						const elapsedNow = (performance.now() - startTime) / 1000;
						const mbpsNow = bytesToMbps(totalUploaded, Math.max(0.001, elapsedNow));
						uploadResult.textContent = `${mbpsNow.toFixed(2)} Mbps`;
						uploadData.textContent = `Data: ${(totalUploaded / (1024 * 1024)).toFixed(2)} MB`;
					};

					xhr.onload = () => {
						// ensure if server reports uploaded bytes, trust it for final correctness
						try {
							const json = xhr.response;
							if (json && typeof json.uploaded_bytes === "number") {
								// server echo can be used to reconcile (but we've been counting via onprogress)
							}
						} catch (e) { /* ignore */ }

						// if time not up, schedule next send
						if ((performance.now() - startTime) < durationMs) {
							setTimeout(loopSend, 25);
						} else {
							running = false;
							return resolve();
						}
					};

					xhr.onerror = () => {
						// on error, small delay then continue until time up
						if ((performance.now() - startTime) < durationMs) {
							setTimeout(loopSend, 200);
						} else {
							running = false;
							return resolve();
						}
					};

					try {
						xhr.setRequestHeader("Content-Type", "application/octet-stream");
						xhr.send(payload);
					} catch (e) {
						// if sending fails, try again a bit later
						if ((performance.now() - startTime) < durationMs) {
							setTimeout(loopSend, 200);
						} else {
							running = false;
							return resolve();
						}
					}
				} // loopSend

				loopSend();
			}); // Promise
		}; // uploaderWorker

		// start N uploaders
		await Promise.all([...Array(UPLOAD_THREADS)].map((_, i) => uploaderWorker(i)));

		// finalize
		const elapsed = (performance.now() - startTime) / 1000;
		const mbps = bytesToMbps(totalUploaded, elapsed);
		uploadResult.textContent = `${mbps.toFixed(2)} Mbps`;
		uploadData.textContent = `Data: ${(totalUploaded / (1024 * 1024)).toFixed(2)} MB`;
		return mbps;
	}
});