import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { phoneNumbersApi } from '@/lib/api';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge, getPhoneStatusVariant } from '@/components/shared/StatusBadge';
import { WhatsAppStatusBadge } from '@/components/whatsapp/WhatsAppStatusBadge';
import { SearchInput } from '@/components/shared/SearchInput';
import { Pagination } from '@/components/shared/Pagination';
import { Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, PhoneStatus, WhatsAppSessionStatus } from '@/types';
import type { PhoneNumber } from '@/types';

const PhoneNumbersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const canEdit = hasRole(UserRole.ADMIN, UserRole.EDITOR);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [whatsappStatus, setWhatsappStatus] = useState(searchParams.get('whatsappStatus') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
  );

  const { data, isLoading } = useQuery({
    queryKey: ['phone-numbers', { search, status, whatsappStatus, page, sortBy, sortOrder }],
    queryFn: () =>
      phoneNumbersApi.list({
        search: search || undefined,
        status: (status as PhoneStatus) || undefined,
        whatsappStatus: (whatsappStatus as WhatsAppSessionStatus) || undefined,
        page,
        pageSize: 20,
        sortBy,
        sortOrder,
      }),
  });

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const columns: Column<PhoneNumber>[] = [
    {
      key: 'e164Number',
      header: 'Number',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm">{item.e164Number}</span>
      ),
    },
    {
      key: 'label',
      header: 'Label',
      sortable: true,
      render: (item) => item.label || '—',
    },
    {
      key: 'simProvider',
      header: 'Provider',
      sortable: true,
      render: (item) => item.simProvider || '—',
    },
    {
      key: 'accounts',
      header: 'Linked Platforms',
      render: (item) => {
        const links = item.accountLinks || [];
        if (links.length === 0) return <span className="text-gray-400">None</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {links.slice(0, 3).map((link) => (
              <span
                key={link.id}
                className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700"
              >
                {link.platformAccount?.platform?.displayName || 'Unknown'}
              </span>
            ))}
            {links.length > 3 && (
              <span className="text-xs text-gray-500">+{links.length - 3}</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item) => (
        <StatusBadge
          label={item.status}
          variant={getPhoneStatusVariant(item.status)}
        />
      ),
    },
    {
      key: 'whatsapp',
      header: 'WhatsApp',
      render: (item) =>
        item.whatsappSession ? (
          <WhatsAppStatusBadge status={item.whatsappSession.status} />
        ) : (
          <span className="text-xs text-gray-400">Not setup</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phone Numbers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your phone numbers and connected accounts
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => navigate('/phone-numbers/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Add Number
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search numbers, labels..."
          className="w-64"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          value={whatsappStatus}
          onChange={(e) => {
            setWhatsappStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All WhatsApp</option>
          <option value="LINKED">Linked</option>
          <option value="SETUP_REQUIRED">Setup Required</option>
          <option value="LINKING">Linking</option>
          <option value="ERROR">Error</option>
          <option value="DISABLED">Disabled</option>
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        emptyTitle="No phone numbers found"
        emptyDescription="Add your first phone number to get started."
        emptyAction={
          canEdit ? (
            <button
              onClick={() => navigate('/phone-numbers/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              Add Number
            </button>
          ) : undefined
        }
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onRowClick={(item) => navigate(`/phone-numbers/${item.id}`)}
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

export default PhoneNumbersPage;
