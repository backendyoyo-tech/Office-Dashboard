import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const confirmButtonClass = {
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    default: 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500',
  }[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl animate-fade-in">
        <div className="flex items-start gap-4">
          {variant !== 'default' && (
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              variant === 'danger' ? 'bg-red-100' : 'bg-yellow-100'
            }`}>
              <AlertTriangle className={`h-5 w-5 ${
                variant === 'danger' ? 'text-red-600' : 'text-yellow-600'
              }`} />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${confirmButtonClass}`}
          >
            {loading && <LoadingSpinner size="sm" className="mr-2" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
