import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {
  Phone,
  Smartphone,
  Users,
  AlertTriangle,
  MessageCircle,
  Plus,
  Activity,
} from 'lucide-react';
import type { DashboardSummary } from '@/types';

const DashboardPage: React.FC = () => {
  const { data: summary, isLoading, error } = useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardApi.summary(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <p className="text-sm text-red-700">Failed to load dashboard data.</p>
      </div>
    );
  }

  if (!summary) return null;

  const cards = [
    {
      label: 'Total Numbers',
      value: summary.totalNumbers,
      icon: Phone,
      color: 'bg-blue-500',
      link: '/phone-numbers',
    },
    {
      label: 'Active Numbers',
      value: summary.activeNumbers,
      icon: Phone,
      color: 'bg-green-500',
      link: '/phone-numbers?status=ACTIVE',
    },
    {
      label: 'Connected Accounts',
      value: summary.connectedAccounts,
      icon: Users,
      color: 'bg-purple-500',
      link: '/phone-numbers',
    },
    {
      label: 'Incomplete Numbers',
      value: summary.incompleteNumbers,
      icon: AlertTriangle,
      color: 'bg-yellow-500',
      link: '/phone-numbers',
    },
    {
      label: 'Login Issues',
      value: summary.loginIssueAccounts,
      icon: AlertTriangle,
      color: 'bg-red-500',
      link: '/phone-numbers',
    },
    {
      label: 'WhatsApp Linked',
      value: summary.whatsappLinked,
      icon: MessageCircle,
      color: 'bg-green-600',
      link: '/phone-numbers?whatsappStatus=LINKED',
    },
    {
      label: 'WA Setup Required',
      value: summary.whatsappSetupRequired,
      icon: Smartphone,
      color: 'bg-yellow-600',
      link: '/phone-numbers?whatsappStatus=SETUP_REQUIRED',
    },
    {
      label: 'WA Errors',
      value: summary.whatsappError,
      icon: AlertTriangle,
      color: 'bg-red-600',
      link: '/phone-numbers?whatsappStatus=ERROR',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of your social media accounts and phone numbers
          </p>
        </div>
        <Link
          to="/phone-numbers/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Add Number
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={`rounded-xl ${card.color} p-3`}>
                <card.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>

        {summary.recentActivity.length === 0 ? (
          <p className="text-sm text-gray-500">No recent activity.</p>
        ) : (
          <div className="space-y-3">
            {summary.recentActivity.slice(0, 10).map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg border border-gray-100 p-3"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {log.action}
                  </p>
                  <p className="text-xs text-gray-500">
                    {log.entityType} • {log.actor?.fullName || 'System'} •{' '}
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
