# speedtester/models.py
from django.db import models

class SpeedTestResult(models.Model):
    timestamp = models.DateTimeField(auto_now_add=True)
    ping_ms = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    download_mbps = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    upload_mbps = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    # YENİ ALANLAR
    jitter_ms = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    packet_loss_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    download_latency_ms = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    upload_latency_ms = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    
    client_ip = models.CharField(max_length=50, null=True, blank=True)

    def __str__(self):
        return f"Test @ {self.timestamp.strftime('%Y-%m-%d %H:%M')}"