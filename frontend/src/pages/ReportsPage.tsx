import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { BarChart3, DollarSign, TrendingUp, Calendar, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { DashboardSkeleton } from '../components/LoadingSkeleton';

interface RevenueData {
  period: { start: string; end: string };
  totalRevenue: number;
  paymentMethods: Record<string, number>;
  transactions: number;
  dailyBreakdown?: Record<string, number>;
}

interface OccupancyData {
  period: { start: string; end: string };
  totalRooms: number;
  checkedIn: number;
  totalNights: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancyData | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchReports();
  }, [user, dateRange]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [revenueRes, occupancyRes] = await Promise.all([
        api.get(`/tenants/${user?.tenantId}/reports/revenue`, {
          params: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            groupBy: 'day',
          },
        }),
        api.get(`/tenants/${user?.tenantId}/reports/occupancy`, {
          params: {
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
          },
        }),
      ]);

      setRevenueData(revenueRes.data.data);
      setOccupancyData(occupancyRes.data.data);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQuickDateRange = (days: number) => {
    const end = new Date();
    const start = subDays(end, days);
    setDateRange({
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    });
  };

  const prepareChartData = () => {
    if (!revenueData?.dailyBreakdown) return [];
    return Object.entries(revenueData.dailyBreakdown)
      .map(([date, revenue]) => ({
        date: format(new Date(date), 'MMM dd'),
        fullDate: date,
        revenue: Number(revenue),
      }))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  };

  const preparePaymentMethodData = () => {
    if (!revenueData?.paymentMethods) return [];
    return Object.entries(revenueData.paymentMethods).map(([method, amount]) => ({
      method: method.replace('_', ' ').toUpperCase(),
      amount: Number(amount),
    }));
  };

  const exportToPDF = async () => {
    if (!revenueData || !occupancyData) return;

    try {
      // Dynamically import PDF libraries only when needed
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(18);
      doc.text('Revenue & Occupancy Report', 14, 22);
      
      // Period
      doc.setFontSize(12);
      doc.text(
        `Period: ${format(new Date(dateRange.startDate), 'MMM dd, yyyy')} - ${format(new Date(dateRange.endDate), 'MMM dd, yyyy')}`,
        14,
        30
      );

      // Summary
      const summaryData = [
        ['Total Revenue', `₦${(revenueData?.totalRevenue || 0).toLocaleString()}`],
        ['Transactions', `${revenueData?.transactions || 0}`],
        ['Occupancy Rate', `${(occupancyData?.occupancyRate || 0).toFixed(1)}%`],
        ['ADR', `₦${(occupancyData?.adr || 0).toLocaleString()}`],
        ['RevPAR', `₦${(occupancyData?.revpar || 0).toLocaleString()}`],
      ];

      autoTable(doc, {
        startY: 40,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'striped',
      });

      // Daily Revenue Table
      const chartData = prepareChartData();
      if (chartData.length > 0) {
        const revenueTableData = chartData.map((item) => [item.date, `₦${item.revenue.toLocaleString()}`]);
        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 20,
          head: [['Date', 'Revenue']],
          body: revenueTableData,
          theme: 'striped',
        });
      }

      doc.save(`revenue-report-${dateRange.startDate}-${dateRange.endDate}.pdf`);
      toast.success('Report exported to PDF');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('Failed to export PDF');
    }
  };

  const exportToCSV = () => {
    const chartData = prepareChartData();
    if (!chartData.length) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Date', 'Revenue'];
    const rows = chartData.map((item) => [item.date, item.revenue.toString()]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `revenue-report-${dateRange.startDate}-${dateRange.endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported to CSV');
  };

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Reports & Analytics</h1>
          <DashboardSkeleton />
        </div>
      </Layout>
    );
  }

  const chartData = prepareChartData();
  const paymentMethodData = preparePaymentMethodData();

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, color: '#1e293b' }}>Reports & Analytics</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={exportToPDF}
              disabled={!revenueData || !occupancyData}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: !revenueData || !occupancyData ? '#94a3b8' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: !revenueData || !occupancyData ? 'not-allowed' : 'pointer',
                fontWeight: '500',
              }}
            >
              <Download size={18} />
              Export PDF
            </button>
            <button
              onClick={exportToCSV}
              disabled={!chartData.length}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: !chartData.length ? '#94a3b8' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: !chartData.length ? 'not-allowed' : 'pointer',
                fontWeight: '500',
              }}
            >
              <Download size={18} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Date Range Selector */}
        <div
          style={{
            background: 'white',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ color: '#64748b', fontSize: '0.875rem' }}>Quick Select:</label>
            <button
              onClick={() => getQuickDateRange(7)}
              style={{
                padding: '0.5rem 1rem',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => getQuickDateRange(30)}
              style={{
                padding: '0.5rem 1rem',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => {
                setDateRange({
                  startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                  endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
                });
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              This Month
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              style={{
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
            <span style={{ color: '#64748b' }}>to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              style={{
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #3b82f6',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <DollarSign size={24} style={{ color: '#3b82f6' }} />
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Revenue</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
              ₦{(revenueData?.totalRevenue || 0).toLocaleString()}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {revenueData?.transactions || 0} transactions
            </div>
          </div>

          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #10b981',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <TrendingUp size={24} style={{ color: '#10b981' }} />
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Occupancy Rate</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
              {(occupancyData?.occupancyRate || 0).toFixed(1)}%
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {occupancyData?.checkedIn || 0} rooms occupied
            </div>
          </div>

          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #f59e0b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <BarChart3 size={24} style={{ color: '#f59e0b' }} />
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>ADR</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
              ₦{(occupancyData?.adr || 0).toLocaleString()}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              Average Daily Rate
            </div>
          </div>

          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderLeft: '4px solid #8b5cf6',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Calendar size={24} style={{ color: '#8b5cf6' }} />
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>RevPAR</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
              ₦{(occupancyData?.revpar || 0).toLocaleString()}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              Revenue per Available Room
            </div>
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '1.5rem' }}>
          {/* Revenue Chart */}
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>Daily Revenue</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `₦${value.toLocaleString()}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No data available</div>
            )}
          </div>

          {/* Payment Methods Chart */}
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>Revenue by Payment Method</h3>
            {paymentMethodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={paymentMethodData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="method" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `₦${value.toLocaleString()}`} />
                  <Legend />
                  <Bar dataKey="amount" fill="#10b981" name="Amount" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No data available</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

