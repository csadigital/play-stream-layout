/**
 * Service Worker for invisible stream proxying
 * All real URLs are hidden, only internal proxy URLs are visible
 */

const CACHE_NAME = 'stream-proxy-v1';
const PROXY_BASE = '/api/stream';

// CORS proxy endpoints (kept internal)
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?request='
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
    
    if (pathParts[3] === 'register') {
      // Handle registration: /api/stream/register?url=...
      const originalUrl = url.searchParams.get('url');
      if (!originalUrl) {
        return new Response(JSON.stringify({ error: 'Missing url' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
      const streamId = generateId();
      URL_MAPPINGS.set(streamId, originalUrl);
      const proxyUrl = `${PROXY_BASE}/manifest/${streamId}`;
      return new Response(JSON.stringify({ streamId, proxyUrl }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

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

    if (pathParts[3] === 'key') {
      // Handle key requests: /api/stream/key/{id}
      const keyId = pathParts[4];
      return await handleKeyRequest(keyId);
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
 * Handle key requests
 */
async function handleKeyRequest(keyId) {
  try {
    const realUrl = URL_MAPPINGS.get(keyId);
    if (!realUrl) {
      return new Response('Key not found', { status: 404 });
    }

    const data = await fetchThroughProxyBinary(realUrl);
    if (!data) {
      return new Response('Failed to fetch key', { status: 502 });
    }

    return new Response(data, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (error) {
    console.error('Key request error:', error);
    return new Response('Key Error', { status: 500 });
  }
}

/**
 * Fetch content through CORS proxies
 */
async function fetchThroughProxy(url) {
  const isHttp = url.startsWith('http://');

  // For HTTPS upstreams, try direct fetch first
  if (!isHttp) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        if (isValidContent(text)) return text;
      }
    } catch (e) {
      // Ignore and try proxies
    }
  }

  // Helper: decode AllOrigins data URL if present
  const decodeAllOriginsContents = (val) => {
    if (!val) return '';
    try {
      if (val.startsWith('data:')) {
        const idx = val.indexOf('base64,');
        if (idx !== -1) {
          const b64 = val.substring(idx + 7);
          try { return atob(b64); } catch { return ''; }
        }
      }
      return val;
    } catch { return ''; }
  };

  // Use AllOrigins JSON API (CORS-friendly)
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      const text = decodeAllOriginsContents(data.contents || '');
      if (isValidContent(text)) return text;
    }
  } catch (e) {
    // continue
  }

  // Fallback: codetabs raw proxy
  try {
    const proxyUrl = `https://api.codetabs.com/v1/proxy?request=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (response.ok) {
      const text = await response.text();
      if (isValidContent(text)) return text;
    }
  } catch (e) {}

  return null;
}

/**
 * Fetch binary content (for segments)
 */
async function fetchThroughProxyBinary(url) {
  const isHttp = url.startsWith('http://');

  // For HTTPS upstreams, try direct fetch first
  if (!isHttp) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.arrayBuffer();
      }
    } catch (e) {
      // Ignore and try proxies
    }
  }

  // Helper: decode AllOrigins JSON contents (data:...;base64,)
  const decodeAllOriginsToBuffer = (val) => {
    if (!val) return null;
    try {
      if (val.startsWith('data:')) {
        const idx = val.indexOf('base64,');
        if (idx !== -1) {
          const b64 = val.substring(idx + 7);
          const binary = atob(b64);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
          return bytes.buffer;
        }
      }
      // Fallback: treat as text
      const enc = new TextEncoder();
      return enc.encode(val).buffer;
    } catch {
      return null;
    }
  };

  // AllOrigins JSON API
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      const buf = decodeAllOriginsToBuffer(data.contents || '');
      if (buf) return buf;
    }
  } catch (e) {}

  // Fallback: codetabs raw proxy
  try {
    const proxyUrl = `https://api.codetabs.com/v1/proxy?request=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch (e) {}

  return null;
}

/**
 * Process M3U8 content to use internal proxy URLs
 */
function processM3U8Content(content, originalUrl, streamId) {
  const lines = content.split('\n');
  const baseUrl = getBaseUrl(originalUrl);
  const processedLines = [];
  let lastTag = '';

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) {
      processedLines.push(line);
      continue;
    }

    if (line.startsWith('#')) {
      // Rewrite key URI if present
      if (line.startsWith('#EXT-X-KEY')) {
        const match = line.match(/URI="([^"]+)"/i);
        if (match) {
          let keyUrl = match[1];
          if (!keyUrl.startsWith('http')) {
            keyUrl = baseUrl + keyUrl.replace(/^\//, '');
          }
          const keyId = generateId();
          URL_MAPPINGS.set(keyId, keyUrl);
          const proxied = line.replace(/URI="([^"]+)"/i, `URI="${PROXY_BASE}/key/${keyId}"`);
          processedLines.push(proxied);
        } else {
          processedLines.push(line);
        }
        lastTag = 'KEY';
        continue;
      }

      if (line.startsWith('#EXT-X-STREAM-INF')) {
        lastTag = 'STREAM-INF';
      } else if (line.startsWith('#EXTINF')) {
        lastTag = 'EXTINF';
      } else {
        lastTag = '';
      }

      processedLines.push(line);
      continue;
    }

    // Non-comment line: either a child manifest (after STREAM-INF) or a media segment
    let targetUrl = line;
    if (!targetUrl.startsWith('http')) {
      targetUrl = baseUrl + targetUrl.replace(/^\//, '');
    }

    const id = generateId();
    URL_MAPPINGS.set(id, targetUrl);

    if (lastTag === 'STREAM-INF') {
      processedLines.push(`${PROXY_BASE}/manifest/${id}`);
    } else {
      processedLines.push(`${PROXY_BASE}/segment/${id}`);
    }

    // Reset tag when consumed
    if (lastTag === 'STREAM-INF' || lastTag === 'EXTINF') {
      lastTag = '';
    }
  }

  // Ensure header exists
  if (!processedLines.length || !processedLines[0]?.startsWith('#EXTM3U')) {
    processedLines.unshift('#EXTM3U');
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
  if (!content || content.length < 10) return false;
  const lower = content.toLowerCase();
  if (lower.includes('<!doctype html') || content.includes('Access Denied') || content.includes('403 Forbidden')) return false;
  return content.includes('#EXTM3U');
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