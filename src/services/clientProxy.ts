/**
 * Client-side proxy service for streaming
 * Handles M3U8 playlists and CORS issues entirely in TypeScript
 */

export interface ProxyResponse {
  success: boolean;
  content?: string;
  error?: string;
  url?: string;
}

class ClientProxyService {
  private corsProxies = [
    'https://corsproxy.io/?',
    'https://cors-anywhere.herokuapp.com/',
    'https://cors.bridged.cc/',
    'https://api.allorigins.win/raw?url=',
  ];
  
  private cache = new Map<string, { content: string; timestamp: number }>();
  private readonly CACHE_TIME = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch content through CORS proxy with fallbacks
   */
  async fetchWithProxy(url: string): Promise<ProxyResponse> {
    // Check cache first
    const cached = this.getFromCache(url);
    if (cached) {
      return { success: true, content: cached };
    }

    // Try direct fetch first (works for HTTPS sources)
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StreamProxy)',
          'Accept': '*/*',
        },
      });
      
      if (response.ok) {
        const content = await response.text();
        this.setCache(url, content);
        return { success: true, content };
      }
    } catch (error) {
      console.log('Direct fetch failed, trying proxies...');
    }

    // Try each proxy
    for (const proxy of this.corsProxies) {
      try {
        const proxyUrl = proxy + encodeURIComponent(url);
        console.log(`Trying proxy: ${proxy}`);
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': '*/*',
          },
        });

        if (response.ok) {
          const content = await response.text();
          
          // Validate content (make sure it's not an error page)
          if (this.isValidContent(content, url)) {
            this.setCache(url, content);
            return { success: true, content };
          }
        }
      } catch (error) {
        console.log(`Proxy ${proxy} failed:`, error);
        continue;
      }
    }

    return { success: false, error: 'All proxy attempts failed' };
  }

  /**
   * Process M3U8 playlist and create proxy URLs for segments
   */
  processM3U8(content: string, originalUrl: string): string {
    const lines = content.split('\n');
    const baseUrl = this.getBaseUrl(originalUrl);
    const processedLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        // Keep metadata lines as-is
        processedLines.push(trimmedLine);
      } else {
        // This is a segment URL
        let segmentUrl = trimmedLine;
        
        // Convert relative URLs to absolute
        if (!segmentUrl.startsWith('http')) {
          segmentUrl = baseUrl + segmentUrl.replace(/^\//, '');
        }
        
        // Create a data URL that our video player can use
        // We'll handle the actual fetching in the video player
        processedLines.push(`data:proxy-segment,${encodeURIComponent(segmentUrl)}`);
      }
    }

    return processedLines.join('\n');
  }

  /**
   * Create a simple M3U8 playlist for direct streams
   */
  createSimplePlaylist(streamUrl: string): string {
    return [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXTINF:10.0,',
      `data:proxy-stream,${encodeURIComponent(streamUrl)}`,
      '#EXT-X-ENDLIST'
    ].join('\n');
  }

  /**
   * Get the base URL from a full URL
   */
  private getBaseUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname.substring(0, parsed.pathname.lastIndexOf('/') + 1)}`;
    } catch {
      return url.substring(0, url.lastIndexOf('/') + 1);
    }
  }

  /**
   * Validate that the fetched content is legitimate
   */
  private isValidContent(content: string, originalUrl: string): boolean {
    // Check for common error indicators
    if (content.toLowerCase().includes('<!doctype html') ||
        content.toLowerCase().includes('<html') ||
        content.includes('Access Denied') ||
        content.includes('403 Forbidden') ||
        content.includes('Rate limit exceeded') ||
        content.length < 10) {
      return false;
    }

    // For M3U8 files, check for proper format
    if (originalUrl.includes('.m3u8') && !content.includes('#EXTM3U')) {
      return false;
    }

    return true;
  }

  /**
   * Cache management
   */
  private getFromCache(url: string): string | null {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TIME) {
      return cached.content;
    }
    this.cache.delete(url);
    return null;
  }

  private setCache(url: string, content: string): void {
    this.cache.set(url, { content, timestamp: Date.now() });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get proxied stream URL for video player
   */
  getProxiedStreamUrl(originalUrl: string): string {
    // Return a custom protocol URL that our video player will handle
    return `proxy://${encodeURIComponent(originalUrl)}`;
  }
}

export const clientProxy = new ClientProxyService();
