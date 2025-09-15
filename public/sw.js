/**
 * Service Worker for invisible stream proxying
 * All real URLs are hidden, only internal proxy URLs are visible
 */

const CACHE_NAME = 'stream-proxy-v1';
const PROXY_BASE = '/api/stream';

// CORS proxy endpoints (kept internal)
const CORS_PROXIES = [
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/',
];

// Internal URL mappings (hidden from network)
const URL_MAPPINGS = new Map();
let mappingCounter = 1000;

self.addEventListener('install', event => {
  console.log('Stream Proxy SW installed');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Stream Proxy SW activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Intercept our internal proxy requests
  if (url.pathname.startsWith(PROXY_BASE)) {
    event.respondWith(handleProxyRequest(event.request));
    return;
  }
  
  // Let other requests pass through
  event.respondWith(fetch(event.request));
});

/**
 * Handle internal proxy requests
 */
async function handleProxyRequest(request) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    
    if (pathParts[3] === 'manifest') {
      // Handle manifest requests: /api/stream/manifest/{id}
      const streamId = pathParts[4];
      return await handleManifestRequest(streamId);
    }
    
    if (pathParts[3] === 'segment') {
      // Handle segment requests: /api/stream/segment/{id}
      const segmentId = pathParts[4];
      return await handleSegmentRequest(segmentId);
    }
    
    return new Response('Not Found', { status: 404 });
  } catch (error) {
    console.error('Proxy request error:', error);
    return new Response('Internal Error', { status: 500 });
  }
}

/**
 * Handle M3U8 manifest requests
 */
async function handleManifestRequest(streamId) {
  try {
    const realUrl = URL_MAPPINGS.get(streamId);
    if (!realUrl) {
      return new Response('Stream not found', { status: 404 });
    }
    
    // Convert to M3U8 URL if needed
    const m3u8Url = convertToM3U8(realUrl);
    
    // Fetch the actual M3U8 content
    const content = await fetchThroughProxy(m3u8Url);
    if (!content) {
      return new Response('Failed to fetch stream', { status: 502 });
    }
    
    // Process M3U8 content to use internal URLs
    const processedContent = processM3U8Content(content, m3u8Url, streamId);
    
    return new Response(processedContent, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('Manifest request error:', error);
    return new Response('Manifest Error', { status: 500 });
  }
}

/**
 * Handle segment requests  
 */
async function handleSegmentRequest(segmentId) {
  try {
    const realUrl = URL_MAPPINGS.get(segmentId);
    if (!realUrl) {
      return new Response('Segment not found', { status: 404 });
    }
    
    // Fetch segment through proxy
    const response = await fetchThroughProxyBinary(realUrl);
    if (!response) {
      return new Response('Failed to fetch segment', { status: 502 });
    }
    
    return new Response(response, {
      headers: {
        'Content-Type': 'video/mp2t',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('Segment request error:', error);
    return new Response('Segment Error', { status: 500 });
  }
}

/**
 * Fetch content through CORS proxies
 */
async function fetchThroughProxy(url) {
  // Try direct fetch first
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    // Ignore, try proxies
  }
  
  // Try each proxy
  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = proxy + encodeURIComponent(url);
      const response = await fetch(proxyUrl);
      
      if (response.ok) {
        const content = await response.text();
        if (isValidContent(content)) {
          return content;
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  return null;
}

/**
 * Fetch binary content (for segments)
 */
async function fetchThroughProxyBinary(url) {
  // Try direct fetch first
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch (e) {
    // Ignore, try proxies
  }
  
  // Try each proxy
  for (const proxy of CORS_PROXIES) {
    try {
      const proxyUrl = proxy + encodeURIComponent(url);
      const response = await fetch(proxyUrl);
      
      if (response.ok) {
        return await response.arrayBuffer();
      }
    } catch (e) {
      continue;
    }
  }
  
  return null;
}

/**
 * Process M3U8 content to use internal proxy URLs
 */
function processM3U8Content(content, originalUrl, streamId) {
  const lines = content.split('\n');
  const baseUrl = getBaseUrl(originalUrl);
  const processedLines = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      processedLines.push(trimmedLine);
    } else {
      // This is a segment URL
      let segmentUrl = trimmedLine;
      
      // Convert relative URLs to absolute
      if (!segmentUrl.startsWith('http')) {
        segmentUrl = baseUrl + segmentUrl.replace(/^\//, '');
      }
      
      // Create internal mapping for this segment
      const segmentId = generateId();
      URL_MAPPINGS.set(segmentId, segmentUrl);
      
      // Use internal proxy URL
      const proxyUrl = `${PROXY_BASE}/segment/${segmentId}`;
      processedLines.push(proxyUrl);
    }
  }
  
  return processedLines.join('\n');
}

/**
 * Convert Xtream URLs to M3U8 format
 */
function convertToM3U8(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // Pattern: /user/pass/id -> /live/user/pass/id.m3u8
    if (pathParts.length === 3 && /^\d+$/.test(pathParts[2])) {
      return `${urlObj.protocol}//${urlObj.host}/live/${pathParts[0]}/${pathParts[1]}/${pathParts[2]}.m3u8`;
    }
    
    // Pattern: /live/user/pass/id -> /live/user/pass/id.m3u8
    if (pathParts.length >= 4 && pathParts[0] === 'live') {
      const idPart = pathParts[3];
      if (!idPart.endsWith('.m3u8') && /^\d+$/.test(idPart)) {
        return `${urlObj.protocol}//${urlObj.host}/live/${pathParts[1]}/${pathParts[2]}/${idPart}.m3u8`;
      }
    }
    
    return url;
  } catch {
    return url;
  }
}

/**
 * Get base URL from full URL
 */
function getBaseUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.substring(0, parsed.pathname.lastIndexOf('/') + 1)}`;
  } catch {
    return url.substring(0, url.lastIndexOf('/') + 1);
  }
}

/**
 * Validate content
 */
function isValidContent(content) {
  return content && 
         content.length > 10 &&
         !content.toLowerCase().includes('<!doctype html') &&
         !content.includes('Access Denied') &&
         !content.includes('403 Forbidden');
}

/**
 * Generate unique ID
 */
function generateId() {
  return (mappingCounter++).toString();
}

/**
 * Register stream and get internal proxy URL
 */
self.addEventListener('message', event => {
  if (event.data.type === 'REGISTER_STREAM') {
    const { originalUrl } = event.data;
    const streamId = generateId();
    
    // Store mapping
    URL_MAPPINGS.set(streamId, originalUrl);
    
    // Return internal proxy URL
    const proxyUrl = `${PROXY_BASE}/manifest/${streamId}`;
    
    event.ports[0].postMessage({
      type: 'STREAM_REGISTERED',
      streamId,
      proxyUrl
    });
  }
});