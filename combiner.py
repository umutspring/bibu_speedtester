import os

# Projenizin ana dizini (bu dosyanın bulunduğu yer)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# İçeriğini tek dosyaya eklemek istediğiniz kritik dosyalar
# NOT: 'venv', '__pycache__' ve 'migrations' klasörleri atlandı.
files_to_combine = [
    'manage.py',
    'README.md',
    'public/script.js',
    'public/style.css',
    'speedtester/admin.py',
    'speedtester/apps.py',
    'speedtester/models.py',
    'speedtester/urls.py',
    'speedtester/views.py',
    'speedtester/templates/speedtester/index.html',
    'speedtest_project_backend/settings.py',
    'speedtest_project_backend/urls.py',
    'speedtest_project_backend/asgi.py',
    'speedtest_project_backend/wsgi.py',
]

OUTPUT_FILE = 'combined_project_code.txt'

def combine_files(file_list, output_file):
    """Belirtilen dosyaların içeriğini tek bir dosyada birleştirir."""
    print(f"{len(file_list)} dosyanın içeriği birleştiriliyor...")
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        for relative_path in file_list:
            full_path = os.path.join(BASE_DIR, relative_path)
            
            # Dosya mevcut değilse atla
            if not os.path.exists(full_path):
                print(f"UYARI: Dosya bulunamadı ve atlandı: {relative_path}")
                continue

            try:
                with open(full_path, 'r', encoding='utf-8') as infile:
                    content = infile.read()
                
                # Başlık ve içeriği çıktı dosyasına yaz
                outfile.write('=' * 80 + '\n')
                outfile.write(f'DOSYA: {relative_path}\n')
                outfile.write('=' * 80 + '\n\n')
                outfile.write(content)
                outfile.write('\n\n')
                print(f"  -> Başarıyla eklendi: {relative_path}")

            except Exception as e:
                outfile.write(f'!!! HATA: {relative_path} dosyası okunamadı. Hata: {e} !!!\n\n')
                print(f"HATA: {relative_path} okunamadı: {e}")

    print('\n' + '=' * 80)
    print(f"Tüm dosyalar başarıyla '{output_file}' içine birleştirildi.")
    print('=' * 80)
    
if __name__ == "__main__":
    combine_files(files_to_combine, OUTPUT_FILE)