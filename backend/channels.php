<?php
/**
 * SportStream Channel Parser
 * Fetches and parses M3U playlist from hadronbalancer.xyz
 */

// CORS headers
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

/**
 * Channel parser class
 */
class ChannelParser {
    private $m3uUrl = 'http://hadronbalancer.xyz:80/get.php?username=sjafGsaGx1235&password=yJHHUuxUrn&type=m3u_plus&output=ts';
    private $cacheFile;
    private $cacheTime = 3600; // 1 hour
    private $userAgent = 'VLC/3.0.16 LibVLC/3.0.16';
    
    public function __construct() {
        $this->cacheFile = __DIR__ . '/cache/channels.json';
        $this->ensureCacheDir();
    }
    
    /**
     * Main function to get channels
     */
    public function getChannels() {
        // Check cache first
        if ($this->isCacheValid()) {
            $cached = $this->getCachedData();
            if ($cached) {
                return $cached;
            }
        }
        
        try {
            // Fetch and parse M3U
            $channels = $this->fetchAndParseM3U();
            
            if (empty($channels)) {
                throw new Exception('No channels found');
            }
            
            // Create response
            $response = [
                'success' => true,
                'count' => count($channels),
                'channels' => $channels,
                'timestamp' => time(),
                'cached' => false
            ];
            
            // Cache the result
            $this->setCachedData($response);
            
            return $response;
            
        } catch (Exception $e) {
            error_log('Channel parsing error: ' . $e->getMessage());
            return $this->getFallbackResponse();
        }
    }
    
    /**
     * Fetch and parse M3U content
     */
    private function fetchAndParseM3U() {
        $content = $this->fetchM3UContent();
        
        if (!$content) {
            throw new Exception('Failed to fetch M3U content');
        }
        
        return $this->parseM3UContent($content);
    }
    
    /**
     * Fetch M3U content with retry logic
     */
    private function fetchM3UContent() {
        $attempts = 3;
        $delay = 2; // seconds
        
        for ($i = 0; $i < $attempts; $i++) {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $this->m3uUrl,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 30,
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
                error_log("Attempt " . ($i + 1) . " - cURL Error: $error");
            } elseif ($httpCode === 200 && !empty($content) && strpos($content, '#EXTINF') !== false) {
                return $content;
            } else {
                error_log("Attempt " . ($i + 1) . " - HTTP Code: $httpCode, Content length: " . strlen($content));
            }
            
            if ($i < $attempts - 1) {
                sleep($delay);
                $delay *= 2; // Exponential backoff
            }
        }
        
        return false;
    }
    
    /**
     * Parse M3U content into channels
     */
    private function parseM3UContent($content) {
        $channels = [];
        $lines = explode("\n", $content);
        $currentChannel = null;
        $channelId = 1;
        
        foreach ($lines as $line) {
            $line = trim($line);
            
            // EXTINF line - channel information
            if (strpos($line, '#EXTINF:') === 0) {
                $currentChannel = $this->parseExtinfLine($line);
                $currentChannel['id'] = $channelId++;
            }
            // URL line
            elseif (!empty($line) && strpos($line, '#') !== 0 && $currentChannel && strpos($line, 'http') === 0) {
                $currentChannel['url'] = $line;
                
                // Only add if it's a sport channel
                if ($this->isSportChannel($currentChannel)) {
                    $currentChannel['number'] = $this->extractChannelNumber($currentChannel['name']);
                    $currentChannel['viewers'] = $this->generateViewerCount($currentChannel['group']);
                    $currentChannel['status'] = 'live';
                    $currentChannel['quality'] = $this->detectQuality($currentChannel['name']);
                    
                    $channels[] = $currentChannel;
                }
                
                $currentChannel = null;
            }
        }
        
        // Sort channels
        usort($channels, [$this, 'sortChannels']);
        
        // Limit to 50 channels for performance
        return array_slice($channels, 0, 50);
    }
    
    /**
     * Parse EXTINF line
     */
    private function parseExtinfLine($line) {
        $channel = [
            'name' => '',
            'group' => 'Genel',
            'logo' => '',
            'description' => ''
        ];
        
        // Extract tvg-name
        if (preg_match('/tvg-name="([^"]*)"/', $line, $matches)) {
            $channel['name'] = $this->fixTurkishEncoding(trim($matches[1]));
        }
        
        // Extract tvg-logo
        if (preg_match('/tvg-logo="([^"]*)"/', $line, $matches)) {
            $channel['logo'] = trim($matches[1]);
        }
        
        // Extract group-title
        if (preg_match('/group-title="([^"]*)"/', $line, $matches)) {
            $channel['group'] = $this->fixTurkishEncoding(trim($matches[1]));
        }
        
        // Extract name after comma if tvg-name is empty
        if (empty($channel['name'])) {
            $parts = explode(',', $line, 2);
            if (count($parts) > 1) {
                $channel['name'] = $this->fixTurkishEncoding(trim($parts[1]));
            }
        }
        
        // Generate logo if missing
        if (empty($channel['logo']) && !empty($channel['name'])) {
            $channel['logo'] = $this->generatePlaceholderLogo($channel['name']);
        }
        
        // Generate description
        $channel['description'] = $this->generateDescription($channel['name'], $channel['group']);
        
        return $channel;
    }
    
    /**
     * Check if channel is sport-related
     */
    private function isSportChannel($channel) {
        $sportKeywords = [
            'sport', 'spor', 'bein', 'ssport', 'smart', 'trt', 'aspor', 
            'tivibu', 'euroleague', 'nba', 'futbol', 'football', 'basketbol',
            'voleybol', 'tenis', 'motor', 'formula', 'uefa', 'fifa',
            'galatasaray', 'fenerbahce', 'besiktas', 'trabzonspor',
            'champions', 'league', 'premier', 'bundesliga', 'laliga'
        ];
        
        $text = strtolower($channel['name'] . ' ' . $channel['group']);
        
        foreach ($sportKeywords as $keyword) {
            if (strpos($text, $keyword) !== false) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Extract channel number from name
     */
    private function extractChannelNumber($name) {
        $nameLower = strtolower($name);
        
        // Specific channel patterns
        if (strpos($nameLower, 's sport 2') !== false || strpos($nameLower, 'ssport 2') !== false) {
            return 'S2';
        } elseif (strpos($nameLower, 's sport') !== false || strpos($nameLower, 'ssport') !== false) {
            return 'S';
        } elseif (strpos($nameLower, 'smart') !== false) {
            return 'SM';
        } elseif (strpos($nameLower, 'trt') !== false) {
            return 'TRT';
        } elseif (strpos($nameLower, 'aspor') !== false || strpos($nameLower, 'a spor') !== false) {
            return 'A';
        }
        
        // Extract numeric number
        if (preg_match('/(\d+)/', $name, $matches)) {
            return intval($matches[1]);
        }
        
        // Default to first letter
        return strtoupper(substr($name, 0, 1));
    }
    
    /**
     * Generate realistic viewer count
     */
    private function generateViewerCount($group) {
        $ranges = [
            'Sport' => [5000, 50000],
            'Spor' => [5000, 50000],
            'Football' => [10000, 80000],
            'Futbol' => [10000, 80000],
            'Basketball' => [3000, 25000],
            'Basketbol' => [3000, 25000]
        ];
        
        $range = $ranges[$group] ?? [1000, 15000];
        return rand($range[0], $range[1]);
    }
    
    /**
     * Detect video quality from name
     */
    private function detectQuality($name) {
        $nameLower = strtolower($name);
        
        if (strpos($nameLower, '4k') !== false || strpos($nameLower, 'uhd') !== false) {
            return '4K';
        } elseif (strpos($nameLower, 'fhd') !== false || strpos($nameLower, '1080') !== false) {
            return 'FHD';
        } elseif (strpos($nameLower, 'hd') !== false || strpos($nameLower, '720') !== false) {
            return 'HD';
        }
        
        return 'SD';
    }
    
    /**
     * Fix Turkish character encoding
     */
    private function fixTurkishEncoding($text) {
        $fixes = [
            'Ã§' => 'ç', 'Ã‡' => 'Ç',
            'ÄŸ' => 'ğ', 'Ä' => 'Ğ',
            'Ä±' => 'ı', 'Ä°' => 'İ',
            'Ã¶' => 'ö', 'Ã–' => 'Ö',
            'Ã¼' => 'ü', 'Ãœ' => 'Ü',
            'ÅŸ' => 'ş', 'Åž' => 'Ş',
            'â€™' => "'", 'â€œ' => '"', 'â€' => '"',
            'â€"' => '-', 'â€¦' => '...'
        ];
        
        return str_replace(array_keys($fixes), array_values($fixes), $text);
    }
    
    /**
     * Generate placeholder logo
     */
    private function generatePlaceholderLogo($name) {
        $initial = strtoupper(substr($name, 0, 1));
        $colors = ['dc2626', '2563eb', '059669', 'db2777', 'ef4444', 'f59e0b'];
        $color = $colors[crc32($name) % count($colors)];
        return "https://via.placeholder.com/48x48/{$color}/ffffff?text=" . urlencode($initial);
    }
    
    /**
     * Generate description
     */
    private function generateDescription($name, $group) {
        $nameLower = strtolower($name);
        
        if (strpos($nameLower, 'bein') !== false) {
            return 'beIN Sports canlı spor yayını';
        } elseif (strpos($nameLower, 'trt') !== false) {
            return 'TRT Spor canlı yayını';
        } elseif (strpos($nameLower, 'aspor') !== false) {
            return 'A Spor canlı yayını';
        } elseif (strpos($nameLower, 'smart') !== false) {
            return 'Smart Spor canlı yayını';
        }
        
        return "$name canlı spor yayını";
    }
    
    /**
     * Sort channels
     */
    private function sortChannels($a, $b) {
        // Numeric first
        if (is_numeric($a['number']) && is_numeric($b['number'])) {
            return $a['number'] - $b['number'];
        } elseif (is_numeric($a['number'])) {
            return -1;
        } elseif (is_numeric($b['number'])) {
            return 1;
        } else {
            return strcmp($a['number'], $b['number']);
        }
    }
    
    /**
     * Cache management
     */
    private function ensureCacheDir() {
        $dir = dirname($this->cacheFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
    }
    
    private function isCacheValid() {
        return file_exists($this->cacheFile) && (time() - filemtime($this->cacheFile) < $this->cacheTime);
    }
    
    private function getCachedData() {
        $data = file_get_contents($this->cacheFile);
        $decoded = json_decode($data, true);
        
        if ($decoded) {
            $decoded['cached'] = true;
            return $decoded;
        }
        
        return false;
    }
    
    private function setCachedData($data) {
        file_put_contents($this->cacheFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
    
    /**
     * Fallback response when parsing fails
     */
    private function getFallbackResponse() {
        return [
            'success' => false,
            'message' => 'Kanal listesi alınamadı, varsayılan kanallar kullanılıyor',
            'count' => 5,
            'timestamp' => time(),
            'channels' => [
                [
                    'id' => 1,
                    'name' => 'beIN Sports 1 HD',
                    'number' => 1,
                    'url' => 'https://tv-trtspor.medya.trt.com.tr/master.m3u8',
                    'group' => 'Spor',
                    'logo' => 'https://via.placeholder.com/48x48/dc2626/ffffff?text=B1',
                    'viewers' => 25000,
                    'status' => 'live',
                    'quality' => 'HD',
                    'description' => 'beIN Sports 1 canlı spor yayını'
                ],
                [
                    'id' => 2,
                    'name' => 'beIN Sports 2 HD',
                    'number' => 2,
                    'url' => 'https://trkvz-live.daioncdn.net/aspor/aspor.m3u8',
                    'group' => 'Spor',
                    'logo' => 'https://via.placeholder.com/48x48/2563eb/ffffff?text=B2',
                    'viewers' => 20000,
                    'status' => 'live',
                    'quality' => 'HD',
                    'description' => 'beIN Sports 2 canlı spor yayını'
                ],
                [
                    'id' => 3,
                    'name' => 'TRT Spor HD',
                    'number' => 'TRT',
                    'url' => 'https://tv-trtspor.medya.trt.com.tr/master.m3u8',
                    'group' => 'Spor',
                    'logo' => 'https://via.placeholder.com/48x48/059669/ffffff?text=T',
                    'viewers' => 18000,
                    'status' => 'live',
                    'quality' => 'HD',
                    'description' => 'TRT Spor canlı yayını'
                ],
                [
                    'id' => 4,
                    'name' => 'A Spor HD',
                    'number' => 'A',
                    'url' => 'https://trkvz-live.daioncdn.net/aspor/aspor.m3u8',
                    'group' => 'Spor',
                    'logo' => 'https://via.placeholder.com/48x48/db2777/ffffff?text=A',
                    'viewers' => 15000,
                    'status' => 'live',
                    'quality' => 'HD',
                    'description' => 'A Spor canlı yayını'
                ],
                [
                    'id' => 5,
                    'name' => 'Smart Spor HD',
                    'number' => 'SM',
                    'url' => 'https://tv-trtspor.medya.trt.com.tr/master.m3u8',
                    'group' => 'Spor',
                    'logo' => 'https://via.placeholder.com/48x48/ef4444/ffffff?text=S',
                    'viewers' => 12000,
                    'status' => 'live',
                    'quality' => 'HD',
                    'description' => 'Smart Spor canlı yayını'
                ]
            ]
        ];
    }
}

// Handle request
try {
    $parser = new ChannelParser();
    $response = $parser->getChannels();
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'timestamp' => time()
    ]);
}
?>