// Backend configuration for API base URL
// IMPORTANT: Set this to your PHP backend origin (Apache/Nginx serving backend/ with .htaccess)
// Examples:
// export const BACKEND_BASE_URL = 'https://your-domain.com';
// export const BACKEND_BASE_URL = 'http://your-server-ip';

// Default to empty string to force fallback if not configured
export const BACKEND_BASE_URL = '';

// Runtime helpers for configuring backend without rebuild
export function getBackendBaseUrl(): string {
  try {
    const saved = localStorage.getItem('backendBaseUrl');
    if (saved && /^(https?:)\/\//.test(saved)) {
      return saved.replace(/\/$/, '');
    }
  } catch {}
  return (BACKEND_BASE_URL || '').replace(/\/$/, '');
}

export function saveBackendBaseUrl(url: string) {
  const cleaned = (url || '').trim().replace(/\/$/, '');
  if (!/^(https?:)\/\//.test(cleaned)) {
    throw new Error('Geçerli bir URL girin (http/https)');
    }
  localStorage.setItem('backendBaseUrl', cleaned);
}

export function isBackendConfigured(): boolean {
  return !!getBackendBaseUrl();
}

