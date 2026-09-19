import { describe, it, expect } from 'vitest';
import { encryptCredential, decryptCredential } from '../../src/lib/crypto/encryption';

describe('Credential Encryption (AES-256-GCM)', () => {
  const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const TEST_AAD = 'test-platform-account-id-12345';

  beforeEach(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
    process.env.CREDENTIAL_KEY_VERSION = '1';
  });

  afterEach(() => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.CREDENTIAL_KEY_VERSION;
  });

  describe('encryptCredential', () => {
    it('should encrypt plaintext successfully', () => {
      const plaintext = 'MySecurePassword123!';
      const result = encryptCredential(plaintext, TEST_AAD);

      expect(result).toBeDefined();
      expect(result.ciphertext).toBeDefined();
      expect(result.nonce).toBeDefined();
      expect(result.authTag).toBeDefined();
      expect(result.keyVersion).toBe(1);

      // Ciphertext should be base64 encoded
      expect(() => Buffer.from(result.ciphertext, 'base64')).not.toThrow();
      expect(() => Buffer.from(result.nonce, 'base64')).not.toThrow();
      expect(() => Buffer.from(result.authTag, 'base64')).not.toThrow();
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'SamePassword';
      const result1 = encryptCredential(plaintext, TEST_AAD);
      const result2 = encryptCredential(plaintext, TEST_AAD);

      expect(result1.ciphertext).not.toBe(result2.ciphertext);
      expect(result1.nonce).not.toBe(result2.nonce);
    });

    it('should use specified key version', () => {
      const result = encryptCredential('test', TEST_AAD, 2);
      expect(result.keyVersion).toBe(2);
    });

    it('should throw if encryption key is not set', () => {
      delete process.env.CREDENTIAL_ENCRYPTION_KEY;
      expect(() => encryptCredential('test', TEST_AAD)).toThrow('CREDENTIAL_ENCRYPTION_KEY');
    });

    it('should throw if key is wrong length', () => {
      process.env.CREDENTIAL_ENCRYPTION_KEY = 'tooshort';
      expect(() => encryptCredential('test', TEST_AAD)).toThrow('64 hex characters');
    });
  });

  describe('decryptCredential', () => {
    it('should decrypt ciphertext successfully', () => {
      const plaintext = 'MySecurePassword123!';
      const encrypted = encryptCredential(plaintext, TEST_AAD);
      const decrypted = decryptCredential(encrypted, TEST_AAD);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const encrypted = encryptCredential(plaintext, TEST_AAD);
      const decrypted = decryptCredential(encrypted, TEST_AAD);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Pässwörd with ümlauts and émojis 🔐';
      const encrypted = encryptCredential(plaintext, TEST_AAD);
      const decrypted = decryptCredential(encrypted, TEST_AAD);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long passwords', () => {
      const plaintext = 'A'.repeat(1000);
      const encrypted = encryptCredential(plaintext, TEST_AAD);
      const decrypted = decryptCredential(encrypted, TEST_AAD);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw if AAD does not match (ciphertext tampering)', () => {
      const plaintext = 'MyPassword';
      const encrypted = encryptCredential(plaintext, TEST_AAD);

      // Try to decrypt with different AAD
      expect(() => decryptCredential(encrypted, 'wrong-aad')).toThrow();
    });

    it('throw if ciphertext is tampered', () => {
      const plaintext = 'MyPassword';
      const encrypted = encryptCredential(plaintext, TEST_AAD);

      // Tamper with ciphertext
      const tampered = {
        ...encrypted,
        ciphertext: Buffer.from('tampered').toString('base64'),
      };

      expect(() => decryptCredential(tampered, TEST_AAD)).toThrow();
    });

    it('should throw if nonce is tampered', () => {
      const plaintext = 'MyPassword';
      const encrypted = encryptCredential(plaintext, TEST_AAD);

      const tampered = {
        ...encrypted,
        nonce: Buffer.from('tampered1234').toString('base64'),
      };

      expect(() => decryptCredential(tampered, TEST_AAD)).toThrow();
    });

    it('should throw if auth tag is tampered', () => {
      const plaintext = 'MyPassword';
      const encrypted = encryptCredential(plaintext, TEST_AAD);

      const tampered = {
        ...encrypted,
        authTag: Buffer.from('tampered12345678').toString('base64'),
      };

      expect(() => decryptCredential(tampered, TEST_AAD)).toThrow();
    });
  });

  describe('AAD Binding', () => {
    it('should bind ciphertext to specific account', () => {
      const plaintext = 'AccountPassword';
      const account1 = 'account-id-001';
      const account2 = 'account-id-002';

      const encrypted1 = encryptCredential(plaintext, account1);
      const encrypted2 = encryptCredential(plaintext, account2);

      // Each account should only be able to decrypt its own ciphertext
      expect(decryptCredential(encrypted1, account1)).toBe(plaintext);
      expect(decryptCredential(encrypted2, account2)).toBe(plaintext);

      // Cross-account decryption should fail
      expect(() => decryptCredential(encrypted1, account2)).toThrow();
      expect(() => decryptCredential(encrypted2, account1)).toThrow();
    });
  });

  describe('Key Version Support', () => {
    it('should support multiple key versions', () => {
      process.env.CREDENTIAL_ENCRYPTION_KEY = TEST_KEY;
      process.env.CREDENTIAL_KEY_VERSION = '1';

      const plaintext = 'TestPassword';
      const encrypted = encryptCredential(plaintext, TEST_AAD, 1);
      expect(encrypted.keyVersion).toBe(1);

      const decrypted = decryptCredential(encrypted, TEST_AAD);
      expect(decrypted).toBe(plaintext);
    });
  });
});
