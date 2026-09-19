import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from '@/lib/api';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge, getDeviceStatusVariant } from '@/components/shared/StatusBadge';
import { SearchInput } from '@/components/shared/SearchInput';
import { Pagination } from '@/components/shared/Pagination';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Plus, Copy, Check } from 'lucide-react';
import type { RegisteredDevice, RegisterDeviceResponse } from '@/types';

const DevicesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [registeredDevice, setRegisteredDevice] = useState<RegisterDeviceResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Register form state
  const [friendlyName, setFriendlyName] = useState('');
  const [hostname, setHostname] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['devices', { search, page }],
    queryFn: () =>
      devicesApi.list({
        search: search || undefined,
        page,
        pageSize: 20,
      }),
  });

  const registerMutation = useMutation({
    mutationFn: () =>
      devicesApi.register({
        friendlyName,
        hostname: hostname || undefined,
      }),
    onSuccess: (device) => {
      setRegisteredDevice(device);
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled, version }: { id: string; enabled: boolean; version: number }) =>
      devicesApi.toggleEnabled(id, enabled, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  const handleCopyApiKey = () => {
    if (registeredDevice?.apiKey) {
      navigator.clipboard.writeText(registeredDevice.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseRegister = () => {
    setShowRegisterDialog(false);
    setRegisteredDevice(null);
    setFriendlyName('');
    setHostname('');
    setCopied(false);
  };

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
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMutation.mutate({
              id: item.id,
              enabled: !item.enabled,
              version: item.version,
            });
          }}
          className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium ${
            item.enabled
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {item.enabled ? 'Enabled' : 'Disabled'}
        </button>
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
        <button
          onClick={() => setShowRegisterDialog(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Register Device
        </button>
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
      {showRegisterDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={handleCloseRegister} />
          <div className="relative mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl animate-fade-in">
            {!registeredDevice ? (
              <>
                <h3 className="text-lg font-medium text-gray-900">Register New Device</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Register a new launcher device for WhatsApp session management.
                </p>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Friendly Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={friendlyName}
                      onChange={(e) => setFriendlyName(e.target.value)}
                      placeholder="e.g., Office PC 1"
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Hostname
                    </label>
                    <input
                      type="text"
                      value={hostname}
                      onChange={(e) => setHostname(e.target.value)}
                      placeholder="e.g., DESKTOP-ABC123"
                      className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {registerMutation.isError && (
                  <div className="mt-4 rounded-lg bg-red-50 p-3">
                    <p className="text-sm text-red-700">Failed to register device.</p>
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={handleCloseRegister}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => registerMutation.mutate()}
                    disabled={!friendlyName.trim() || registerMutation.isPending}
                    className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {registerMutation.isPending && <LoadingSpinner size="sm" className="mr-2" />}
                    Register
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">Device Registered</h3>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-500">Device Code</p>
                    <p className="mt-1 font-mono text-sm text-gray-900">
                      {registeredDevice.deviceCode}
                    </p>
                  </div>
                  <div className="rounded-lg bg-yellow-50 p-3">
                    <p className="text-xs font-medium text-yellow-800">API Key</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="flex-1 break-all font-mono text-sm text-yellow-900">
                        {registeredDevice.apiKey}
                      </p>
                      <button
                        onClick={handleCopyApiKey}
                        className="rounded p-1 text-yellow-700 hover:bg-yellow-100"
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-yellow-700">
                      ⚠️ Copy this API key now. It will not be shown again.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleCloseRegister}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DevicesPage;
