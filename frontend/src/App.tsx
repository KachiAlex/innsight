import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useIsAuthenticated } from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DashboardSkeleton } from './components/LoadingSkeleton';

// Component to guard login route - redirects to dashboard if already authenticated
function LoginRouteGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
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
const GuestProfilePageModule = lazy(() => import('./pages/GuestProfilePage'));
const GuestProfilePage = () => <GuestProfilePageModule />;
const GuestsPage = () => {
  const module = require('./pages/GuestProfilePage');
  return <module.GuestsPage />;
};
const CalendarPage = lazy(() => import('./pages/CalendarPage'));

function App() {
  const PageLoader = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <DashboardSkeleton />
    </div>
  );

  // Debug logging
  console.log('App component rendering, current path:', window.location.pathname);

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
              element={
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <TenantsPage />
                  </Suspense>
                </ProtectedRoute>
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
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
