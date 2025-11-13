Speed Test (Simplified)
=======================

Bu proje, standart kütüphaneler dışında ek bir paket kullanmadan paralel (multi-threaded) istemci ölçümü yapabilen sade bir hız testi sunucusu ve arayüzü içerir.

Neler değişti?
- Django ve veritabanına bağlı karmaşık mimari devre dışı bırakıldı.
- Basit bir Python HTTP sunucusu (`server.py`) ile:
  - GET `/ping` (latency ölçümü)
  - GET `/dw?size=1000000` (indirilebilir sahte veri)
  - POST `/up` (yükeleme verisini okuyup atar)
  - `public/` altından statik dosyalar servis edilir.
- Ön yüz `public/app.js` ile paralel fetch işçileri kullanarak süre bazlı sürekli ölçüm yapar.

Çalıştırma
1) Python 3.9+ yüklü olmalı.
2) Proje dizininde şu komutu çalıştırın:
   - Windows PowerShell:
     `python .\server.py 8000`
   - Bash:
     `python server.py 8000`
3) Tarayıcıdan `http://localhost:8000` adresine gidin ve BAŞLAT'a basın.

Notlar
- İndirmenin süre bazlı ve paralel ölçümü için `DOWNLOAD_THREADS`, `TEST_DURATION_SEC` ve `DOWNLOAD_CHUNK_BYTES` değerlerini `public/app.js` içinde ayarlayabilirsiniz. Yükleme için benzer parametreler mevcuttur.
- Django dosyaları proje içinde duruyor ama artık kullanılmıyor. İstenirse tamamen kaldırılabilir.


