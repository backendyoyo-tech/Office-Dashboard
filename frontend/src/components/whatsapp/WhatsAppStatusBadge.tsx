import React from 'react';
import { WhatsAppSessionStatus } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';

interface WhatsAppStatusBadgeProps {
  status: WhatsAppSessionStatus;
  className?: string;
}

const statusConfig: Record<WhatsAppSessionStatus, { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'gray' }> = {
  [WhatsAppSessionStatus.LINKED]: { label: 'Linked', variant: 'success' },
  [WhatsAppSessionStatus.SETUP_REQUIRED]: { label: 'Setup Required', variant: 'warning' },
  [WhatsAppSessionStatus.LINKING]: { label: 'Linking...', variant: 'info' },
  [WhatsAppSessionStatus.RELOGIN_REQUIRED]: { label: 'Re-login Required', variant: 'warning' },
  [WhatsAppSessionStatus.ERROR]: { label: 'Error', variant: 'error' },
  [WhatsAppSessionStatus.DISABLED]: { label: 'Disabled', variant: 'gray' },
  [WhatsAppSessionStatus.UNKNOWN]: { label: 'Unknown', variant: 'gray' },
};

export const WhatsAppStatusBadge: React.FC<WhatsAppStatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusConfig[status] || statusConfig[WhatsAppSessionStatus.UNKNOWN];
  return <StatusBadge label={config.label} variant={config.variant} className={className} />;
};
