import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformAccountsApi } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatusBadge, getAccountStatusVariant } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import {
  ArrowLeft,
  Edit,
  Archive,
  Eye,
  EyeOff,
  Shield,
  ExternalLink,
} from 'lucide-react';

const AccountDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canEdit = hasRole(UserRole.ADMIN, UserRole.EDITOR);

  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);

  const { data: account, isLoading, error } = useQuery({
    queryKey: ['platform-account', id],
    queryFn: () => platformAccountsApi.getById(id!),
    enabled: !!id,
  });

  const archiveMutation = useMutation({
    mutationFn: () => platformAccountsApi.archive(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-account', id] });
      setShowArchiveConfirm(false);
    },
  });

  const handleReveal = async () => {
    if (revealedPassword) {
      setRevealedPassword(null);
      return;
    }
    setRevealLoading(true);
    try {
      const result = await platformAccountsApi.revealCredential(id!);
      setRevealedPassword(result.password);
      // Auto-clear after 30 seconds
      setTimeout(() => setRevealedPassword(null), 30000);
    } catch {
      // Error handled by API interceptor
    } finally {
      setRevealLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <p className="text-sm text-red-700">Failed to load account details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <span className="text-lg font-bold text-gray-600">
                  {account.platform?.displayName?.charAt(0) || '?'}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {account.displayName || account.accountHandle || 'Unknown Account'}
                </h1>
                <p className="text-sm text-gray-500">
                  {account.platform?.displayName}
                </p>
              </div>
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Link
              to={`/accounts/${id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Link>
            {account.accountStatus !== 'UNKNOWN' && (
              <button
                onClick={() => setShowArchiveConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <Archive className="h-4 w-4" />
                Archive
              </button>
            )}
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Identity */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Identity</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs font-medium text-gray-500">Display Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{account.displayName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Handle</dt>
              <dd className="mt-1 text-sm text-gray-900">{account.accountHandle || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Login Identifier</dt>
              <dd className="mt-1 text-sm font-mono text-gray-900">{account.loginIdentifier || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">External Account ID</dt>
              <dd className="mt-1 text-sm font-mono text-gray-900">{account.externalAccountId || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Profile URL</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {account.profileUrl ? (
                  <a
                    href={account.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary-600 hover:underline"
                  >
                    {account.profileUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <StatusBadge
                  label={account.accountStatus}
                  variant={getAccountStatusVariant(account.accountStatus)}
                />
              </dd>
            </div>
          </dl>
        </div>

        {/* Credentials */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Credentials</h2>
          {account.credential?.hasCredential ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">Password stored</span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={handleReveal}
                      disabled={revealLoading}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {revealLoading ? (
                        <LoadingSpinner size="sm" />
                      ) : revealedPassword ? (
                        <>
                          <EyeOff className="h-3 w-3" />
                          Hide
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          Reveal
                        </>
                      )}
                    </button>
                  )}
                </div>
                {revealedPassword && (
                  <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 p-3">
                    <p className="mb-1 text-xs font-medium text-yellow-800">Password</p>
                    <p className="break-all font-mono text-sm text-yellow-900">{revealedPassword}</p>
                    <p className="mt-2 text-xs text-yellow-700">
                      ⚠️ This password will auto-clear in 30 seconds. Do not share or store it.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">
                  Last updated: {new Date(account.credential.secretUpdatedAt).toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-500">No credentials stored</p>
            </div>
          )}
        </div>
      </div>

      {/* Recovery Methods */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Recovery Methods ({account.recoveryMethods?.length || 0})
        </h2>
        {account.recoveryMethods && account.recoveryMethods.length > 0 ? (
          <div className="space-y-2">
            {account.recoveryMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                      method.methodType === 'EMAIL'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {method.methodType}
                  </span>
                  <span className="text-sm text-gray-900">{method.valueNormalized}</span>
                  {method.isPrimary && (
                    <span className="text-xs text-gray-500">(Primary)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No recovery methods configured.</p>
        )}
      </div>

      {/* Notes */}
      {account.notes && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{account.notes}</p>
        </div>
      )}

      {/* Archive Confirmation */}
      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive Account"
        message={`Are you sure you want to archive this ${account.platform?.displayName} account? This action can be undone later.`}
        confirmLabel="Archive"
        variant="warning"
        loading={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
        onCancel={() => setShowArchiveConfirm(false)}
      />
    </div>
  );
};

export default AccountDetailPage;
