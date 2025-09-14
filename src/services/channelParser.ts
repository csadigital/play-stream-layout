// Channel Parser Service - Equivalent to PHP M3U parser
import { proxyService } from './proxyService';

export interface ParsedChannel {
  name: string;
  number: string | number;
  url: string;
  group: string;
  logo?: string;
  id: number;
  viewers: number;
  status: 'live' | 'offline';
  quality: string;
  description: string;
  category: string;
}

export interface ChannelResponse {
  success: boolean;
  message?: string;
  count: number;
  channels: ParsedChannel[];
  timestamp: number;
}

export class ChannelParserService {
  private m3uUrl = 'http://hadronbalancer.xyz:80/get.php?username=sjafGsaGx1235&password=yJHHUuxUrn&type=m3u_plus&output=ts';
  private cacheKey = 'channels_parsed';
  private cacheTime = 3600000; // 1 hour

  /**
   * Main function to fetch and parse M3U channels
   */
  async fetchAndParseChannels(): Promise<ChannelResponse> {
    try {
      // Check cache first
      const cached = this.getCachedChannels();
      if (cached) {
        console.log('📦 Using cached channels');
        return cached;
      }

      console.log('🔄 Fetching fresh M3U data...');
      
      // Fetch M3U content
      const content = await proxyService.fetchM3U8Content(this.m3uUrl);
      
      if (!content || !content.includes('#EXTINF')) {
        throw new Error('Invalid M3U content received');
      }

      // Parse channels
      const channels = this.parseM3UContent(content);
      
      // Filter for sports channels
      const sportChannels = this.filterSportChannels(channels);
      
      // Sort channels
      const sortedChannels = this.sortChannels(sportChannels);
      
      // Limit to 50 channels
      const limitedChannels = sortedChannels.slice(0, 50);
      
      // Create response
      const response: ChannelResponse = {
        success: true,
        count: limitedChannels.length,
        channels: limitedChannels,
        timestamp: Date.now()
      };

      // Cache the result
      this.setCachedChannels(response);
      
      console.log(`✅ Successfully parsed ${limitedChannels.length} sport channels`);
      return response;

    } catch (error) {
      console.error('❌ Channel parsing failed:', error);
      return this.getFallbackChannels();
    }
  }

  /**
   * Parse M3U content into channel objects
   */
  private parseM3UContent(content: string): ParsedChannel[] {
    const channels: ParsedChannel[] = [];
    const lines = content.split('\n');
    let currentChannel: Partial<ParsedChannel> | null = null;
    let channelId = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // EXTINF line - channel information
      if (line.startsWith('#EXTINF:')) {
        currentChannel = this.parseExtinfLine(line);
        currentChannel.id = channelId++;
      }
      // URL line
      else if (line && !line.startsWith('#') && currentChannel && line.startsWith('http')) {
        currentChannel.url = line;
        
        // Only add channels with valid data
        if (currentChannel.name && currentChannel.url) {
          channels.push(currentChannel as ParsedChannel);
        }
        
        currentChannel = null;
      }
    }

    console.log(`📊 Parsed ${channels.length} total channels from M3U`);
    return channels;
  }

  /**
   * Parse EXTINF line to extract channel information
   */
  private parseExtinfLine(line: string): Partial<ParsedChannel> {
    const channel: Partial<ParsedChannel> = {
      name: '',
      group: 'Genel',
      logo: '',
      number: 0,
      viewers: 0,
      status: 'live',
      quality: 'HD',
      description: '',
      category: 'Genel'
    };

    // Extract tvg-name
    const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
    if (tvgNameMatch) {
      channel.name = this.fixTurkishEncoding(tvgNameMatch[1]);
    }

    // Extract tvg-logo
    const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
    if (tvgLogoMatch) {
      channel.logo = tvgLogoMatch[1];
    }

    // Extract group-title
    const groupMatch = line.match(/group-title="([^"]*)"/);
    if (groupMatch) {
      channel.group = this.fixTurkishEncoding(groupMatch[1]);
      channel.category = this.normalizeCategory(channel.group);
    }

    // Extract channel name after comma if tvg-name is empty
    if (!channel.name) {
      const parts = line.split(',');
      if (parts.length > 1) {
        channel.name = this.fixTurkishEncoding(parts[1].trim());
      }
    }

    // Generate placeholder logo if none
    if (!channel.logo && channel.name) {
      channel.logo = this.generatePlaceholderLogo(channel.name);
    }

    // Set description
    channel.description = this.generateDescription(channel.name || '', channel.category || 'Genel');

    // Generate realistic viewer count
    channel.viewers = this.generateViewerCount(channel.category || 'Genel');

    return channel;
  }

  /**
   * Filter channels to get only sports channels
   */
  private filterSportChannels(channels: ParsedChannel[]): ParsedChannel[] {
    const sportKeywords = [
      'sport', 'spor', 'bein', 'ssport', 'smart', 'trt', 'aspor', 
      'tivibu', 'euroleague', 'nba', 'futbol', 'football', 'basketbol',
      'voleybol', 'tenis', 'motor', 'formula', 'uefa', 'fifa',
      'galatasaray', 'fenerbahce', 'besiktas', 'trabzonspor'
    ];

    return channels.filter(channel => {
      const nameLower = channel.name.toLowerCase();
      const groupLower = channel.group.toLowerCase();
      
      return sportKeywords.some(keyword => 
        nameLower.includes(keyword) || groupLower.includes(keyword)
      );
    }).map(channel => {
      // Set channel number based on name
      channel.number = this.extractChannelNumber(channel.name);
      channel.category = 'Spor'; // All filtered channels are sports
      return channel;
    });
  }

  /**
   * Extract channel number from name
   */
  private extractChannelNumber(name: string): string | number {
    const nameLower = name.toLowerCase();
    
    // Check for specific patterns
    if (nameLower.includes('s sport 2') || nameLower.includes('ssport 2')) {
      return 'S2';
    } else if (nameLower.includes('s sport') || nameLower.includes('ssport')) {
      return 'S';
    } else if (nameLower.includes('smart')) {
      return 'SM';
    } else if (nameLower.includes('trt')) {
      return 'TRT';
    } else if (nameLower.includes('aspor') || nameLower.includes('a spor')) {
      return 'A';
    }
    
    // Extract numeric channel number
    const numberMatch = name.match(/(\d+)/);
    if (numberMatch) {
      return parseInt(numberMatch[1]);
    }
    
    // Default to first letter of channel name
    return name.charAt(0).toUpperCase();
  }

  /**
   * Sort channels by number and name
   */
  private sortChannels(channels: ParsedChannel[]): ParsedChannel[] {
    return channels.sort((a, b) => {
      // Numeric numbers first
      if (typeof a.number === 'number' && typeof b.number === 'number') {
        return a.number - b.number;
      } else if (typeof a.number === 'number') {
        return -1;
      } else if (typeof b.number === 'number') {
        return 1;
      } else {
        // String comparison for non-numeric
        return a.number.toString().localeCompare(b.number.toString(), 'tr');
      }
    });
  }

  /**
   * Utility functions
   */
  private fixTurkishEncoding(text: string): string {
    const fixes: [RegExp, string][] = [
      [/Ã§/g, 'ç'], [/Ã‡/g, 'Ç'],
      [/ÄŸ/g, 'ğ'], [/Ä/g, 'Ğ'],
      [/Ä±/g, 'ı'], [/Ä°/g, 'İ'],
      [/Ã¶/g, 'ö'], [/Ã–/g, 'Ö'],
      [/Ã¼/g, 'ü'], [/Ãœ/g, 'Ü'],
      [/ÅŸ/g, 'ş'], [/Åž/g, 'Ş'],
    ];
    
    let fixed = text;
    fixes.forEach(([from, to]) => {
      fixed = fixed.replace(from, to);
    });
    
    return fixed;
  }

  private normalizeCategory(category: string): string {
    const categoryMap: { [key: string]: string } = {
      'Sports': 'Spor',
      'Sport': 'Spor',
      'Football': 'Spor',
      'Soccer': 'Spor',
      'Basketball': 'Spor',
    };
    
    return categoryMap[category] || 'Spor';
  }

  private generatePlaceholderLogo(name: string): string {
    const initial = name.charAt(0).toUpperCase();
    const colors = ['dc2626', '2563eb', '059669', 'db2777', 'ef4444', 'f59e0b'];
    const color = colors[name.length % colors.length];
    return `https://via.placeholder.com/48x48/${color}/ffffff?text=${encodeURIComponent(initial)}`;
  }

  private generateDescription(name: string, category: string): string {
    if (name.toLowerCase().includes('bein')) {
      return 'beIN Sports canlı spor yayını';
    } else if (name.toLowerCase().includes('trt')) {
      return 'TRT Spor canlı yayını';
    } else if (name.toLowerCase().includes('aspor')) {
      return 'A Spor canlı yayını';
    } else if (name.toLowerCase().includes('smart')) {
      return 'Smart Spor canlı yayını';
    }
    return `${name} canlı spor yayını`;
  }

  private generateViewerCount(category: string): number {
    const ranges: { [key: string]: [number, number] } = {
      'Spor': [5000, 50000],
      'Futbol': [10000, 80000],
      'Basketbol': [3000, 25000]
    };
    
    const range = ranges[category] || [1000, 15000];
    return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  }

  /**
   * Cache management
   */
  private getCachedChannels(): ChannelResponse | null {
    try {
      const cached = localStorage.getItem(this.cacheKey);
      if (!cached) return null;
      
      const data: ChannelResponse = JSON.parse(cached);
      const now = Date.now();
      
      if (now - data.timestamp > this.cacheTime) {
        localStorage.removeItem(this.cacheKey);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Cache read error:', error);
      return null;
    }
  }

  private setCachedChannels(response: ChannelResponse): void {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(response));
    } catch (error) {
      console.error('Cache write error:', error);
    }
  }

  /**
   * Fallback channels when parsing fails
   */
  private getFallbackChannels(): ChannelResponse {
    return {
      success: false,
      message: 'Kanal listesi alınamadı, varsayılan kanallar kullanılıyor',
      count: 5,
      timestamp: Date.now(),
      channels: [
        {
          id: 1,
          name: 'beIN Sports 1 HD',
          number: 1,
          url: 'https://tv-trtspor.medya.trt.com.tr/master.m3u8',
          group: 'Spor',
          logo: 'https://via.placeholder.com/48x48/dc2626/ffffff?text=B1',
          viewers: 25000,
          status: 'live' as const,
          quality: 'HD',
          description: 'beIN Sports 1 canlı spor yayını',
          category: 'Spor'
        },
        {
          id: 2,
          name: 'beIN Sports 2 HD',
          number: 2,
          url: 'https://trkvz-live.daioncdn.net/aspor/aspor.m3u8',
          group: 'Spor',
          logo: 'https://via.placeholder.com/48x48/2563eb/ffffff?text=B2',
          viewers: 20000,
          status: 'live' as const,
          quality: 'HD',
          description: 'beIN Sports 2 canlı spor yayını',
          category: 'Spor'
        },
        {
          id: 3,
          name: 'TRT Spor HD',
          number: 'TRT',
          url: 'https://tv-trtspor.medya.trt.com.tr/master.m3u8',
          group: 'Spor',
          logo: 'https://via.placeholder.com/48x48/059669/ffffff?text=T',
          viewers: 18000,
          status: 'live' as const,
          quality: 'HD',
          description: 'TRT Spor canlı yayını',
          category: 'Spor'
        },
        {
          id: 4,
          name: 'A Spor HD',
          number: 'A',
          url: 'https://trkvz-live.daioncdn.net/aspor/aspor.m3u8',
          group: 'Spor',
          logo: 'https://via.placeholder.com/48x48/db2777/ffffff?text=A',
          viewers: 15000,
          status: 'live' as const,
          quality: 'HD',
          description: 'A Spor canlı yayını',
          category: 'Spor'
        },
        {
          id: 5,
          name: 'Smart Spor HD',
          number: 'SM',
          url: 'https://tv-trtspor.medya.trt.com.tr/master.m3u8',
          group: 'Spor',
          logo: 'https://via.placeholder.com/48x48/ef4444/ffffff?text=S',
          viewers: 12000,
          status: 'live' as const,
          quality: 'HD',
          description: 'Smart Spor canlı yayını',
          category: 'Spor'
        }
      ]
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    localStorage.removeItem(this.cacheKey);
    console.log('🧹 Channel cache cleared');
  }
}

// Export singleton instance
export const channelParser = new ChannelParserService();
export default channelParser;