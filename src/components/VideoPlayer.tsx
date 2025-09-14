import { Play, Users, Volume2, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import heroStadium from '@/assets/hero-stadium.jpg';

const VideoPlayer = () => {
  return (
    <div className="video-player">
      {/* Video Content */}
      <div className="absolute inset-0">
        <img 
          src={heroStadium} 
          alt="Live Sports Stream" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Live Badge */}
      <div className="absolute top-4 left-4">
        <div className="live-badge">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          LIVE
        </div>
      </div>

      {/* Viewer Count */}
      <div className="absolute top-4 right-4">
        <div className="flex items-center gap-2 px-3 py-1 bg-black/50 rounded-full text-white text-sm">
          <Users className="w-4 h-4" />
          <span className="font-semibold">24,583</span>
        </div>
      </div>

      {/* Play Button Overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Button 
          size="lg" 
          className="w-20 h-20 rounded-full bg-black/50 hover:bg-black/70 border-2 border-white/20 backdrop-blur-sm glow-button"
        >
          <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
        </Button>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10">
            <Volume2 className="w-4 h-4" />
          </Button>
          <div className="text-white text-sm font-medium">
            Manchester United vs Liverpool FC
          </div>
        </div>
        
        <Button size="sm" variant="ghost" className="text-white hover:bg-white/10">
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
        <div className="h-full w-1/3 bg-primary" />
      </div>
    </div>
  );
};

export default VideoPlayer;