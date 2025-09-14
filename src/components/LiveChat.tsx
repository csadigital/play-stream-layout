import { useState } from 'react';
import { Send, Smile, Heart, ThumbsUp, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const LiveChat = () => {
  const [message, setMessage] = useState('');
  
  const messages = [
    { id: 1, user: 'SportsFan99', text: 'What a goal! 🔥', time: '2 min ago', isOwn: false },
    { id: 2, user: 'RedDevil', text: 'Manchester United looking strong today!', time: '3 min ago', isOwn: false },
    { id: 3, user: 'You', text: 'This match is incredible!', time: '4 min ago', isOwn: true },
    { id: 4, user: 'FootballKing', text: 'Best game of the season so far', time: '5 min ago', isOwn: false },
    { id: 5, user: 'LiveWatcher', text: 'Anyone else getting chills?', time: '6 min ago', isOwn: false },
    { id: 6, user: 'ChampionFan', text: 'The atmosphere is electric! ⚡', time: '7 min ago', isOwn: false },
  ];

  const quickReplies = [
    { icon: Heart, color: 'text-red-500' },
    { icon: ThumbsUp, color: 'text-blue-500' },
    { icon: Flame, color: 'text-orange-500' },
    { icon: Smile, color: 'text-yellow-500' },
  ];

  const handleSend = () => {
    if (message.trim()) {
      // Handle sending message
      setMessage('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Chat Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">Live Chat</h3>
        <div className="text-xs text-muted-foreground">847 watching</div>
      </div>

      {/* Chat Messages */}
      <div className="h-80 overflow-y-auto space-y-2 p-2 bg-background-secondary/30 rounded-lg">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message animate-fade-in-up ${msg.isOwn ? 'own' : ''}`}>
            <div className="flex items-start gap-2">
              {!msg.isOwn && (
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground">
                  {msg.user[0]}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-foreground">{msg.user}</span>
                  <span className="text-xs text-muted-foreground">{msg.time}</span>
                </div>
                <div className="text-sm text-foreground">{msg.text}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Reactions */}
      <div className="flex gap-2 justify-center">
        {quickReplies.map((reply, index) => (
          <Button
            key={index}
            size="sm"
            variant="ghost"
            className={`${reply.color} hover:bg-muted/50 glow-button`}
          >
            <reply.icon className="w-4 h-4" />
          </Button>
        ))}
      </div>

      {/* Message Input */}
      <div className="flex gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 bg-background-secondary/50 border-muted"
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <Button onClick={handleSend} size="sm" className="glow-button">
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Large Ad Space */}
      <div className="ad-banner h-64 mt-6">
        <div className="text-center">
          <span className="text-xs">Advertisement</span>
          <br />
          <span className="text-xs">300x250</span>
        </div>
      </div>
    </div>
  );
};

export default LiveChat;