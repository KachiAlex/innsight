import { useEffect } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';

export default function SuperadminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    console.log('[SuperadminDashboard] Page mounted');
    console.log('[SuperadminDashboard] isAuthenticated:', isAuthenticated);
    console.log('[SuperadminDashboard] user:', user);
    console.log('[SuperadminDashboard] user role:', user?.role);

    if (!isAuthenticated) {
      console.log('[SuperadminDashboard] Not authenticated, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    if (user?.role !== 'iitech_admin') {
      console.log('[SuperadminDashboard] Not iitech_admin, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }

    console.log('[SuperadminDashboard] Auth check passed, rendering dashboard');
  }, [user, isAuthenticated, navigate]);

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Superadmin Dashboard</h1>
        <div className="bg-white border rounded-lg p-6">
          <p className="text-lg text-gray-700">Welcome, Superadmin!</p>
          <p className="text-gray-600 mt-2">This is a minimal test version to verify routing works.</p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              <strong>User:</strong> {user?.email || 'N/A'}<br/>
              <strong>Role:</strong> {user?.role || 'N/A'}<br/>
              <strong>Tenant ID:</strong> {user?.tenantId || 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
