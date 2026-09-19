import prisma from '@/lib/db/prisma';
import {
  countIncompleteNumbers,
  countCompleteNumbers,
  countEmptyNumbers,
} from '@/lib/completeness';
import { effectiveDeviceStatus } from '@/lib/device-state';

/**
 * Dashboard service — summary metrics for the overview page.
 *
 * CANONICAL CONTRACT (REPAIR: D-004, D-005, D-030)
 * -------------------------------------------------
 * This exact shape is mirrored by `DashboardSummary` in the frontend
 * (`frontend/src/types/index.ts`) and is asserted against by
 * `tests/integration/dashboard-contract.test.ts`. If you change a key here you
 * MUST change the frontend type and the contract test in the same commit.
 *
 * Every metric below is explicitly defined:
 *  - totalNumbers / activeNumbers  — non-archived phone rows / non-archived with
 *    status ACTIVE. Archived rows are excluded from both.
 *  - connectedAccounts            — non-archived platform accounts.
 *  - completeNumbers              — phones with ≥1 link where every link is complete.
 *  - incompleteNumbers            — phones with ≥1 link where some link is incomplete.
 *  - emptyNumbers                 — phones with zero links (onboarding, NOT incomplete).
 *  - loginIssueAccounts           — non-archived accounts flagged LOGIN_ISSUE.
 *  - accountsWithCredentials      — credentials rows (1:1 with accounts).
 *  - totalUsers                   — ACTIVE dashboard users.
 *  - totalDevices                 — enabled devices.
 *  - onlineDevices                — enabled devices whose *effective* status is ONLINE.
 *  - offlineDevices               — enabled devices whose effective status is OFFLINE or UNKNOWN.
 *  - whatsappTotal                — every session row, including DISABLED (repairs D-030's
 *                                   ambiguity by exposing both).
 *  - whatsappActive               — sessions excluding DISABLED.
 *  - whatsappLinked / Setup / Error / Disabled — per-status counts.
 *  - recentActivity               — the 10 most recent audit rows, in the exact
 *                                   `AuditLog` shape the frontend already declares.
 */
export class DashboardService {
  async getSummary() {
    const [
      totalPhones,
      activePhones,
      totalAccounts,
      accountsWithCredentials,
      totalUsers,
      recentAuditLogs,
      totalDevices,
      enabledDevices,
      totalWaSessions,
      activeWaSessions,
      linkedSessions,
      setupRequiredSessions,
      errorSessions,
      loginIssueAccounts,
      disabledSessions,
      completeNumbers,
      incompleteNumbers,
      emptyNumbers,
    ] = await Promise.all([
      prisma.phoneNumber.count({ where: { status: 'ACTIVE' } }),
      prisma.phoneNumber.count({ where: { status: 'ACTIVE' } }),
      prisma.platformAccount.count({ where: { archivedAt: null } }),
      prisma.accountCredential.count(),
      prisma.appUser.count({ where: { status: 'ACTIVE' } }),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
      }),
      // Phase 2
      prisma.registeredDevice.count({ where: { enabled: true } }),
      prisma.registeredDevice.findMany({
        where: { enabled: true },
        select: { id: true, status: true, enabled: true, lastSeenAt: true },
      }),
      prisma.whatsappSession.count(),
      prisma.whatsappSession.count({ where: { status: { not: 'DISABLED' } } }),
      prisma.whatsappSession.count({ where: { status: 'LINKED' } }),
      prisma.whatsappSession.count({ where: { status: 'SETUP_REQUIRED' } }),
      prisma.whatsappSession.count({ where: { status: 'ERROR' } }),
      // Additional counts
      prisma.platformAccount.count({ where: { archivedAt: null, accountStatus: 'LOGIN_ISSUE' } }),
      prisma.whatsappSession.count({ where: { status: 'DISABLED' } }),
      // REPAIR D-004 — completeness is derived, so it is computed from stored fields.
      countCompleteNumbers(),
      countIncompleteNumbers(),
      countEmptyNumbers(),
    ]);

    const onlineDevices = enabledDevices.filter(d => effectiveDeviceStatus(d) === 'ONLINE').length;
    const offlineDevices = enabledDevices.length - onlineDevices;

    return {
      totalNumbers: totalPhones,
      activeNumbers: activePhones,
      connectedAccounts: totalAccounts,
      completeNumbers,
      incompleteNumbers,
      emptyNumbers,
      loginIssueAccounts,
      accountsWithCredentials,
      totalUsers,
      totalDevices,
      onlineDevices,
      offlineDevices,
      whatsappTotal: totalWaSessions,
      whatsappActive: activeWaSessions,
      whatsappLinked: linkedSessions,
      whatsappSetupRequired: setupRequiredSessions,
      whatsappError: errorSessions,
      whatsappDisabled: disabledSessions,
      recentActivity: recentAuditLogs.map(log => ({
        id: log.id,
        actorUserId: log.actorUserId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        actor: log.actor,
      })),
    };
  }
}

export const dashboardService = new DashboardService();

