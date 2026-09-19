import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phoneNumbersApi, platformAccountsApi } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatusBadge, getAccountStatusVariant } from '@/components/shared/StatusBadge';
import { DataTable, Column } from '@/components/shared/DataTable';
import { SearchInput } from '@/components/shared/SearchInput';
import { Pagination } from '@/components/shared/Pagination';
import { ArrowLeft, Link as LinkIcon } from 'lucide-react';
import type { PlatformAccount, PhoneAccountLink, RelationshipType } from '@/types';

const LinkAccountPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Fetch phone number for header context
  const { data: phone } = useQuery({
    queryKey: ['phone-number', id],
    queryFn: () => phoneNumbersApi.getById(id!),
    enabled: !!id,
  });

  // Fetch already linked account IDs to exclude them
  const { data: linkedAccounts } = useQuery({
    queryKey: ['phone-number-accounts', id],
    queryFn: () => phoneNumbersApi.getAccounts(id!),
    enabled: !!id,
  });

  const linkedAccountIds = new Set((linkedAccounts || []).map((l: PhoneAccountLink) => l.platformAccountId));

  // Fetch unlinked accounts (platform accounts not already linked to this phone)
  const { data, isLoading } = useQuery({
    queryKey: ['unlinked-accounts', { search, page, phoneId: id }],
    queryFn: () =>
      platformAccountsApi.list({
        search: search || undefined,
        page,
        pageSize: 20,
        // Note: Backend should filter out already-linked accounts
        // For now we filter client-side
      }),
    enabled: !!id,
  });

  const linkMutation = useMutation({
    mutationFn: (accountId: string) =>
      phoneNumbersApi.linkAccount(id!, { platformAccountId: accountId, relationshipType: 'GENERAL' as RelationshipType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-number-accounts', id] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-accounts', { phoneId: id }] });
      queryClient.invalidateQueries({ queryKey: ['phone-number', id] });
    },
    onError: (err: any) => {
      console.error('Link failed:', err);
    },
  });

  const filteredData = (data?.data || []).filter((account: PlatformAccount) => !linkedAccountIds.has(account.id));

  const columns: Column<PlatformAccount>[] = [
    {
      key: 'platform',
      header: 'Platform',
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
            <span className="text-sm font-bold text-gray-600">
              {item.platform?.displayName?.charAt(0) || '?'}
            </span>
          </div>
          <span>{item.platform?.displayName || 'Unknown'}</span>
        </div>
      ),
    },
    {
      key: 'displayName',
      header: 'Account Name',
      render: (item) => item.displayName || item.accountHandle || '—',
    },
    {
      key: 'loginIdentifier',
      header: 'Login ID',
      render: (item) => item.loginIdentifier || '—',
    },
    {
      key: 'accountStatus',
      header: 'Status',
      render: (item) => (
        <StatusBadge label={item.accountStatus} variant={getAccountStatusVariant(item.accountStatus)} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            linkMutation.mutate(item.id);
          }}
          disabled={linkMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {linkMutation.isPending && <LoadingSpinner size="sm" className="mr-1" />}
          <LinkIcon className="h-3.5 w-3.5" />
          Link
        </button>
      ),
    },
  ];

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/phone-numbers/${id}`)}
          className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Link Account</h1>
          <p className="mt-1 text-sm text-gray-500">
            {phone?.e164Number || 'Loading...'} • Select an account to link
          </p>
        </div>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Search accounts..."
        className="w-80"
      />

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredData}
        loading={isLoading}
        emptyTitle="No unlinked accounts found"
        emptyDescription="All available accounts are already linked, or no accounts exist yet."
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

export default LinkAccountPage;