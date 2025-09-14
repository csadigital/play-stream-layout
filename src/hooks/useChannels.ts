import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import streamingApi, { Channel } from '@/services/streamingApi';

export const useChannels = () => {
  return useQuery({
    queryKey: ['channels'],
    queryFn: () => streamingApi.getChannels(),
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });
};

export const useChannelsByCategory = (category: string) => {
  return useQuery({
    queryKey: ['channels', 'category', category],
    queryFn: () => streamingApi.getChannelsByCategory(category),
    enabled: !!category,
    refetchInterval: 30000,
  });
};

export const useStreamingStats = () => {
  return useQuery({
    queryKey: ['streaming-stats'],
    queryFn: () => streamingApi.getStats(),
    refetchInterval: 60000, // Refetch every minute
  });
};

export const useChannelSearch = (query: string) => {
  return useQuery({
    queryKey: ['channels', 'search', query],
    queryFn: () => streamingApi.searchChannels(query),
    enabled: query.length > 2,
    refetchInterval: 30000,
  });
};

// Custom hook for real-time viewer updates
export const useRealTimeViewers = () => {
  const [viewers, setViewers] = useState<{ [key: number]: number }>({});

  useEffect(() => {
    const handleViewerUpdate = (event: CustomEvent) => {
      const channels = event.detail as Channel[];
      const viewerMap: { [key: number]: number } = {};
      
      channels.forEach(channel => {
        viewerMap[channel.id] = channel.viewers;
      });
      
      setViewers(viewerMap);
    };

    // Listen for viewer updates
    window.addEventListener('viewerUpdate', handleViewerUpdate as EventListener);
    
    return () => {
      window.removeEventListener('viewerUpdate', handleViewerUpdate as EventListener);
    };
  }, []);

  return viewers;
};

// Custom hook for managing selected channel and stream
export const useStreamPlayer = () => {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setIsPlaying(false); // Reset playing state when switching channels
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const getStreamUrl = (channel: Channel) => {
    return streamingApi.getStreamUrl(channel.url);
  };

  return {
    selectedChannel,
    isPlaying,
    volume,
    isFullscreen,
    selectChannel,
    togglePlayPause,
    setVolume,
    toggleFullscreen,
    getStreamUrl,
  };
};