/** Fixed destinations for privileged launch; profile links are metadata only. */
export const OFFICIAL_PLATFORM_HOMES: Record<string, string> = {
  whatsapp: 'https://web.whatsapp.com/',
  instagram: 'https://www.instagram.com/',
  facebook: 'https://www.facebook.com/',
  youtube: 'https://www.youtube.com/',
  telegram: 'https://web.telegram.org/',
  pinterest: 'https://www.pinterest.com/',
  x: 'https://x.com/',
  linkedin: 'https://www.linkedin.com/',
  gmail: 'https://mail.google.com/',
};

const HOSTS: Record<string, readonly string[]> = {
  whatsapp: ['web.whatsapp.com'],
  instagram: ['www.instagram.com', 'instagram.com'],
  facebook: ['www.facebook.com', 'facebook.com'],
  youtube: ['www.youtube.com', 'youtube.com'],
  telegram: ['web.telegram.org', 't.me'],
  pinterest: ['www.pinterest.com', 'pinterest.com'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
  linkedin: ['www.linkedin.com', 'linkedin.com'],
  gmail: ['mail.google.com'],
};

export function officialPlatformHome(slug: string): string | null {
  return OFFICIAL_PLATFORM_HOMES[slug] ?? null;
}

/** Validate public navigation metadata without treating it as login identity. */
export function validatePlatformProfileUrl(raw: string, slug: string): string {
  const value = raw.trim();
  // Reject ambiguous raw input before WHATWG URL canonicalization can hide it.
  if (/[^\x21-\x7e]|\\/.test(value)) throw new Error('Profile URL contains ambiguous characters');
  if (value.length > 500 || !/^https:\/\//i.test(value)) throw new Error('Profile URL must use HTTPS');
  if (value.includes('%')) throw new Error('Encoded profile URLs are not allowed');
  const authority = /^https:\/\/([^/?#]+)/i.exec(value)?.[1] ?? '';
  if (authority.includes('@') || authority.includes(':')) throw new Error('Profile URL must not contain credentials or a port');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Invalid profile URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) {
    throw new Error('Invalid profile URL');
  }
  const host = url.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+$/.test(host) || !HOSTS[slug]?.includes(host)) {
    throw new Error('Profile URL host is not approved for this platform');
  }
  const path = url.pathname;
  if (/\/(?:\.|\.\.)(?:\/|$)/.test(value.slice(value.indexOf(authority) + authority.length))) {
    throw new Error('Dot segments are not permitted');
  }
  if (/^\/(?:redirect|url|away|out|l\.php|login|logout|intent|share)(?:\/|$)/i.test(path)) {
    throw new Error('Redirect and action endpoints are not profile URLs');
  }
  if (/%|\\/.test(path)) throw new Error('Encoded or escaped profile paths are not allowed');
  const simpleHandle = /^\/[a-zA-Z0-9._-]{1,100}\/?$/;
  const isHome = path === '/';
  let allowed = false;
  switch (slug) {
    case 'whatsapp': case 'gmail': allowed = isHome; break;
    case 'instagram': allowed = isHome || /^\/[a-zA-Z0-9._]{1,30}\/?$/.test(path); break;
    case 'facebook': allowed = isHome || simpleHandle.test(path) || /^\/pages\/[a-zA-Z0-9._-]{1,100}\/[0-9]{1,30}\/?$/.test(path); break;
    case 'youtube': allowed = isHome || /^\/(?:@[a-zA-Z0-9._-]{1,100}|(?:channel|c|user)\/[a-zA-Z0-9_-]{1,100})\/?$/.test(path); break;
    case 'telegram': allowed = host === 't.me' ? simpleHandle.test(path) : isHome || /^\/(?:k|a)\/?$/.test(path); break;
    case 'pinterest': case 'x': allowed = isHome || simpleHandle.test(path); break;
    case 'linkedin': allowed = isHome || /^\/(?:in|company)\/[a-zA-Z0-9_-]{1,100}\/?$/.test(path); break;
  }
  if (slug === 'facebook' && path === '/profile.php' && /^[0-9]{1,30}$/.test(url.searchParams.get('id') ?? '') && [...url.searchParams.keys()].length === 1) {
    allowed = true;
  } else if (url.search) {
    allowed = false;
  }
  if (!allowed) throw new Error('Profile URL path is not approved for this platform');
  return url.href;
}
