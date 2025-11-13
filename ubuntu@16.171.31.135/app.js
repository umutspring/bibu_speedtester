document.addEventListener("DOMContentLoaded", () => {
	const startBtn = document.getElementById("startButton");
	const pingEl = document.getElementById("pingResult");
	const downEl = document.getElementById("downloadResult");
	const upEl = document.getElementById("uploadResult");
	const statusEl = document.getElementById("status");
  
	const TEST_TIME = 10; // seconds
	const DL_THREADS = 4;
	const UL_THREADS = 3;
  
	const toMbps = (bytes, seconds) => (bytes * 8) / (seconds * 1e6);
  
	startBtn.onclick = async () => {
	  startBtn.disabled = true;
	  pingEl.textContent = downEl.textContent = upEl.textContent = "--";
	  statusEl.textContent = "Testing...";
  
	  try {
		const ping = await testPing();
		pingEl.textContent = ping.toFixed(1) + " ms";
  
		const dl = await testDownload();
		downEl.textContent = dl.toFixed(1) + " Mbps";
  
		const ul = await testUpload();
		upEl.textContent = ul.toFixed(1) + " Mbps";
  
		statusEl.textContent = "Done!";
	  } catch (err) {
		console.error(err);
		statusEl.textContent = "Error occurred!";
	  } finally {
		startBtn.disabled = false;
	  }
	};
  
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
  
	async function testDownload() {
	  statusEl.textContent = "Downloading...";
	  let total = 0;
	  const start = performance.now();
	  const worker = async () => {
		while ((performance.now() - start) / 1000 < TEST_TIME) {
		  const res = await fetch(`/api/download?bytes=1000000&nocache=${Math.random()}`);
		  const buf = await res.arrayBuffer();
		  total += buf.byteLength;
		}
	  };
	  await Promise.all(Array(DL_THREADS).fill(0).map(worker));
	  const elapsed = (performance.now() - start) / 1000;
	  return toMbps(total, elapsed);
	}
  
	async function testUpload() {
	  statusEl.textContent = "Uploading...";
	  const payload = new Uint8Array(512 * 1024);
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
  