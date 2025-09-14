import { Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import soccerChannel from '@/assets/channel-soccer.jpg';
import basketballChannel from '@/assets/channel-basketball.jpg';

const ChannelList = () => {
  const channels = [
    {
      id: 1,
      name: 'Sports Central',
      game: 'Man United vs Liverpool',
      viewers: '24.5K',
      image: soccerChannel,
      isLive: true,
    },
    {
      id: 2,
      name: 'Basketball Pro',
      game: 'Lakers vs Warriors',
      viewers: '18.2K',
      image: basketballChannel,
      isLive: true,
    },
    {
      id: 3,
      name: 'Football Zone',
      game: 'NFL Highlights',
      viewers: '12.8K',
      image: soccerChannel,
      isLive: false,
    },
    {
      id: 4,
      name: 'Tennis Court',
      game: 'Wimbledon Final',
      viewers: '9.4K',
      image: basketballChannel,
      isLive: false,
    },
  ];

  const todaysMatches = [
    { time: '15:30', teams: 'Arsenal vs Chelsea', status: 'upcoming' },
    { time: '18:00', teams: 'Barcelona vs Real Madrid', status: 'live' },
    { time: '20:45', teams: 'Bayern vs Dortmund', status: 'upcoming' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Ad */}
      <div className="ad-banner h-20">
        <span className="text-xs">Advertisement 728x90</span>
      </div>

      {/* Channel List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">Live Channels</h2>
        
        <div className="space-y-2">
          {channels.map((channel) => (
            <div key={channel.id} className="channel-item">
              <div className="relative">
                <div className={`status-dot ${channel.isLive ? 'live' : 'offline'}`} />
                <img 
                  src={channel.image} 
                  alt={channel.name}
                  className="w-12 h-12 rounded-lg object-cover ml-4"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground text-sm truncate">
                  {channel.name}
                </div>
                <div className="text-muted-foreground text-xs truncate">
                  {channel.game}
                </div>
                <div className="text-primary text-xs font-medium">
                  {channel.viewers} viewers
                </div>
              </div>
            </div>
          ))}
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