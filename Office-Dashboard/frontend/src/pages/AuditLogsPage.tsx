import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogsApi } from '@/lib/api';
import { DataTable, Column } from '@/components/shared/DataTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { Pagination } from '@/components/shared/Pagination';
import { ScrollText } from 'lucide-react';
import type { AuditLog } from '@/types';

const AuditLogsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', { search, action, entityType, page, sortBy, sortOrder }],
    queryFn: () =>
      auditLogsApi.list({
        search: search || undefined,
        action: action || undefined,
        entityType: entityType || undefined,
        page,
        pageSize: 50,
        sortBy,
        sortOrder,
      }),
  });

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const columns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      header: 'Time',
      sortable: true,
      width: '180px',
      render: (item) => (
        <span className="text-xs text-gray-500">
          {new Date(item.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (item) => (
        <span className="text-sm">
          {item.actor?.fullName || 'System'}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (item) => (
        <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
          {item.action}
        </span>
      ),
    },
    {
      key: 'entityType',
      header: 'Entity Type',
      sortable: true,
      render: (item) => (
        <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          {item.entityType}
        </span>
      ),
    },
    {
      key: 'entityId',
      header: 'Entity ID',
      render: (item) =>
        item.entityId ? (
          <span className="font-mono text-xs text-gray-500">
            {item.entityId.slice(0, 8)}...
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'ipAddress',
      header: 'IP',
      render: (item) => (
        <span className="font-mono text-xs text-gray-500">
          {item.ipAddress || '—'}
        </span>
      ),
    },
  ];

  const actionTypes = [
    'CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'RESTORE',
    'LOGIN', 'LOGOUT', 'LINK', 'UNLINK', 'REVEAL_CREDENTIAL',
    'SETUP_WHATSAPP', 'OPEN_WHATSAPP', 'RECONNECT_WHATSAPP',
    'DISABLE_WHATSAPP', 'CHANGE_DEVICE',
  ];

  const entityTypes = [
    'PhoneNumber', 'PlatformAccount', 'AppUser', 'RegisteredDevice',
    'WhatsappSession', 'PhoneAccountLink', 'AccountCredential',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search and review all system activity
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search audit logs..."
          className="w-64"
        />
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Actions</option>
          {actionTypes.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Entities</option>
          {entityTypes.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        emptyTitle="No audit logs found"
        emptyDescription="Activity will appear here as actions are performed."
        emptyAction={
          <ScrollText className="h-12 w-12 text-gray-300" />
        }
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
      />

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};

export default AuditLogsPage;
