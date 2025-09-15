import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Users, Volume2, Maximize, Minimize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStreamPlayer } from '@/hooks/useChannels';
import { streamingApi } from '@/services/streamingApi';
import { streamHandler } from '@/services/streamHandler';
import heroStadium from '@/assets/hero-stadium.jpg';

// HLS.js import
declare global {
  interface Window {
    Hls: any;
  }
}

interface VideoPlayerProps {
  selectedChannel?: any;
  onChannelSelect?: (channel: any) => void;
}

const VideoPlayer = ({ selectedChannel }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const lastUrlRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isPlaying, volume, isFullscreen, togglePlayPause, setVolume, toggleFullscreen, getStreamUrl } = useStreamPlayer();

  // Load HLS.js dynamically
  useEffect(() => {
    const loadHls = async () => {
      if (!window.Hls) {
        const Hls = await import('hls.js');
        window.Hls = Hls.default;
      }
    };
    loadHls();
  }, []);

  // Initialize HLS when channel changes
  useEffect(() => {
    if (!selectedChannel || !videoRef.current || !window.Hls) return;

    const video = videoRef.current;
    setIsLoading(true);
    setError(null);

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    if (window.Hls.isSupported()) {
      // Use custom loader for proxy handling
      const CustomLoader = streamHandler.createHLSLoader();
      
      const hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        loader: CustomLoader,
      });

      hlsRef.current = hls;

      hls.on(window.Hls.Events.MEDIA_ATTACHED, () => {
        console.log('Video and HLS.js are now bound together');
      });

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        console.log('Manifest loaded, found levels:', hls.levels);
        setIsLoading(false);
      });

      hls.on(window.Hls.Events.ERROR, (event: any, data: any) => {
        console.error('🚨 HLS Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              console.log('📡 Network error - retrying...');
              hls.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              console.log('🎥 Media error - recovering...');
              hls.recoverMediaError();
              break;
            default:
              setError(`Stream error: ${data.details || 'Unknown error'}`);
              setIsLoading(false);
              break;
          }
        }
      });

      hls.attachMedia(video);
      
      // Track viewer for this channel
      streamingApi.trackViewer(selectedChannel.id.toString());
      
      // Load the stream URL through our proxy
      const streamUrl = getStreamUrl(selectedChannel);
      lastUrlRef.current = streamUrl;
      hls.loadSource(streamUrl);

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      const streamUrl = getStreamUrl(selectedChannel);
      lastUrlRef.current = streamUrl;
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        console.log('✅ Video metadatası yüklendi');
        setIsLoading(false);
      });
      video.addEventListener('error', (e) => {
        console.error('❌ Video yükleme hatası:', e);
        setError('Yayın yüklenemedi - tarayıcı HLS desteklemiyor');
        setIsLoading(false);
      });
    } else {
      setError('Bu tarayıcıda HLS desteği bulunmuyor');
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [selectedChannel, getStreamUrl]);

  // Handle play/pause
  useEffect(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.play().catch(console.error);
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  // Handle volume changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
    }
  }, [volume]);

  const handlePlayPause = () => {
    togglePlayPause();
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(Math.max(0, Math.min(1, newVolume)));
  };

  return (
    <div className={`video-player ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Video Element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        controls={false}
        playsInline
        muted={false}
      />

      {/* Fallback Background Image */}
      {!selectedChannel && (
        <div className="absolute inset-0">
          <img 
            src={heroStadium} 
            alt="Sports streaming platform" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-center">
            <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
            <div className="text-sm">Yayın yükleniyor...</div>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-white text-center p-4">
            <div className="text-red-400 mb-2">⚠️ Yayın Hatası</div>
            <div className="text-sm">{error}</div>
          </div>
        </div>
      )}

      {/* Live Badge */}
      {selectedChannel && selectedChannel.status === 'live' && (
        <div className="absolute top-4 left-4">
          <div className="live-badge">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            LIVE
          </div>
        </div>
      )}

      {/* Channel Quality Badge */}
      {selectedChannel?.quality && (
        <div className="absolute top-4 left-24">
          <div className="px-2 py-1 bg-black/50 text-white text-xs font-bold rounded">
            {selectedChannel.quality}
          </div>
        </div>
      )}

      {/* Viewer Count */}
      {selectedChannel && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-black/50 rounded-full text-white text-sm">
            <Users className="w-4 h-4" />
            <span className="font-semibold">{selectedChannel.viewers.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Play Button Overlay */}
      {!isPlaying && selectedChannel && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button 
            size="lg" 
            onClick={handlePlayPause}
            className="w-20 h-20 rounded-full bg-black/50 hover:bg-black/70 border-2 border-white/20 backdrop-blur-sm glow-button"
          >
            <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
          </Button>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={handlePlayPause}
            className="text-white hover:bg-white/10"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          <Button 
            size="sm" 
            variant="ghost" 
            className="text-white hover:bg-white/10"
            onClick={() => handleVolumeChange(volume > 0 ? 0 : 1)}
          >
            <Volume2 className="w-4 h-4" />
          </Button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-20 h-1 bg-white/20 rounded-lg appearance-none slider"
          />
          
          <div className="text-white text-sm font-medium">
            {selectedChannel ? selectedChannel.name : 'İzlemeye başlamak için bir kanal seçin'}
          </div>
        </div>
        
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={toggleFullscreen}
          className="text-white hover:bg-white/10"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </Button>
      </div>

      {/* Channel Info */}
      {selectedChannel && (
        <div className="absolute bottom-16 left-4 text-white text-sm">
          <div className="bg-black/50 rounded px-2 py-1">
            {selectedChannel.description}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;