import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-6 py-12 ${className}`}>
      <div className="mb-4 text-gray-400">
        {icon || <Inbox className="h-12 w-12" />}
      </div>
      <h3 className="mb-1 text-sm font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mb-4 text-sm text-gray-500">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};
