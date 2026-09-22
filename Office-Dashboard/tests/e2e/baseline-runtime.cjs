// Run only with DATABASE_URL pointed at a disposable isolated schema.
// The script never prints credentials, JWTs, phone values, or response bodies.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.LAUNCH_TICKET_SECRET = crypto.randomBytes(32).toString('hex');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');
const app = require('../../dist/src/app').default;
const { platformSessionService } = require('../../dist/src/modules/secure-launcher/session.service');
const { launchGrantService } = require('../../dist/src/modules/secure-launcher/grant.service');
const { launchTicketService } = require('../../dist/src/modules/secure-launcher/ticket.service');

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  const schema = url.searchParams.get('schema');
  if (!schema || !/^sl_test_[a-z0-9_]+$/.test(schema)) {
    throw new Error('Refusing runtime test outside a named sl_test_ schema');
  }
  const prisma = new PrismaClient();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  let token;
  const call = async (method, path, body, bearer) => {
    const response = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...((bearer || token) ? { authorization: `Bearer ${bearer || token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    return { status: response.status, data };
  };
  const localProof = (purpose, referenceId, deviceId, apiKey) => {
    const timestamp = Date.now();
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const signature = crypto.createHmac('sha256', keyHash)
      .update(`${purpose}|${referenceId}|${deviceId}|${timestamp}`).digest('hex');
    return { deviceId, purpose, referenceId, timestamp, signature };
  };
  try {
    const initial = await Promise.all([
      prisma.phoneNumber.count(), prisma.platformAccount.count(), prisma.whatsappSession.count(),
    ]);
    if (process.env.EXPECT_FRESH === '1') {
      assert.deepEqual(initial, [0, 0, 0], 'test schema must start without business records');
    }
    console.log(`initial synthetic schema counts: ${initial.join(',')} (phones, accounts, WhatsApp)`);

    const password = crypto.randomBytes(24).toString('hex');
    const email = `secure-launcher-smoke-${crypto.randomUUID()}@example.invalid`;
    await prisma.appUser.create({ data: {
      fullName: 'Synthetic Test Admin', email, passwordHash: await argon2.hash(password), role: 'ADMIN',
    } });
    const platform = await prisma.platform.upsert({
      where: { slug: 'instagram' }, update: {}, create: { slug: 'instagram', displayName: 'Instagram' },
    });

    let response = await call('GET', '/health');
    assert.equal(response.status, 200);
    response = await call('POST', '/auth/login', { email, password });
    assert.equal(response.status, 200, 'login should succeed');
    token = response.data.token;
    assert.ok(token);
    const adminId = response.data.user.id;
    console.log('health and synthetic admin login: 200');

    const suffix = String(2000 + crypto.randomInt(7000));
    const nationalNumber = `415555${suffix}`;
    const phone = await call('POST', '/phone-numbers', {
      e164Number: `+1${nationalNumber}`, countryCode: '1', nationalNumber, label: 'Synthetic N1',
    });
    assert.equal(phone.status, 201, 'phone create should succeed');
    const account = await call('POST', '/platform-accounts', {
      platformId: platform.id, displayName: 'Synthetic A1', accountHandle: 'synthetic_a1',
      profileUrl: 'https://www.instagram.com/synthetic_a1/',
    });
    assert.equal(account.status, 201, 'account create should succeed');
    const linked = await call('POST', `/phone-numbers/${phone.data.id}/accounts`, {
      platformAccountId: account.data.id, relationshipType: 'GENERAL', isPrimary: true,
    });
    assert.equal(linked.status, 201, 'association create should succeed');
    console.log('synthetic phone, account and association create: 201');

    const otherNational = `415555${String(2000 + crypto.randomInt(7000))}`;
    const otherPhone = await call('POST', '/phone-numbers', {
      e164Number: `+1${otherNational}`, countryCode: '1', nationalNumber: otherNational, label: 'Synthetic N2',
    });
    assert.equal(otherPhone.status, 201);
    const otherAccount = await call('POST', '/platform-accounts', {
      platformId: platform.id, displayName: 'Synthetic A2', accountHandle: 'synthetic_a2',
      profileUrl: 'https://www.instagram.com/synthetic_a2/',
    });
    assert.equal(otherAccount.status, 201);
    assert.equal((await call('POST', `/phone-numbers/${otherPhone.data.id}/accounts`, {
      platformAccountId: otherAccount.data.id, relationshipType: 'GENERAL', isPrimary: true,
    })).status, 201);
    const wrongUrl = await call('POST', '/platform-accounts', {
      platformId: platform.id, displayName: 'Unsafe', profileUrl: 'https://www.instagram.com.evil.test/example',
    });
    assert.equal(wrongUrl.status, 400, 'lookalike host must be rejected');

    const details = await call('GET', `/phone-numbers/${phone.data.id}`);
    assert.equal(details.status, 200);
    const inventory = await call('GET', `/phone-numbers/${phone.data.id}/accounts`);
    assert.equal(inventory.status, 200);
    assert.ok(Array.isArray(inventory.data));
    assert.ok(inventory.data.some(link => link.platformAccountId === account.data.id));
    assert.ok(!inventory.data.some(link => link.platformAccountId === otherAccount.data.id));
    const summary = await call('GET', '/dashboard/summary');
    assert.equal(summary.status, 200);
    console.log('number details, isolated account inventory and dashboard summary: 200; unsafe URL: 400');

    const device = await call('POST', '/devices', {
      deviceCode: `SL-${crypto.randomBytes(4).toString('hex')}`, friendlyName: 'Synthetic PC',
    });
    assert.equal(device.status, 201);
    const pending = await call('GET', `/devices/${device.data.id}`);
    assert.equal(pending.data.approvalState, 'PENDING');
    const approved = await call('POST', `/devices/${device.data.id}/approve-launcher`, { version: pending.data.version });
    assert.equal(approved.status, 200);
    assert.equal(approved.data.approvalState, 'APPROVED');
    assert.equal(approved.data.supportsPlatformLauncher, false);

    assert.equal((await call('POST', '/launcher/platform-capability',
      { launcherVersion: '2.0.0' }, device.data.apiKey)).status, 200);
    assert.equal((await call('POST', '/launcher/heartbeat',
      { launcherVersion: '2.0.0' }, device.data.apiKey)).status, 200);
    const firstMapping = await platformSessionService.findOrCreate(phone.data.id, account.data.id, device.data.id);
    const repeatedMapping = await platformSessionService.findOrCreate(phone.data.id, account.data.id, device.data.id);
    assert.equal(firstMapping.session.id, repeatedMapping.session.id);
    assert.match(firstMapping.session.profileKey, /^[a-f0-9]{32}$/);
    await assert.rejects(platformSessionService.findOrCreate(phone.data.id, otherAccount.data.id, device.data.id));
    const secondMapping = await platformSessionService.findOrCreate(otherPhone.data.id, otherAccount.data.id, device.data.id);
    assert.notEqual(firstMapping.session.profileKey, secondMapping.session.profileKey);

    const otherDevice = await prisma.registeredDevice.create({ data: {
      deviceCode: `SL-${crypto.randomBytes(4).toString('hex')}`,
      friendlyName: 'Synthetic PC 2', createdBy: adminId,
      launcherApiKeyHash: crypto.randomBytes(32).toString('hex'),
      approvalState: 'APPROVED', supportsPlatformLauncher: true,
      status: 'ONLINE', lastSeenAt: new Date(),
    } });
    const otherPcMapping = await platformSessionService.findOrCreate(phone.data.id, account.data.id, otherDevice.id);
    assert.notEqual(firstMapping.session.profileKey, otherPcMapping.session.profileKey);
    console.log('same-account reuse and cross-account/cross-device isolation: passed');

    const setupGrant = await call('POST', '/launch/reauth', {
      phoneNumberId: phone.data.id, platformAccountId: account.data.id,
      deviceId: device.data.id, operation: 'SETUP', password,
    });
    assert.equal(setupGrant.status, 200);
    const setupIssued = await call('POST', `/launch/phone-numbers/${phone.data.id}/accounts/${account.data.id}/setup`, {
      deviceId: device.data.id, grantId: setupGrant.data.grantId, grantSecret: setupGrant.data.grantSecret,
      expectedVersion: firstMapping.session.version,
      proof: localProof('grant', setupGrant.data.grantId, device.data.id, device.data.apiKey),
    });
    assert.equal(setupIssued.status, 200);
    const setupConsumed = await call('POST', '/launcher/platform-consume',
      { ticket: setupIssued.data.ticket }, device.data.apiKey);
    assert.equal(setupConsumed.status, 200);
    assert.equal(setupConsumed.data.profileKey, firstMapping.session.profileKey);
    assert.equal((await call('POST', '/launcher/platform-ack', {
      operationId: setupIssued.data.operationId, result: 'DELIVERED',
    }, device.data.apiKey)).status, 200);
    assert.equal((await call('GET', `/launch/operations/${setupIssued.data.operationId}`)).data.state, 'BROWSER_LAUNCHED');
    const confirmedApi = await call('POST', `/launch/sessions/${setupIssued.data.sessionId}/confirm`, {
      phoneNumberId: phone.data.id, platformAccountId: account.data.id, deviceId: device.data.id,
      version: setupIssued.data.version, confirmedIdentifier: 'synthetic_a1',
      proof: localProof('confirm', `${setupIssued.data.sessionId}:${setupIssued.data.version}`, device.data.id, device.data.apiKey),
    });
    assert.equal(confirmedApi.status, 200);
    assert.equal(confirmedApi.data.state, 'USER_CONFIRMED');
    console.log('synthetic API setup, ticket consume, ack and user assertion: passed');

    const grantScope = {
      actorUserId: adminId, phoneNumberId: phone.data.id, platformAccountId: account.data.id,
      deviceId: device.data.id, operation: 'OPEN',
    };
    await assert.rejects(launchGrantService.createForPlatform({ ...grantScope, password: 'wrong-password' }));
    const issued = await launchGrantService.createForPlatform({ ...grantScope, password });
    const storedGrant = await prisma.launchGrant.findUniqueOrThrow({ where: { id: issued.grantId } });
    assert.notEqual(storedGrant.secretHash, issued.grantSecret);
    assert.ok(storedGrant.expiresAt > new Date());
    const confirmed = await prisma.devicePlatformSession.findUniqueOrThrow({ where: { id: firstMapping.session.id } });
    const operation = await launchTicketService.issuePlatform({
      ...grantScope, grantId: issued.grantId, grantSecret: issued.grantSecret, expectedVersion: confirmed.version,
    });
    await assert.rejects(launchTicketService.issuePlatform({
      ...grantScope, grantId: issued.grantId, grantSecret: issued.grantSecret, expectedVersion: confirmed.version,
    }));
    await assert.rejects(launchTicketService.consumePlatform(operation.ticket, otherDevice.id));
    await assert.rejects(launchTicketService.consumePlatform(operation.ticket + 'x', device.data.id));
    const consumed = await launchTicketService.consumePlatform(operation.ticket, device.data.id);
    assert.equal(consumed.profileKey, firstMapping.session.profileKey);
    assert.equal(consumed.targetUrl, 'https://www.instagram.com/');
    await assert.rejects(launchTicketService.consumePlatform(operation.ticket, device.data.id));
    console.log('one-use grant and signed device-bound ticket replay/tamper checks: passed');
    const unusedGrant = await launchGrantService.createForPlatform({ ...grantScope, password });
    assert.equal((await call('POST', '/auth/logout')).status, 200);
    const revokedGrant = await prisma.launchGrant.findUniqueOrThrow({ where: { id: issued.grantId } });
    assert.ok(revokedGrant.consumedAt);
    const revokedUnused = await prisma.launchGrant.findUniqueOrThrow({ where: { id: unusedGrant.grantId } });
    assert.ok(revokedUnused.revokedAt);
    await assert.rejects(launchGrantService.createForPlatform({ ...grantScope, password }));
    console.log('wrong password, scoped grant, hashed secret and logout invalidation: passed');

    const adminToken = token;
    const viewerEmail = `secure-launcher-viewer-${crypto.randomUUID()}@example.invalid`;
    const viewerPassword = crypto.randomBytes(24).toString('hex');
    await prisma.appUser.create({ data: {
      fullName: 'Synthetic Viewer', email: viewerEmail,
      passwordHash: await argon2.hash(viewerPassword), role: 'VIEWER',
    } });
    const viewerLogin = await call('POST', '/auth/login', { email: viewerEmail, password: viewerPassword });
    assert.equal(viewerLogin.status, 200);
    token = viewerLogin.data.token;
    assert.equal((await call('POST', `/devices/${device.data.id}/revoke-launcher`, { version: approved.data.version })).status, 403);
    token = adminToken;
    const revoked = await call('POST', `/devices/${device.data.id}/revoke-launcher`, { version: approved.data.version });
    assert.equal(revoked.status, 200);
    assert.equal(revoked.data.approvalState, 'REVOKED');
    const storedDevice = await prisma.registeredDevice.findUniqueOrThrow({ where: { id: device.data.id } });
    assert.equal(storedDevice.launcherApiKeyHash, null);
    console.log('device pending, admin approval, viewer denial, revoke and key invalidation: passed');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error('baseline runtime failed:', error.message);
  process.exitCode = 1;
});
