import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { getConfiguredAdminEmail } from '@/api/supabaseClient';

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

  console.log('[AUTH] Auth loading:', isLoadingAuth || !authChecked);

  if (isLoadingAuth || !authChecked) {
    return <AdminLoadingFallback />;
  }

  if (!isAuthenticated || !user) {
    console.log('[AUTH] User email:', null);
    console.log('[AUTH] Admin email:', getConfiguredAdminEmail());
    console.log('[AUTH] Admin check:', false);
    console.log('[AUTH] Selected role:', null);
    console.log('[AUTH] Target route: /login?role=admin');
    return <Navigate to="/login?role=admin" replace />;
  }

  console.log('[AUTH] User email:', user.email);
  console.log('[AUTH] Admin email:', getConfiguredAdminEmail());
  console.log('[AUTH] Admin check:', user.role === 'admin');
  console.log('[AUTH] Selected role:', user.role);

  if (user?.role !== 'admin') {
    console.log('[AUTH] Target route: /login?role=admin&error=unauthorized');
    return <Navigate to="/login?role=admin&error=unauthorized" replace />;
  }

  console.log('[AUTH] Target route: /admin/dashboard');
  console.log('[AUTH] Navigating to dashboard');

  return <Outlet />;
}
