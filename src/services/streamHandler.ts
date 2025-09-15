/**
 * Advanced stream handler for HLS.js with custom loader
 */

import { clientProxy } from './clientProxy';

export class CustomStreamLoader {
  private static instance: CustomStreamLoader;
  
  static getInstance(): CustomStreamLoader {
    if (!CustomStreamLoader.instance) {
      CustomStreamLoader.instance = new CustomStreamLoader();
    }
    return CustomStreamLoader.instance;
  }

  /**
   * Create custom HLS loader that handles our proxy protocol
   */
  createHLSLoader() {
    const self = this;
    
    return class extends (window as any).Hls.DefaultConfig.loader {
      load(context: any, config: any, callbacks: any) {
        const originalUrl = context.url;
        console.log(`Loading: ${originalUrl}`);
        
        // Handle our custom proxy protocol
        if (originalUrl.startsWith('proxy://')) {
          const decodedUrl = decodeURIComponent(originalUrl.replace('proxy://', ''));
          self.handleProxyRequest(decodedUrl, callbacks);
          return;
        }
        
        // Handle data URLs for segments
        if (originalUrl.startsWith('data:proxy-segment,')) {
          const segmentUrl = decodeURIComponent(originalUrl.replace('data:proxy-segment,', ''));
          self.handleSegmentRequest(segmentUrl, callbacks);
          return;
        }
        
        if (originalUrl.startsWith('data:proxy-stream,')) {
          const streamUrl = decodeURIComponent(originalUrl.replace('data:proxy-stream,', ''));
          self.handleStreamRequest(streamUrl, callbacks);
          return;
        }
        
        // Default behavior for regular URLs
        super.load(context, config, callbacks);
      }
    };
  }

  /**
   * Handle proxy requests for M3U8 playlists
   */
  private async handleProxyRequest(url: string, callbacks: any) {
    try {
      console.log(`Fetching M3U8: ${url}`);
      
      // Try to convert Xtream URL to M3U8 format
      const m3u8Url = this.convertToM3U8(url);
      
      const response = await clientProxy.fetchWithProxy(m3u8Url);
      
      if (response.success && response.content) {
        let processedContent = response.content;
        
        // If it's valid M3U8, process it
        if (response.content.includes('#EXTM3U')) {
          processedContent = clientProxy.processM3U8(response.content, m3u8Url);
        } else {
          // Create simple playlist for direct streams
          processedContent = clientProxy.createSimplePlaylist(url);
        }
        
        // Create blob URL for the processed content
        const blob = new Blob([processedContent], { 
          type: 'application/vnd.apple.mpegurl' 
        });
        const manifestUrl = URL.createObjectURL(blob);
        
        // Success callback
        callbacks.onSuccess({
          url: manifestUrl,
          data: processedContent
        }, { url: manifestUrl }, { code: 200 });
        
      } else {
        console.error('Failed to fetch M3U8:', response.error);
        callbacks.onError({
          type: 'networkError',
          details: 'manifestLoadError',
          fatal: true,
          url: url,
          response: { code: 404, text: response.error }
        });
      }
    } catch (error) {
      console.error('Proxy request error:', error);
      callbacks.onError({
        type: 'networkError',
        details: 'manifestLoadError',
        fatal: true,
        url: url,
        response: { code: 500, text: error.message }
      });
    }
  }

  /**
   * Handle segment requests
   */
  private async handleSegmentRequest(segmentUrl: string, callbacks: any) {
    try {
      console.log(`Fetching segment: ${segmentUrl}`);
      
      const response = await fetch(segmentUrl, {
        headers: {
          'Accept': '*/*',
          'Range': 'bytes=0-',
        }
      });
      
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        callbacks.onSuccess({
          url: segmentUrl,
          data: arrayBuffer
        }, { url: segmentUrl }, { code: 200 });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      // Try with proxy
      try {
        const proxyResponse = await clientProxy.fetchWithProxy(segmentUrl);
        if (proxyResponse.success && proxyResponse.content) {
          const arrayBuffer = new TextEncoder().encode(proxyResponse.content).buffer;
          callbacks.onSuccess({
            url: segmentUrl,
            data: arrayBuffer
          }, { url: segmentUrl }, { code: 200 });
          return;
        }
      } catch (proxyError) {
        console.error('Segment proxy error:', proxyError);
      }
      
      callbacks.onError({
        type: 'networkError',
        details: 'fragLoadError',
        fatal: false,
        url: segmentUrl,
        response: { code: 404, text: error.message }
      });
    }
  }

  /**
   * Handle direct stream requests
   */
  private async handleStreamRequest(streamUrl: string, callbacks: any) {
    try {
      console.log(`Direct stream: ${streamUrl}`);
      
      // For direct streams, we'll create a continuous playlist
      const playlist = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:60',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXTINF:60.0,',
        streamUrl,
        '#EXT-X-ENDLIST'
      ].join('\n');
      
      const blob = new Blob([playlist], { 
        type: 'application/vnd.apple.mpegurl' 
      });
      const manifestUrl = URL.createObjectURL(blob);
      
      callbacks.onSuccess({
        url: manifestUrl,
        data: playlist
      }, { url: manifestUrl }, { code: 200 });
      
    } catch (error) {
      callbacks.onError({
        type: 'networkError',
        details: 'manifestLoadError',
        fatal: true,
        url: streamUrl,
        response: { code: 500, text: error.message }
      });
    }
  }

  /**
   * Convert Xtream URLs to M3U8 format
   */
  private convertToM3U8(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      // Pattern: /user/pass/id -> /live/user/pass/id.m3u8
      if (pathParts.length === 3 && /^\d+$/.test(pathParts[2])) {
        return `${urlObj.protocol}//${urlObj.host}/live/${pathParts[0]}/${pathParts[1]}/${pathParts[2]}.m3u8`;
      }
      
      // Pattern: /live/user/pass/id -> /live/user/pass/id.m3u8
      if (pathParts.length >= 4 && pathParts[0] === 'live') {
        const idPart = pathParts[3];
        if (!idPart.endsWith('.m3u8') && /^\d+$/.test(idPart)) {
          return `${urlObj.protocol}//${urlObj.host}/live/${pathParts[1]}/${pathParts[2]}/${idPart}.m3u8`;
        }
      }
      
      // If already has .m3u8 or unknown format, return as-is
      return url;
    } catch {
      return url;
    }
  }
}

export const streamHandler = CustomStreamLoader.getInstance();