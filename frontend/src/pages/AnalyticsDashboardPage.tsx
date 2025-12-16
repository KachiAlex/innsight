import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Button from '../components/Button';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  Building,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Filter,
  Eye,
  Activity
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardMetrics {
  period: {
    start: string;
    end: string;
  };
  revenue: {
    totalRevenue: number;
    roomRevenue: number;
    roomServiceRevenue: number;
    averageDailyRate: number;
    changePercent: number;
  };
  occupancy: {
    totalRooms: number;
    occupiedRoomDays: number;
    totalRoomDays: number;
    occupancyRate: number;
  };
  satisfaction: {
    totalRequests: number;
    resolvedRequests: number;
    resolutionRate: number;
    urgentRequests: number;
    urgentResolutionRate: number;
    avgResolutionTime: number;
  };
  operational: {
    housekeepingTasks: number;
    maintenanceTickets: number;
    guestRequests: number;
    totalTasks: number;
  };
  alerts: any[];
  trends: {
    revenue: Array<{ date: string; revenue: number }>;
    occupancy: Array<{ date: string; occupancyRate: number }>;
  };
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
  }>;
}

export default function AnalyticsDashboardPage() {
  const { user } = useAuthStore();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadDashboardData();
  }, [user?.tenantId, period]);

  const loadDashboardData = async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);
      const response = await api.get(`/tenants/${user.tenantId}/analytics/dashboard?period=${period}`);
      setMetrics(response.data.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getChangeIndicator = (change: number) => {
    if (change > 0) {
      return {
        icon: TrendingUp,
        color: '#10b981',
        text: `+${change.toFixed(1)}%`
      };
    } else if (change < 0) {
      return {
        icon: TrendingDown,
        color: '#ef4444',
        text: `${change.toFixed(1)}%`
      };
    } else {
      return {
        icon: Activity,
        color: '#6b7280',
        text: '0%'
      };
    }
  };

  const getStatusColor = (rate: number, thresholds: { good: number; warning: number }) => {
    if (rate >= thresholds.good) return '#10b981';
    if (rate >= thresholds.warning) return '#f59e0b';
    return '#ef4444';
  };

  const periodOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' }
  ];

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            Analytics Dashboard
          </h1>
          <p style={{ color: '#64748b' }}>
            Business intelligence and performance metrics
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              background: 'white'
            }}
          >
            {periodOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <Button variant="secondary" onClick={loadDashboardData}>
            <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
            Refresh
          </Button>

          <Button variant="secondary">
            <Download size={16} style={{ marginRight: '0.5rem' }} />
            Export
          </Button>
        </div>
      </div>

      {/* Last Updated */}
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '2rem',
        fontSize: '0.875rem',
        color: '#64748b'
      }}>
        Last updated: {lastUpdated.toLocaleString()}
      </div>

      {metrics && (
        <>
          {/* Key Metrics Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            {/* Revenue Card */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '40px',
                height: '40px',
                background: '#dbeafe',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <DollarSign size={20} style={{ color: '#3b82f6' }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b', marginBottom: '0.5rem' }}>
                  Total Revenue
                </h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
                  {formatCurrency(metrics.revenue.totalRevenue)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  vs previous period
                </div>
                {(() => {
                  const indicator = getChangeIndicator(metrics.revenue.changePercent);
                  const Icon = indicator.icon;
                  return (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      color: indicator.color
                    }}>
                      <Icon size={14} />
                      {indicator.text}
                    </div>
                  );
                })()}
              </div>

              <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                <div>Room Revenue: {formatCurrency(metrics.revenue.roomRevenue)}</div>
                <div>Room Service: {formatCurrency(metrics.revenue.roomServiceRevenue)}</div>
                <div>Avg Daily Rate: {formatCurrency(metrics.revenue.averageDailyRate)}</div>
              </div>
            </div>

            {/* Occupancy Card */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '40px',
                height: '40px',
                background: '#dcfce7',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Building size={20} style={{ color: '#10b981' }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b', marginBottom: '0.5rem' }}>
                  Occupancy Rate
                </h3>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: getStatusColor(metrics.occupancy.occupancyRate, { good: 80, warning: 60 })
                }}>
                  {formatPercentage(metrics.occupancy.occupancyRate)}
                </div>
              </div>

              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                <div>Total Rooms: {metrics.occupancy.totalRooms}</div>
                <div>Occupied: {metrics.occupancy.occupiedRoomDays} room-days</div>
                <div>Total: {metrics.occupancy.totalRoomDays} room-days</div>
              </div>
            </div>

            {/* Guest Satisfaction Card */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '40px',
                height: '40px',
                background: '#fef3c7',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={20} style={{ color: '#f59e0b' }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b', marginBottom: '0.5rem' }}>
                  Guest Satisfaction
                </h3>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: getStatusColor(metrics.satisfaction.resolutionRate, { good: 90, warning: 75 })
                }}>
                  {formatPercentage(metrics.satisfaction.resolutionRate)}
                </div>
              </div>

              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                <div>Total Requests: {metrics.satisfaction.totalRequests}</div>
                <div>Resolved: {metrics.satisfaction.resolvedRequests}</div>
                <div>Urgent Resolution: {formatPercentage(metrics.satisfaction.urgentResolutionRate)}</div>
              </div>
            </div>

            {/* Operational Efficiency Card */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '40px',
                height: '40px',
                background: '#e0e7ff',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Target size={20} style={{ color: '#6366f1' }} />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#64748b', marginBottom: '0.5rem' }}>
                  Operational Tasks
                </h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
                  {metrics.operational.totalTasks}
                </div>
              </div>

              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                <div>Housekeeping: {metrics.operational.housekeepingTasks}</div>
                <div>Maintenance: {metrics.operational.maintenanceTickets}</div>
                <div>Guest Requests: {metrics.operational.guestRequests}</div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            marginBottom: '2rem'
          }}>
            {/* Revenue Trend Chart Placeholder */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem'
              }}>
                <BarChart3 size={20} style={{ color: '#64748b' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
                  Revenue Trend
                </h3>
              </div>

              <div style={{
                height: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                borderRadius: '8px',
                color: '#64748b'
              }}>
                Chart visualization will be implemented here
                <br />
                Data points: {metrics.trends.revenue.length}
              </div>
            </div>

            {/* Occupancy Trend Chart Placeholder */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem'
              }}>
                <TrendingUp size={20} style={{ color: '#64748b' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
                  Occupancy Trend
                </h3>
              </div>

              <div style={{
                height: '200px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f8fafc',
                borderRadius: '8px',
                color: '#64748b'
              }}>
                Chart visualization will be implemented here
                <br />
                Data points: {metrics.trends.occupancy.length}
              </div>
            </div>
          </div>

          {/* Alerts Section */}
          {metrics.alerts.length > 0 && (
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem'
              }}>
                <AlertTriangle size={20} style={{ color: '#ef4444' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
                  Active Alerts ({metrics.alerts.length})
                </h3>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                {metrics.alerts.slice(0, 3).map((alert: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1rem',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px'
                    }}
                  >
                    <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500', color: '#991b1b' }}>
                        {alert.title}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#7f1d1d' }}>
                        {alert.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem'
          }}>
            {/* Revenue Breakdown */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem'
            }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                Revenue Breakdown
              </h3>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: '#f8fafc',
                  borderRadius: '8px'
                }}>
                  <span style={{ color: '#64748b' }}>Room Revenue</span>
                  <span style={{ fontWeight: '600' }}>
                    {formatCurrency(metrics.revenue.roomRevenue)}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: '#f8fafc',
                  borderRadius: '8px'
                }}>
                  <span style={{ color: '#64748b' }}>Room Service</span>
                  <span style={{ fontWeight: '600' }}>
                    {formatCurrency(metrics.revenue.roomServiceRevenue)}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: '#dbeafe',
                  borderRadius: '8px'
                }}>
                  <span style={{ color: '#1e40af', fontWeight: '500' }}>Total Revenue</span>
                  <span style={{ fontWeight: '700', color: '#1e40af' }}>
                    {formatCurrency(metrics.revenue.totalRevenue)}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Indicators */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem'
            }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                Performance Indicators
              </h3>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: getStatusColor(metrics.occupancy.occupancyRate, { good: 80, warning: 60 }) + '15',
                  borderRadius: '8px'
                }}>
                  <span style={{ color: '#64748b' }}>Occupancy Rate</span>
                  <span style={{
                    fontWeight: '600',
                    color: getStatusColor(metrics.occupancy.occupancyRate, { good: 80, warning: 60 })
                  }}>
                    {formatPercentage(metrics.occupancy.occupancyRate)}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: getStatusColor(metrics.satisfaction.resolutionRate, { good: 90, warning: 75 }) + '15',
                  borderRadius: '8px'
                }}>
                  <span style={{ color: '#64748b' }}>Request Resolution</span>
                  <span style={{
                    fontWeight: '600',
                    color: getStatusColor(metrics.satisfaction.resolutionRate, { good: 90, warning: 75 })
                  }}>
                    {formatPercentage(metrics.satisfaction.resolutionRate)}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  background: '#f8fafc',
                  borderRadius: '8px'
                }}>
                  <span style={{ color: '#64748b' }}>Avg Resolution Time</span>
                  <span style={{ fontWeight: '600' }}>
                    {metrics.satisfaction.avgResolutionTime > 0
                      ? `${Math.round(metrics.satisfaction.avgResolutionTime)}h`
                      : 'N/A'
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem'
            }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                Quick Actions
              </h3>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <Button variant="secondary" style={{ justifyContent: 'flex-start' }}>
                  <Eye size={16} style={{ marginRight: '0.5rem' }} />
                  View Detailed Reports
                </Button>

                <Button variant="secondary" style={{ justifyContent: 'flex-start' }}>
                  <Filter size={16} style={{ marginRight: '0.5rem' }} />
                  Custom Date Range
                </Button>

                <Button variant="secondary" style={{ justifyContent: 'flex-start' }}>
                  <Download size={16} style={{ marginRight: '0.5rem' }} />
                  Export Data
                </Button>

                <Button variant="secondary" style={{ justifyContent: 'flex-start' }}>
                  <Target size={16} style={{ marginRight: '0.5rem' }} />
                  Set Performance Goals
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
