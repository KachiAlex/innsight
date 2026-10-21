import { ReactNode } from 'react';
import { useAuthStore } from '../../store/authStore';

interface RoleGateProps {
  /** Roles allowed to see the content */
  roles: string[];
  children: ReactNode;
  /** Optional fallback when the role doesn't match (default: render nothing) */
  fallback?: ReactNode;
  /** When true, requires role match against user.role OR user.isIitechAdmin for 'iitech_admin' */
  allowSuperadmin?: boolean;
}

/**
 * UI-level role gate. IMPORTANT: this only controls visibility —
 * backend authorization remains the real enforcement point.
 */
export default function RoleGate({ roles, children, fallback = null }: RoleGateProps) {
  const role = useAuthStore((s) => s.user?.role);
  if (!role || !roles.includes(role)) return <>{fallback}</>;

  return <>{children}</>;
}

/** Hook variant for conditional logic inside components */
export function useHasRole(roles: string[]): boolean {
  const role = useAuthStore((s) => s.user?.role);
  return !!role && roles.includes(role);
}
