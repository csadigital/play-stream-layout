import { useState } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import ChannelList from '@/components/ChannelList';
import LiveChat from '@/components/LiveChat';
import { Channel } from '@/services/streamingApi';
import { useStreamingStats } from '@/hooks/useChannels';

const Index = () => {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const { data: stats } = useStreamingStats();

  const handleChannelSelect = (channel: Channel) => {
    setSelectedChannel(channel);
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="bg-background-secondary/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-primary">SportStream</h1>
              <div className="hidden md:flex items-center space-x-6 text-sm">
                <a href="#" className="text-foreground hover:text-primary transition-colors">Home</a>
                <a href="#" className="text-foreground hover:text-primary transition-colors">Live</a>
                <a href="#" className="text-foreground hover:text-primary transition-colors">Sports</a>
                <a href="#" className="text-foreground hover:text-primary transition-colors">Schedule</a>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                🔴 <span className="text-primary font-semibold">
                  {stats?.total_channels || 'Loading'} Live
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Top Banner Ad */}
        <div className="border-t border-border">
          <div className="container mx-auto px-4 py-2">
            <div className="ad-banner h-20">
              <span className="text-xs">Advertisement 728x90</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="streaming-grid">
        {/* Left Sidebar - Channel List */}
        <aside className="space-y-4">
          <ChannelList 
            onChannelSelect={handleChannelSelect}
            selectedChannel={selectedChannel}
          />
        </aside>

        {/* Main Video Player */}
        <section className="space-y-4">
          <VideoPlayer selectedChannel={selectedChannel} />
          
          {/* Match Info */}
          <div className="bg-card/50 backdrop-blur-sm rounded-lg p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {selectedChannel ? selectedChannel.name : 'Select a Channel'}
                </h2>
                <p className="text-muted-foreground">
                  {selectedChannel ? `${selectedChannel.category} • ${selectedChannel.description}` : 'Choose from available live streams'}
                </p>
              </div>
              {selectedChannel && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {selectedChannel.status === 'live' ? 'LIVE' : 'OFFLINE'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedChannel.viewers.toLocaleString()} viewers
                  </div>
                </div>
              )}
            </div>
            
            {selectedChannel && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quality</span>
                    <span className="text-foreground">{selectedChannel.quality || 'Auto'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Language</span>
                    <span className="text-foreground">{selectedChannel.language || 'N/A'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span className="text-foreground">{selectedChannel.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`${selectedChannel.status === 'live' ? 'text-primary' : 'text-muted-foreground'}`}>
                      {selectedChannel.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!selectedChannel && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-6xl mb-4">📺</div>
                <div className="text-lg font-semibold mb-2">Welcome to SportStream</div>
                <div className="text-sm">Select a channel from the left sidebar to start watching live sports</div>
              </div>
            )}
          </div>
        </section>

        {/* Right Sidebar - Chat & Ads */}
        <aside className="space-y-4">
          <LiveChat />
        </aside>
      </main>

      {/* Footer Banner */}
      <footer className="bg-background-secondary/80 backdrop-blur-sm border-t border-border mt-8">
        <div className="container mx-auto px-4 py-4">
          <div className="ad-banner h-20">
            <span className="text-xs">Footer Advertisement 728x90</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
