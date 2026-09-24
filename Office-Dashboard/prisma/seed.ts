import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Hair Rap Dashboard database...\n');

  // Clean up everything from previous seed runs to make this idempotent.
  // Order matters: children before parents to avoid FK violations.
  await prisma.whatsappAuditLog.deleteMany();
  await prisma.phoneAccountLink.deleteMany();
  await prisma.accountCredential.deleteMany();
  await prisma.accountRecoveryMethod.deleteMany();
  await prisma.whatsappSession.deleteMany();
  await prisma.platformAccount.deleteMany();
  await prisma.phoneNumber.deleteMany();
  await prisma.registeredDevice.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.appUser.deleteMany();

  // ============================================================
  // 1. Seed Platforms
  // ============================================================
  console.log('📱 Seeding platforms...');
  const platforms = [
    { slug: 'instagram', displayName: 'Instagram', iconKey: 'instagram' },
    { slug: 'facebook', displayName: 'Facebook', iconKey: 'facebook' },
    { slug: 'x', displayName: 'X (Twitter)', iconKey: 'x-twitter' },
    { slug: 'linkedin', displayName: 'LinkedIn', iconKey: 'linkedin' },
    { slug: 'youtube', displayName: 'YouTube', iconKey: 'youtube' },
    { slug: 'pinterest', displayName: 'Pinterest', iconKey: 'pinterest' },
    { slug: 'gmail', displayName: 'Gmail', iconKey: 'gmail' },
  ];

  for (const platform of platforms) {
    await prisma.platform.upsert({
      where: { slug: platform.slug },
      update: { displayName: platform.displayName, iconKey: platform.iconKey },
      create: platform,
    });
  }
  console.log(`  ✅ ${platforms.length} platforms seeded\n`);

  // ============================================================
  // 2. Seed Admin User
  // ============================================================
  console.log('👤 Seeding admin user...');
  const adminPasswordHash = await argon2.hash('admin123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.appUser.upsert({
    where: { email: 'admin@hairrap.com' },
    update: {},
    create: {
      fullName: 'Admin User',
      email: 'admin@hairrap.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log(`  ✅ Admin user created: admin@hairrap.com / admin123\n`);

  // ============================================================
  // 3. Generate 100 Synthetic WhatsApp Sessions
  // ============================================================
  console.log('📱 Generating 100 synthetic WhatsApp sessions...');

  const statuses = [
    'SETUP_REQUIRED', 'LINKING', 'LINKED', 'LINKED', 'LINKED',
    'RELOGIN_REQUIRED', 'ERROR', 'DISABLED', 'UNKNOWN',
  ];

  // First create some devices
  const devices: { id: string; deviceCode: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    const code = `PC-${String(i).padStart(2, '0')}`;
    const device = await prisma.registeredDevice.upsert({
      where: { deviceCode: code },
      update: {},
      create: {
        deviceCode: code,
        friendlyName: `Office Desktop ${i}`,
        hostname: `DESKTOP-OFFICE-${i}`,
        status: i <= 3 ? 'ONLINE' : 'UNKNOWN',
        launcherVersion: '1.0.0',
        enabled: true,
        createdBy: admin.id,
        lastSeenAt: i <= 3 ? new Date() : null,
      },
    });
    devices.push({ id: device.id, deviceCode: device.deviceCode });
  }
  console.log(`  ✅ ${devices.length} devices created`);

  // Create 100 phone numbers with WhatsApp sessions
  let phoneCount = 0;
  for (let i = 1; i <= 100; i++) {
    const num = String(i).padStart(4, '0');
    const phoneNumber = `+1415555${num}`;
    const e164Number = phoneNumber;

    // Create or get phone number
    const phone = await prisma.phoneNumber.upsert({
      where: { e164Number },
      update: {},
      create: {
        e164Number,
        countryCode: '1',
        nationalNumber: `415555${num}`,
        simProvider: ['AT&T', 'T-Mobile', 'Verizon'][i % 3],
        label: `Test Phone ${num}`,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });

    // Create WhatsApp session
    const sessionCode = `HR-WA-${String(i).padStart(4, '0')}`;
    const device = devices[i % devices.length];
    const status = statuses[i % statuses.length];
    const sessionDir = `C:\\HairRap\\WhatsAppSessions\\${sessionCode}`;

    await prisma.whatsappSession.upsert({
      where: { phoneNumberId: phone.id },
      update: {},
      create: {
        sessionCode,
        phoneNumberId: phone.id,
        deviceId: device.id,
        status: status as any,
        sessionDirectory: sessionDir,
        createdBy: admin.id,
        linkedAt: status === 'LINKED' ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null,
        lastOpenedAt: status === 'LINKED' ? new Date() : null,
        lastError: status === 'ERROR' ? 'Browser process crashed' : null,
      },
    });

    phoneCount++;
  }

  console.log(`  ✅ ${phoneCount} phone numbers with WhatsApp sessions created\n`);
  // REPAIR D-035 — Phase 1 requires platform accounts linked to phone numbers.
  // Create platform accounts (one per platform) and link each to a phone number,
  // with credentials and recovery methods where sensible so the completeness
  // metrics and reveal flow have real data to work against.
  const platformRows = await prisma.platform.findMany({
    orderBy: { slug: 'asc' },
  });
  console.log(`  📱 ${platformRows.length} platforms available for account seeding`);

  for (let i = 0; i < platformRows.length; i++) {
    const platform = platformRows[i];
    const acctHandle = `qa_acct_${platform.slug}`;
    const loginId = `qa_${platform.slug}_recover@example.test`;

    const existingAccount = await prisma.platformAccount.findFirst({
      where: { loginIdentifier: loginId },
    });

    const account =
      existingAccount ??
      (await prisma.platformAccount.create({
        data: {
          platformId: platform.id,
          displayName: `${platform.displayName} QA Account`,
          accountHandle: acctHandle,
          loginIdentifier: loginId,
          accountStatus: 'ACTIVE',
          createdBy: admin.id,
          updatedBy: admin.id,
        },
      }));

    // Persist an encrypted credential so the account is COMPLETE and the reveal
    // path is immediately usable (D-002/D-003 alignment).
    const pw = `QApass${String(i + 1).padStart(2, '0')}!`;
    const { encryptCredential } = await import('@/lib/crypto/encryption');
    const encrypted = encryptCredential(pw, account.id);
    await prisma.accountCredential.upsert({
      where: { platformAccountId: account.id },
      update: {},
      create: {
        platformAccountId: account.id,
        passwordCiphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        authTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
        secretUpdatedBy: admin.id,
        secretUpdatedAt: new Date(),
      },
    });

    // One recovery method per account.
    const recovery = await prisma.accountRecoveryMethod.upsert({
      where: {
        platformAccountId_methodType: {
          platformAccountId: account.id,
          methodType: 'EMAIL',
        },
      },
      update: {},
      create: {
        platformAccountId: account.id,
        methodType: 'EMAIL',
        valueNormalized: loginId,
        isPrimary: true,
        createdBy: admin.id,
      },
    });

    // Link this account to a phone number so the phone has ≥1 linked account.
    // Cycle through the first few phones so no single phone gets everything.
    const phoneSlot = i % 7;
    const phone = await prisma.phoneNumber.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      skip: phoneSlot,
      take: 1,
    });
    if (phone) {
      await prisma.phoneAccountLink.upsert({
        where: {
          phoneNumberId_platformAccountId_relationshipType: {
            phoneNumberId: phone.id,
            platformAccountId: account.id,
            relationshipType: 'GENERAL',
          },
        },
        update: {},
        create: {
          phoneNumberId: phone.id,
          platformAccountId: account.id,
          relationshipType: 'GENERAL',
          isPrimary: i === 0,
          linkedBy: admin.id,
        },
      });
    }

    console.log(`  ✅ platform account ${platform.slug} created + linked + credential + recovery`);
  }
  console.log('');

  console.log('🎉 Seeding complete!');
  console.log('─────────────────────────────────');
  console.log('Admin login: admin@hairrap.com / admin123');
  console.log('─────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

