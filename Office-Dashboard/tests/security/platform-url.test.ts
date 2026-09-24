import { describe, expect, it } from 'vitest';
import { officialPlatformHome, validatePlatformProfileUrl } from '../../src/lib/platform-url';

describe('platform profile URL policy', () => {
  it.each([
    ['instagram', 'https://www.instagram.com/example/'],
    ['facebook', 'https://www.facebook.com/profile.php?id=12345'],
    ['youtube', 'https://www.youtube.com/@example'],
    ['telegram', 'https://t.me/example'],
    ['pinterest', 'https://www.pinterest.com/example/'],
    ['x', 'https://x.com/example'],
    ['linkedin', 'https://www.linkedin.com/company/example/'],
    ['gmail', 'https://mail.google.com/'],
    ['whatsapp', 'https://web.whatsapp.com/'],
  ])('accepts the approved %s URL', (slug, url) => {
    expect(validatePlatformProfileUrl(url, slug)).toBe(url);
    expect(officialPlatformHome(slug)).toMatch(/^https:\/\//);
  });

  it.each([
    ['instagram', 'https://www.instagram.com\\example'],
    ['instagram', 'https://www.insta\ngram.com/example'],
    ['instagram', 'https://www.ｉnstagram.com/example'],
    ['instagram', 'https://www.instagram.com/a/../example'],
    ['instagram', 'https://www.instagram.com:443/example'],
    ['instagram', 'https://www.instagram.com/example#fragment'],
    ['facebook', 'https://www.facebook.com/l.php'],
    ['x', 'https://x.com/intent'],
    ['x', 'https://x.com/logout'],
    ['instagram', 'http://www.instagram.com/example'],
    ['instagram', 'https://www.instagram.com.evil.test/example'],
    ['instagram', 'https://user:pass@www.instagram.com/example'],
    ['instagram', 'https://www.instagram.com:8443/example'],
    ['instagram', 'https://www.instagram.com/%2e%2e/'],
    ['instagram', 'https://www.instagram.com/example?next=https://evil.test'],
    ['facebook', 'https://www.facebook.com/profile.php?id=123&next=evil'],
    ['youtube', 'https://www.youtube.com/redirect?url=evil'],
    ['x', 'https://127.0.0.1/example'],
    ['linkedin', 'https://www.linkedin.com.evil.test/in/example'],
    ['gmail', 'https://mail.google.com/mail/u/0/'],
    ['other', 'https://example.com/'],
  ])('rejects unsafe %s URL', (slug, url) => {
    expect(() => validatePlatformProfileUrl(url, slug)).toThrow();
  });
});
