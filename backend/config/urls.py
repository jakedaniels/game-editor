"""Root URL configuration. The Django Ninja API is mounted under /api/."""
from django.contrib import admin
from django.urls import path

from api.api import api

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
