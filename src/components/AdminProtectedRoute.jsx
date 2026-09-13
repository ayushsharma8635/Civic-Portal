import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const AdminLoadingFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
  </div>
);

/**
 * Route protection strictly for the single authorized system administrator.
 * Redirects unauthorized users or non-admin citizens to login with a warning.
 */
export default function AdminProtectedRoute() {
  const { user, isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return <AdminLoadingFallback />;
  }

  if (!isAuthenticated || !user) {
    console.log('[Civic Route Guard] Admin access denied: unauthenticated, redirecting to login');
    return <Navigate to="/login?role=admin" replace />;
  }

  if (user?.role !== 'admin') {
    console.log('[Civic Route Guard] Admin access denied: user is not admin, role =', user?.role);
    return <Navigate to="/login?role=admin&error=unauthorized" replace />;
  }

  return <Outlet />;
}
