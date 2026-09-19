/**
 * Input sanitisation helpers (REPAIR: D-017 / SEC-007).
 *
 * Threat model: stored XSS via free-text fields that are echoed back to the
 * dashboard (phone label, notes, account display name/handle, device friendly
 * name, error strings).
 *
 * Defence in depth:
 *  1. The React frontend renders all of these as text nodes (no
 *     `dangerouslySetInnerHTML` anywhere — asserted by a regression test), so
 *     React escapes them on output.
 *  2. Additionally, the API now normalises these fields on ingest so a
 *     dashboard export / third-party consumer cannot be attacked either.
 *
 * The sanitiser is deliberately *lossless for legitimate data*:
 *  - it strips HTML tag delimiters (`<`, `>`) which have no business being in a
 *    phone label, account handle, device name or error string;
 *  - it removes NUL and other C0/C1 control characters;
 *  - it normalises unicode whitespace and trims;
 *  - it caps length.
 * It does NOT HTML-entity-encode, so "A & B" stays "A & B".
 */

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;
const LONE_ANGLE = /[<>]/g;
const SCRIPTISH = /(javascript|vbscript|data)\s*:/gi;

export function sanitizeText(input: unknown, maxLength = 2000): string | undefined {
  if (input === undefined || input === null) return undefined;
  let value = String(input);
  value = value.replace(CONTROL_CHARS, '');
  value = value.replace(HTML_TAG, '');
  value = value.replace(LONE_ANGLE, '');
  value = value.replace(SCRIPTISH, '');
  value = value.replace(/\u00A0/g, ' ');
  value = value.replace(/[ \t]{2,}/g, ' ');
  value = value.trim();
  if (value.length > maxLength) value = value.slice(0, maxLength);
  return value;
}

/** Sanitise but preserve `undefined` vs empty-string semantics. */
export function sanitizeOptionalText(input: unknown, maxLength = 2000): string | undefined {
  const out = sanitizeText(input, maxLength);
  return out === '' ? undefined : out;
}

/**
 * Strict URL validation (REPAIR: D-018).
 * Only http/https absolute URLs are accepted; everything else (javascript:,
 * data:, file:, protocol-relative, credentials-in-URL) is rejected.
 */
export function sanitizeUrl(input: unknown): string | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input === '') return null;
  const raw = String(input).trim();
  if (raw === '') return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('profileUrl must be an absolute http(s) URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('profileUrl must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('profileUrl must not embed credentials');
  }
  if (raw.length > 500) {
    throw new Error('profileUrl must be at most 500 characters');
  }
  return raw;
}

/** True when a string contains no HTML/script/control payloads. */
export function isCleanText(input: unknown): boolean {
  if (input === undefined || input === null) return true;
  const value = String(input);
  if (CONTROL_CHARS.test(value)) return false;
  if (/<[a-zA-Z/!]/.test(value)) return false;
  if (/javascript\s*:/i.test(value)) return false;
  return true;
}
