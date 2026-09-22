import React, { useState } from 'react';
import { Smartphone, RefreshCw, Unlink, Settings, ExternalLink, CheckCircle } from 'lucide-react';
import { WhatsAppSession, WhatsAppSessionStatus } from '@/types';
import { WhatsAppStatusBadge } from './WhatsAppStatusBadge';
import { SetupWhatsAppDialog } from './SetupWhatsAppDialog';
import { ChangeDeviceDialog } from './ChangeDeviceDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { whatsappApi } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';

interface WhatsAppSectionProps {
  phoneNumberId: string;
  session: WhatsAppSession | null;
}

export const WhatsAppSection: React.FC<WhatsAppSectionProps> = ({ phoneNumberId, session }) => {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showChangeDeviceDialog, setShowChangeDeviceDialog] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [openMessage, setOpenMessage] = useState('');

  const canEdit = hasRole(UserRole.ADMIN, UserRole.EDITOR);

  const setupMutation = useMutation({
    mutationFn: () => whatsappApi.setupSession(phoneNumberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-number', phoneNumberId] });
    },
  });

  const openMutation = useMutation({
    mutationFn: (phoneId: string) => whatsappApi.openSession(phoneId),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['phone-number', phoneNumberId],
      });
      setOpenMessage('Opening WhatsApp Web on the assigned device.');
    },

    onError: (error) => {
      console.error('Failed to open WhatsApp:', error);
      setOpenMessage('Could not request WhatsApp launch. Check the assigned device.');
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: (phoneId: string) => whatsappApi.reconnectSession(phoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-number', phoneNumberId] });
    },
  });

  const disableMutation = useMutation({
    mutationFn: (phoneId: string) => whatsappApi.disableSession(phoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-number', phoneNumberId] });
      setShowDisableConfirm(false);
    },
  });

  const confirmLinkMutation = useMutation({
    mutationFn: (success: boolean) =>
      whatsappApi.confirmLinkSession(phoneNumberId, {
        sessionCode: session!.sessionCode,
        success,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-number', phoneNumberId] });
    },
  });

  if (!session) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">WhatsApp</h3>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowSetupDialog(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Settings className="h-4 w-4" />
              Setup WhatsApp
            </button>
          )}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          No WhatsApp session configured for this number.
        </p>
        {showSetupDialog && (
          <SetupWhatsAppDialog
            phoneNumberId={phoneNumberId}
            onClose={() => setShowSetupDialog(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Smartphone className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-medium text-gray-900">WhatsApp</h3>
          <WhatsAppStatusBadge status={session.status} />
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {session.status === WhatsAppSessionStatus.LINKED && (
              <button
                onClick={() => openMutation.mutate(phoneNumberId)}
                disabled={openMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ExternalLink className="h-4 w-4" />
                Open on assigned PC
              </button>
            )}
            {session.status === WhatsAppSessionStatus.SETUP_REQUIRED && (
              <button
                onClick={() => setupMutation.mutate()}
                disabled={setupMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Settings className="h-4 w-4" />
                Setup
              </button>
            )}
            {session.status === WhatsAppSessionStatus.LINKING && (
              <button
                onClick={() => confirmLinkMutation.mutate(true)}
                disabled={confirmLinkMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                Confirm Link
              </button>
            )}
            {(session.status === WhatsAppSessionStatus.RELOGIN_REQUIRED ||
              session.status === WhatsAppSessionStatus.ERROR) && (
                <button
                  onClick={() => reconnectMutation.mutate(phoneNumberId)}
                  disabled={reconnectMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reconnect
                </button>
              )}
            <button
              onClick={() => setShowChangeDeviceDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Smartphone className="h-4 w-4" />
              Change Device
            </button>
            {session.status !== WhatsAppSessionStatus.DISABLED && (
              <button
                onClick={() => setShowDisableConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <Unlink className="h-4 w-4" />
                Disable
              </button>
            )}
          </div>
        )}
      </div>

      {openMessage && <p role="status" className="mt-3 text-sm text-gray-700">{openMessage}</p>}

      {/* Session Details */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium text-gray-500">Session Code</p>
          <p className="mt-1 text-sm font-mono text-gray-900">{session.sessionCode}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">Device</p>
          <p className="mt-1 text-sm text-gray-900">
            {session.device?.friendlyName || 'Unknown'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">Linked At</p>
          <p className="mt-1 text-sm text-gray-900">
            {session.linkedAt ? new Date(session.linkedAt).toLocaleString() : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">Last Opened</p>
          <p className="mt-1 text-sm text-gray-900">
            {session.lastOpenedAt ? new Date(session.lastOpenedAt).toLocaleString() : '—'}
          </p>
        </div>
      </div>

      {session.lastError && (
        <div className="mt-4 rounded-lg bg-red-50 p-3">
          <p className="text-xs font-medium text-red-800">Last Error</p>
          <p className="mt-1 text-sm text-red-700">{session.lastError}</p>
        </div>
      )}

      {/* Dialogs */}
      {showChangeDeviceDialog && (
        <ChangeDeviceDialog
          currentDeviceId={session.deviceId}
          phoneNumberId={phoneNumberId}
          version={session.version}
          onClose={() => setShowChangeDeviceDialog(false)}
        />
      )}

      <ConfirmDialog
        open={showDisableConfirm}
        title="Disable WhatsApp Session"
        message="This will disable the WhatsApp session. The phone number will no longer be able to send/receive WhatsApp messages until re-enabled."
        confirmLabel="Disable"
        variant="danger"
        loading={disableMutation.isPending}
        onConfirm={() => disableMutation.mutate(phoneNumberId)}
        onCancel={() => setShowDisableConfirm(false)}
      />
    </div>
  );
};
