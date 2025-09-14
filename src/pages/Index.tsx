import VideoPlayer from '@/components/VideoPlayer';
import ChannelList from '@/components/ChannelList';
import LiveChat from '@/components/LiveChat';

const Index = () => {
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
                🔴 <span className="text-primary font-semibold">12 Live</span>
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
          <ChannelList />
        </aside>

        {/* Main Video Player */}
        <section className="space-y-4">
          <VideoPlayer />
          
          {/* Match Info */}
          <div className="bg-card/50 backdrop-blur-sm rounded-lg p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Manchester United vs Liverpool FC</h2>
                <p className="text-muted-foreground">Premier League • Old Trafford</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">2-1</div>
                <div className="text-sm text-muted-foreground">75' min</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Possession</span>
                  <span className="text-foreground">58% - 42%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shots</span>
                  <span className="text-foreground">12 - 8</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Corners</span>
                  <span className="text-foreground">6 - 3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cards</span>
                  <span className="text-foreground">2 - 4</span>
                </div>
              </div>
            </div>
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
