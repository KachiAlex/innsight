import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Button from '../components/Button';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Building,
  Target,
  FileText,
  Download,
  RefreshCw,
  Eye,
  Settings,
  Activity,
  AlertTriangle,
  Star,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ReportData {
  period: {
    start: string;
    end: string;
  };
  [key: string]: any;
}

interface PerformanceMetrics {
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    occupancy?: {
      occupiedRoomDays: number;
      totalRoomDays: number;
      occupancyRate: number;
      totalRooms: number;
    };
    revenue?: {
      totalRevenue: number;
      transactionCount: number;
    };
    guestSatisfaction?: {
      totalRequests: number;
      resolvedRequests: number;
      resolutionRate: number;
    };
    operationalEfficiency?: {
      totalTasks: number;
      completedTasks: number;
      completionRate: number;
    };
    averageDailyRate?: {
      totalRevenue: number;
      totalRoomNights: number;
      adr: number;
    };
    revpar?: {
      totalRevenue: number;
      totalRoomDays: number;
      revpar: number;
    };
    goppar?: {
      note: string;
      value: number | null;
    };
  };
}

interface CustomReport {
  id: string;
  name: string;
  description: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  metrics: string[];
  filters: any;
  groupBy: string;
  format: string;
  status: string;
  createdAt: Date;
  completedAt?: Date;
  createdBy: string;
  data?: any;
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'occupancy' | 'revenue' | 'performance' | 'financial' | 'feedback' | 'custom'>('performance');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics | null>(null);
  const [customReports, setCustomReports] = useState<CustomReport[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [showCustomReportModal, setShowCustomReportModal] = useState(false);
  const [customReportForm, setCustomReportForm] = useState({
    name: '',
    description: '',
    metrics: [] as string[],
    groupBy: 'day' as 'day' | 'month'
  });

  const availableMetrics = [
    { id: 'occupancy', label: 'Occupancy Rate', icon: Building },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'guestSatisfaction', label: 'Guest Satisfaction', icon: Users },
    { id: 'operationalEfficiency', label: 'Operational Efficiency', icon: Target },
    { id: 'averageDailyRate', label: 'Average Daily Rate (ADR)', icon: TrendingUp },
    { id: 'revpar', label: 'Revenue Per Available Room (RevPAR)', icon: BarChart3 },
    { id: 'goppar', label: 'Gross Operating Profit Per Available Room (GOPPAR)', icon: Activity }
  ];

  useEffect(() => {
    loadReportData();
    loadCustomReports();
  }, [user?.tenantId, activeTab, dateRange]);

  const loadReportData = async () => {
    if (!user?.tenantId) return;

    try {
      setLoading(true);

      if (activeTab === 'performance') {
        const response = await api.get(`/tenants/${user.tenantId}/reports/performance-metrics`, {
          params: {
            startDate: dateRange.start,
            endDate: dateRange.end
          }
        });
        setPerformanceData(response.data.data);
      } else if (activeTab === 'occupancy') {
        const response = await api.get(`/tenants/${user.tenantId}/reports/occupancy`, {
          params: {
            startDate: dateRange.start,
            endDate: dateRange.end
          }
        });
        setReportData(response.data.data);
      } else if (activeTab === 'revenue') {
        const response = await api.get(`/tenants/${user.tenantId}/reports/revenue`, {
          params: {
            startDate: dateRange.start,
            endDate: dateRange.end
          }
        });
        setReportData(response.data.data);
      } else if (activeTab === 'financial') {
        const response = await api.get(`/tenants/${user.tenantId}/reports/financial`, {
          params: {
            startDate: dateRange.start,
            endDate: dateRange.end
          }
        });
        setReportData(response.data.data);
      } else if (activeTab === 'feedback') {
        const response = await api.get(`/tenants/${user.tenantId}/reports/guest-feedback`, {
          params: {
            startDate: dateRange.start,
            endDate: dateRange.end
          }
        });
        setReportData(response.data.data);
      }
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const loadCustomReports = async () => {
    if (!user?.tenantId) return;

    try {
      const response = await api.get(`/tenants/${user.tenantId}/reports/custom`);
      setCustomReports(response.data.data);
    } catch (error) {
      console.error('Error loading custom reports:', error);
    }
  };

  const createCustomReport = async () => {
    if (!user?.tenantId) return;

    try {
      await api.post(`/tenants/${user.tenantId}/reports/custom`, {
        name: customReportForm.name,
        description: customReportForm.description,
        dateRange: {
          start: dateRange.start,
          end: dateRange.end
        },
        metrics: customReportForm.metrics,
        groupBy: customReportForm.groupBy,
        format: 'json'
      });

      toast.success('Custom report created successfully');
      setShowCustomReportModal(false);
      setCustomReportForm({
        name: '',
        description: '',
        metrics: [],
        groupBy: 'day'
      });
      loadCustomReports();
    } catch (error) {
      console.error('Error creating custom report:', error);
      toast.error('Failed to create custom report');
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

  const getStatusColor = (rate: number, thresholds: { good: number; warning: number }) => {
    if (rate >= thresholds.good) return '#10b981';
    if (rate >= thresholds.warning) return '#f59e0b';
    return '#ef4444';
  };

  const tabs = [
    { id: 'performance', label: 'Performance Metrics', icon: Target },
    { id: 'occupancy', label: 'Occupancy Reports', icon: Building },
    { id: 'revenue', label: 'Revenue Reports', icon: DollarSign },
    { id: 'financial', label: 'Financial Reports', icon: FileText },
    { id: 'feedback', label: 'Guest Feedback', icon: Star },
    { id: 'custom', label: 'Custom Reports', icon: Settings }
  ];

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
            Reports & Analytics
          </h1>
          <p style={{ color: '#64748b' }}>
            Comprehensive business intelligence and performance metrics
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: '#64748b' }}>From:</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: '#64748b' }}>To:</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              style={{
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            />
          </div>
          <Button variant="secondary" onClick={loadReportData}>
            <RefreshCw size={16} style={{ marginRight: '0.5rem' }} />
            Refresh
          </Button>
          <Button variant="secondary">
            <Download size={16} style={{ marginRight: '0.5rem' }} />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '2rem',
        overflowX: 'auto'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem 1.5rem',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === tab.id ? '#3b82f6' : '#64748b',
                fontWeight: activeTab === tab.id ? '600' : '500',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: '#64748b' }} />
          <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading report data...</p>
        </div>
      ) : (
        <>
          {/* Performance Metrics Tab */}
          {activeTab === 'performance' && performanceData && (
            <div style={{ display: 'grid', gap: '2rem' }}>
              {/* Key Metrics Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem'
              }}>
                {performanceData.metrics.occupancy && (
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
                      marginBottom: '1rem'
                    }}>
                      <Building size={20} style={{ color: '#3b82f6' }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Occupancy Rate</h3>
                    </div>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: 'bold',
                      color: getStatusColor(performanceData.metrics.occupancy.occupancyRate, { good: 80, warning: 60 }),
                      marginBottom: '0.5rem'
                    }}>
                      {formatPercentage(performanceData.metrics.occupancy.occupancyRate)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {performanceData.metrics.occupancy.occupiedRoomDays} of {performanceData.metrics.occupancy.totalRoomDays} room-days
                    </div>
                  </div>
                )}

                {performanceData.metrics.revenue && (
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
                      marginBottom: '1rem'
                    }}>
                      <DollarSign size={20} style={{ color: '#10b981' }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Total Revenue</h3>
                    </div>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: 'bold',
                      color: '#1f2937',
                      marginBottom: '0.5rem'
                    }}>
                      {formatCurrency(performanceData.metrics.revenue.totalRevenue)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {performanceData.metrics.revenue.transactionCount} transactions
                    </div>
                  </div>
                )}

                {performanceData.metrics.averageDailyRate && (
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
                      marginBottom: '1rem'
                    }}>
                      <TrendingUp size={20} style={{ color: '#f59e0b' }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Average Daily Rate</h3>
                    </div>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: 'bold',
                      color: '#1f2937',
                      marginBottom: '0.5rem'
                    }}>
                      {formatCurrency(performanceData.metrics.averageDailyRate.adr)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      Based on {performanceData.metrics.averageDailyRate.totalRoomNights} room nights
                    </div>
                  </div>
                )}

                {performanceData.metrics.revpar && (
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
                      marginBottom: '1rem'
                    }}>
                      <BarChart3 size={20} style={{ color: '#8b5cf6' }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Revenue Per Available Room</h3>
                    </div>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: 'bold',
                      color: '#1f2937',
                      marginBottom: '0.5rem'
                    }}>
                      {formatCurrency(performanceData.metrics.revpar.revpar)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      Per room per day
                    </div>
                  </div>
                )}

                {performanceData.metrics.guestSatisfaction && (
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
                      marginBottom: '1rem'
                    }}>
                      <Users size={20} style={{ color: '#ec4899' }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Guest Satisfaction</h3>
                    </div>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: 'bold',
                      color: getStatusColor(performanceData.metrics.guestSatisfaction.resolutionRate, { good: 90, warning: 75 }),
                      marginBottom: '0.5rem'
                    }}>
                      {formatPercentage(performanceData.metrics.guestSatisfaction.resolutionRate)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {performanceData.metrics.guestSatisfaction.resolvedRequests} of {performanceData.metrics.guestSatisfaction.totalRequests} requests resolved
                    </div>
                  </div>
                )}

                {performanceData.metrics.operationalEfficiency && (
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
                      marginBottom: '1rem'
                    }}>
                      <Target size={20} style={{ color: '#06b6d4' }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Operational Efficiency</h3>
                    </div>
                    <div style={{
                      fontSize: '2.5rem',
                      fontWeight: 'bold',
                      color: getStatusColor(performanceData.metrics.operationalEfficiency.completionRate, { good: 90, warning: 75 }),
                      marginBottom: '0.5rem'
                    }}>
                      {formatPercentage(performanceData.metrics.operationalEfficiency.completionRate)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {performanceData.metrics.operationalEfficiency.completedTasks} of {performanceData.metrics.operationalEfficiency.totalTasks} tasks completed
                    </div>
                  </div>
                )}
              </div>

              {/* GOPPAR Note */}
              {performanceData.metrics.goppar && (
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontSize: '0.875rem',
                  color: '#92400e'
                }}>
                  <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  {performanceData.metrics.goppar.note}
                </div>
              )}
            </div>
          )}

          {/* Occupancy Reports Tab */}
          {activeTab === 'occupancy' && reportData && (
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem'
            }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
                Occupancy Report
              </h3>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Detailed occupancy analytics for the selected period
              </div>
              {/* Occupancy report content would go here */}
              <div style={{
                padding: '4rem',
                textAlign: 'center',
                color: '#64748b',
                background: '#f8fafc',
                borderRadius: '8px',
                marginTop: '2rem'
              }}>
                Occupancy report visualization will be implemented here
                <br />
                Data available: {JSON.stringify(reportData, null, 2).length} characters
              </div>
            </div>
          )}

          {/* Revenue Reports Tab */}
          {activeTab === 'revenue' && reportData && (
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem'
            }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
                Revenue Report
              </h3>
              <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Comprehensive revenue analysis and trends
              </div>
              {/* Revenue report content would go here */}
              <div style={{
                padding: '4rem',
                textAlign: 'center',
                color: '#64748b',
                background: '#f8fafc',
                borderRadius: '8px',
                marginTop: '2rem'
              }}>
                Revenue report visualization will be implemented here
                <br />
                Data available: {JSON.stringify(reportData, null, 2).length} characters
              </div>
            </div>
          )}

          {/* Financial Reports Tab */}
          {activeTab === 'financial' && reportData && (
            <div style={{ display: 'grid', gap: '2rem' }}>
              {/* Summary Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem'
              }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1.5rem'
                }}>
                  <h4 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Total Revenue
                  </h4>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {formatCurrency(reportData.summary?.revenue?.totalRevenue || 0)}
                  </div>
                </div>

                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1.5rem'
                }}>
                  <h4 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Total Expenses
                  </h4>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {formatCurrency(reportData.summary?.expenses?.totalExpenses || 0)}
                  </div>
                </div>

                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1.5rem'
                }}>
                  <h4 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Net Profit
                  </h4>
                  <div style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: (reportData.summary?.profitLoss?.netProfit || 0) >= 0 ? '#10b981' : '#ef4444'
                  }}>
                    {formatCurrency(reportData.summary?.profitLoss?.netProfit || 0)}
                  </div>
                </div>

                <div style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '1.5rem'
                }}>
                  <h4 style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                    Profit Margin
                  </h4>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {formatPercentage(reportData.summary?.profitLoss?.profitMargin || 0)}
                  </div>
                </div>
              </div>

              {/* Expense Note */}
              {reportData.summary?.expenses?.note && (
                <div style={{
                  background: '#fef3c7',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  padding: '1rem',
                  fontSize: '0.875rem',
                  color: '#92400e'
                }}>
                  <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                  {reportData.summary.expenses.note}
                </div>
              )}
            </div>
          )}

          {/* Guest Feedback Tab */}
          {activeTab === 'feedback' && reportData && (
            <div style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '2rem'
            }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
                Guest Feedback Report
              </h3>
              <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '2rem' }}>
                {reportData.note}
              </div>

              {/* Feedback Summary */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem'
              }}>
                <div style={{
                  background: '#f8fafc',
                  borderRadius: '8px',
                  padding: '1rem',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#64748b' }}>
                    {reportData.summary?.totalFeedback || 0}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Total Feedback</div>
                </div>

                <div style={{
                  background: '#f8fafc',
                  borderRadius: '8px',
                  padding: '1rem',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#64748b' }}>
                    {reportData.summary?.averageRating ? reportData.summary.averageRating.toFixed(1) : '0.0'}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Average Rating</div>
                </div>

                <div style={{
                  background: '#f8fafc',
                  borderRadius: '8px',
                  padding: '1rem',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#64748b' }}>
                    {formatPercentage(reportData.summary?.responseRate || 0)}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>Response Rate</div>
                </div>
              </div>

              {/* Feedback Categories */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem'
              }}>
                {Object.entries(reportData.summary?.categories || {}).map(([category, data]: [string, any]) => (
                  <div key={category} style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1rem'
                  }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'capitalize' }}>
                      {category}
                    </h4>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      {data.averageRating?.toFixed(1) || '0.0'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {data.count || 0} reviews
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Reports Tab */}
          {activeTab === 'custom' && (
            <div style={{ display: 'grid', gap: '2rem' }}>
              {/* Create Custom Report Button */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Custom Reports
                  </h3>
                  <p style={{ color: '#64748b' }}>
                    Create tailored reports with specific metrics and date ranges
                  </p>
                </div>
                <Button onClick={() => setShowCustomReportModal(true)}>
                  <Plus size={18} style={{ marginRight: '0.5rem' }} />
                  Create Custom Report
                </Button>
              </div>

              {/* Custom Reports List */}
              <div style={{
                display: 'grid',
                gap: '1rem'
              }}>
                {customReports.map(report => (
                  <div key={report.id} style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {report.name}
                      </h4>
                      <p style={{ color: '#64748b', marginBottom: '0.5rem' }}>
                        {report.description}
                      </p>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        Created: {report.createdAt.toLocaleDateString()} •
                        Metrics: {report.metrics.join(', ')} •
                        Group by: {report.groupBy}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        background: report.status === 'completed' ? '#dcfce7' : '#fef3c7',
                        color: report.status === 'completed' ? '#166534' : '#92400e'
                      }}>
                        {report.status}
                      </span>
                      <Button variant="secondary" size="sm">
                        <Eye size={14} style={{ marginRight: '0.5rem' }} />
                        View
                      </Button>
                      <Button variant="secondary" size="sm">
                        <Download size={14} style={{ marginRight: '0.5rem' }} />
                        Export
                      </Button>
                    </div>
                  </div>
                ))}

                {customReports.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: '4rem',
                    color: '#64748b',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}>
                    <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                      No Custom Reports Yet
                    </h3>
                    <p>Create your first custom report to get started with tailored analytics</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Custom Report Modal */}
      {showCustomReportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            width: '600px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
              Create Custom Report
            </h3>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Report Name
                </label>
                <input
                  type="text"
                  value={customReportForm.name}
                  onChange={(e) => setCustomReportForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter report name"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Description
                </label>
                <textarea
                  value={customReportForm.description}
                  onChange={(e) => setCustomReportForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this report will show"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Metrics to Include
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.5rem'
                }}>
                  {availableMetrics.map(metric => {
                    const Icon = metric.icon;
                    const isSelected = customReportForm.metrics.includes(metric.id);
                    return (
                      <label
                        key={metric.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.75rem',
                          border: `1px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
                          borderRadius: '6px',
                          background: isSelected ? '#eff6ff' : 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCustomReportForm(prev => ({
                                ...prev,
                                metrics: [...prev.metrics, metric.id]
                              }));
                            } else {
                              setCustomReportForm(prev => ({
                                ...prev,
                                metrics: prev.metrics.filter(m => m !== metric.id)
                              }));
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        <Icon size={16} style={{ color: isSelected ? '#3b82f6' : '#64748b' }} />
                        <span style={{ fontSize: '0.875rem' }}>{metric.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  Group Data By
                </label>
                <select
                  value={customReportForm.groupBy}
                  onChange={(e) => setCustomReportForm(prev => ({ ...prev, groupBy: e.target.value as 'day' | 'month' }))}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="day">Daily</option>
                  <option value="month">Monthly</option>
                </select>
              </div>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem',
              marginTop: '2rem'
            }}>
              <Button variant="secondary" onClick={() => setShowCustomReportModal(false)}>
                Cancel
              </Button>
              <Button onClick={createCustomReport} disabled={!customReportForm.name || customReportForm.metrics.length === 0}>
                Create Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}