// API service for communicating with PHP M3U8 proxy backend
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

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  timestamp: number;
  error?: string;
}

export interface StreamStats {
  total_channels: number;
  categories: string[];
  server_time: string;
  uptime: number[];
}

class StreamingApiService {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost/streaming-proxy.php') {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch all available channels
   */
  async getChannels(): Promise<Channel[]> {
    try {
      const response = await fetch(`${this.baseUrl}?action=channels`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse<Channel[]> = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch channels');
      }

      return result.data;
    } catch (error) {
      console.error('Error fetching channels:', error);
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
   * Get stream URL for a channel (proxied through PHP backend)
   */
  getStreamUrl(channelUrl: string): string {
    const encodedUrl = encodeURIComponent(channelUrl);
    return `${this.baseUrl}?action=proxy&url=${encodedUrl}`;
  }

  /**
   * Get streaming statistics
   */
  async getStats(): Promise<StreamStats> {
    try {
      const response = await fetch(`${this.baseUrl}?action=stats`);
      const result: ApiResponse<StreamStats> = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch stats');
      }

      return result.data;
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
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
   * Fallback channels when API fails
   */
  private getFallbackChannels(): Channel[] {
    return [
      {
        id: 1,
        name: 'Spor TV HD',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/238636/ffffff?text=S1',
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
        logo: 'https://via.placeholder.com/48x48/da3633/ffffff?text=F+',
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
        name: 'Voleybol HD',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/6f42c1/ffffff?text=V',
        url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        viewers: 3240,
        description: 'Voleybol müsabakaları',
        status: 'offline',
        quality: 'HD'
      },
      {
        id: 5,
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
        id: 6,
        name: 'Motor Sports',
        category: 'Spor',
        logo: 'https://via.placeholder.com/48x48/fd7e14/ffffff?text=M',
        url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
        viewers: 7890,
        description: 'Formula 1 ve MotoGP',
        status: 'live',
        quality: 'HD'
      }
    ];
  }
}

// Export singleton instance
export const streamingApi = new StreamingApiService();
export default streamingApi;