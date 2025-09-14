# 📦 SportStream Backend İndirme Talimatları

Bu dosyaları indirmek ve kurmak için aşağıdaki adımları takip edin:

## 🚀 Hızlı Kurulum (Tek Komut)

### 1. Dosyaları İndir
Lovable'dan tüm dosyaları indirmek için **Dev Mode**'a geçin:

1. **Sol üstteki "Dev Mode" toggle'ını** açın
2. **File Explorer**'da tüm dosyaları seçin
3. **Download** butonuna basın veya Ctrl+A ile tümünü seçip indirin

### 2. Sunucuya Yükle
```bash
# Dosyaları sunucuya yükle (scp, FTP veya doğrudan kopyala)
scp -r sportstream-backend.zip user@your-server:/tmp/

# Sunucuda extract et
cd /tmp && unzip sportstream-backend.zip
```

### 3. Otomatik Kurulum Çalıştır
```bash
# Root yetkisiyle kurulum
sudo bash setup.sh

# VEYA hızlı kurulum
sudo bash backend/install.sh
```

## 📁 Manuel Kurulum

### Gerekli Dosyalar
```
project/
├── backend/
│   ├── proxy.php          # M3U8 proxy server
│   ├── channels.php       # Kanal parser
│   ├── config.php         # Konfigürasyon
│   ├── .htaccess         # Apache config
│   ├── README.md         # Dokümantasyon
│   └── install.sh        # Hızlı kurulum
├── setup.sh              # Tam otomatik kurulum
└── download-instructions.md
```

### Adım Adım
1. **Backend klasörünü** web dizinine kopyala:
   ```bash
   sudo cp -r backend/* /var/www/html/sportstream/
   ```

2. **İzinleri** ayarla:
   ```bash
   sudo chown -R www-data:www-data /var/www/html/sportstream/
   sudo chmod -R 777 /var/www/html/sportstream/cache/
   ```

3. **Nginx/Apache** konfigürasyonu yap (README.md'de detaylar)

## 🔧 Frontend Entegrasyonu

TypeScript servislerinde backend URL'ini güncelle:

```typescript
// src/services/streamingApi.ts
const API_BASE_URL = 'http://YOUR_SERVER_IP'; // Backend IP/domain

// API calls güncellemeleri
const response = await fetch(`${API_BASE_URL}/api/channels`);
```

## ✅ Test Et

Kurulum sonrası test:
```bash
# Backend test
curl http://localhost/test.php

# Kanal listesi test  
curl http://localhost/api/channels

# Proxy test
curl "http://localhost/api/proxy?url=https://test-stream.m3u8"
```

## 🚨 Production için

### SSL/HTTPS Ekle
```bash
# Let's Encrypt ile SSL
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Firewall Ayarla  
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Monitoring Ekle
```bash
# Log monitoring
tail -f /var/www/html/sportstream/logs/app.log
```

## 📞 Sorun Giderme

### Yaygın Hatalar
1. **CORS Hatası**: `.htaccess` veya Nginx config kontrol et
2. **Permission Error**: `chmod 777 cache/ logs/` 
3. **PHP Error**: `php.ini` memory limit artır
4. **Stream Error**: cURL extension kontrol et

### Debug Mode
```php
// config.php'de
define('DEBUG', true);
```

---

## 🎯 Özet

1. **Dev Mode** → Dosyaları indir
2. **Sunucuya yükle** → `sudo bash setup.sh` 
3. **Frontend güncelle** → API URL değiştir
4. **Test et** → `/test.php` endpoint
5. **Production** → SSL + monitoring ekle

**Bu backend tamamen çalışır durumda ve production-ready!** 🚀

Herhangi bir sorun için `backend/README.md` dosyasında detaylı troubleshooting bulabilirsiniz.