import {
  LayoutDashboard,
  CalendarDays,
  Calendar,
  DoorOpen,
  UserCheck,
  Users,
  MessageSquare,
  Sparkles,
  Wrench,
  ChefHat,
  Package,
  Receipt,
  CreditCard,
  DollarSign,
  Moon,
  BarChart3,
  UserCog,
  Wallet,
  Globe,
  AlertCircle,
  Settings,
  Building2,
  ShieldCheck,
  Gauge,
  LifeBuoy,
  KeyRound,
  DatabaseBackup,
  ScrollText,
  Archive,
  Mail,
  SlidersHorizontal,
  TrendingUp,
  Wand2,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Roles that see this item. Omit = all roles in the shell's audience. */
  roles?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const MANAGERS = ['owner', 'general_manager'];
const DESK = [...MANAGERS, 'front_desk'];
const FINANCE = [...MANAGERS, 'accountant', 'front_desk'];
const OPS = [...MANAGERS, 'housekeeping', 'housekeeping_supervisor', 'housekeeping_staff', 'maintenance'];

/** Staff PMS navigation — grouped per the redesign blueprint §3 */
export const STAFF_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/onboarding', label: 'Setup Wizard', icon: Wand2, roles: MANAGERS },
      { path: '/calendar', label: 'Calendar', icon: CalendarDays, roles: [...DESK, ...OPS] },
      { path: '/reservations', label: 'Reservations', icon: Calendar, roles: DESK },
    ],
  },
  {
    label: 'Front Office',
    items: [
      { path: '/rooms', label: 'Rooms & Availability', icon: DoorOpen },
      { path: '/guests', label: 'Guests & CRM', icon: UserCheck, roles: DESK },
      { path: '/group-bookings', label: 'Group Bookings', icon: Users, roles: DESK },
      { path: '/guest-requests', label: 'Guest Requests', icon: MessageSquare },
    ],
  },
  {
    label: 'Operations',
    items: [
      { path: '/housekeeping', label: 'Housekeeping', icon: Sparkles, roles: [...DESK, ...OPS] },
      { path: '/maintenance', label: 'Maintenance', icon: Wrench, roles: [...MANAGERS, 'maintenance', 'front_desk', 'housekeeping_supervisor'] },
      { path: '/room-service', label: 'Room Service POS', icon: ChefHat, roles: [...DESK, 'staff'] },
      { path: '/lost-found', label: 'Lost & Found', icon: Package },
    ],
  },
  {
    label: 'Finance & Insights',
    items: [
      { path: '/folios', label: 'Folios', icon: Receipt, roles: FINANCE },
      { path: '/payments', label: 'Payments', icon: CreditCard, roles: FINANCE },
      { path: '/deposit-management', label: 'Deposits', icon: DollarSign, roles: FINANCE },
      { path: '/rate-plans', label: 'Rate Plans', icon: DollarSign, roles: FINANCE },
      { path: '/night-audit', label: 'Night Audit', icon: Moon, roles: FINANCE },
      { path: '/reports', label: 'Reports', icon: BarChart3, roles: FINANCE },
      { path: '/analytics', label: 'Analytics', icon: TrendingUp, roles: FINANCE },
    ],
  },
  {
    label: 'Administration',
    items: [
      { path: '/staff', label: 'Staff & Shifts', icon: UserCog, roles: MANAGERS },
      { path: '/wage-plans', label: 'Wage Plans', icon: Wallet, roles: MANAGERS },
      { path: '/integrations', label: 'Integrations', icon: Globe, roles: MANAGERS },
      { path: '/alerts', label: 'Alerts', icon: AlertCircle },
      { path: '/settings', label: 'Hotel Settings', icon: Settings, roles: MANAGERS },
    ],
  },
];

/** Superadmin console navigation — blueprint §3 */
export const SUPERADMIN_NAV: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      { path: '/superadmin-dashboard', label: 'Overview', icon: LayoutDashboard },
      { path: '/superadmin/tenants', label: 'Hotels & Tenants', icon: Building2 },
      { path: '/superadmin-users', label: 'Users', icon: Users },
      { path: '/billing', label: 'Subscriptions & Billing', icon: CreditCard },
      { path: '/platform-analytics', label: 'Platform Analytics', icon: TrendingUp },
    ],
  },
  {
    label: 'Operations',
    items: [
      { path: '/tenant-quotas', label: 'Resource Quotas', icon: Gauge },
      { path: '/sla-dashboard', label: 'Service Levels', icon: ShieldCheck },
      { path: '/support-tickets', label: 'Support Tickets', icon: LifeBuoy },
      { path: '/api-management', label: 'API Management', icon: KeyRound },
      { path: '/superadmin/integrations', label: 'Integrations', icon: Globe },
    ],
  },
  {
    label: 'Security & Control',
    items: [
      { path: '/backup-restore', label: 'Backups & Restore', icon: DatabaseBackup },
      { path: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
      { path: '/data-retention', label: 'Data Retention', icon: Archive },
      { path: '/communications', label: 'Communications', icon: Mail },
      { path: '/system-settings', label: 'System Settings', icon: SlidersHorizontal },
    ],
  },
];

export const navForRole = (role?: string): NavGroup[] =>
  role === 'iitech_admin' ? SUPERADMIN_NAV : STAFF_NAV;

/** Filter groups to what a role can see; drops empty groups */
export const visibleNav = (groups: NavGroup[], role?: string): NavGroup[] => {
  const items = (item: NavItem) => !item.roles || (role && item.roles.includes(role));
  return groups
    .map((g) => ({ ...g, items: g.items.filter(items) }))
    .filter((g) => g.items.length > 0);
};

export const flattenNav = (groups: NavGroup[]): NavItem[] =>
  groups.flatMap((g) => g.items);
