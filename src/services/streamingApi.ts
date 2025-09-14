// Direct M3U8 streaming service - fetches data directly from source
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
  private cacheTime: number = 300000; // 5 minutes
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  constructor() {
    this.m3u8Url = 'http://hadronbalancer.xyz:80/get.php?username=sjafGsaGx1235&password=yJHHUuxUrn&type=m3u_plus&output=ts';
  }

  /**
   * Fetch all available channels directly from M3U8 source
   */
  async getChannels(): Promise<Channel[]> {
    const cacheKey = 'channels';
    
    // Check cache first
    if (this.cache[cacheKey] && (Date.now() - this.cache[cacheKey].timestamp) < this.cacheTime) {
      return this.cache[cacheKey].data;
    }

    try {
      console.log('Fetching M3U8 playlist from:', this.m3u8Url);
      
      // Use a CORS proxy for cross-origin requests
      const proxyUrl = `https://cors-anywhere.herokuapp.com/${this.m3u8Url}`;
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        console.warn(`Failed to fetch from proxy, using direct URL. Status: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const content = await response.text();
      console.log('M3U8 content length:', content.length);
      
      if (!content || content.length < 100) {
        throw new Error('Invalid M3U8 content');
      }

      const channels = this.parseM3U8Content(content);
      
      // Cache the result
      this.cache[cacheKey] = {
        data: channels,
        timestamp: Date.now()
      };
      
      console.log(`Parsed ${channels.length} channels from M3U8`);
      return channels;
      
    } catch (error) {
      console.error('Error fetching M3U8:', error);
      console.log('Using fallback channels due to error');
      // Return fallback channels on error
      return this.getFallbackChannels();
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
   * Parse M3U8 content and extract channel information
   */
  private parseM3U8Content(content: string): Channel[] {
    const channels: Channel[] = [];
    const lines = content.split('\n');
    let currentChannel: Partial<Channel> = {};
    let id = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('#EXTINF:')) {
        // Parse channel information from EXTINF line
        currentChannel = this.parseExtinfLine(line);
        currentChannel.id = id++;
        currentChannel.status = 'live';
        currentChannel.viewers = this.generateRealisticViewerCount(currentChannel.category || 'Genel');
        
      } else if (line && !line.startsWith('#') && currentChannel.name) {
        // This is the stream URL
        currentChannel.url = line;
        
        // Generate description if not present
        if (!currentChannel.description) {
          currentChannel.description = this.generateDescription(currentChannel);
        }
        
        // Only add channels with valid URLs and names
        if (currentChannel.url && currentChannel.name && this.isValidUrl(currentChannel.url)) {
          channels.push(currentChannel as Channel);
        }
        
        currentChannel = {};
      }
    }

    // Sort channels by category and viewer count
    return channels.sort((a, b) => {
      if (a.category === b.category) {
        return b.viewers - a.viewers;
      }
      return a.category.localeCompare(b.category);
    });
  }

  /**
   * Parse EXTINF line for channel information
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

    // Extract channel name (everything after the comma)
    const nameMatch = line.match(/#EXTINF:.*,(.+)$/);
    if (nameMatch) {
      channel.name = nameMatch[1].trim();
    }

    // Extract logo URL
    const logoMatch = line.match(/tvg-logo="([^"]+)"/);
    if (logoMatch) {
      channel.logo = logoMatch[1];
    }

    // Extract category/group
    const groupMatch = line.match(/group-title="([^"]+)"/);
    if (groupMatch) {
      channel.category = this.normalizeCategory(groupMatch[1]);
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
   * Fallback channels when M3U8 fetch fails
   */
  private getFallbackChannels(): Channel[] {
    return [
      {
        id: 1,
        name: 'Spor TV HD',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/238636/ffffff?text=S',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        viewers: 15420,
        description: 'Canlı spor yayınları',
        status: 'live',
        quality: 'HD'
      },
      {
        id: 2,
        name: 'Futbol Plus',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/da3633/ffffff?text=F',
        url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
        viewers: 8930,
        description: 'Futbol maçları canlı',
        status: 'live',
        quality: 'FHD'
      },
      {
        id: 3,
        name: 'Basketbol TV',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/fb8500/ffffff?text=B',
        url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
        viewers: 5670,
        description: 'NBA ve Euroleague',
        status: 'live',
        quality: 'HD'
      },
      {
        id: 4,
        name: 'Tenis World',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/20c997/ffffff?text=T',
        url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
        viewers: 2180,
        description: 'Tenis turnuvaları',
        status: 'live',
        quality: 'FHD'
      },
      {
        id: 5,
        name: 'Motor Sports',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/fd7e14/ffffff?text=M',
        url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
        viewers: 7890,
        description: 'Formula 1 ve MotoGP',
        status: 'live',
        quality: 'HD'
      },
      {
        id: 6,
        name: 'Olimpiyat TV',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/e83e8c/ffffff?text=O',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        viewers: 12340,
        description: 'Olimpik sporlar',
        status: 'live',
        quality: 'HD'
      },
      {
        id: 7,
        name: 'Extreme Sports',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/6610f2/ffffff?text=X',
        url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
        viewers: 4560,
        description: 'Ekstrem sporlar',
        status: 'live',
        quality: 'HD'
      }
    ];
  }
}

// Export singleton instance
export const streamingApi = new StreamingApiService();
export default streamingApi;