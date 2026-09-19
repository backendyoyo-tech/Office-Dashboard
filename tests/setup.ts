import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Test database setup/teardown helpers.
 * 
 * These helpers manage the test database lifecycle:
 * - Clean all tables before each test suite
 * - Seed test fixtures
 * - Disconnect after all tests
 */

let prisma: PrismaClient;

/**
 * Get or create the test Prisma client.
 */
export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prisma;
}

/**
 * Clean all data from the database.
 * Order matters due to foreign key constraints.
 */
export async function cleanDatabase(): Promise<void> {
  const db = getTestPrisma();
  
  // Delete in reverse dependency order
  await db.whatsappAuditLog.deleteMany();
  await db.whatsappSession.deleteMany();
  await db.registeredDevice.deleteMany();
  await db.auditLog.deleteMany();
  await db.accountRecoveryMethod.deleteMany();
  await db.accountCredential.deleteMany();
  await db.phoneAccountLink.deleteMany();
  await db.platformAccount.deleteMany();
  await db.phoneNumber.deleteMany();
  await db.appUser.deleteMany();
  // Don't delete platforms - they're reference data
}

/**
 * Seed test fixtures.
 */
export async function seedTestData() {
  const db = getTestPrisma();

  // Seed platforms
  const platforms = await Promise.all([
    db.platform.upsert({
      where: { slug: 'instagram' },
      update: {},
      create: { slug: 'instagram', displayName: 'Instagram', iconKey: 'instagram' },
    }),
    db.platform.upsert({
      where: { slug: 'facebook' },
      update: {},
      create: { slug: 'facebook', displayName: 'Facebook', iconKey: 'facebook' },
    }),
    db.platform.upsert({
      where: { slug: 'x' },
      update: {},
      create: { slug: 'x', displayName: 'X (Twitter)', iconKey: 'x-twitter' },
    }),
    db.platform.upsert({
      where: { slug: 'linkedin' },
      update: {},
      create: { slug: 'linkedin', displayName: 'LinkedIn', iconKey: 'linkedin' },
    }),
    db.platform.upsert({
      where: { slug: 'youtube' },
      update: {},
      create: { slug: 'youtube', displayName: 'YouTube', iconKey: 'youtube' },
    }),
    db.platform.upsert({
      where: { slug: 'pinterest' },
      update: {},
      create: { slug: 'pinterest', displayName: 'Pinterest', iconKey: 'pinterest' },
    }),
    db.platform.upsert({
      where: { slug: 'gmail' },
      update: {},
      create: { slug: 'gmail', displayName: 'Gmail', iconKey: 'gmail' },
    }),
  ]);

  return { platforms };
}

/**
 * Create a test user.
 */
export async function createTestUser(overrides: {
  fullName?: string;
  email?: string;
  role?: 'ADMIN' | 'EDITOR' | 'VIEWER';
  passwordHash?: string;
} = {}) {
  const db = getTestPrisma();
  const argon2 = await import('argon2');

  return db.appUser.create({
    data: {
      fullName: overrides.fullName ?? 'Test User',
      email: overrides.email ?? `test-${Date.now()}@example.com`,
      role: overrides.role ?? 'ADMIN',
      status: 'ACTIVE',
      passwordHash: overrides.passwordHash ?? await argon2.hash('testpassword123', {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      }),
    },
  });
}

/**
 * Create a test phone number.
 */
export async function createTestPhone(userId: string, overrides: {
  e164Number?: string;
  label?: string;
} = {}) {
  const db = getTestPrisma();
  const e164 = overrides.e164Number ?? `+1415555${String(Date.now()).slice(-4)}`;

  return db.phoneNumber.create({
    data: {
      e164Number: e164,
      countryCode: '1',
      nationalNumber: e164.slice(2),
      label: overrides.label ?? 'Test Phone',
      createdBy: userId,
      updatedBy: userId,
    },
  });
}

/**
 * Create a test device.
 */
export async function createTestDevice(userId: string, overrides: {
  deviceCode?: string;
  friendlyName?: string;
} = {}) {
  const db = getTestPrisma();

  return db.registeredDevice.create({
    data: {
      deviceCode: overrides.deviceCode ?? `PC-${String(Date.now()).slice(-4)}`,
      friendlyName: overrides.friendlyName ?? 'Test Device',
      status: 'UNKNOWN',
      enabled: true,
      createdBy: userId,
    },
  });
}

/**
 * Generate a JWT token for a test user.
 */
export async function generateTestToken(userId: string): Promise<string> {
  const jwt = await import('jsonwebtoken');
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET ?? 'test-jwt-secret-for-testing-only',
    { expiresIn: '1h' },
  );
}

/**
 * Disconnect the test Prisma client.
 */
export async function disconnectTestDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}
