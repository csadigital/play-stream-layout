# SportStream Backend

Türkçe spor kanalları için M3U8 proxy backend sistemi.

## 🚀 Hızlı Başlangıç

### Otomatik Kurulum (Önerilen)

```bash
# Kurulum scriptini çalıştır
sudo bash setup.sh

# Test et
curl http://localhost/test.php
```

### Manuel Kurulum

#### 1. Gereksinimler
- PHP 8.1+
- Nginx veya Apache
- cURL extension
- JSON extension
- mbstring extension

#### 2. Dosyaları Kopyala
```bash
# Web dizinine kopyala
sudo cp -r backend/* /var/www/html/sportstream/
sudo chown -R www-data:www-data /var/www/html/sportstream/
sudo chmod -R 755 /var/www/html/sportstream/
sudo chmod -R 777 /var/www/html/sportstream/cache/
sudo chmod -R 777 /var/www/html/sportstream/logs/
```

#### 3. Nginx Konfigürasyonu
```nginx
server {
    listen 80;
    server_name localhost;
    root /var/www/html/sportstream;
    index index.php;
    
    # CORS headers
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, X-Requested-With" always;
    
    # API routes
    location ~ ^/api/(channels|proxy)/?$ {
        try_files $uri /$1.php$is_args$args;
    }
    
    # Stream proxy
    location ~ ^/stream/(.*)$ {
        try_files $uri /proxy.php?action=proxy&url=$1;
    }
    
    # PHP handling
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_read_timeout 300;
    }
}
```

#### 4. PHP Konfigürasyonu
```ini
; /etc/php/8.1/fpm/pool.d/sportstream.conf
[sportstream]
user = www-data
group = www-data
listen = /var/run/php/php8.1-fpm-sportstream.sock

pm = dynamic
pm.max_children = 20
pm.start_servers = 5

php_admin_value[memory_limit] = 256M
php_admin_value[max_execution_time] = 0
php_admin_value[max_input_time] = 300
```

## 📡 API Endpoints

### 1. Kanal Listesi
```
GET /api/channels
```

**Response:**
```json
{
  "success": true,
  "count": 25,
  "channels": [
    {
      "id": 1,
      "name": "beIN Sports 1 HD",
      "number": 1,
      "url": "http://stream-url.m3u8",
      "group": "Spor",
      "logo": "https://logo-url.png",
      "viewers": 25000,
      "status": "live",
      "quality": "HD",
      "description": "beIN Sports 1 canlı spor yayını"
    }
  ],
  "timestamp": 1234567890,
  "cached": false
}
```

### 2. Stream Proxy
```
GET /api/proxy?url=<stream_url>
GET /stream/<stream_url>
```

**Desteklenen Formatlar:**
- M3U8 playlists
- TS segments
- Direct stream URLs

### 3. Test Endpoint
```
GET /test.php
```

**Response:**
```json
{
  "status": "OK",
  "message": "SportStream Backend is running",
  "tests": {
    "php_version": "8.1.0",
    "curl_available": true,
    "json_available": true,
    "writable_cache": true,
    "writable_logs": true
  },
  "all_tests_passed": true
}
```

## 🔧 Konfigürasyon

### Environment Values (.env)
```bash
ENVIRONMENT=production
M3U_SOURCE_URL=http://hadronbalancer.xyz:80/get.php?username=...
CACHE_DURATION=3600
CORS_ORIGINS=*
API_BASE_URL=http://localhost/backend
```

### config.php Ayarları
```php
// Cache settings
define('CACHE_ENABLED', true);
define('CACHE_DURATION', 3600);

// Stream settings
define('STREAM_TIMEOUT', 30);
define('STREAM_USER_AGENT', 'VLC/3.0.16');

// Feature flags
define('ENABLE_SPORTS_ONLY', true);
define('ENABLE_PROXY_STREAMING', true);
```

## 📁 Dosya Yapısı

```
backend/
├── proxy.php          # M3U8 proxy handler
├── channels.php       # Channel parser
├── config.php         # Configuration
├── .htaccess          # Apache configuration
├── test.php           # Test endpoint
├── cache/             # Cache directory
├── logs/              # Log files
└── README.md          # Bu dosya
```

## 🚨 Güvenlik

### CORS Konfigürasyonu
```php
// Specific origins for production
header('Access-Control-Allow-Origin: https://yourdomain.com');
```

### Rate Limiting
```php
// config.php
define('RATE_LIMIT_ENABLED', true);
define('MAX_REQUESTS_PER_MINUTE', 100);
```

### Log Monitoring
```bash
# Real-time log monitoring
tail -f /var/www/html/sportstream/logs/app.log
tail -f /var/www/html/sportstream/logs/error.log
```

## 🔍 Troubleshooting

### Yaygın Sorunlar

#### 1. CORS Hatası
```bash
# Nginx CORS headers kontrol et
curl -H "Origin: http://localhost:3000" -I http://localhost/api/channels
```

#### 2. Cache Permission Hatası
```bash
sudo chmod -R 777 /var/www/html/sportstream/cache/
sudo chown -R www-data:www-data /var/www/html/sportstream/cache/
```

#### 3. PHP Memory Limit
```bash
# PHP memory limit artır
echo "memory_limit = 256M" >> /etc/php/8.1/fpm/conf.d/99-sportstream.ini
sudo systemctl restart php8.1-fpm
```

#### 4. Stream Timeout
```bash
# Nginx timeout artır
echo "fastcgi_read_timeout 300;" >> /etc/nginx/sites-available/sportstream
sudo nginx -s reload
```

### Debug Mode
```php
// config.php
define('ENVIRONMENT', 'development');
define('DEBUG', true);
```

### Log Levels
```bash
# Error logs
tail -f logs/error.log

# Application logs  
tail -f logs/app.log

# PHP-FPM logs
tail -f /var/log/php8.1-fpm.log
```

## 📊 Performance

### Optimization Settings
```nginx
# Nginx caching
location ~* \.(ts|m3u8)$ {
    add_header Cache-Control "no-cache";
}

# Gzip compression
gzip on;
gzip_types application/json application/javascript text/css;
```

### PHP Tuning
```ini
; PHP-FPM optimization
pm.max_children = 50
pm.start_servers = 10
pm.min_spare_servers = 5
pm.max_spare_servers = 20
```

### System Limits
```bash
# Increase file descriptor limits
echo "www-data soft nofile 65536" >> /etc/security/limits.conf
echo "www-data hard nofile 65536" >> /etc/security/limits.conf
```

## 🔄 Updates

### Backend Güncelleme
```bash
# Backup current installation
sudo cp -r /var/www/html/sportstream /var/www/html/sportstream.backup

# Copy new files
sudo cp -r backend/* /var/www/html/sportstream/

# Restore permissions
sudo chown -R www-data:www-data /var/www/html/sportstream/
sudo systemctl restart php8.1-fpm nginx
```

### Cache Temizleme
```bash
# Clear all cache
sudo rm -rf /var/www/html/sportstream/cache/*

# Clear specific cache
curl "http://localhost/api/channels?clear_cache=1"
```

## 📞 Support

### Sistem Durumu
```bash
# Service status
sudo systemctl status nginx php8.1-fpm

# Disk usage
df -h /var/www/html/sportstream/

# Memory usage
free -h
```

### Log Analysis
```bash
# Error summary
grep "ERROR" logs/error.log | tail -20

# Request analysis
grep "GET" /var/log/nginx/access.log | tail -20
```

---

## 🎯 Frontend Entegrasyonu

TypeScript servislerinizi backend ile entegre etmek için:

```typescript
// src/services/streamingApi.ts
const API_BASE_URL = 'http://localhost'; // Backend URL

// API calls
const response = await fetch(`${API_BASE_URL}/api/channels`);
const streamUrl = `${API_BASE_URL}/api/proxy?url=${encodeURIComponent(channelUrl)}`;
```

Bu backend tamamen çalışır durumda ve production-ready! 🚀