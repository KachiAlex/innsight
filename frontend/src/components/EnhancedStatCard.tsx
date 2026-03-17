import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface EnhancedStatCardProps {
  icon: React.ComponentType<any>;
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentChange: number;
    previousValue?: number;
  };
  sparkData?: number[];
  format?: 'currency' | 'percentage' | 'number';
  status?: 'good' | 'warning' | 'critical' | 'neutral';
}

/**
 * Enhanced StatCard with trends, sparklines, and status indicators
 * Designed for dashboard optimization - Phase 1
 */
export const EnhancedStatCard: React.FC<EnhancedStatCardProps> = ({
  icon: Icon,
  title,
  value,
  subtitle,
  color,
  trend,
  sparkData,
  format = 'number',
  status = 'neutral',
}) => {
  // Determine status color
  const statusColor = {
    good: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
    neutral: color,
  }[status];

  // Format value based on type
  const formatValue = (val: any) => {
    if (typeof val === 'number') {
      switch (format) {
        case 'currency':
          return `₦${val.toLocaleString()}`;
        case 'percentage':
          return `${val.toFixed(1)}%`;
        default:
          return val.toLocaleString();
      }
    }
    return val;
  };

  // Get trend icon and color
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : trend?.direction === 'down' ? TrendingDown : Minus;
  const trendColor = trend?.direction === 'up' ? '#10b981' : trend?.direction === 'down' ? '#ef4444' : '#9ca3af';
  const trendSign = trend?.direction === 'up' ? '+' : '';

  // Generate sparkline path (simplified SVG)
  const sparklineHeight = 30;
  const sparklineWidth = 60;
  const minValue = sparkData ? Math.min(...sparkData) : 0;
  const maxValue = sparkData ? Math.max(...sparkData) : 100;
  const range = maxValue - minValue || 1;

  const points = useMemo(() => {
    if (!sparkData || sparkData.length < 2) return '';
    const pointSpacing = sparklineWidth / (sparkData.length - 1);
    return sparkData
      .map((val, idx) => {
        const x = idx * pointSpacing;
        const y = sparklineHeight - ((val - minValue) / range) * sparklineHeight;
        return `${x},${y}`;
      })
      .join(' ');
  }, [sparkData, minValue, range]);

  return (
    <div
      style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: `1px solid ${statusColor}20`,
        borderLeft: `4px solid ${statusColor}`,
        transition: 'all 0.2s ease-out',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      }}
    >
      {/* Sparkline in background */}
      {sparkData && (
        <svg
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            opacity: 0.15,
            width: `${sparklineWidth}px`,
            height: `${sparklineHeight}px`,
          }}
          viewBox={`0 0 ${sparklineWidth} ${sparklineHeight}`}
        >
          {/* Background area */}
          <path
            d={`M 0,${sparklineHeight} L ${points.split(' ')[0]} L ${points} L ${sparklineWidth},${sparklineHeight}`}
            fill={`${color}10`}
          />
          {/* Line */}
          <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
        </svg>
      )}

      {/* Main content */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          {/* Title */}
          <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>
            {title}
          </div>

          {/* Value with trend */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
              {formatValue(value)}
            </div>
            
            {trend && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: trendColor,
                  padding: '0.25rem 0.5rem',
                  background: `${trendColor}10`,
                  borderRadius: '4px',
                }}
              >
                <TrendIcon size={14} />
                {trendSign}{trend.percentChange.toFixed(1)}%
              </div>
            )}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Icon badge */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '8px',
            background: `${statusColor}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: statusColor,
            flexShrink: 0,
            marginLeft: '1rem',
          }}
        >
          <Icon size={24} />
        </div>
      </div>

      {/* Status indicator dot */}
      {status !== 'neutral' && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: statusColor,
            opacity: 0.5,
          }}
        />
      )}
    </div>
  );
};

/**
 * StatCard Mini - Compact version for secondary metrics
 */
export const StatCardMini: React.FC<Omit<EnhancedStatCardProps, 'sparkData'>> = (props) => {
  const { icon: Icon, title, value, color } = props;

  return (
    <div
      style={{
        background: 'white',
        padding: '1rem',
        borderRadius: '6px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        border: `1px solid ${color}15`,
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}05`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'white';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem', fontWeight: 500 }}>
            {title}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b' }}>
            {value}
          </div>
        </div>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '6px',
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            flexShrink: 0,
          }}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
};

/**
 * KPI Grid - Container for organizing multiple stat cards
 * @param columns - Number of columns (default: responsive auto-fit)
 */
export const KPIGrid: React.FC<{ children: React.ReactNode; columns?: number }> = ({
  children,
  columns,
}) => {
  const gridTemplateColumns = columns
    ? `repeat(${columns}, 1fr)`
    : `repeat(auto-fit, minmax(280px, 1fr))`;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: '1.5rem',
        marginBottom: '2rem',
      }}
    >
      {children}
    </div>
  );
};
