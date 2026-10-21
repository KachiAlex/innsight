import { useNavigate } from 'react-router-dom';
import {
  Bed,
  Calendar,
  DollarSign,
  BarChart3,
  Shield,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ClipboardList,
  Wrench,
} from 'lucide-react';
import styles from './HomePage.module.css';

const features = [
  {
    icon: Calendar,
    title: 'Reservation Management',
    description: 'Bookings, check-ins, and check-outs on a live room calendar with guest profiles and folio tracking.',
  },
  {
    icon: Bed,
    title: 'Room Management',
    description: 'Track room status, availability, and housekeeping readiness in real time across your property.',
  },
  {
    icon: DollarSign,
    title: 'Payments & Folios',
    description: 'Charges, deposits, refunds, and night audit — every posting lands on the guest folio.',
  },
  {
    icon: ClipboardList,
    title: 'Housekeeping & Requests',
    description: 'Assign rooms, track cleaning progress, and manage guest requests from one board.',
  },
  {
    icon: Wrench,
    title: 'Maintenance Tracking',
    description: 'Log issues, assign technicians, and keep out-of-order rooms visible to the front desk.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Reports',
    description: 'Occupancy, revenue, and performance reporting with exportable reports.',
  },
  {
    icon: Users,
    title: 'Multi-Property Support',
    description: 'Run multiple properties from one platform with tenant-level isolation.',
  },
  {
    icon: Shield,
    title: 'Secure by Design',
    description: 'Role-based access control, audit trails, and per-tenant data isolation.',
  },
];

const benefits = [
  'One workspace for front desk, housekeeping, and finance',
  'Real-time room status and availability tracking',
  'Guest self-service portal with OTP access',
  'Integrated payments and deposit management',
  'Multi-property administration from a single console',
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>I</div>
          <span className={styles.brandName}>InnSight</span>
        </div>
        <div className="row">
          <button className={styles.btnGhost} style={{ color: 'var(--text)', borderColor: 'var(--line-strong)' }} onClick={() => navigate('/login')}>
            Sign in
          </button>
          <button className={styles.btnPrimary} onClick={() => navigate('/login')}>
            Get started
          </button>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroBadge}>
            <Sparkles size={15} />
            Property management, simplified
          </div>
          <h1 className={styles.heroTitle}>
            Run your property with <span>clarity</span>
          </h1>
          <p className={styles.heroSub}>
            InnSight brings reservations, rooms, housekeeping, payments, and reporting into one
            workspace — for hotels, hostels, and serviced apartments.
          </p>
          <div className={styles.heroActions}>
            <button className={styles.btnPrimary} onClick={() => navigate('/login')}>
              Open InnSight
              <ArrowRight size={18} />
            </button>
            <button
              className={styles.btnGhost}
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              See what's inside
            </button>
          </div>
        </div>
      </section>

      <section id="features" className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Everything you need to run your property</h2>
            <p className={styles.sectionSub}>
              From the front desk to finance — one system for the whole operation.
            </p>
          </div>
          <div className={styles.featureGrid}>
            {features.map((feature) => (
              <div key={feature.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <feature.icon size={22} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionAlt}`}>
        <div className={styles.container}>
          <div className={styles.benefitGrid}>
            <div>
              <h2 className={styles.sectionTitle}>Built for real operations</h2>
              <p className={styles.sectionSub} style={{ margin: 0 }}>
                Designed around the workflows your team uses every day — not bolted-on extras.
              </p>
              <div className={styles.benefitList}>
                {benefits.map((benefit) => (
                  <div key={benefit} className={styles.benefitItem}>
                    <span className={styles.benefitCheck}>
                      <CheckCircle2 size={16} />
                    </span>
                    {benefit}
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.ctaPanel}>
              <h2>Ready to see it in action?</h2>
              <p>
                Sign in to your property workspace, or reach out to get InnSight set up for your team.
              </p>
              <button className={styles.btnPrimary} onClick={() => navigate('/login')}>
                Sign in to InnSight
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.footerMark}>I</div>
            InnSight
          </div>
          <span>© {new Date().getFullYear()} InnSight. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
