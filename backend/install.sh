#!/bin/bash

# SportStream Quick Install Script
# One-command installation for SportStream Backend

set -e

echo "🎯 SportStream Quick Install"
echo "============================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check root
if [[ $EUID -ne 0 ]]; then
   error "Bu script root olarak çalıştırılmalı (sudo kullanın)"
   exit 1
fi

# Quick OS detection and package installation
install_packages() {
    log "Gerekli paketler kuruluyor..."
    
    if command -v apt >/dev/null 2>&1; then
        # Ubuntu/Debian
        apt update -qq
        apt install -y nginx php8.1 php8.1-fpm php8.1-curl php8.1-json php8.1-mbstring curl
        PHP_VERSION="8.1"
        PHP_FPM_SERVICE="php8.1-fpm"
    elif command -v yum >/dev/null 2>&1; then
        # CentOS/RHEL
        yum install -y epel-release
        yum install -y nginx php php-fpm php-curl php-json php-mbstring curl
        PHP_VERSION="8.1"
        PHP_FPM_SERVICE="php-fpm"
    else
        error "Desteklenmeyen işletim sistemi"
        exit 1
    fi
}

# Quick setup
quick_setup() {
    BACKEND_DIR="/var/www/html/sportstream"
    
    log "Dizinler oluşturuluyor..."
    mkdir -p $BACKEND_DIR/{cache,logs}
    
    log "Backend dosyaları kopyalanıyor..."
    if [[ -f "proxy.php" ]]; then
        cp *.php $BACKEND_DIR/
        cp .htaccess $BACKEND_DIR/ 2>/dev/null || true
    else
        warn "Backend dosyaları bulunamadı, manuel kopyalayın"
    fi
    
    log "İzinler ayarlanıyor..."
    chown -R www-data:www-data $BACKEND_DIR
    chmod -R 755 $BACKEND_DIR
    chmod -R 777 $BACKEND_DIR/{cache,logs}
    
    log "Nginx konfigürasyonu..."
    cat > /etc/nginx/sites-available/sportstream << 'EOF'
server {
    listen 80;
    server_name localhost;
    root /var/www/html/sportstream;
    index index.php;
    
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, X-Requested-With" always;
    
    location / {
        if ($request_method = 'OPTIONS') { return 200; }
        try_files $uri $uri/ /index.php?$query_string;
    }
    
    location ~ ^/api/(channels|proxy)/?$ {
        try_files $uri /$1.php?$query_string;
    }
    
    location ~ ^/stream/(.*)$ {
        try_files $uri /proxy.php?action=proxy&url=$1;
    }
    
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_read_timeout 300;
    }
}
EOF
    
    ln -sf /etc/nginx/sites-available/sportstream /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    log "Servisler başlatılıyor..."
    systemctl restart $PHP_FPM_SERVICE
    systemctl restart nginx
    systemctl enable $PHP_FPM_SERVICE nginx
    
    log "Test endpoint oluşturuluyor..."
    cat > $BACKEND_DIR/test.php << 'EOF'
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
echo json_encode([
    'status' => 'OK',
    'message' => 'SportStream Backend çalışıyor!',
    'php_version' => PHP_VERSION,
    'time' => date('Y-m-d H:i:s')
], JSON_PRETTY_PRINT);
?>
EOF
}

# Verification
verify() {
    log "Kurulum test ediliyor..."
    sleep 2
    
    if curl -s http://localhost/test.php | grep -q "OK"; then
        log "✅ Test başarılı!"
        echo
        echo "🎉 SportStream Backend hazır!"
        echo "📡 Test: http://localhost/test.php"
        echo "📋 Kanallar: http://localhost/api/channels"
        echo "🎬 Proxy: http://localhost/api/proxy?url=STREAM_URL"
        echo
        warn "Frontend'inizi http://localhost'u kullanacak şekilde güncelleyin"
    else
        error "Test başarısız!"
        exit 1
    fi
}

# Main execution
main() {
    install_packages
    quick_setup
    verify
}

echo "SportStream Backend kurulumu başlıyor..."
main
log "Kurulum tamamlandı! 🚀"