#!/bin/bash

# SportStream Backend Setup Script
# Automatically sets up PHP backend for SportStream

set -e

echo "🚀 SportStream Backend Setup Starting..."
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="/var/www/html/sportstream"
NGINX_CONF="/etc/nginx/sites-available/sportstream"
PHP_VERSION="8.1"
DOMAIN="localhost"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (use sudo)"
   exit 1
fi

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    elif type lsb_release >/dev/null 2>&1; then
        OS=$(lsb_release -si)
        VER=$(lsb_release -sr)
    else
        OS=$(uname -s)
        VER=$(uname -r)
    fi
    
    log_info "Detected OS: $OS $VER"
}

# Install packages based on OS
install_packages() {
    log_info "Installing required packages..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        apt update
        apt install -y nginx php${PHP_VERSION} php${PHP_VERSION}-fpm php${PHP_VERSION}-curl php${PHP_VERSION}-json php${PHP_VERSION}-mbstring curl unzip
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"Amazon Linux"* ]]; then
        yum update -y
        yum install -y epel-release
        yum install -y nginx php php-fpm php-curl php-json php-mbstring curl unzip
    elif [[ "$OS" == *"Fedora"* ]]; then
        dnf update -y
        dnf install -y nginx php php-fpm php-curl php-json php-mbstring curl unzip
    else
        log_error "Unsupported operating system: $OS"
        exit 1
    fi
    
    log_success "Packages installed successfully"
}

# Create backend directory structure
setup_directories() {
    log_info "Setting up directory structure..."
    
    mkdir -p $BACKEND_DIR
    mkdir -p $BACKEND_DIR/cache
    mkdir -p $BACKEND_DIR/logs
    mkdir -p /var/log/nginx
    
    # Set permissions
    chown -R www-data:www-data $BACKEND_DIR
    chmod -R 755 $BACKEND_DIR
    chmod -R 777 $BACKEND_DIR/cache
    chmod -R 777 $BACKEND_DIR/logs
    
    log_success "Directory structure created"
}

# Copy backend files
copy_backend_files() {
    log_info "Copying backend files..."
    
    # Check if backend files exist in current directory
    if [[ -d "./backend" ]]; then
        cp -r ./backend/* $BACKEND_DIR/
        log_success "Backend files copied from ./backend/"
    else
        log_warning "Backend files not found in ./backend/, you'll need to copy them manually"
        log_info "Expected files: proxy.php, channels.php, .htaccess, config.php"
    fi
    
    # Set ownership
    chown -R www-data:www-data $BACKEND_DIR
}

# Configure Nginx
setup_nginx() {
    log_info "Configuring Nginx..."
    
    cat > $NGINX_CONF << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    root $BACKEND_DIR;
    index index.php index.html;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # CORS headers
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, DELETE, PUT" always;
    add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;
    add_header Access-Control-Max-Age "3600" always;
    
    # Handle preflight requests
    location / {
        if (\$request_method = 'OPTIONS') {
            return 200;
        }
        try_files \$uri \$uri/ /index.php?\$query_string;
    }
    
    # API endpoints
    location ~ ^/api/(channels|proxy)/?$ {
        try_files \$uri /\$1.php?\$query_string;
    }
    
    # Stream proxy
    location ~ ^/stream/(.*)$ {
        try_files \$uri /proxy.php?action=proxy&url=\$1;
    }
    
    # PHP handling
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
        
        # Increase timeouts for streaming
        fastcgi_read_timeout 300;
        fastcgi_send_timeout 300;
        fastcgi_connect_timeout 300;
    }
    
    # Deny access to sensitive files
    location ~ /\.(ht|git|env) {
        deny all;
    }
    
    location ~ \.(log|json)$ {
        location ~ \.json$ {
            allow all;
        }
        location ~ \.log$ {
            deny all;
        }
    }
    
    # Static file caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
    
    # Video file handling
    location ~* \.(ts|m3u8)$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
}
EOF

    # Enable site
    ln -sf $NGINX_CONF /etc/nginx/sites-enabled/sportstream
    
    # Remove default site if exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    nginx -t
    if [[ $? -eq 0 ]]; then
        log_success "Nginx configuration created successfully"
    else
        log_error "Nginx configuration test failed"
        exit 1
    fi
}

# Configure PHP
setup_php() {
    log_info "Configuring PHP..."
    
    # PHP-FPM configuration
    PHP_FPM_CONF="/etc/php/${PHP_VERSION}/fpm/pool.d/sportstream.conf"
    
    cat > $PHP_FPM_CONF << EOF
[sportstream]
user = www-data
group = www-data
listen = /var/run/php/php${PHP_VERSION}-fpm-sportstream.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = dynamic
pm.max_children = 20
pm.start_servers = 5
pm.min_spare_servers = 5
pm.max_spare_servers = 10
pm.max_requests = 1000

; PHP settings for streaming
php_admin_value[memory_limit] = 256M
php_admin_value[max_execution_time] = 0
php_admin_value[max_input_time] = 300
php_admin_value[post_max_size] = 50M
php_admin_value[upload_max_filesize] = 50M
php_admin_value[default_socket_timeout] = 300

; Error logging
php_admin_value[log_errors] = On
php_admin_value[error_log] = $BACKEND_DIR/logs/php_errors.log
EOF

    # Update Nginx to use new socket
    sed -i "s|php${PHP_VERSION}-fpm.sock|php${PHP_VERSION}-fpm-sportstream.sock|g" $NGINX_CONF
    
    log_success "PHP configured for streaming"
}

# Setup systemd services
setup_services() {
    log_info "Configuring systemd services..."
    
    # Enable and start services
    systemctl enable nginx
    systemctl enable php${PHP_VERSION}-fpm
    
    log_success "Services configured"
}

# Create test endpoint
create_test_endpoint() {
    log_info "Creating test endpoint..."
    
    cat > $BACKEND_DIR/test.php << 'EOF'
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$tests = [
    'php_version' => PHP_VERSION,
    'curl_available' => function_exists('curl_init'),
    'json_available' => function_exists('json_encode'),
    'writable_cache' => is_writable(__DIR__ . '/cache'),
    'writable_logs' => is_writable(__DIR__ . '/logs'),
    'memory_limit' => ini_get('memory_limit'),
    'max_execution_time' => ini_get('max_execution_time'),
    'server_time' => date('Y-m-d H:i:s'),
    'server_info' => php_uname()
];

echo json_encode([
    'status' => 'OK',
    'message' => 'SportStream Backend is running',
    'tests' => $tests,
    'all_tests_passed' => !in_array(false, array_values($tests))
], JSON_PRETTY_PRINT);
?>
EOF

    chown www-data:www-data $BACKEND_DIR/test.php
    log_success "Test endpoint created at /test.php"
}

# Setup firewall
setup_firewall() {
    log_info "Configuring firewall..."
    
    if command -v ufw >/dev/null 2>&1; then
        ufw --force enable
        ufw allow 22/tcp  # SSH
        ufw allow 80/tcp  # HTTP
        ufw allow 443/tcp # HTTPS
        log_success "UFW firewall configured"
    elif command -v firewall-cmd >/dev/null 2>&1; then
        systemctl enable firewalld
        systemctl start firewalld
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --reload
        log_success "Firewalld configured"
    else
        log_warning "No firewall detected, please configure manually"
    fi
}

# Start services
start_services() {
    log_info "Starting services..."
    
    systemctl restart php${PHP_VERSION}-fpm
    systemctl restart nginx
    
    # Check service status
    if systemctl is-active --quiet nginx && systemctl is-active --quiet php${PHP_VERSION}-fpm; then
        log_success "All services started successfully"
    else
        log_error "Some services failed to start"
        systemctl status nginx
        systemctl status php${PHP_VERSION}-fpm
        exit 1
    fi
}

# Performance optimization
optimize_performance() {
    log_info "Applying performance optimizations..."
    
    # Increase system limits
    cat >> /etc/security/limits.conf << EOF
# SportStream optimizations
www-data soft nofile 65536
www-data hard nofile 65536
www-data soft nproc 32768
www-data hard nproc 32768
EOF

    # Optimize kernel parameters
    cat >> /etc/sysctl.conf << EOF
# SportStream network optimizations
net.core.rmem_default = 262144
net.core.rmem_max = 16777216
net.core.wmem_default = 262144
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 262144 16777216
net.ipv4.tcp_wmem = 4096 262144 16777216
net.core.netdev_max_backlog = 30000
net.ipv4.tcp_max_syn_backlog = 30000
EOF

    sysctl -p
    log_success "Performance optimizations applied"
}

# Setup log rotation
setup_log_rotation() {
    log_info "Setting up log rotation..."
    
    cat > /etc/logrotate.d/sportstream << EOF
$BACKEND_DIR/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        systemctl reload php${PHP_VERSION}-fpm
    endscript
}
EOF

    log_success "Log rotation configured"
}

# Final verification
verify_installation() {
    log_info "Verifying installation..."
    
    # Test HTTP endpoint
    sleep 2
    if curl -s http://localhost/test.php | grep -q '"status":"OK"'; then
        log_success "HTTP endpoint test passed"
    else
        log_error "HTTP endpoint test failed"
        return 1
    fi
    
    # Check file permissions
    if [[ -w "$BACKEND_DIR/cache" && -w "$BACKEND_DIR/logs" ]]; then
        log_success "File permissions correct"
    else
        log_error "File permissions incorrect"
        return 1
    fi
    
    return 0
}

# Print final instructions
print_final_instructions() {
    echo
    echo "🎉 SportStream Backend Setup Complete!"
    echo "====================================="
    echo
    log_success "Backend installed at: $BACKEND_DIR"
    log_success "Test endpoint: http://$DOMAIN/test.php"
    log_success "API endpoints:"
    echo "  • Channels: http://$DOMAIN/api/channels"
    echo "  • Proxy: http://$DOMAIN/api/proxy?url=<stream_url>"
    echo "  • Stream: http://$DOMAIN/stream/<stream_url>"
    echo
    log_info "Frontend configuration:"
    echo "  Update your TypeScript service to use: http://$DOMAIN"
    echo
    log_info "Logs location:"
    echo "  • Application: $BACKEND_DIR/logs/"
    echo "  • Nginx: /var/log/nginx/"
    echo "  • PHP: $BACKEND_DIR/logs/php_errors.log"
    echo
    log_warning "Next steps:"
    echo "  1. Update your frontend API URLs"
    echo "  2. Test the endpoints"
    echo "  3. Configure SSL/TLS for production"
    echo "  4. Set up monitoring and backups"
    echo
}

# Main installation flow
main() {
    detect_os
    install_packages
    setup_directories
    copy_backend_files
    setup_nginx
    setup_php
    setup_services
    create_test_endpoint
    setup_firewall
    optimize_performance
    setup_log_rotation
    start_services
    
    if verify_installation; then
        print_final_instructions
    else
        log_error "Installation verification failed"
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "SportStream Backend Setup Script"
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --domain=...   Set custom domain (default: localhost)"
        echo "  --dir=...      Set custom backend directory"
        exit 0
        ;;
    --domain=*)
        DOMAIN="${1#*=}"
        ;;
    --dir=*)
        BACKEND_DIR="${1#*=}"
        ;;
esac

# Run main installation
main

log_success "Setup completed successfully! 🚀"