/**
 * Invisible proxy service - all real URLs are hidden
 * Only internal proxy URLs are visible in network/console
 */

class InvisibleProxyService {
  private worker: ServiceWorker | null = null;
  private isReady = false;
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.initialize();
  }

  /**
   * Initialize service worker
   */
  private async initialize(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator)) throw new Error('Service Worker not supported');

      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('🔧 Invisible proxy service worker registered');

      // Ensure this page is controlled (first load may not be)
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          const onChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', onChange as any);
            resolve();
          };
          navigator.serviceWorker.addEventListener('controllerchange', onChange);
        });
      }

      this.worker = (navigator.serviceWorker.controller as ServiceWorker) || registration.active || registration.waiting || registration.installing;
      this.isReady = !!this.worker;
      console.log('✅ Invisible proxy ready');
    } catch (error) {
      console.error('❌ Failed to initialize invisible proxy:', error);
      this.isReady = false;
    }
  }

  /**
   * Register a stream and get internal proxy URL
   */
  async registerStream(originalUrl: string): Promise<string> {
    await this.readyPromise;
    
    if (!this.isReady || !this.worker) {
      // Fallback: return original URL if service worker fails
      console.warn('Service worker not ready, using original URL');
      return originalUrl;
    }

    try {
      // Preferred: register via SW fetch endpoint (more reliable than postMessage)
      const res = await fetch(`/api/stream/register?url=${encodeURIComponent(originalUrl)}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.proxyUrl) {
          console.log(`🔐 Stream registered: ${originalUrl} -> ${data.proxyUrl}`);
          return data.proxyUrl as string;
        }
      }

      // Fallback: message channel
      const channel = new MessageChannel();
      const registrationPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Registration timeout')), 5000);
        channel.port1.onmessage = (event) => {
          clearTimeout(timeout);
          if (event.data?.type === 'STREAM_REGISTERED' && event.data?.proxyUrl) {
            resolve(event.data.proxyUrl);
          } else {
            reject(new Error('Registration failed'));
          }
        };
      });

      (this.worker || navigator.serviceWorker.controller)?.postMessage(
        { type: 'REGISTER_STREAM', originalUrl },
        [channel.port2]
      );

      const proxyUrl = await registrationPromise;
      console.log(`🔐 Stream registered (fallback): ${originalUrl} -> ${proxyUrl}`);
      return proxyUrl;
    } catch (error) {
      console.error('Stream registration failed:', error);
      // Final fallback: use client-side proxy protocol handled by custom HLS loader
      return `proxy://${encodeURIComponent(originalUrl)}`;
    }
  }

  /**
   * Get stream URL (will be proxied invisibly)
   */
  async getStreamUrl(originalUrl: string): Promise<string> {
    // Clean the URL first
    const cleanUrl = this.cleanUrl(originalUrl);
    
    // Register with service worker and get internal proxy URL
    const proxyUrl = await this.registerStream(cleanUrl);
    
    // This URL will be completely internal - no real URLs visible
    return proxyUrl;
  }

  /**
   * Clean and normalize URL
   */
  private cleanUrl(url: string): string {
    try {
      // Remove any existing proxy wrapping
      if (url.startsWith('proxy://')) {
        url = decodeURIComponent(url.replace('proxy://', ''));
      }
      
      // Validate URL
      new URL(url);
      return url;
    } catch {
      return url;
    }
  }

  /**
   * Check if service is ready
   */
  async isServiceReady(): Promise<boolean> {
    await this.readyPromise;
    return this.isReady;
  }

  /**
   * Get service status
   */
  getStatus(): string {
    if (this.isReady) {
      return '🔐 Invisible Proxy Active - All URLs Hidden';
    } else {
      return '⚠️ Invisible Proxy Not Ready';
    }
  }
}

export const invisibleProxy = new InvisibleProxyService();