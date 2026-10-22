import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronsLeft,
  ChevronsRight,
  DatabaseBackup,
  HelpCircle,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { CommandPalette, Command } from '../CommandPalette';
import { navForRole, visibleNav, flattenNav, type NavGroup } from './navConfig';
import { api } from '../../lib/api';
import styles from './AppShell.module.css';

const MOBILE_BREAKPOINT = 900;

function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
}

const titleForPath = (pathname: string, groups: NavGroup[]): string => {
  const match = flattenNav(groups).find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`)
  );
  return match?.label ?? 'InnSight';
};

export default function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const groups = useMemo(() => visibleNav(navForRole(user?.role), user?.role), [user?.role]);
  const pageTitle = titleForPath(location.pathname, groups);
  const isSuperadmin = user?.role === 'iitech_admin';

  // Superadmin console signals — nav badges + palette tenant search
  const [navBadges, setNavBadges] = useState<Record<string, number>>({});
  const [tenants, setTenants] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  useEffect(() => {
    if (!isSuperadmin) return;
    const safe = (p: Promise<any>) => p.catch(() => ({ data: { data: null } }));
    Promise.all([
      safe(api.get('/superadmin/support/stats')),
      safe(api.get('/superadmin/sla/summary')),
      safe(api.get('/superadmin/backup-metrics')),
      safe(api.get('/superadmin/tenants?limit=100')),
    ]).then(([tickets, sla, backups, tenantRes]) => {
      const openTickets =
        (tickets.data?.data?.openTickets || 0) + (tickets.data?.data?.inProgressTickets || 0);
      const badges: Record<string, number> = {};
      if (openTickets > 0) badges['/support-tickets'] = openTickets;
      if ((sla.data?.data?.tenantsWithViolations || 0) > 0)
        badges['/sla-dashboard'] = sla.data.data.tenantsWithViolations;
      if ((backups.data?.data?.failedBackups || 0) > 0)
        badges['/backup-restore'] = backups.data.data.failedBackups;
      setNavBadges(badges);
      setTenants(
        (tenantRes.data?.data?.tenants || tenantRes.data?.data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
        }))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Ctrl/Cmd+K opens the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const commands: Command[] = useMemo(() => {
    const nav: Command[] = flattenNav(groups).map((item) => ({
      id: item.path,
      title: item.label,
      category: 'Navigation',
      action: () => navigate(item.path),
      icon: <item.icon size={16} />,
    }));
    if (!isSuperadmin) return nav;
    return [
      ...nav,
      {
        id: 'action-create-tenant',
        title: 'Provision new tenant',
        category: 'Actions',
        action: () => navigate('/tenants'),
        icon: <Plus size={16} />,
      },
      {
        id: 'action-new-backup',
        title: 'Run a backup',
        category: 'Actions',
        action: () => navigate('/backup-restore'),
        icon: <DatabaseBackup size={16} />,
      },
      {
        id: 'action-new-ticket',
        title: 'Create support ticket',
        category: 'Actions',
        action: () => navigate('/support-tickets'),
        icon: <Plus size={16} />,
      },
      ...tenants.map((t) => ({
        id: `tenant-${t.id}`,
        title: t.name,
        description: `@${t.slug}`,
        category: 'Tenants',
        action: () => navigate(`/superadmin/tenants/${t.id}`),
        icon: <Building2 size={16} />,
      })),
    ];
  }, [groups, navigate, isSuperadmin, tenants]);

  const sidebar = (
    <aside
      className={`${styles.sidebar} ${collapsed && !isMobile ? styles.collapsed : ''} ${
        isMobile ? styles.mobile : ''
      }`}
      aria-label="Primary navigation"
    >
      <div className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">
          ✦
        </span>
        {(!collapsed || isMobile) && <span className={styles.brandName}>InnSight</span>}
        {isMobile && (
          <button
            className={styles.iconBtn}
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {(!collapsed || isMobile) && (
        <div className={styles.contextCard}>
          <strong>{isSuperadmin ? 'InnSight Platform' : user?.tenant?.name ?? 'Property'}</strong>
          <small>
            {user?.firstName} {user?.lastName} · {user?.role?.replace(/_/g, ' ')}
          </small>
        </div>
      )}

      <nav className={styles.nav}>
        {groups.map((group) => (
          <div key={group.label} className={styles.navGroup}>
            {(!collapsed || isMobile) && <div className={styles.groupLabel}>{group.label}</div>}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                title={item.label}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.active : ''}`
                }
              >
                <item.icon size={18} className={styles.navIcon} aria-hidden="true" />
                {(!collapsed || isMobile) && <span className={styles.navLabel}>{item.label}</span>}
                {navBadges[item.path] > 0 && (
                  <span className={styles.navBadge} aria-label={`${navBadges[item.path]} pending`}>
                    {navBadges[item.path]}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {!isMobile && (
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      )}
    </aside>
  );

  return (
    <div className={styles.shell}>
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />

      {isMobile ? (
        <>
          {mobileOpen && <div className={styles.backdrop} onClick={() => setMobileOpen(false)} />}
          {mobileOpen && sidebar}
        </>
      ) : (
        sidebar
      )}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            {isMobile && (
              <button
                className={styles.iconBtn}
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>
            )}
            <div className={styles.breadcrumb}>
              <Link to={isSuperadmin ? '/superadmin-dashboard' : '/dashboard'} className={styles.crumb}>
                InnSight
              </Link>
              <span className={styles.crumbSep}>/</span>
              <span className={styles.crumbCurrent}>{pageTitle}</span>
            </div>
          </div>

          <div className={styles.topbarRight}>
            <button
              className={styles.searchBtn}
              onClick={() => setPaletteOpen(true)}
              aria-label="Search and navigate (Ctrl+K)"
            >
              <Search size={15} />
              {!isMobile && <span>Search…</span>}
              {!isMobile && <kbd className={styles.kbd}>Ctrl K</kbd>}
            </button>

            <Link to="/alerts" className={styles.iconBtn} aria-label="Alerts">
              <Bell size={18} />
            </Link>
            <a
              href="https://devin.ai/support"
              target="_blank"
              rel="noreferrer"
              className={styles.iconBtn}
              aria-label="Help"
            >
              <HelpCircle size={18} />
            </a>
            <button
              className={styles.iconBtn}
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <div className={styles.avatar} title={`${user?.firstName} ${user?.lastName}`}>
              {(user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')}
            </div>
            <button className={styles.iconBtn} onClick={handleLogout} aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className={styles.content} id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
