import prisma from '@/lib/db/prisma';

/**
 * Dashboard service — summary metrics for the overview page.
 */
export class DashboardService {
  async getSummary() {
    const [
      totalPhones,
      activePhones,
      archivedPhones,
      totalAccounts,
      accountsWithCredentials,
      totalUsers,
      recentAuditLogs,
      // Phase 2 metrics
      totalDevices,
      onlineDevices,
      totalWaSessions,
      linkedSessions,
      setupRequiredSessions,
      errorSessions,
    ] = await Promise.all([
      prisma.phoneNumber.count(),
      prisma.phoneNumber.count({ where: { status: 'ACTIVE' } }),
      prisma.phoneNumber.count({ where: { status: 'ARCHIVED' } }),
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
      prisma.registeredDevice.count({ where: { enabled: true, status: 'ONLINE' } }),
      prisma.whatsappSession.count(),
      prisma.whatsappSession.count({ where: { status: 'LINKED' } }),
      prisma.whatsappSession.count({ where: { status: 'SETUP_REQUIRED' } }),
      prisma.whatsappSession.count({ where: { status: 'ERROR' } }),
    ]);

    // Platform breakdown
    const platformBreakdown = await prisma.platformAccount.groupBy({
      by: ['platformId'],
      _count: { id: true },
      where: { archivedAt: null },
    });

    const platforms = await prisma.platform.findMany({
      where: { isActive: true },
    });

    const platformMap = new Map(platforms.map(p => [p.id, p]));

    return {
      phones: {
        total: totalPhones,
        active: activePhones,
        archived: archivedPhones,
        inactive: totalPhones - activePhones - archivedPhones,
      },
      accounts: {
        total: totalAccounts,
        withCredentials: accountsWithCredentials,
        byPlatform: platformBreakdown.map(pb => ({
          platform: platformMap.get(pb.platformId)?.displayName ?? 'Unknown',
          slug: platformMap.get(pb.platformId)?.slug ?? 'unknown',
          count: pb._count.id,
        })),
      },
      users: {
        active: totalUsers,
      },
      devices: {
        total: totalDevices,
        online: onlineDevices,
      },
      whatsapp: {
        totalSessions: totalWaSessions,
        linked: linkedSessions,
        setupRequired: setupRequiredSessions,
        error: errorSessions,
      },
      recentActivity: recentAuditLogs.map(log => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actor: log.actor,
        createdAt: log.createdAt,
      })),
    };
  }
}

export const dashboardService = new DashboardService();
