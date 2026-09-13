import ToastContainer from '@/components/ToastContainer'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import SubmitComplaint from '@/pages/SubmitComplaint';
import ComplaintTracking from '@/pages/ComplaintTracking';
import ComplaintHistory from '@/pages/ComplaintHistory';
import Profile from '@/pages/Profile';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminComplaints from '@/pages/AdminComplaints';
import AdminAreas from '@/pages/AdminAreas';
import ComplaintMapPage from '@/pages/ComplaintMapPage';
import AdminOfficers from '@/pages/AdminOfficers';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import OfficerProtectedRoute from '@/components/OfficerProtectedRoute';
import OfficerLayout from '@/components/OfficerLayout';
import OfficerComplaints from '@/pages/OfficerComplaints';
import OfficerComplaintDetail from '@/pages/OfficerComplaintDetail';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const CitizenDashboardRoute = () => {
  const { user } = useAuth();
  if (user?.role === 'admin') {
    console.log('[AUTH] Target route: /admin/dashboard');
    console.log('[AUTH] Navigating to dashboard');
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Home />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authChecked, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or restoring auth session
  if (isLoadingPublicSettings || isLoadingAuth || !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Citizen Protected Routes */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<CitizenDashboardRoute />} />
          <Route path="/citizen/dashboard" element={<CitizenDashboardRoute />} />
          <Route path="/submit" element={<SubmitComplaint />} />
          <Route path="/track" element={<ComplaintTracking />} />
          <Route path="/history" element={<ComplaintHistory />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Strict Single-Admin Protected Routes */}
      <Route element={<AdminProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/complaints" element={<AdminComplaints />} />
          <Route path="/admin/areas" element={<AdminAreas />} />
          <Route path="/admin/officers" element={<AdminOfficers />} />
          <Route path="/admin/map" element={<ComplaintMapPage />} />
        </Route>
      </Route>
      <Route path="/officer-login" element={<Navigate to="/login?role=officer" replace />} />
      <Route element={<OfficerProtectedRoute />}>
        <Route element={<OfficerLayout />}>
          <Route path="/officer/dashboard" element={<Navigate to="/officer/complaints" replace />} />
          <Route path="/officer/complaints" element={<OfficerComplaints />} />
          <Route path="/officer/complaints/:id" element={<OfficerComplaintDetail />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <ToastContainer />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App