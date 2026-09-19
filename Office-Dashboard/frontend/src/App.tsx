import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { FullPageSpinner } from '@/components/shared/LoadingSpinner';

// Lazy load pages
const LoginPage = React.lazy(() => import('@/pages/LoginPage'));
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage'));
const PhoneNumbersPage = React.lazy(() => import('@/pages/PhoneNumbersPage'));
const AddEditNumberPage = React.lazy(() => import('@/pages/AddEditNumberPage'));
const NumberDetailPage = React.lazy(() => import('@/pages/NumberDetailPage'));
const DevicesPage = React.lazy(() => import('@/pages/DevicesPage'));
const UsersPage = React.lazy(() => import('@/pages/UsersPage'));
const AuditLogsPage = React.lazy(() => import('@/pages/AuditLogsPage'));
const AccountDetailPage = React.lazy(() => import('@/pages/AccountDetailPage'));
const LinkAccountPage = React.lazy(() => import('@/pages/LinkAccountPage'));
const AddAccountPage = React.lazy(() => import('@/pages/AddAccountPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

// Auth guard component
const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({
  children,
  roles,
}) => {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !hasRole(...(roles as any[]))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Public route (redirect if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/phone-numbers" element={<PhoneNumbersPage />} />
          <Route
            path="/phone-numbers/new"
            element={
              <ProtectedRoute roles={['ADMIN', 'EDITOR']}>
                <AddEditNumberPage />
              </ProtectedRoute>
            }
          />
          <Route path="/phone-numbers/:id" element={<NumberDetailPage />} />
          <Route path="/accounts/:id" element={<AccountDetailPage />} />
          <Route
            path="/phone-numbers/:id/link-account"
            element={
              <ProtectedRoute roles={['ADMIN', 'EDITOR']}>
                <LinkAccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/phone-numbers/:id/add-account"
            element={
              <ProtectedRoute roles={['ADMIN', 'EDITOR']}>
                <AddAccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/devices"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <DevicesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute roles={['ADMIN', 'EDITOR']}>
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
