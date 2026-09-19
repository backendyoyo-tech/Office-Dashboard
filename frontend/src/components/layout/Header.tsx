import React from 'react';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-900">Hair Rap Dashboard</h1>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5">
              <User className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{user.fullName}</span>
              <span className="rounded bg-primary-100 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                {user.role}
              </span>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
