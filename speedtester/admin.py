# speedtester/admin.py

from django.contrib import admin
from .models import SpeedTestResult

@admin.register(SpeedTestResult)
class SpeedTestResultAdmin(admin.ModelAdmin):
    # Admin arayüzünde gösterilecek alanlar
    list_display = ('timestamp', 'ping_ms', 'download_mbps', 'upload_mbps')
    # Filtreleme ve arama özellikleri
    list_filter = ('timestamp',)
    search_fields = ('client_ip',)