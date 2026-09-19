import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Hair Rap Dashboard database...\n');

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
  let created = 0;
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

    created++;
  }

  console.log(`  ✅ ${created} phone numbers with WhatsApp sessions created\n`);
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
