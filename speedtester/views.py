# speedtester/views.py
from django.shortcuts import render
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from decimal import Decimal, InvalidOperation
from .models import SpeedTestResult
import json

def index(request):
    # Veritabanından son 10 sonucu, en yeniden eskiye doğru çek
    past_results_qs = SpeedTestResult.objects.order_by('-timestamp')[:10]
    
    # Django QuerySet'i JSON formatına çevir
    # Not: reverse() ile en eski sonucun başta olmasını sağlıyoruz ki grafik doğru çizilsin
    results_list = list(past_results_qs.values('timestamp', 'download_mbps', 'upload_mbps', 'ping_ms'))[::-1]

    context = {
        'past_results_json': json.dumps(results_list, indent=4, default=str)
    }
    return render(request, 'speedtester/index.html', context)

def ping_test(request):
    return JsonResponse({'message': 'pong'})

def download_test(request):
    file_size_mb = int(request.GET.get('size', 100)) # Daha uzun testler için boyutu artır
    file_size_bytes = file_size_mb * 1024 * 1024
    chunk_size = 1024 * 64
    dummy_data_chunk = b'0' * chunk_size

    def file_iterator():
        bytes_sent = 0
        while bytes_sent < file_size_bytes:
            yield dummy_data_chunk
            bytes_sent += chunk_size

    response = StreamingHttpResponse(file_iterator(), content_type='application/octet-stream')
    response['Content-Disposition'] = f'attachment; filename="dummy_{file_size_mb}MB.bin"'
    response['Content-Length'] = file_size_bytes
    return response

@csrf_exempt
def upload_test(request):
    if request.method == 'POST':
        uploaded_bytes = len(request.body)
        return JsonResponse({'uploaded_bytes': uploaded_bytes})
    return JsonResponse({'error': 'Only POST requests are supported'}, status=405)

@csrf_exempt
def save_result(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            def to_decimal(value):
                if value in [None, '--', '']: return None
                return Decimal(value)

            SpeedTestResult.objects.create(
                ping_ms=to_decimal(data.get('ping_ms')),
                download_mbps=to_decimal(data.get('download_mbps')),
                upload_mbps=to_decimal(data.get('upload_mbps')),
                jitter_ms=to_decimal(data.get('jitter_ms')),
                packet_loss_percent=to_decimal(data.get('packet_loss_percent')),
                download_latency_ms=to_decimal(data.get('download_latency_ms')),
                upload_latency_ms=to_decimal(data.get('upload_latency_ms')),
            )
            return JsonResponse({'status': 'ok', 'message': 'Result saved successfully.'})
        
        except (InvalidOperation, json.JSONDecodeError) as e:
            return JsonResponse({'status': 'error', 'message': f'Invalid data: {str(e)}'}, status=400)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': f'Server Error: {str(e)}'}, status=500)

    return JsonResponse({'status': 'error', 'message': 'Only POST requests are accepted.'}, status=405)