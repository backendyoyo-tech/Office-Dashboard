import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { phoneNumbersApi, platformAccountsApi } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatusBadge, getPhoneStatusVariant, getAccountStatusVariant } from '@/components/shared/StatusBadge';
import { WhatsAppSection } from '@/components/whatsapp/WhatsAppSection';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import {
  ArrowLeft,
  Edit,
  Archive,
  Plus,
  Link as LinkIcon,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';

const NumberDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canEdit = hasRole(UserRole.ADMIN, UserRole.EDITOR);

  const [showArchiveConfirm, setShowArchiveConfirm] = React.useState(false);
  const [revealedCredentialId, setRevealedCredentialId] = React.useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = React.useState<string | null>(null);

  const { data: phone, isLoading, error } = useQuery({
    queryKey: ['phone-number', id],
    queryFn: () => phoneNumbersApi.getById(id!),
    enabled: !!id,
  });

  const archiveMutation = useMutation({
    mutationFn: () => phoneNumbersApi.archive(id!, phone!.version),
    onSuccess: () => {
      navigate('/phone-numbers');
    },
  });

  const revealMutation = useMutation({
    mutationFn: (accountId: string) => platformAccountsApi.revealCredential(accountId),
    onSuccess: (data) => {
      setRevealedPassword(data.password);
      // Auto-clear after 30 seconds
      setTimeout(() => {
        setRevealedPassword(null);
        setRevealedCredentialId(null);
      }, 30000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !phone) {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <p className="text-sm text-red-700">Failed to load phone number.</p>
      </div>
    );
  }

  const accounts = phone.accountLinks || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/phone-numbers')}
            className="rounded-lg border border-gray-300 p-2 text-gray-500 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 font-mono">
                {phone.e164Number}
              </h1>
              <StatusBadge
                label={phone.status}
                variant={getPhoneStatusVariant(phone.status)}
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {phone.label || 'No label'} • {phone.simProvider || 'No provider'}
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Link
              to={`/phone-numbers/${id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Link>
            {phone.status !== 'ARCHIVED' && (
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

      {/* WhatsApp Section */}
      <WhatsAppSection
        phoneNumberId={phone.id}
        session={phone.whatsappSession || null}
      />

      {/* Connected Accounts */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Connected Accounts ({accounts.length})
          </h2>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Link
                to={`/phone-numbers/${id}/link-account`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <LinkIcon className="h-4 w-4" />
                Link Existing
              </Link>
              <Link
                to={`/phone-numbers/${id}/add-account`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                Add Account
              </Link>
            </div>
          )}
        </div>

        {accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">No accounts connected to this number.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((link) => {
              const account = link.platformAccount;
              if (!account) return null;

              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                      <span className="text-sm font-bold text-gray-600">
                        {account.platform?.displayName?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {account.displayName || account.accountHandle || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {account.platform?.displayName} • {account.loginIdentifier || 'No login ID'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge
                      label={account.accountStatus}
                      variant={getAccountStatusVariant(account.accountStatus)}
                    />

                    {account.credential?.hasCredential && (
                      <div className="relative">
                        <button
                          onClick={() => {
                            if (revealedCredentialId === account.id) {
                              setRevealedCredentialId(null);
                              setRevealedPassword(null);
                            } else {
                              setRevealedCredentialId(account.id);
                              revealMutation.mutate(account.id);
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          {revealedCredentialId === account.id ? (
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
                        {revealedCredentialId === account.id && revealedPassword && (
                          <div className="absolute right-0 top-8 z-10 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                            <p className="mb-1 text-xs font-medium text-gray-500">Password</p>
                            <p className="font-mono text-sm text-gray-900">{revealedPassword}</p>
                            <p className="mt-1 text-xs text-gray-400">Clears in 30s</p>
                          </div>
                        )}
                      </div>
                    )}

                    <Link
                      to={`/accounts/${account.id}`}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notes */}
      {phone.notes && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{phone.notes}</p>
        </div>
      )}

      {/* Archive Confirmation */}
      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive Phone Number"
        message={`Are you sure you want to archive ${phone.e164Number}? This action can be undone later.`}
        confirmLabel="Archive"
        variant="warning"
        loading={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
        onCancel={() => setShowArchiveConfirm(false)}
      />
    </div>
  );
};

export default NumberDetailPage;
