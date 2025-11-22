import Layout from '../components/Layout';
import { BarChart3, AlertCircle, Wrench, CreditCard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  icon: LucideIcon;
  description: string;
}

export default function PlaceholderPage({ title, icon: Icon, description }: PlaceholderPageProps) {
  return (
    <Layout>
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem',
          }}
        >
          <Icon size={40} style={{ color: '#64748b' }} />
        </div>
        <h1 style={{ marginBottom: '1rem', color: '#1e293b' }}>{title}</h1>
        <p style={{ color: '#64748b', fontSize: '1.125rem', maxWidth: '600px', margin: '0 auto' }}>
          {description}
        </p>
      </div>
    </Layout>
  );
}

export function ReportsPage() {
  return (
    <PlaceholderPage
      title="Reports & Analytics"
      icon={BarChart3}
      description="Revenue reports, occupancy analytics, and business insights coming soon."
    />
  );
}

export function AlertsPage() {
  return (
    <PlaceholderPage
      title="Alerts"
      icon={AlertCircle}
      description="System alerts and notifications will be displayed here."
    />
  );
}

export function MaintenancePage() {
  return (
    <PlaceholderPage
      title="Maintenance"
      icon={Wrench}
      description="Maintenance ticket management coming soon."
    />
  );
}

export function PaymentsPage() {
  return (
    <PlaceholderPage
      title="Payments"
      icon={CreditCard}
      description="Payment management and reconciliation coming soon."
    />
  );
}
