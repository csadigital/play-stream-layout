import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import streamingApi, { Channel } from '@/services/streamingApi';

export const useChannels = () => {
  return useQuery({
    queryKey: ['channels'],
    queryFn: () => streamingApi.getChannels(),
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });
};

export const useChannelsByCategory = (category: string) => {
  return useQuery({
    queryKey: ['channels', 'category', category],
    queryFn: () => streamingApi.getChannelsByCategory(category),
    enabled: !!category,
    refetchInterval: 60000,
  });
};

export const useStreamingStats = () => {
  return useQuery({
    queryKey: ['streaming-stats'],
    queryFn: () => streamingApi.getStats(),
    refetchInterval: 300000, // Refetch every 5 minutes
  });
};

export const useChannelSearch = (query: string) => {
  return useQuery({
    queryKey: ['channels', 'search', query],
    queryFn: () => streamingApi.searchChannels(query),
    enabled: query.length > 2, // Only search when query is longer than 2 characters
    refetchInterval: 60000,
  });
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