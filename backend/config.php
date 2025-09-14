<?php
/**
 * SportStream Backend Configuration
 */

// Environment settings
define('ENVIRONMENT', getenv('ENVIRONMENT') ?: 'production');
define('DEBUG', ENVIRONMENT === 'development');

// Database settings (if needed in future)
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'sportstream');
define('DB_USER', getenv('DB_USER') ?: 'sportstream');
define('DB_PASS', getenv('DB_PASS') ?: '');

// M3U source configuration
define('M3U_SOURCE_URL', getenv('M3U_SOURCE_URL') ?: 'http://hadronbalancer.xyz:80/get.php?username=sjafGsaGx1235&password=yJHHUuxUrn&type=m3u_plus&output=ts');

// Cache settings
define('CACHE_ENABLED', true);
define('CACHE_DURATION', 3600); // 1 hour
define('CACHE_DIR', __DIR__ . '/cache');

// Stream settings
define('STREAM_TIMEOUT', 30);
define('STREAM_USER_AGENT', 'VLC/3.0.16 LibVLC/3.0.16');
define('STREAM_BUFFER_SIZE', 128 * 1024); // 128KB

// CORS settings
define('CORS_ORIGINS', getenv('CORS_ORIGINS') ?: '*');
define('CORS_METHODS', 'GET, POST, OPTIONS, DELETE, PUT');
define('CORS_HEADERS', 'Content-Type, Authorization, X-Requested-With');

// API settings
define('API_VERSION', '1.0');
define('API_BASE_URL', getenv('API_BASE_URL') ?: 'http://localhost/backend');

// Security settings
define('MAX_REQUESTS_PER_MINUTE', 100);
define('RATE_LIMIT_ENABLED', false); // Set to true in production

// Logging settings
define('LOG_ENABLED', DEBUG);
define('LOG_FILE', __DIR__ . '/logs/app.log');
define('ERROR_LOG_FILE', __DIR__ . '/logs/error.log');

// Performance settings
define('OUTPUT_COMPRESSION', true);
define('MEMORY_LIMIT', '256M');
define('MAX_EXECUTION_TIME', 0); // No limit for streaming

// Feature flags
define('ENABLE_CHANNEL_FILTERING', true);
define('ENABLE_SPORTS_ONLY', true);
define('ENABLE_PROXY_STREAMING', true);
define('ENABLE_CACHE_WARMING', false);

// Initialize error reporting
if (DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(E_ALL & ~E_NOTICE & ~E_STRICT & ~E_DEPRECATED);
    ini_set('display_errors', 0);
}

// Set PHP settings
ini_set('memory_limit', MEMORY_LIMIT);
set_time_limit(MAX_EXECUTION_TIME);

if (OUTPUT_COMPRESSION) {
    ini_set('zlib.output_compression', 1);
}

// Create necessary directories
$dirs = [CACHE_DIR, dirname(LOG_FILE), dirname(ERROR_LOG_FILE)];
foreach ($dirs as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
}

// Utility functions
function config($key, $default = null) {
    return defined($key) ? constant($key) : $default;
}

function isDebug() {
    return DEBUG;
}

function logMessage($message, $level = 'INFO') {
    if (!LOG_ENABLED) return;
    
    $timestamp = date('Y-m-d H:i:s');
    $log = "[$timestamp] [$level] $message" . PHP_EOL;
    file_put_contents(LOG_FILE, $log, FILE_APPEND | LOCK_EX);
}

function logError($message, $context = []) {
    $timestamp = date('Y-m-d H:i:s');
    $contextStr = !empty($context) ? json_encode($context) : '';
    $log = "[$timestamp] ERROR: $message $contextStr" . PHP_EOL;
    file_put_contents(ERROR_LOG_FILE, $log, FILE_APPEND | LOCK_EX);
}

// Set custom error handler
if (!DEBUG) {
    set_error_handler(function($severity, $message, $file, $line) {
        logError("PHP Error: $message in $file:$line", ['severity' => $severity]);
        return false;
    });
    
    set_exception_handler(function($exception) {
        logError("Uncaught Exception: " . $exception->getMessage(), [
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString()
        ]);
    });
}

// Configuration validation
if (!function_exists('curl_init')) {
    die('cURL extension is required but not installed.');
}

if (!is_writable(CACHE_DIR)) {
    logError("Cache directory is not writable: " . CACHE_DIR);
}

// Load additional config if exists
$localConfig = __DIR__ . '/config.local.php';
if (file_exists($localConfig)) {
    require_once $localConfig;
}
?>