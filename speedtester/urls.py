# speedtester/urls.py

from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('ping/', views.ping_test, name='ping_test'),
    path('download/', views.download_test, name='download_test'),
    path('upload/', views.upload_test, name='upload_test'),
    path('save/', views.save_result, name='save_result'),
]