import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getOfficerSession } from '@/lib/officerSession';

export default function OfficerProtectedRoute() {
  const officer = getOfficerSession();
  if (!officer) return <Navigate to="/login?role=officer" replace />;
  return <Outlet />;
}