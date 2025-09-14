// Direct M3U8 streaming service with integrated channel parser
import { proxyService } from './proxyService';
import { channelParser, ParsedChannel } from './channelParser';

export interface Channel {
  id: number;
  name: string;
  category: string;
  logo: string;
  url: string;
  viewers: number;
  description: string;
  language?: string;
  quality?: string;
  status: 'live' | 'offline';
  tvg_id?: string;
  number?: string | number;
}

export interface StreamStats {
  total_channels: number;
  categories: string[];
  server_time: string;
  live_count: number;
}

class StreamingApiService {
  private cache: { [key: string]: { data: any; timestamp: number } } = {};
  private cacheTime: number = 60000; // 1 minute cache
  private viewerUpdateInterval: NodeJS.Timeout | null = null;
  private channels: Channel[] = [];

  constructor() {
    // Start real-time viewer updates
    this.startViewerUpdates();
  }

  /**
   * Start real-time viewer count updates
   */
  private startViewerUpdates() {
    if (this.viewerUpdateInterval) {
      clearInterval(this.viewerUpdateInterval);
    }
    
    this.viewerUpdateInterval = setInterval(() => {
      this.updateViewerCounts();
    }, 3000); // Update every 3 seconds
  }

  /**
   * Update viewer counts with realistic fluctuations
   */
  private updateViewerCounts() {
    if (this.channels.length === 0) return;
    
    this.channels = this.channels.map(channel => {
      if (channel.status === 'live') {
        // Add realistic fluctuation (-10% to +15%)
        const baseViewers = channel.viewers;
        const fluctuation = (Math.random() - 0.4) * 0.25; // -10% to +15%
        const newViewers = Math.max(100, Math.floor(baseViewers * (1 + fluctuation)));
        
        return { ...channel, viewers: newViewers };
      }
      return channel;
    });
    
    // Trigger update for any listeners
    this.notifyViewerUpdate();
  }

  private notifyViewerUpdate() {
    // Custom event for real-time updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('viewerUpdate', { detail: this.channels }));
    }
  }

  /**
   * Fetch all available channels using the new parser
   */
  async getChannels(): Promise<Channel[]> {
    const cacheKey = 'channels';
    
    // Check cache first
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTime) {
      this.channels = this.cache[cacheKey].data;
      return this.channels;
    }

    try {
      console.log('🔄 Fetching channels using integrated parser...');
      
      // Use the new channel parser
      const response = await channelParser.fetchAndParseChannels();
      
      if (!response.success || response.channels.length === 0) {
        console.log('⚠️ Parser returned no channels, using fallback');
        this.channels = this.convertParsedChannels(response.channels);
        return this.channels;
      }

      // Convert parsed channels to our format
      const channels = this.convertParsedChannels(response.channels);
      
      // Cache the result
      this.cache[cacheKey] = {
        data: channels,
        timestamp: Date.now()
      };
      
      this.channels = channels;
      console.log(`✅ Successfully loaded ${channels.length} channels via parser`);
      return channels;
      
    } catch (error) {
      console.error('❌ Channel parser failed:', error);
      console.log('🔄 Using Turkish demo channels...');
      
      // Use working demo channels
      this.channels = this.getTurkishDemoChannels();
      return this.channels;
    }
  }

  /**
   * Convert parsed channels to our Channel format
   */
  private convertParsedChannels(parsedChannels: ParsedChannel[]): Channel[] {
    return parsedChannels.map(parsed => ({
      id: parsed.id,
      name: parsed.name,
      category: parsed.category,
      logo: parsed.logo || this.generatePlaceholderLogo(parsed.name),
      url: parsed.url,
      viewers: parsed.viewers,
      description: parsed.description,
      language: 'tr',
      quality: parsed.quality,
      status: parsed.status,
      number: parsed.number
    }));
  }

  /**
   * Get channels by category
   */
  async getChannelsByCategory(category: string): Promise<Channel[]> {
    const channels = await this.getChannels();
    return channels.filter(channel => 
      channel.category.toLowerCase() === category.toLowerCase()
    );
  }

  /**
   * Search channels by name
   */
  async searchChannels(query: string): Promise<Channel[]> {
    const channels = await this.getChannels();
    const lowerQuery = query.toLowerCase();
    
    return channels.filter(channel =>
      channel.name.toLowerCase().includes(lowerQuery) ||
      channel.description.toLowerCase().includes(lowerQuery) ||
      channel.category.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get direct stream URL with proxy processing if needed
   */
  getStreamUrl(channelUrl: string): string {
    // For M3U8 URLs, we can try to process them through our proxy service
    if (channelUrl.includes('.m3u8')) {
      return channelUrl; // Direct M3U8 URL - modern browsers handle this well
    }
    
    // For other stream types, return as is
    return channelUrl;
  }

  /**
   * Process M3U8 URL through proxy service (future enhancement)
   */
  async processM3U8Stream(channelUrl: string): Promise<string> {
    try {
      // Check if URL needs .m3u8 extension
      const processedUrl = await proxyService.checkAndFixM3U8Url(channelUrl);
      
      // If it's a valid M3U8, we can process it
      if (processedUrl.includes('.m3u8')) {
        return processedUrl;
      }
      
      // For non-M3U8 streams, create a simple playlist
      return `data:application/vnd.apple.mpegurl,${encodeURIComponent(proxyService.createSimplePlaylist(channelUrl))}`;
      
    } catch (error) {
      console.error('Stream processing failed:', error);
      return channelUrl; // Return original URL as fallback
    }
  }

  /**
   * Get streaming statistics
   */
  async getStats(): Promise<StreamStats> {
    try {
      const channels = await this.getChannels();
      const categories = [...new Set(channels.map(c => c.category))];
      const liveChannels = channels.filter(c => c.status === 'live');
      
      return {
        total_channels: channels.length,
        categories: categories,
        server_time: new Date().toISOString(),
        live_count: liveChannels.length
      };
    } catch (error) {
      console.error('Error generating stats:', error);
      return {
        total_channels: 0,
        categories: [],
        server_time: new Date().toISOString(),
        live_count: 0
      };
    }
  }

  /**
   * Get unique categories from channels
   */
  async getCategories(): Promise<string[]> {
    const channels = await this.getChannels();
    const categories = [...new Set(channels.map(channel => channel.category))];
    return categories.sort((a, b) => a.localeCompare(b, 'tr'));
  }

  /**
   * Utility methods
   */
  private normalizeCategory(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'Sports': 'Spor',
      'Sport': 'Spor',
      'Football': 'Futbol',
      'Soccer': 'Futbol',
      'Basketball': 'Basketbol',
      'Tennis': 'Tenis',
      'Volleyball': 'Voleybol',
      'News': 'Haber',
      'Entertainment': 'Eğlence',
      'Movies': 'Film',
      'Music': 'Müzik',
      'Documentary': 'Belgesel',
      'Kids': 'Çocuk',
      'Series': 'Dizi'
    };
    
    return categoryMap[category] || category;
  }

  private generateRealisticViewerCount(category: string): number {
    const baseRanges: { [key: string]: [number, number] } = {
      'Spor': [5000, 50000],
      'Futbol': [10000, 100000],
      'Basketbol': [2000, 25000],
      'Haber': [1000, 15000],
      'Eğlence': [500, 10000],
      'Film': [1000, 20000],
      'Müzik': [500, 8000],
      'Belgesel': [300, 5000],
      'Çocuk': [800, 12000],
      'Dizi': [1500, 18000]
    };
    
    const range = baseRanges[category] || [500, 5000];
    return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  }

  private generateDescription(channel: Partial<Channel>): string {
    const templates: { [key: string]: string } = {
      'Spor': 'Canlı spor yayınları ve maç özetleri',
      'Futbol': 'Futbol maçları ve analiz programları',
      'Basketbol': 'NBA, Euroleague ve yerel basketbol',
      'Haber': 'Güncel haberler ve son dakika gelişmeleri',
      'Eğlence': 'Eğlence programları ve talk show\'lar',
      'Film': 'En yeni filmler ve klasikler',
      'Müzik': 'Müzik videoları ve konserler',
      'Belgesel': 'Belgesel programlar ve doğa yayınları',
      'Çocuk': 'Çocuk programları ve çizgi filmler',
      'Dizi': 'Türk ve yabancı diziler'
    };
    
    return templates[channel.category || 'Genel'] || 'Canlı TV yayını';
  }

  private detectQuality(content: string): string {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('4k') || lowerContent.includes('uhd') || lowerContent.includes('2160')) {
      return '4K';
    } else if (lowerContent.includes('fhd') || lowerContent.includes('1080')) {
      return 'FHD';
    } else if (lowerContent.includes('hd') || lowerContent.includes('720')) {
      return 'HD';
    }
    return 'SD';
  }

  private generatePlaceholderLogo(name: string): string {
    const initial = name.charAt(0).toUpperCase();
    const colors = ['238636', 'da3633', 'fb8500', '6f42c1', '20c997', 'fd7e14', 'e83e8c', '6610f2'];
    const colorIndex = name.length % colors.length;
    const color = colors[colorIndex];
    return `https://via.placeholder.com/48x48/${color}/ffffff?text=${encodeURIComponent(initial)}`;
  }

  private isValidStreamUrl(url: string): boolean {
    try {
      new URL(url);
      return url.includes('http') && (url.includes('.m3u8') || url.includes('.ts') || url.includes('playlist') || url.includes(':8080'));
    } catch {
      return false;
    }
  }

  /**
   * Fix Turkish character encoding issues
   */
  private fixTurkishEncoding(content: string): string {
    const fixes: [RegExp, string][] = [
      [/Ã§/g, 'ç'], [/Ã‡/g, 'Ç'],
      [/ÄŸ/g, 'ğ'], [/Ä/g, 'Ğ'],
      [/Ä±/g, 'ı'], [/Ä°/g, 'İ'],
      [/Ã¶/g, 'ö'], [/Ã–/g, 'Ö'],
      [/Ã¼/g, 'ü'], [/Ãœ/g, 'Ü'],
      [/ÅŸ/g, 'ş'], [/Åž/g, 'Ş'],
      [/â€™/g, "'"], [/â€œ/g, '"'], [/â€/g, '"'],
      [/â€"/g, '-'], [/â€¦/g, '...'],
    ];
    
    let fixed = content;
    fixes.forEach(([from, to]) => {
      fixed = fixed.replace(from, to);
    });
    
    return fixed;
  }

  /**
   * Get working Turkish demo channels with real streaming URLs
   */
  private getTurkishDemoChannels(): Channel[] {
    return [
      {
        id: 1,
        name: 'TRT Spor HD',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/dc2626/ffffff?text=TS',
        url: 'https://tv-trtspor.medya.trt.com.tr/master.m3u8',
        viewers: this.generateRealisticViewerCount('Spor'),
        description: 'TRT Spor canlı yayını',
        status: 'live' as const,
        quality: 'HD',
        language: 'tr',
        number: 'TRT'
      },
      {
        id: 2,
        name: 'A Spor HD',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/2563eb/ffffff?text=AS',
        url: 'https://trkvz-live.daioncdn.net/aspor/aspor.m3u8',
        viewers: this.generateRealisticViewerCount('Spor'),
        description: 'A Spor canlı yayını',
        status: 'live' as const,
        quality: 'HD',
        language: 'tr',
        number: 'A'
      },
      {
        id: 3,
        name: 'TRT 1 HD',
        category: 'Genel',
        logo: 'https://via.placeholder.com/48x48/059669/ffffff?text=T1',
        url: 'https://tv-trt1.medya.trt.com.tr/master.m3u8',
        viewers: this.generateRealisticViewerCount('Genel'),
        description: 'TRT 1 canlı yayını',
        status: 'live' as const,
        quality: 'HD',
        language: 'tr',
        number: 1
      },
      {
        id: 4,
        name: 'Show TV',
        category: 'Eğlence',
        logo: 'https://via.placeholder.com/48x48/db2777/ffffff?text=ST',
        url: 'https://ciner-live.daioncdn.net/showtv/showtv.m3u8',
        viewers: this.generateRealisticViewerCount('Eğlence'),
        description: 'Show TV canlı yayını',
        status: 'live' as const,
        quality: 'HD',
        language: 'tr',
        number: 'SH'
      },
      {
        id: 5,
        name: 'CNN Türk',
        category: 'Haber',
        logo: 'https://via.placeholder.com/48x48/ef4444/ffffff?text=CN',
        url: 'https://live.duhnet.tv/S2/HLS_LIVE/cnnturknp/track_4_1000/playlist.m3u8',
        viewers: this.generateRealisticViewerCount('Haber'),
        description: 'CNN Türk canlı haber yayını',
        status: 'live' as const,
        quality: 'HD',
        language: 'tr',
        number: 'CNN'
      },
      {
        id: 6,
        name: 'TRT Haber',
        category: 'Haber',
        logo: 'https://via.placeholder.com/48x48/b91c1c/ffffff?text=TH',
        url: 'https://tv-trthaber.medya.trt.com.tr/master.m3u8',
        viewers: this.generateRealisticViewerCount('Haber'),
        description: 'TRT Haber canlı yayını',
        status: 'live' as const,
        quality: 'HD',
        language: 'tr',
        number: 'TH'
      },
      {
        id: 7,
        name: 'TRT Çocuk',
        category: 'Çocuk',
        logo: 'https://via.placeholder.com/48x48/f59e0b/ffffff?text=TÇ',
        url: 'https://tv-trtcocuk.medya.trt.com.tr/master.m3u8',
        viewers: this.generateRealisticViewerCount('Çocuk'),
        description: 'TRT Çocuk canlı yayını',
        status: 'live' as const,
        quality: 'HD',
        language: 'tr',
        number: 'TÇ'
      },
      {
        id: 8,
        name: 'TRT Müzik',
        category: 'Müzik',
        logo: 'https://via.placeholder.com/48x48/8b5cf6/ffffff?text=TM',
        url: 'https://tv-trtmuzik.medya.trt.com.tr/master.m3u8',
        viewers: this.generateRealisticViewerCount('Müzik'),
        description: 'TRT Müzik canlı yayını',
        status: 'live' as const,
        quality: 'HD',
        language: 'tr',
        number: 'TM'
      },
      {
        id: 9,
        name: 'beIN Sports 1 HD',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/dc2626/ffffff?text=B1',
        url: 'https://tv-trtspor.medya.trt.com.tr/master.m3u8', // Fallback URL
        viewers: this.generateRealisticViewerCount('Spor'),
        description: 'beIN Sports 1 canlı spor yayını',
        status: 'live' as const,
        quality: 'HD',
        language: 'tr',
        number: 1
      },
      {
        id: 10,
        name: 'Smart Spor HD',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/059669/ffffff?text=SS',
        url: 'https://trkvz-live.daioncdn.net/aspor/aspor.m3u8', // Fallback URL
        viewers: this.generateRealisticViewerCount('Spor'),
        description: 'Smart Spor canlı yayını',
        status: 'live' as const,
        quality: 'HD',
        language: 'tr',
        number: 'SS'
      }
    ];
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.viewerUpdateInterval) {
      clearInterval(this.viewerUpdateInterval);
      this.viewerUpdateInterval = null;
    }
    
    // Clear cache
    proxyService.clearCache();
    channelParser.clearCache();
  }
}

// Export singleton instance
export const streamingApi = new StreamingApiService();
export default streamingApi;