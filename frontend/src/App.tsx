import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useIsAuthenticated, useAuthStore } from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardSkeleton } from './components/LoadingSkeleton';

// Component to guard login route - redirects to dashboard if already authenticated
function LoginRouteGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const { user } = useAuthStore();
  
  if (isAuthenticated) {
    // IITECH admins go to tenants page, others go to dashboard
    if (user?.role === 'iitech_admin') {
      return <Navigate to="/tenants" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Component to guard tenant login - redirects to tenants page if already authenticated as IITECH admin
function TenantLoginRouteGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const { user } = useAuthStore();
  
  if (isAuthenticated && user?.role === 'iitech_admin') {
    return <Navigate to="/tenants" replace />;
  }
  
  return <>{children}</>;
}

// Component to handle /tenant route - redirects to login or tenants based on auth
function TenantRouteHandler() {
  const isAuthenticated = useIsAuthenticated();
  const { user } = useAuthStore();
  
  if (isAuthenticated && user?.role === 'iitech_admin') {
    return <Navigate to="/tenants" replace />;
  }
  
  return <Navigate to="/tenant/login" replace />;
}

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const TenantLoginPage = lazy(() => import('./pages/TenantLoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'));
const RoomsPage = lazy(() => import('./pages/RoomsPage'));
const FoliosPage = lazy(() => import('./pages/FoliosPage'));
const HousekeepingPage = lazy(() => import('./pages/HousekeepingPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const TenantsPage = lazy(() => import('./pages/TenantsPage'));
const RatePlansPage = lazy(() => import('./pages/RatePlansPage'));
const GuestProfilePage = lazy(() => import('./pages/GuestProfilePageEnhanced'));
const GuestsPage = lazy(() => import('./pages/GuestsPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const NightAuditPage = lazy(() => import('./pages/NightAuditPage'));
const GroupBookingsEnhancedPage = lazy(() => import('./pages/GroupBookingsEnhancedPage'));
const DepositManagementPage = lazy(() => import('./pages/DepositManagementPage'));
const GuestRequestsPage = lazy(() => import('./pages/GuestRequestsPage'));
const RoomServicePage = lazy(() => import('./pages/RoomServicePage'));
const LostFoundPage = lazy(() => import('./pages/LostFoundPage'));
const AnalyticsDashboardPage = lazy(() => import('./pages/AnalyticsDashboardPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const WagePlansPage = lazy(() => import('./pages/WagePlansPage'));

function App() {
  const PageLoader = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <DashboardSkeleton />
    </div>
  );

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route
              path="/"
              element={
                <Suspense fallback={<PageLoader />}>
                  <HomePage />
                </Suspense>
              }
            />
            <Route
              path="/login"
              element={
                <LoginRouteGuard>
                  <Suspense fallback={<PageLoader />}>
                    <LoginPage />
                  </Suspense>
                </LoginRouteGuard>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <DashboardPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reservations"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <ReservationsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/group-bookings"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <GroupBookingsEnhancedPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/deposit-management"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <DepositManagementPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rooms"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <RoomsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/folios"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <FoliosPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <PaymentsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/housekeeping"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <HousekeepingPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/room-service"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <RoomServicePage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/maintenance"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <MaintenancePage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <ReportsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <AnalyticsDashboardPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <AlertsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tenants"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <TenantsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tenant"
              element={<TenantRouteHandler />}
            />
            <Route
              path="/tenant/login"
              element={
                <TenantLoginRouteGuard>
                  <Suspense fallback={<PageLoader />}>
                    <TenantLoginPage />
                  </Suspense>
                </TenantLoginRouteGuard>
              }
            />
            <Route
              path="/rate-plans"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <RatePlansPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/guests"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <GuestsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/guest-requests"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <GuestRequestsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/lost-found"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <LostFoundPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/guests/:identifier"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <GuestProfilePage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <CalendarPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/night-audit"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <NightAuditPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <StaffPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <SettingsPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/wage-plans"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <WagePlansPage />
                  </Suspense>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
