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
                <a href="#" className="text-foreground hover:text-primary transition-colors">Ana Sayfa</a>
                <a href="#" className="text-foreground hover:text-primary transition-colors">Canlı</a>
                <a href="#" className="text-foreground hover:text-primary transition-colors">Spor</a>
                <a href="#" className="text-foreground hover:text-primary transition-colors">Program</a>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                🔴 <span className="text-primary font-semibold">
                  {stats?.total_channels || 'Yükleniyor'} Canlı
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
                  {selectedChannel ? selectedChannel.name : 'Bir Kanal Seçin'}
                </h2>
                <p className="text-muted-foreground">
                  {selectedChannel ? `${selectedChannel.category} • ${selectedChannel.description}` : 'Mevcut canlı yayınlardan birini seçin'}
                </p>
              </div>
              {selectedChannel && (
                <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {selectedChannel.status === 'live' ? 'CANLI' : 'ÇEVRİMDIŞI'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedChannel.viewers.toLocaleString()} izleyici
                </div>
                </div>
              )}
            </div>
            
            {selectedChannel && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kalite</span>
                    <span className="text-foreground">{selectedChannel.quality || 'Otomatik'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dil</span>
                    <span className="text-foreground">{selectedChannel.language || 'Belirtilmemiş'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kategori</span>
                    <span className="text-foreground">{selectedChannel.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Durum</span>
                    <span className={`${selectedChannel.status === 'live' ? 'text-primary' : 'text-muted-foreground'}`}>
                      {selectedChannel.status === 'live' ? 'CANLI' : 'ÇEVRİMDIŞI'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!selectedChannel && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-6xl mb-4">📺</div>
                <div className="text-lg font-semibold mb-2">SportStream'e Hoş Geldiniz</div>
                <div className="text-sm">Canlı spor izlemeye başlamak için sol kenar çubuğundan bir kanal seçin</div>
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
