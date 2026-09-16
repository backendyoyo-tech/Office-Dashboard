import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default' | 'gray';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  default: 'bg-gray-100 text-gray-800 border-gray-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, variant = 'default', className = '' }) => {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {label}
    </span>
  );
};

export const getAccountStatusVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'INACTIVE':
      return 'gray';
    case 'LOGIN_ISSUE':
      return 'warning';
    case 'SUSPENDED':
      return 'error';
    default:
      return 'default';
  }
};

export const getPhoneStatusVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'INACTIVE':
      return 'gray';
    case 'ARCHIVED':
      return 'default';
    default:
      return 'default';
  }
};

export const getDeviceStatusVariant = (status: string): BadgeVariant => {
  switch (status) {
    case 'ONLINE':
      return 'success';
    case 'OFFLINE':
      return 'gray';
    case 'UNKNOWN':
      return 'default';
    case 'DISABLED':
      return 'error';
    default:
      return 'default';
  }
};
