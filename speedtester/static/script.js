console.log('script.js loaded and parsing...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired.');
    const startButton = document.getElementById('startButton');
    const pingResult = document.getElementById('pingResult');
    const downloadResult = document.getElementById('downloadResult');
    const uploadResult = document.getElementById('uploadResult');
    const downloadData = document.getElementById('downloadData');
    const uploadData = document.getElementById('uploadData');
    const statusDiv = document.getElementById('status');

    startButton.addEventListener('click', startSpeedTest);

    async function startSpeedTest() {
        console.log('startSpeedTest function called.');
        statusDiv.textContent = 'Test başlatılıyor...';
        startButton.disabled = true;

        await runPingTest();
        await runDownloadTest(); // Re-enable download test
        console.log('Calling runUploadTest...');
        await runUploadTest();

        statusDiv.textContent = 'Test tamamlandı!';
        startButton.disabled = false;
    }

    async function runPingTest() {
        statusDiv.textContent = 'Ping testi yapılıyor...';
        const startTime = new Date().getTime();
        try {
            const response = await fetch('/ping_test');
            const endTime = new Date().getTime();
            const rtt = endTime - startTime;
            pingResult.textContent = `${rtt} ms`;
        } catch (error) {
            pingResult.textContent = 'Hata!';
            console.error('Ping testi hatası:', error);
        }
    }

    async function runDownloadTest() {
        statusDiv.textContent = 'İndirme testi yapılıyor...';
        const fileSizeMB = 10; // Must match the server-side file_size_mb
        const url = `/download_test?size=${fileSizeMB}`; // Assuming the server can take size as a parameter
        const startTime = new Date().getTime();
        let downloadedBytes = 0;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                downloadedBytes += value.length;
            }

            const endTime = new Date().getTime();
            const duration = (endTime - startTime) / 1000; // seconds
            const speedMbps = (downloadedBytes * 8) / (duration * 1024 * 1024); // Mbps
            
            downloadResult.textContent = `${speedMbps.toFixed(2)} Mbps`;
            downloadData.textContent = `${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB`;

        } catch (error) {
            downloadResult.textContent = 'Hata!';
            downloadData.textContent = 'Hata!';
            console.error('İndirme testi hatası:', error);
        }
    }

    // Placeholder for upload test
    async function runUploadTest() {
        statusDiv.textContent = 'Yükleme testi yapılıyor...';
        const fileSizeKB = 100; // Yüklenecek dosya boyutu (KB) - daha küçük başlatalım
        const fileSizeB = fileSizeKB * 1024; // Byte olarak
        const dummyData = new Uint8Array(fileSizeB).fill(0); // Basit bir byte dizisi

        const url = '/upload/';
        const startTime = new Date().getTime();
        let uploadedBytes = 0;

        console.log('Attempting to send upload request...', { url, fileSizeKB });

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: dummyData,
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            uploadedBytes = data.uploaded_bytes || fileSizeB;

            const endTime = new Date().getTime();
            const duration = (endTime - startTime) / 1000; // seconds
            const speedMbps = (uploadedBytes * 8) / (duration * 1024 * 1024); // Mbps

            uploadResult.textContent = `${speedMbps.toFixed(2)} Mbps`;
            uploadData.textContent = `${(uploadedBytes / 1024).toFixed(2)} KB`;

        } catch (error) {
            uploadResult.textContent = 'Hata!';
            uploadData.textContent = 'Hata!';
            console.error('Yükleme testi hatası:', error);
        } finally {
            console.log('Upload request finished (either success or error).');
        }
    }
});
