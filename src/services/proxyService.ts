// M3U8 Proxy Service - TypeScript Implementation
export class ProxyService {
  private cacheTime = 3600000; // 1 hour in milliseconds
  private userAgent = 'VLC/3.0.16';
  private baseUrl = window.location.origin; // Current domain for proxying

  /**
   * Get proxied stream URL
   */
  getProxiedStreamUrl(originalUrl: string): string {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${this.baseUrl}/api/proxy?url=${encodedUrl}`;
  }

  /**
   * Cache management using localStorage
   */
  private getCachedData(key: string): any | null {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      const now = Date.now();
      
      if (now - data.timestamp > this.cacheTime) {
        localStorage.removeItem(key);
        return null;
      }
      
      return data.content;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  private setCachedData(key: string, content: any): void {
    try {
      const data = {
        content,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  /**
   * Fetch M3U8 content with proxy handling
   */
  async fetchM3U8Content(url: string): Promise<string> {
    const cacheKey = `m3u8_${btoa(url)}`;
    
    // Try cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      console.log('📦 Cache hit for M3U8:', url);
      return cached;
    }

    try {
      console.log('🌐 Fetching M3U8:', url);
      
      // Try multiple methods
      let content = '';
      
      // Method 1: Direct fetch
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': '*/*',
            'User-Agent': this.userAgent,
            'Connection': 'keep-alive'
          },
          mode: 'cors'
        });
        
        if (response.ok) {
          content = await response.text();
          if (content.includes('#EXTM3U')) {
            console.log('✅ Direct fetch successful');
          }
        }
      } catch (directError) {
        console.log('⚠️ Direct fetch failed:', directError.message);
      }

      // Method 2: AllOrigins proxy
      if (!content || !content.includes('#EXTM3U')) {
        try {
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl);
          
          if (response.ok) {
            const data = await response.json();
            if (data.contents && data.contents.includes('#EXTM3U')) {
              content = data.contents;
              console.log('✅ AllOrigins proxy successful');
            }
          }
        } catch (proxyError) {
          console.log('⚠️ AllOrigins proxy failed:', proxyError.message);
        }
      }

      // Method 3: CORS Anywhere
      if (!content || !content.includes('#EXTM3U')) {
        try {
          const corsUrl = `https://cors-anywhere.herokuapp.com/${url}`;
          const response = await fetch(corsUrl, {
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'User-Agent': this.userAgent
            }
          });
          
          if (response.ok) {
            const corsContent = await response.text();
            if (corsContent.includes('#EXTM3U')) {
              content = corsContent;
              console.log('✅ CORS Anywhere successful');
            }
          }
        } catch (corsError) {
          console.log('⚠️ CORS Anywhere failed:', corsError.message);
        }
      }

      if (!content || !content.includes('#EXTM3U')) {
        throw new Error('M3U8 content could not be fetched from any source');
      }

      // Cache the result
      this.setCachedData(cacheKey, content);
      return content;
      
    } catch (error) {
      console.error('❌ M3U8 fetch failed:', error);
      throw error;
    }
  }

  /**
   * Process M3U8 content and convert URLs to proxy URLs
   */
  processM3U8Content(content: string, originalUrl: string): string {
    const lines = content.split('\n');
    const baseUrl = this.getBaseUrl(originalUrl);
    const processedLines: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        // Keep metadata lines as is
        processedLines.push(trimmedLine);
      } else {
        // This is a segment URL
        let segmentUrl = trimmedLine;
        
        // Convert relative URLs to absolute
        if (!segmentUrl.startsWith('http')) {
          segmentUrl = baseUrl + segmentUrl;
        }
        
        // Convert to proxy URL
        const proxyUrl = this.createProxyUrl(segmentUrl, 'segment');
        processedLines.push(proxyUrl);
      }
    }

    return processedLines.join('\n');
  }

  /**
   * Create a proxy URL for segments
   */
  private createProxyUrl(url: string, action: 'segment' | 'ts'): string {
    const encodedUrl = btoa(url);
    // Since we can't run PHP, we'll return the original URL
    // In a real implementation, this would point to your proxy server
    return url; // Direct URL - browsers will handle CORS
  }

  /**
   * Get base URL from full URL
   */
  private getBaseUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1)}`;
    } catch {
      const lastSlash = url.lastIndexOf('/');
      return lastSlash > 0 ? url.substring(0, lastSlash + 1) : url;
    }
  }

  /**
   * Check if URL needs .m3u8 extension
   */
  async checkAndFixM3U8Url(url: string): Promise<string> {
    // If it's already an M3U8 URL, return as is
    if (url.includes('.m3u8')) {
      return url;
    }

    // If it's an IPTV URL, try adding .m3u8
    if (url.includes(':8080/')) {
      const testUrl = url.endsWith('/') ? url.slice(0, -1) + '.m3u8' : url + '.m3u8';
      
      try {
        const response = await fetch(testUrl, {
          method: 'HEAD',
          timeout: 3000
        } as any);
        
        if (response.ok) {
          console.log('✅ M3U8 extension added successfully:', testUrl);
          return testUrl;
        }
      } catch (error) {
        console.log('⚠️ M3U8 extension test failed for:', testUrl);
      }
    }

    return url;
  }

  /**
   * Create a simple M3U8 playlist for non-M3U8 streams
   */
  createSimplePlaylist(streamUrl: string): string {
    return `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:10\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:10.0,\n${streamUrl}\n#EXT-X-ENDLIST`;
  }

  /**
   * Clean up cache
   */
  clearCache(): void {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('m3u8_') || key.startsWith('channels_')) {
        localStorage.removeItem(key);
      }
    });
    console.log('🧹 Cache cleared');
  }
}

// Export singleton instance
export const proxyService = new ProxyService();
export default proxyService;
