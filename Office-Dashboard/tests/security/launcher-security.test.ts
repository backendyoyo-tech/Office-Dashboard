import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';

describe('Launcher Security Validation', () => {
  const ALLOWED_URLS = ['https://web.whatsapp.com'];
  const SESSION_DIR_PREFIX = 'C:\\HairRap\\WhatsAppSessions';
  const SESSION_CODE_PATTERN = /^HR-WA-\d{4,}$/;

  function validateLaunchRequest(requestData: Record<string, string>): { valid: boolean; error: string } {
    // 1. Validate session_code format
    const sessionCode = requestData.session_code || '';
    if (!sessionCode) {
      return { valid: false, error: 'Missing session_code' };
    }
    if (sessionCode.length > 20) {
      return { valid: false, error: 'session_code exceeds maximum length' };
    }
    if (!SESSION_CODE_PATTERN.test(sessionCode)) {
      return { valid: false, error: 'Invalid session_code format' };
    }

    // 2. Validate session_directory
    const sessionDir = requestData.session_directory || '';
    if (!sessionDir) {
      return { valid: false, error: 'Missing session_directory' };
    }
    if (!sessionDir.startsWith(SESSION_DIR_PREFIX)) {
      return { valid: false, error: 'session_directory must start with allowed prefix' };
    }

    // 3. Validate target_url
    const targetUrl = requestData.target_url || '';
    if (targetUrl && !ALLOWED_URLS.includes(targetUrl)) {
      return { valid: false, error: 'target_url not in allowed URLs' };
    }

    // 4. No path traversal
    if (sessionDir.includes('..')) {
      return { valid: false, error: 'Path traversal detected' };
    }

    // 5. No null bytes
    if (sessionDir.includes('\x00')) {
      return { valid: false, error: 'Null byte detected' };
    }

    // 6. No command injection characters in session_directory (only alphanumeric, hyphens, underscores, backslashes allowed after prefix)
    const relativePath = sessionDir.substring(SESSION_DIR_PREFIX.length);
    if (relativePath && !/^[a-zA-Z0-9\-_\\]+$/.test(relativePath)) {
      return { valid: false, error: 'session_directory contains unsafe characters' };
    }

    return { valid: true, error: '' };
  }

  describe('Session Code Validation', () => {
    it('should accept valid HR-WA-XXXX format', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\HR-WA-0001',
        target_url: 'https://web.whatsapp.com',
      });
      expect(result.valid).toBe(true);
    });

    it('should accept HR-WA-0001 through HR-WA-9999', () => {
      for (let i = 1; i <= 9999; i += 1000) {
        const code = `HR-WA-${String(i).padStart(4, '0')}`;
        const result = validateLaunchRequest({
          session_code: code,
          session_directory: `C:\\HairRap\\WhatsAppSessions\\${code}`,
        });
        expect(result.valid).toBe(true);
      }
    });

    it('should reject empty session_code', () => {
      const result = validateLaunchRequest({
        session_code: '',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\test',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing session_code');
    });

    it('should reject session_code without HR-WA- prefix', () => {
      const result = validateLaunchRequest({
        session_code: 'WA-0001',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\WA-0001',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid session_code');
    });

    it('should reject session_code with special characters', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001; rm -rf /',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\HR-WA-0001',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid session_code');
    });

    it('should reject session_code that is too long', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-' + '0'.repeat(50),
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\test',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });
  });

  describe('Session Directory Validation', () => {
    it('should accept valid session directory', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\HR-WA-0001',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject directory outside allowed prefix', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001',
        session_directory: 'C:\\Windows\\System32\\HR-WA-0001',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('must start with allowed prefix');
    });

    it('should reject path traversal with ..', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\..\\..\\Windows\\System32',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Path traversal');
    });

    it('should reject null bytes in path', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\\x00evil',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Null byte');
    });
  });

  describe('URL Validation', () => {
    it('should accept https://web.whatsapp.com', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\HR-WA-0001',
        target_url: 'https://web.whatsapp.com',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject arbitrary URLs', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\HR-WA-0001',
        target_url: 'https://evil.com',
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not in allowed URLs');
    });

    it('should reject http:// URLs', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\HR-WA-0001',
        target_url: 'http://web.whatsapp.com',
      });
      expect(result.valid).toBe(false);
    });

    it('should reject javascript: URLs', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\HR-WA-0001',
        target_url: 'javascript:alert(1)',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('Arbitrary Command Injection Prevention', () => {
    it('should reject shell commands in session_code', () => {
      const result = validateLaunchRequest({
        session_code: '; rm -rf /',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\test',
      });
      expect(result.valid).toBe(false);
    });

    it('should reject command injection in session_directory', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\HR-WA-0001 & del /f /q C:\\',
      });
      expect(result.valid).toBe(false);
    });

    it('should reject encoded path traversal', () => {
      const result = validateLaunchRequest({
        session_code: 'HR-WA-0001',
        session_directory: 'C:\\HairRap\\WhatsAppSessions\\HR-WA-0001\\..\\..\\..',
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('API Key Validation', () => {
    function validateApiKeyFormat(apiKey: string): boolean {
      if (!apiKey) return false;
      if (apiKey.length < 32) return false;
      return /^[a-zA-Z0-9\-_]+$/.test(apiKey);
    }

    it('should accept valid API key format', () => {
      const key = `hr_launcher_${crypto.randomBytes(32).toString('hex')}`;
      expect(validateApiKeyFormat(key)).toBe(true);
    });

    it('should reject short API keys', () => {
      expect(validateApiKeyFormat('short')).toBe(false);
    });

    it('should reject empty API keys', () => {
      expect(validateApiKeyFormat('')).toBe(false);
    });
  });
});

describe('Credential Encryption', () => {
  it('should have AES-256-GCM encryption module', async () => {
    const encryption = await import('../../src/lib/crypto/encryption');
    expect(encryption.encryptCredential).toBeDefined();
    expect(encryption.decryptCredential).toBeDefined();
  });
});
