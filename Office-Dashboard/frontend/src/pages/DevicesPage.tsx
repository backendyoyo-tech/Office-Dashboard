import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '@/lib/api';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge, getDeviceStatusVariant } from '@/components/shared/StatusBadge';
import { SearchInput } from '@/components/shared/SearchInput';
import { Pagination } from '@/components/shared/Pagination';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import {Monitor, X, RefreshCw } from 'lucide-react';
import type { RegisteredDevice,} from '@/types';
import { UserRole } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

const DevicesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showPairingRequests, setShowPairingRequests] = useState(false);

  // Register form state

  const { data, isLoading } = useQuery({
    queryKey: ['devices', { search, page }],
    queryFn: () =>
      devicesApi.list({
        search: search || undefined,
        page,
        pageSize: 20,
      }),
  });

  const {
    data: pairingData,
    isLoading: pairingLoading,
    refetch: refetchPairingRequests,
  } = useQuery({
    queryKey: ['device-pairing-requests'],
    queryFn: async () => {
      const response = await devicesApi.pairingRequests();

      return {
        ...response,
        data: Array.isArray(response?.data)
          ? response.data.filter(
            (request: { status?: string }) => request.status === 'PENDING'
          )
          : [],
      };
    },
    enabled: showPairingRequests,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled, version }: { id: string; enabled: boolean; version: number }) =>
      devicesApi.toggleEnabled(id, enabled, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, version, approve }: { id: string; version: number; approve: boolean }) =>
      approve ? devicesApi.approveLauncher(id, version) : devicesApi.revokeLauncher(id, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  const approvePairingMutation = useMutation({
    mutationFn: (id: string) => devicesApi.approvePairing(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devices'] });
      await queryClient.invalidateQueries({ queryKey: ['device-pairing-requests'] });
    },
  });

  const rejectPairingMutation = useMutation({
    mutationFn: (id: string) => devicesApi.rejectPairing(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['device-pairing-requests'] });
    },
  });

  const columns: Column<RegisteredDevice>[] = [
    {
      key: 'deviceCode',
      header: 'Code',
      sortable: true,
      render: (item) => (
        <span className="font-mono text-sm">{item.deviceCode}</span>
      ),
    },
    {
      key: 'friendlyName',
      header: 'Name',
      sortable: true,
      render: (item) => item.friendlyName,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (item) => (
        <StatusBadge
          label={item.status}
          variant={getDeviceStatusVariant(item.status)}
        />
      ),
    },
    {
      key: 'hostname',
      header: 'Hostname',
      render: (item) => item.hostname || '—',
    },
    {
      key: 'lastSeenAt',
      header: 'Last Seen',
      sortable: true,
      render: (item) =>
        item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString() : '—',
    },
    {
      key: 'launcherVersion',
      header: 'Launcher Version',
      render: (item) => item.launcherVersion || '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('DEVICE TOGGLE:', {
                id: item.id,
                enabled: !item.enabled,
                version: item.version,
              });

              toggleMutation.mutate({
                id: item.id,
                enabled: !item.enabled,
                version: item.version,
              });
            }}
            className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium ${item.enabled
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {item.enabled ? 'Enabled' : 'Disabled'}
          </button>
          {hasRole(UserRole.ADMIN) && item.approvalState !== 'APPROVED' && item.approvalState !== 'REVOKED' && (
            <button className="rounded-md bg-blue-100 px-2.5 py-1.5 text-xs font-medium text-blue-700 disabled:opacity-50"
              disabled={approvalMutation.isPending}
              onClick={(e) => { e.stopPropagation(); approvalMutation.mutate({ id: item.id, version: item.version, approve: true }); }}>
              Approve launcher
            </button>
          )}
          {hasRole(UserRole.ADMIN) && item.approvalState === 'APPROVED' && (
            <button className="rounded-md bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
              disabled={approvalMutation.isPending}
              onClick={(e) => { e.stopPropagation(); approvalMutation.mutate({ id: item.id, version: item.version, approve: false }); }}>
              Revoke launcher
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage launcher devices for WhatsApp sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowPairingRequests(true);
              refetchPairingRequests();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Add This PC
          </button>

          {/* <button
            onClick={() => setShowRegisterDialog(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            
          </button> */}
        </div>
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        placeholder="Search devices..."
        className="w-64"
      />

      {/* Table */}
      {approvalMutation.isError && <p role="alert" className="text-sm text-red-700">Launcher approval change failed. Refresh and retry.</p>}
      <DataTable
        columns={columns}
        data={data?.data || []}
        loading={isLoading}
        emptyTitle="No devices found"
        emptyDescription="Register your first device to start managing WhatsApp sessions."
      />

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Register Dialog */}

      {/* Pending Device Pairing Dialog */}
      {showPairingRequests && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowPairingRequests(false)}
          />

          <div className="relative mx-4 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl animate-fade-in">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary-600" />
                  <h3 className="text-lg font-medium text-gray-900">
                    Pending PC Pairing
                  </h3>
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  Approve a Hair Rap Launcher running on a Windows PC.
                </p>
              </div>

              <button
                onClick={() => setShowPairingRequests(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              {pairingLoading ? (
                <div className="flex justify-center py-10">
                  <LoadingSpinner />
                </div>
              ) : !pairingData?.data?.length ? (
                <div className="rounded-lg border border-dashed border-gray-300 px-6 py-10 text-center">
                  <Monitor className="mx-auto h-8 w-8 text-gray-400" />

                  <p className="mt-3 text-sm font-medium text-gray-900">
                    No pending PCs
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Start the Hair Rap Launcher on a new PC to create a pairing request.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pairingData.data.map((request: any) => (
                    <div
                      key={request.id}
                      className="rounded-lg border border-gray-200 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">
                            {request.friendlyName || request.hostname || 'Unknown PC'}
                          </p>

                          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            <span className="text-gray-500">
                              Hostname:
                            </span>
                            <span className="text-gray-900">
                              {request.hostname || '—'}
                            </span>

                            <span className="text-gray-500">
                              Launcher:
                            </span>
                            <span className="text-gray-900">
                              {request.launcherVersion || '—'}
                            </span>

                            <span className="text-gray-500">
                              Pairing Code:
                            </span>
                            <span className="font-mono font-semibold text-gray-900">
                              {request.pairingCode}
                            </span>

                            <span className="text-gray-500">
                              Expires:
                            </span>
                            <span className="text-gray-900">
                              {request.expiresAt
                                ? new Date(request.expiresAt).toLocaleString()
                                : '—'}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <button
                            disabled={
                              approvePairingMutation.isPending ||
                              rejectPairingMutation.isPending
                            }
                            onClick={() =>
                              approvePairingMutation.mutate(request.id)
                            }
                            className="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Approve
                          </button>

                          <button
                            disabled={
                              approvePairingMutation.isPending ||
                              rejectPairingMutation.isPending
                            }
                            onClick={() =>
                              rejectPairingMutation.mutate(request.id)
                            }
                            className="rounded-md bg-red-100 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(approvePairingMutation.isError || rejectPairingMutation.isError) && (
              <p className="mt-4 text-sm text-red-700">
                Pairing action failed. Refresh and try again.
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowPairingRequests(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default DevicesPage;
