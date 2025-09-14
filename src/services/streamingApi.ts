// Direct M3U8 streaming service with real-time updates
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
}

export interface StreamStats {
  total_channels: number;
  categories: string[];
  server_time: string;
  live_count: number;
}

class StreamingApiService {
  private m3u8Url: string;
  private cache: { [key: string]: { data: any; timestamp: number } } = {};
  private cacheTime: number = 60000; // 1 minute cache
  private viewerUpdateInterval: NodeJS.Timeout | null = null;
  private channels: Channel[] = [];

  constructor() {
    // Original M3U8 URL
    this.m3u8Url = 'http://hadronbalancer.xyz:80/get.php?username=sjafGsaGx1235&password=yJHHUuxUrn&type=m3u_plus&output=ts';
    
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
   * Fetch all available channels with multiple fallback strategies
   */
  async getChannels(): Promise<Channel[]> {
    const cacheKey = 'channels';
    
    // Check cache first
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTime) {
      this.channels = this.cache[cacheKey].data;
      return this.channels;
    }

    try {
      console.log('🔄 M3U8 listesi çekiliyor...', this.m3u8Url);
      
      // Try multiple methods to fetch M3U8
      let content = '';
      
      // Method 1: Direct fetch with CORS mode
      try {
        const response = await fetch(this.m3u8Url, {
          method: 'GET',
          mode: 'cors',
          headers: {
            'Accept': 'application/vnd.apple.mpegurl, application/x-mpegURL, text/plain',
            'User-Agent': 'SportStream/1.0',
          },
        });
        
        if (response.ok) {
          content = await response.text();
          console.log('✅ Direkt bağlantı başarılı:', content.length, 'karakter');
        }
      } catch (directError) {
        console.log('⚠️ Direkt bağlantı başarısız:', directError.message);
      }

      // Method 2: Try with AllOrigins proxy if direct fails
      if (!content || content.length < 100) {
        try {
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(this.m3u8Url)}`;
          const proxyResponse = await fetch(proxyUrl);
          
          if (proxyResponse.ok) {
            const data = await proxyResponse.json();
            content = data.contents;
            console.log('✅ Proxy bağlantısı başarılı:', content.length, 'karakter');
          }
        } catch (proxyError) {
          console.log('⚠️ Proxy bağlantısı başarısız:', proxyError.message);
        }
      }

      // Method 3: Try with CORS Anywhere as last resort
      if (!content || content.length < 100) {
        try {
          const corsUrl = `https://cors-anywhere.herokuapp.com/${this.m3u8Url}`;
          const corsResponse = await fetch(corsUrl, {
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
            },
          });
          
          if (corsResponse.ok) {
            content = await corsResponse.text();
            console.log('✅ CORS Anywhere başarılı:', content.length, 'karakter');
          }
        } catch (corsError) {
          console.log('⚠️ CORS Anywhere başarısız:', corsError.message);
        }
      }
      
      if (!content || content.length < 100) {
        throw new Error('M3U8 içeriği alınamadı');
      }

      const channels = this.parseM3U8Content(content);
      
      if (channels.length === 0) {
        throw new Error('Geçerli kanal bulunamadı');
      }
      
      // Cache the result
      this.cache[cacheKey] = {
        data: channels,
        timestamp: Date.now()
      };
      
      this.channels = channels;
      console.log(`✅ ${channels.length} kanal başarıyla ayrıştırıldı`);
      return channels;
      
    } catch (error) {
      console.error('❌ M3U8 çekme hatası:', error);
      console.log('🔄 Yedek kanallar yükleniyor...');
      
      // Use working demo channels with proper Turkish content
      this.channels = this.getTurkishDemoChannels();
      return this.channels;
    }
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
   * Parse M3U8 content with improved Turkish character support
   */
  private parseM3U8Content(content: string): Channel[] {
    const channels: Channel[] = [];
    
    // Fix Turkish character encoding issues
    content = this.fixTurkishEncoding(content);
    
    const lines = content.split('\n');
    let currentChannel: Partial<Channel> = {};
    let id = 1;

    console.log(`📋 ${lines.length} satır işleniyor...`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('#EXTINF:')) {
        // Parse channel information from EXTINF line
        currentChannel = this.parseExtinfLine(line);
        currentChannel.id = id++;
        currentChannel.status = 'live';
        currentChannel.viewers = this.generateRealisticViewerCount(currentChannel.category || 'Genel');
        
      } else if (line && !line.startsWith('#') && currentChannel.name && line.includes('http')) {
        // This is the stream URL
        currentChannel.url = line.trim();
        
        // Generate description if not present
        if (!currentChannel.description) {
          currentChannel.description = this.generateDescription(currentChannel);
        }
        
        // Only add channels with valid URLs and names
        if (currentChannel.url && currentChannel.name && this.isValidStreamUrl(currentChannel.url)) {
          channels.push(currentChannel as Channel);
          console.log(`✅ Kanal eklendi: ${currentChannel.name} (${currentChannel.category})`);
        } else {
          console.log(`❌ Geçersiz kanal atlandı: ${currentChannel.name}`);
        }
        
        currentChannel = {};
      }
    }

    console.log(`📊 Toplam ${channels.length} geçerli kanal bulundu`);

    // Sort channels by category and viewer count
    return channels.sort((a, b) => {
      if (a.category === b.category) {
        return b.viewers - a.viewers;
      }
      return a.category.localeCompare(b.category, 'tr');
    });
  }

  /**
   * Fix Turkish character encoding issues
   */
  private fixTurkishEncoding(content: string): string {
    // Common Turkish character fixes
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
   * Parse EXTINF line with improved Turkish support
   */
  private parseExtinfLine(line: string): Partial<Channel> {
    const channel: Partial<Channel> = {
      name: '',
      category: 'Genel',
      logo: '',
      description: '',
      language: 'tr',
      quality: 'HD'
    };

    // Extract channel name (everything after the comma) with Turkish support
    const nameMatch = line.match(/#EXTINF:.*,(.+)$/);
    if (nameMatch) {
      channel.name = this.fixTurkishEncoding(nameMatch[1].trim());
    }

    // Extract logo URL
    const logoMatch = line.match(/tvg-logo="([^"]+)"/);
    if (logoMatch) {
      channel.logo = logoMatch[1];
    }

    // Extract category/group with Turkish normalization
    const groupMatch = line.match(/group-title="([^"]+)"/);
    if (groupMatch) {
      channel.category = this.normalizeCategory(this.fixTurkishEncoding(groupMatch[1]));
    }

    // Extract TVG ID
    const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
    if (tvgIdMatch) {
      channel.tvg_id = tvgIdMatch[1];
    }

    // Extract language
    const langMatch = line.match(/tvg-language="([^"]+)"/);
    if (langMatch) {
      channel.language = langMatch[1];
    }

    // Detect quality from name or line
    channel.quality = this.detectQuality(line + ' ' + (channel.name || ''));

    // Generate placeholder logo if none provided
    if (!channel.logo && channel.name) {
      channel.logo = this.generatePlaceholderLogo(channel.name);
    }

    return channel;
  }

  /**
   * Improved URL validation for streaming
   */
  private isValidStreamUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const validProtocols = ['http:', 'https:'];
      const validExtensions = ['.m3u8', '.ts', '.mp4', '.flv'];
      const validKeywords = ['playlist', 'stream', 'live', 'hls'];
      
      if (!validProtocols.includes(urlObj.protocol)) {
        return false;
      }
      
      const lowerUrl = url.toLowerCase();
      return validExtensions.some(ext => lowerUrl.includes(ext)) ||
             validKeywords.some(keyword => lowerUrl.includes(keyword));
    } catch {
      return false;
    }
  }

  /**
   * Get direct stream URL (no proxy needed)
   */
  getStreamUrl(channelUrl: string): string {
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
    return categories.sort();
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
    return `https://via.placeholder.com/48x48/${color}/ffffff?text=${initial}`;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return url.includes('http') && (url.includes('.m3u8') || url.includes('.ts') || url.includes('playlist'));
    } catch {
      return false;
    }
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
        language: 'tr'
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
        language: 'tr'
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
        language: 'tr'
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
        language: 'tr'
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
        language: 'tr'
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
        language: 'tr'
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
        language: 'tr'
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
        language: 'tr'
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
  }
}

// Export singleton instance
export const streamingApi = new StreamingApiService();
export default streamingApi;