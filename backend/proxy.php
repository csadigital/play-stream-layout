<?php
/**
 * SportStream M3U8 Proxy Server
 * Handles CORS, M3U8 processing, and stream proxying
 */

// CORS headers for all requests
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Set maximum execution time for streaming
set_time_limit(0);
ini_set('memory_limit', '256M');

/**
 * Main proxy handler class
 */
class StreamProxy {
    private $userAgent = 'VLC/3.0.16 LibVLC/3.0.16';
    private $timeout = 30;
    private $streamTimeout = 0; // No timeout for streaming
    
    public function __construct() {
        // Log requests for debugging
        $this->logRequest();
    }
    
    /**
     * Handle incoming requests
     */
    public function handleRequest() {
        // Decode URL parameter properly
        $url = $_GET['url'] ?? '';
        
        // PHP automatically URL-decodes GET parameters, so we have the original URL
        // Only try base64 decode if it doesn't look like a valid URL
        if (!empty($url) && !filter_var($url, FILTER_VALIDATE_URL)) {
            // Try base64 decode as fallback
            $decoded = base64_decode($url, true);
            if ($decoded !== false && filter_var($decoded, FILTER_VALIDATE_URL)) {
                $url = $decoded;
            }
        }
        
        if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
            $this->returnError(400, 'Geçersiz URL');
            return;
        }
        
        // Determine action (default to 'proxy' for playlist proxying)
        $action = $_GET['action'] ?? 'proxy';
        switch ($action) {
            case 'proxy':
            case 'm3u8':
                $this->proxyM3U8($url);
                break;
                
            case 'segment':
                $this->proxySegment($url);
                break;
                
            case 'ts':
                $this->proxyTSStream($url);
                break;
                
            default:
                $this->returnError(400, 'Geçersiz action');
        }
    }
    
    /**
     * Proxy M3U8 playlist files
     */
    private function proxyM3U8($url) {
        // First check if URL needs .m3u8 extension
        $url = $this->checkAndFixM3U8Url($url);
        
        $content = $this->fetchContent($url, $this->timeout);
        
        if ($content === false) {
            $this->returnError(502, 'M3U8 içeriği alınamadı');
            return;
        }
        
        // Check if it's valid M3U8 content
        if (strpos($content, '#EXTM3U') === false) {
            // If not M3U8, create a simple playlist
            $content = $this->createSimplePlaylist($url);
        } else {
            // Process M3U8 content to proxy segments
            $content = $this->processM3U8Content($content, $url);
        }
        
        // Set appropriate headers
        header('Content-Type: application/vnd.apple.mpegurl');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        
        echo $content;
    }
    
    /**
     * Proxy individual segments
     */
    private function proxySegment($url) {
        header('Content-Type: video/mp2t');
        header('Cache-Control: public, max-age=3600');
        
        $this->streamContent($url);
    }
    
    /**
     * Proxy TS streams directly
     */
    private function proxyTSStream($url) {
        header('Content-Type: video/mp2t');
        header('Cache-Control: no-cache');
        header('Connection: close');
        
        $this->streamContent($url, true);
    }
    
    /**
     * Check if URL needs .m3u8 extension and test it
     */
    private function checkAndFixM3U8Url($url) {
        // If already has .m3u8, return as is
        if (strpos($url, '.m3u8') !== false) {
            return $url;
        }
        
        // If it's an IPTV URL (contains :8080), try adding .m3u8
        if (strpos($url, ':8080/') !== false) {
            $testUrl = rtrim($url, '/') . '.m3u8';
            
            // Quick test to see if .m3u8 version exists
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $testUrl,
                CURLOPT_NOBODY => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_USERAGENT => $this->userAgent
            ]);
            
            curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode == 200) {
                return $testUrl;
            }
        }
        
        return $url;
    }
    
    /**
     * Process M3U8 content to proxy all segments through this server
     */
    private function processM3U8Content($content, $originalUrl) {
        $lines = explode("\n", $content);
        $baseUrl = $this->getBaseUrl($originalUrl);
        $processedLines = [];
        
        foreach ($lines as $line) {
            $line = trim($line);
            
            if (empty($line) || strpos($line, '#') === 0) {
                // Keep metadata lines as is
                $processedLines[] = $line;
            } else {
                // This is a segment URL
                $segmentUrl = $line;
                
                // Convert relative URLs to absolute
                if (strpos($segmentUrl, 'http') !== 0) {
                    $segmentUrl = $baseUrl . ltrim($segmentUrl, '/');
                }
                
                // Create proxy URL for this segment
                $proxyUrl = $_SERVER['REQUEST_SCHEME'] . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'] . 
                           '?action=segment&url=' . urlencode(base64_encode($segmentUrl));
                
                $processedLines[] = $proxyUrl;
            }
        }
        
        return implode("\n", $processedLines);
    }
    
    /**
     * Create a simple M3U8 playlist for non-M3U8 streams
     */
    private function createSimplePlaylist($streamUrl) {
        $proxyUrl = $_SERVER['REQUEST_SCHEME'] . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'] . 
                   '?action=ts&url=' . urlencode(base64_encode($streamUrl));
        
        return "#EXTM3U\n" .
               "#EXT-X-VERSION:3\n" .
               "#EXT-X-TARGETDURATION:10\n" .
               "#EXT-X-MEDIA-SEQUENCE:0\n" .
               "#EXTINF:10.0,\n" .
               $proxyUrl . "\n" .
               "#EXT-X-ENDLIST\n";
    }
    
    /**
     * Get base URL from full URL
     */
    private function getBaseUrl($url) {
        $parsed = parse_url($url);
        $baseUrl = $parsed['scheme'] . '://' . $parsed['host'];
        
        if (isset($parsed['port'])) {
            $baseUrl .= ':' . $parsed['port'];
        }
        
        $path = $parsed['path'] ?? '/';
        $baseUrl .= dirname($path);
        
        return rtrim($baseUrl, '/') . '/';
    }
    
    /**
     * Fetch content using cURL
     */
    private function fetchContent($url, $timeout = 30) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_USERAGENT => $this->userAgent,
            CURLOPT_HTTPHEADER => [
                'Accept: */*',
                'Connection: keep-alive',
                'Cache-Control: no-cache'
            ]
        ]);
        
        $content = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            error_log("cURL Error for $url: $error");
            return false;
        }
        
        if ($httpCode !== 200) {
            error_log("HTTP Error for $url: $httpCode");
            return false;
        }
        
        return $content;
    }
    
    /**
     * Stream content directly to client
     */
    private function streamContent($url, $continuous = false) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_HEADER => false,
            CURLOPT_TIMEOUT => $continuous ? $this->streamTimeout : $this->timeout,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_BUFFERSIZE => 128 * 1024, // 128KB buffer
            CURLOPT_USERAGENT => $this->userAgent,
            CURLOPT_HTTPHEADER => [
                'Accept: */*',
                'Connection: keep-alive'
            ]
        ]);
        
        // Stream data as it arrives
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function($ch, $data) {
            echo $data;
            if (ob_get_level()) {
                ob_flush();
            }
            flush();
            return strlen($data);
        });
        
        curl_exec($ch);
        curl_close($ch);
    }
    
    /**
     * Return error response
     */
    private function returnError($code, $message) {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => true,
            'code' => $code,
            'message' => $message,
            'timestamp' => time()
        ]);
    }
    
    /**
     * Log requests for debugging
     */
    private function logRequest() {
        $log = date('Y-m-d H:i:s') . ' - ' . $_SERVER['REQUEST_METHOD'] . ' ' . 
               $_SERVER['REQUEST_URI'] . ' - ' . ($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown') . "\n";
        
        // Uncomment for debugging
        // file_put_contents(__DIR__ . '/proxy.log', $log, FILE_APPEND | LOCK_EX);
    }
}

// Initialize and handle request
try {
    $proxy = new StreamProxy();
    $proxy->handleRequest();
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'error' => true,
        'message' => 'Server error: ' . $e->getMessage(),
        'timestamp' => time()
    ]);
}
?>
