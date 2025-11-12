document.addEventListener('DOMContentLoaded', () => {
    // HTML elementleri
    const startButton = document.getElementById('startButton');
    const statusDiv = document.getElementById('status');
    const gaugeText = document.getElementById('gaugeText');
    const gaugeUnit = document.getElementById('gaugeUnit');
    const ctx = document.getElementById('speedGauge').getContext('2d');
    
    // Görünüm konteynerları
    const testView = document.getElementById('testView');
    const detailsView = document.getElementById('detailsView');
    const detailsContainer = document.getElementById('detailsContainer');
    const detailsButton = document.getElementById('detailsButton');
    const backButton = document.getElementById('backButton');
    const historyChartContainer = document.getElementById('historyChartContainer');
    const noHistoryMessage = document.getElementById('noHistoryMessage');

    // Sonuç elementleri
    const resultsElements = {
        ping: document.getElementById('pingResult'),
        jitter: document.getElementById('jitterResult'),
        packetLoss: document.getElementById('packetLossResult'),
        download: document.getElementById('downloadResult'),
        upload: document.getElementById('uploadResult'),
        downloadData: document.getElementById('downloadData'),
        uploadData: document.getElementById('uploadData'),
        downloadLatency: document.getElementById('downloadLatency'),
        uploadLatency: document.getElementById('uploadLatency'),
    };
    
    let gaugeChart;
    let historyChart;
    let pastResults = []; 

    const PING_TIMEOUT = 2000;
    const TEST_DURATION = 8000; // Stabil sabit test süresi (8 saniye)

    // --- YARDIMCI FONKSİYONLAR VE GRAFİK AYARLARI ---

    // Gösterge iğnesi eklentisi (Chart.js için zorunludur)
    const gaugeNeedle = { id: 'gaugeNeedle', afterDatasetDraw(chart) { const { ctx, data } = chart; ctx.save(); const needleValue = data.datasets[0].needleValue || 0; const maxSpeed = data.datasets[0].maxSpeed || 100; const angle = Math.PI + (Math.min(needleValue, maxSpeed) / maxSpeed) * Math.PI; const cx = chart.width / 2; const cy = chart.height; ctx.translate(cx, cy); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(chart.height - 15, 0); ctx.lineTo(0, 5); ctx.fillStyle = '#f0f0f0'; ctx.fill(); ctx.restore(); ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 10); ctx.fillStyle = '#f0f0f0'; ctx.fill(); ctx.restore(); } };
    
    // Göstergeyi oluşturan fonksiyon
    function createGauge(maxSpeed = 100) { 
        if (gaugeChart) { gaugeChart.destroy(); } 
        gaugeChart = new Chart(ctx, { type: 'doughnut', data: { datasets: [{ data: [1, 1, 1, 1, 1, 1, 1, 1], backgroundColor: ['rgba(0, 123, 255, 0.2)', 'rgba(0, 123, 255, 0.3)', 'rgba(0, 123, 255, 0.4)', 'rgba(0, 123, 255, 0.6)', 'rgba(255, 205, 86, 0.7)', 'rgba(255, 159, 64, 0.8)', 'rgba(255, 99, 132, 0.8)', 'rgba(255, 99, 132, 1)'], needleValue: 0, maxSpeed: maxSpeed, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, rotation: -90, circumference: 180, cutout: '70%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, animation: { duration: 0 } }, plugins: [gaugeNeedle] }); 
    }

    // Göstergeyi anlık güncelleyen fonksiyon
    function updateGauge(value) { 
        if (!gaugeChart) return; 
        let currentMax = gaugeChart.data.datasets[0].maxSpeed; 
        if (value > currentMax) { gaugeChart.data.datasets[0].maxSpeed = value * 1.2; } 
        gaugeChart.data.datasets[0].needleValue = value; 
        gaugeText.textContent = value.toFixed(2); 
        gaugeChart.update('none'); 
    }
    
    // Geçmiş grafiği oluşturma
    function createHistoryChart() {
        if (historyChart) { historyChart.destroy(); }
        
        if (pastResults.length === 0) {
            historyChartContainer.classList.add('hidden');
            noHistoryMessage.classList.remove('hidden');
            return;
        }

        historyChartContainer.classList.remove('hidden');
        noHistoryMessage.classList.add('hidden');
        
        const labels = pastResults.map(r => new Date(r.timestamp).toLocaleTimeString());
        const historyCtx = document.getElementById('historyChart').getContext('2d');
        historyChart = new Chart(historyCtx, {
            type: 'line',
            data: { labels: labels, datasets: [ { label: 'Download (Mbps)', data: pastResults.map(r => r.download_mbps), borderColor: 'rgba(0, 123, 255, 1)', backgroundColor: 'rgba(0, 123, 255, 0.1)', fill: true, tension: 0.3 }, { label: 'Upload (Mbps)', data: pastResults.map(r => r.upload_mbps), borderColor: 'rgba(0, 209, 178, 1)', backgroundColor: 'rgba(0, 209, 178, 0.1)', fill: true, tension: 0.3 }, { label: 'Ping (ms)', data: pastResults.map(r => r.ping_ms), borderColor: 'rgba(255, 99, 132, 1)', yAxisID: 'yPing', tension: 0.3 } ] },
            options: { responsive: true, plugins: { legend: { labels: { color: '#fff' } } }, scales: { y: { beginAtZero: true, ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } }, yPing: { position: 'right', beginAtZero: true, ticks: { color: 'rgba(255, 99, 132, 1)' }, grid: { drawOnChartArea: false } }, x: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } } } }
        });
    }

    // --- GÖRÜNÜM KONTROLÜ ---
    function showTestView() {
        detailsView.classList.add('hidden');
        testView.classList.remove('hidden');
        resultsContainer.classList.remove('hidden');
        statusDiv.classList.remove('hidden');
        if (resultsElements.ping.textContent !== '--') {
            detailsContainer.classList.remove('hidden');
        }
        createGauge();
    }
    
    function showDetailsView() {
        testView.classList.add('hidden');
        resultsContainer.classList.add('hidden'); 
        statusDiv.classList.add('hidden');
        detailsContainer.classList.add('hidden');
        detailsView.classList.remove('hidden');
        createHistoryChart();
    }

    // --- ANA TEST MANTIĞI ---
    async function startSpeedTest() {
        startButton.disabled = true;
        statusDiv.textContent = 'Starting test...';
        detailsContainer.classList.add('hidden');
        Object.values(resultsElements).forEach(el => { if (el) el.textContent = '--'; });
        createGauge(100);

        try {
            const { avgPing, jitter, packetLoss } = await runPingTest();
            const { downloadSpeed, avgDownloadLatency, downloadedMB } = await runDownloadTest();
            const { uploadSpeed, avgUploadLatency, uploadedMB } = await runUploadTest();
            
            resultsElements.downloadData.textContent = `Data: ${downloadedMB.toFixed(2)} MB`;
            resultsElements.uploadData.textContent = `Data: ${uploadedMB.toFixed(2)} MB`;
            
            // Yeni sonucu lokal listeye ekle
            const newResult = {
                timestamp: new Date().toISOString(),
                ping_ms: avgPing,
                download_mbps: downloadSpeed,
                upload_mbps: uploadSpeed
            };
            pastResults.push(newResult);
            if (pastResults.length > 10) { pastResults.shift(); }

            await saveResults({ avgPing, jitter, packetLoss, downloadSpeed, avgDownloadLatency, uploadSpeed, avgUploadLatency });
            statusDiv.textContent = 'Test Completed!';
            detailsContainer.classList.remove('hidden');
        } catch (error) {
            console.error('An error occurred during the test:', error);
            statusDiv.textContent = 'Error: Test could not be completed.';
        } finally {
            startButton.disabled = false;
        }
    }

    // --- PING TESTİ (Jitter/Loss dahil) ---
    async function runPingTest() {
        statusDiv.textContent = 'Measuring Latency & Jitter...';
        gaugeUnit.textContent = "ms";
        let pingTimes = []; let lostPackets = 0; const numPings = 10;
        for (let i = 0; i < numPings; i++) {
            const startTime = performance.now();
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);
                const response = await fetch('/ping/', { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!response.ok) throw new Error('Response not OK');
                await response.json();
                const rtt = performance.now() - startTime;
                pingTimes.push(rtt);
                updateGauge(rtt);
            } catch (error) { lostPackets++; console.error('Ping error or timeout'); }
        }
        if (pingTimes.length === 0) throw new Error("Ping test failed completely.");
        const avgPing = pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length;
        const jitter = Math.sqrt(pingTimes.map(t => Math.pow(t - avgPing, 2)).reduce((a, b) => a + b, 0) / pingTimes.length);
        const packetLoss = (lostPackets / numPings) * 100;
        resultsElements.ping.textContent = `${avgPing.toFixed(2)} ms`;
        resultsElements.jitter.textContent = `${jitter.toFixed(2)} ms`;
        resultsElements.packetLoss.textContent = `${packetLoss.toFixed(1)}%`;
        updateGauge(avgPing);
        return { avgPing: avgPing.toFixed(2), jitter: jitter.toFixed(2), packetLoss: packetLoss.toFixed(1) };
    }
    
    // --- DOWNLOAD TESTİ (XMLHttpRequest ile stabil) ---
    function runDownloadTest() {
        return new Promise((resolve, reject) => {
            statusDiv.textContent = 'Measuring Download Speed...';
            gaugeUnit.textContent = "Mbps";
            createGauge(100);

            const fileSizeMB = 50; 
            const totalSize = fileSizeMB * 1024 * 1024;
            let latencyChecks = [];
            const startTime = performance.now();

            const latencyCheckInterval = setInterval(async () => {
                try {
                    const pingStart = performance.now();
                    await fetch('/ping/');
                    latencyChecks.push(performance.now() - pingStart);
                } catch (e) {}
            }, 500);

            const xhr = new XMLHttpRequest();
            xhr.open('GET', `/download/?size=${fileSizeMB}`, true);

            xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                    const elapsedTime = (performance.now() - startTime) / 1000;
                    if (elapsedTime > 0) {
                        const speedMbps = (event.loaded * 8) / (elapsedTime * 1000000);
                        updateGauge(speedMbps);
                    }
                }
            };
            
            xhr.onload = () => {
                clearInterval(latencyCheckInterval);
                const totalTime = (performance.now() - startTime) / 1000;
                const finalDownloadedBytes = xhr.response.length;
                const finalSpeedMbps = (finalDownloadedBytes * 8) / (totalTime * 1000000);
                const avgDownloadLatency = latencyChecks.length > 0 ? latencyChecks.reduce((a, b) => a + b, 0) / latencyChecks.length : 0;
                
                resultsElements.download.textContent = `${finalSpeedMbps.toFixed(2)} Mbps`;
                resultsElements.downloadLatency.textContent = `Latency: ${avgDownloadLatency.toFixed(2)} ms`;
                updateGauge(finalSpeedMbps);
                
                resolve({ downloadSpeed: finalSpeedMbps.toFixed(2), avgDownloadLatency: avgDownloadLatency.toFixed(2), downloadedMB: finalDownloadedBytes / 1048576 });
            };

            xhr.onerror = () => {
                clearInterval(latencyCheckInterval);
                resultsElements.download.textContent = 'Error';
                reject(new Error('Download failed.'));
            };

            xhr.send();
        });
    }
    
    // --- UPLOAD TESTİ (XMLHttpRequest ile stabil) ---
    function runUploadTest() {
        return new Promise((resolve, reject) => {
            statusDiv.textContent = 'Measuring Upload Speed...';
            gaugeUnit.textContent = "Mbps";
            createGauge(100);
            let latencyChecks = [];
            const startTime = performance.now();
            
            const latencyCheckInterval = setInterval(async () => { try { const pingStart = performance.now(); await fetch('/ping/'); latencyChecks.push(performance.now() - pingStart); } catch (e) {} }, 500);

            const totalSize = 20 * 1024 * 1024;
            const dummyData = new Blob([new Uint8Array(totalSize)]);
            
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const elapsedTime = (performance.now() - startTime) / 1000;
                    if (elapsedTime > 0) {
                        const speedMbps = (event.loaded * 8) / (elapsedTime * 1000000);
                        updateGauge(speedMbps);
                    }
                }
            };
            
            xhr.onload = () => {
                clearInterval(latencyCheckInterval);
                const totalTime = (performance.now() - startTime) / 1000;
                const finalSpeedMbps = (dummyData.size * 8) / (totalTime * 1000000);
                const avgUploadLatency = latencyChecks.length > 0 ? latencyChecks.reduce((a, b) => a + b, 0) / latencyChecks.length : 0;
                resultsElements.upload.textContent = `${finalSpeedMbps.toFixed(2)} Mbps`;
                resultsElements.uploadLatency.textContent = `Latency: ${avgUploadLatency.toFixed(2)} ms`;
                updateGauge(finalSpeedMbps);
                resolve({ uploadSpeed: finalSpeedMbps.toFixed(2), avgUploadLatency: avgUploadLatency.toFixed(2), uploadedMB: dummyData.size / 1048576 });
            };

            xhr.onerror = () => {
                clearInterval(latencyCheckInterval);
                resultsElements.upload.textContent = 'Error';
                reject(new Error('Upload failed.'));
            };
            
            xhr.open('POST', '/upload/', true);
            xhr.send(dummyData);
        });
    }

    async function saveResults(results) {
        statusDiv.textContent = 'Saving results...';
        const testData = {
            ping_ms: results.avgPing, jitter_ms: results.jitter, packet_loss_percent: results.packetLoss,
            download_mbps: results.downloadSpeed, download_latency_ms: results.avgDownloadLatency,
            upload_mbps: results.uploadSpeed, upload_latency_ms: results.avgUploadLatency
        };
        try {
            await fetch('/save/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
            });
        } catch (error) { console.error("Network error while saving:", error); }
    }

    // Başlangıç ayarları ve olay dinleyicileri
    function initialize() {
        const historyDataElement = document.getElementById('past-results-data');
        if (historyDataElement && historyDataElement.textContent) {
            try {
                pastResults = JSON.parse(historyDataElement.textContent);
            } catch (e) {
                pastResults = [];
            }
        }
        createGauge();
        startButton.addEventListener('click', startSpeedTest);
        detailsButton.addEventListener('click', showDetailsView);
        backButton.addEventListener('click', showTestView);
    }
    
    initialize();
});