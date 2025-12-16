import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard,
  Calendar,
  DoorOpen,
  Receipt,
  CreditCard,
  Sparkles,
  Wrench,
  AlertCircle,
  LogOut,
  Menu,
  X,
  DollarSign,
  Users,
  CalendarDays,
  Moon,
  Settings,
  UserCheck,
  Wallet,
  UserCog,
  MessageSquare,
  ChefHat,
  Package,
  BarChart3
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/reservations', icon: Calendar, label: 'Reservations' },
  { path: '/group-bookings', icon: Users, label: 'Group Bookings' },
  { path: '/deposit-management', icon: DollarSign, label: 'Deposit Management' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { path: '/rooms', icon: DoorOpen, label: 'Rooms' },
  { path: '/rate-plans', icon: DollarSign, label: 'Rate Plans' },
  { path: '/guests', icon: UserCheck, label: 'Guests' },
  { path: '/guest-requests', icon: MessageSquare, label: 'Guest Requests' },
  { path: '/lost-found', icon: Package, label: 'Lost & Found' },
  { path: '/folios', icon: Receipt, label: 'Folios' },
  { path: '/payments', icon: CreditCard, label: 'Payments' },
  { path: '/housekeeping', icon: Sparkles, label: 'Housekeeping' },
  { path: '/room-service', icon: ChefHat, label: 'Room Service' },
  { path: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { path: '/reports', icon: BarChart3, label: 'Reports' },
  { path: '/analytics', icon: BarChart3, label: 'Analytics Dashboard' },
  { path: '/night-audit', icon: Moon, label: 'Night Audit' },
  { path: '/staff', icon: UserCog, label: 'Staff' },
  { path: '/wage-plans', icon: Wallet, label: 'Wage Plans' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/alerts', icon: AlertCircle, label: 'Alerts' },
];


export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Don't show tenant sidebar for IITECH admin
  const isIITechAdmin = user?.role === 'iitech_admin';
  const showTenantSidebar = !isIITechAdmin;

  // Debug: Log menu items and user info
  useEffect(() => {
    console.log('Layout mounted - Menu items:', menuItems.map(item => item.label));
    console.log('Layout - User role:', user?.role);
    console.log('Layout - Show tenant sidebar:', showTenantSidebar);
    console.log('Layout - Staff menu item:', menuItems.find(item => item.path === '/staff'));
    console.log('Layout - Wage Plans menu item:', menuItems.find(item => item.path === '/wage-plans'));
  }, [user, showTenantSidebar]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Sidebar - Only show for tenant users */}
      {showTenantSidebar && (
      <aside
        style={{
          width: sidebarOpen ? '250px' : '0',
          background: '#1e293b',
          color: 'white',
          transition: 'width 0.3s',
          overflow: 'hidden',
          position: 'fixed',
          height: '100vh',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #334155', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>InnSight PMS</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                display: sidebarOpen ? 'block' : 'none',
              }}
            >
              <X size={20} />
            </button>
          </div>
          {user && !isIITechAdmin && user.tenant && (
            <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#94a3b8' }}>
              <div>{user.tenant.name}</div>
              <div style={{ marginTop: '0.25rem' }}>
                {user.firstName} {user.lastName}
              </div>
            </div>
          )}
        </div>

        <nav style={{ padding: '1rem 0', flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            console.log(`Rendering menu item: ${item.label}, Path: ${item.path}, Active: ${isActive}`);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem 1.5rem',
                  color: isActive ? '#fff' : '#cbd5e1',
                  background: isActive ? '#334155' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = '#334155';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon size={20} style={{ marginRight: '0.75rem', flexShrink: 0 }} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '1.5rem', borderTop: '1px solid #334155', flexShrink: 0 }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '0.75rem',
              background: 'transparent',
              border: 'none',
              color: '#cbd5e1',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#334155';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <LogOut size={20} style={{ marginRight: '0.75rem' }} />
            Logout
          </button>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <div style={{ flex: 1, marginLeft: showTenantSidebar && sidebarOpen ? '250px' : '0', transition: 'margin-left 0.3s', width: showTenantSidebar && sidebarOpen ? 'calc(100% - 250px)' : '100%' }}>
        {/* Top Bar */}
        <header
          style={{
            background: 'white',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {showTenantSidebar && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
            }}
          >
            <Menu size={24} />
          </button>
          )}
          {!showTenantSidebar && <div />}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
              {user?.role.replace('_', ' ').toUpperCase()}
            </span>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '0.875rem',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main style={{ padding: '1.5rem' }}>{children}</main>
      </div>
    </div>
  );
}
