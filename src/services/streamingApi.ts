// Direct M3U8 streaming service - TypeScript only
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
  private apiBaseUrl: string;
  private cache: { [key: string]: { data: any; timestamp: number } } = {};
  private cacheTime: number = 60000; // 1 minute cache
  private viewerUpdateInterval: NodeJS.Timeout | null = null;
  private channels: Channel[] = [];
  private backendOnline = false;
  private realViewers: { [channelId: string]: Set<string> } = {};
  private viewerIpTracker: { [ip: string]: { channelId: string; timestamp: number } } = {};
  
  constructor() {
    // No backend needed - direct streaming
    this.apiBaseUrl = '';
    
    // Start real-time viewer updates
    this.startViewerUpdates();
    
    console.log('🔧 StreamingApi initialized - Direct streaming mode');
  }

  /**
   * Track real viewer by IP for a channel
   */
  trackViewer(channelId: string, userIp?: string): void {
    // Generate a pseudo-IP if not provided (for demo purposes)
    const ip = userIp || this.generatePseudoIP();
    
    // Remove old viewer tracking for this IP
    if (this.viewerIpTracker[ip]) {
      const oldChannelId = this.viewerIpTracker[ip].channelId;
      if (this.realViewers[oldChannelId]) {
        this.realViewers[oldChannelId].delete(ip);
      }
    }
    
    // Add to new channel
    if (!this.realViewers[channelId]) {
      this.realViewers[channelId] = new Set();
    }
    this.realViewers[channelId].add(ip);
    
    // Update tracker
    this.viewerIpTracker[ip] = {
      channelId,
      timestamp: Date.now()
    };
    
    // Clean old viewers (older than 30 seconds)
    this.cleanOldViewers();
  }

  /**
   * Get real viewer count for a channel
   */
  getRealViewerCount(channelId: string): number {
    return this.realViewers[channelId]?.size || 0;
  }

  /**
   * Clean viewers older than 30 seconds
   */
  private cleanOldViewers(): void {
    const now = Date.now();
    const timeout = 30000; // 30 seconds
    
    Object.entries(this.viewerIpTracker).forEach(([ip, data]) => {
      if (now - data.timestamp > timeout) {
        // Remove from channel viewers
        if (this.realViewers[data.channelId]) {
          this.realViewers[data.channelId].delete(ip);
        }
        // Remove from tracker
        delete this.viewerIpTracker[ip];
      }
    });
  }

  /**
   * Generate a pseudo-IP for demo purposes
   */
  private generatePseudoIP(): string {
    return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
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
   * Update viewer counts with real IP-based counts
   */
  private updateViewerCounts() {
    if (this.channels.length === 0) return;
    
    // Clean old viewers first
    this.cleanOldViewers();
    
    this.channels = this.channels.map(channel => {
      if (channel.status === 'live') {
        // Use real viewer count, but add some base viewers for demo
        const realCount = this.getRealViewerCount(channel.id.toString());
        const baseViewers = Math.max(100, Math.floor(Math.random() * 1000) + 500); // Demo base
        const newViewers = baseViewers + (realCount * 10); // Multiply real viewers for effect
        
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
   * Fetch all available channels from PHP backend
   */
  async getChannels(): Promise<Channel[]> {
    const cacheKey = 'channels';
    
    // Check cache first
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTime) {
      this.channels = this.cache[cacheKey].data;
      return this.channels;
    }

    try {
      // Direct M3U parsing - no backend needed
      const response = await channelParser.fetchAndParseChannels();
      if (response.success && response.channels.length > 0) {
        this.channels = this.convertParsedChannels(response.channels);
        
        // Cache the result
        this.cache[cacheKey] = {
          data: this.channels,
          timestamp: Date.now()
        };
        
        console.log('✅ Direct M3U parsing succeeded');
        return this.channels;
      }
    } catch (error) {
      console.error('❌ M3U parsing failed:', error);
    }
    
    // Use Turkish demo channels as fallback
    console.log('🔄 Using demo channels...');
    this.channels = this.getTurkishDemoChannels();
    return this.channels;
  }

  /**
   * Convert backend PHP response to our Channel format
   */
  private convertBackendChannels(backendChannels: any[]): Channel[] {
    return backendChannels.map((backend, index) => ({
      id: backend.id || index + 1,
      name: backend.name || 'Unknown Channel',
      category: backend.group || backend.category || 'Spor',
      logo: backend.logo || this.generatePlaceholderLogo(backend.name || 'Unknown'),
      url: backend.url || '',
      viewers: backend.viewers || this.generateRealisticViewerCount('Spor'),
      description: backend.description || `${backend.name} canlı yayını`,
      language: 'tr',
      quality: backend.quality || 'HD',
      status: backend.status || 'live' as const,
      number: backend.number
    }));
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
   * Get direct stream URL - no proxy needed
   */
  getStreamUrl(channelUrl: string): string {
    return channelUrl;
  }

  /**
   * Get direct stream URL for testing (bypasses proxy)
   */
  getDirectStreamUrl(channelUrl: string): string {
    return channelUrl;
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