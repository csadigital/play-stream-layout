import { useState } from 'react';
import { Calendar, Clock, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChannels } from '@/hooks/useChannels';
import { Channel } from '@/services/streamingApi';

interface ChannelListProps {
  onChannelSelect?: (channel: Channel) => void;
  selectedChannel?: Channel | null;
}

const ChannelList = ({ onChannelSelect, selectedChannel }: ChannelListProps) => {
  const { data: channels = [], isLoading, error } = useChannels();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filter channels based on search and category
  const filteredChannels = channels.filter(channel => {
    const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         channel.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || channel.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(channels.map(c => c.category)))];

  const todaysMatches = [
    { time: '15:30', teams: 'Arsenal vs Chelsea', status: 'upcoming' },
    { time: '18:00', teams: 'Barcelona vs Real Madrid', status: 'live' },
    { time: '20:45', teams: 'Bayern vs Dortmund', status: 'upcoming' },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center p-4 bg-destructive/10 rounded-lg">
          <div className="text-destructive text-sm">Failed to load channels</div>
          <div className="text-muted-foreground text-xs mt-1">Using fallback channels</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Ad */}
      <div className="ad-banner h-20">
        <span className="text-xs">Advertisement 728x90</span>
      </div>

      {/* Search and Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background-secondary/50 border-muted"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(category => (
            <Button
              key={category}
              size="sm"
              variant={selectedCategory === category ? "default" : "outline"}
              onClick={() => setSelectedCategory(category)}
              className="whitespace-nowrap text-xs"
            >
              {category === 'all' ? 'All' : category}
            </Button>
          ))}
        </div>
      </div>

      {/* Channel List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Live Channels</h2>
          {isLoading && (
            <div className="text-xs text-muted-foreground">Loading...</div>
          )}
        </div>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredChannels.map((channel) => (
            <div 
              key={channel.id} 
              className={`channel-item ${selectedChannel?.id === channel.id ? 'bg-primary/10 border-primary/20' : ''}`}
              onClick={() => onChannelSelect?.(channel)}
            >
              <div className="relative">
                <div className={`status-dot ${channel.status === 'live' ? 'live' : 'offline'}`} />
                <img 
                  src={channel.logo} 
                  alt={channel.name}
                  className="w-12 h-12 rounded-lg object-cover ml-4"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://via.placeholder.com/48x48/238636/ffffff?text=${channel.name.charAt(0)}`;
                  }}
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground text-sm truncate">
                  {channel.name}
                </div>
                <div className="text-muted-foreground text-xs truncate">
                  {channel.description}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-primary text-xs font-medium">
                    {channel.viewers.toLocaleString()} viewers
                  </div>
                  {channel.quality && (
                    <div className="px-1 py-0.5 bg-secondary/20 text-secondary-foreground text-xs rounded">
                      {channel.quality}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                {channel.category}
              </div>
            </div>
          ))}

          {filteredChannels.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <div className="text-sm">No channels found</div>
              <div className="text-xs">Try adjusting your search or filter</div>
            </div>
          )}
        </div>
      </div>

      {/* Vertical Ad */}
      <div className="ad-banner h-48">
        <div className="text-center">
          <span className="text-xs">Advertisement</span>
          <br />
          <span className="text-xs">160x600</span>
        </div>
      </div>

      {/* Today's Matches */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground">Today's Matches</h3>
        </div>
        
        <div className="space-y-3">
          {todaysMatches.map((match, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{match.time}</span>
              </div>
              
              <div className="flex-1 text-center">
                <div className="text-sm font-medium text-foreground">{match.teams}</div>
              </div>
              
              <div className={`px-2 py-1 rounded text-xs font-bold ${
                match.status === 'live' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                {match.status === 'live' ? 'LIVE' : 'Soon'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChannelList;