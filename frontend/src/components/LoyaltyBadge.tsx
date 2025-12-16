import { Crown, Award, Medal, Star } from 'lucide-react';

interface LoyaltyBadgeProps {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const tierConfig = {
  bronze: {
    color: '#cd7f32',
    bgColor: '#fdf6ed',
    label: 'Bronze',
    Icon: Medal,
  },
  silver: {
    color: '#c0c0c0',
    bgColor: '#f5f5f5',
    label: 'Silver',
    Icon: Medal,
  },
  gold: {
    color: '#ffd700',
    bgColor: '#fffbeb',
    label: 'Gold',
    Icon: Award,
  },
  platinum: {
    color: '#e5e4e2',
    bgColor: '#f8fafc',
    label: 'Platinum',
    Icon: Star,
  },
  vip: {
    color: '#9333ea',
    bgColor: '#faf5ff',
    label: 'VIP',
    Icon: Crown,
  },
};

const sizeConfig = {
  sm: { icon: 14, padding: '0.25rem 0.5rem', fontSize: '0.75rem' },
  md: { icon: 16, padding: '0.375rem 0.75rem', fontSize: '0.875rem' },
  lg: { icon: 20, padding: '0.5rem 1rem', fontSize: '1rem' },
};

export default function LoyaltyBadge({ tier, size = 'md', showLabel = true }: LoyaltyBadgeProps) {
  const config = tierConfig[tier];
  const sizeStyle = sizeConfig[size];
  const Icon = config.Icon;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: sizeStyle.padding,
        backgroundColor: config.bgColor,
        color: config.color,
        borderRadius: '6px',
        fontSize: sizeStyle.fontSize,
        fontWeight: '600',
        border: `1px solid ${config.color}20`,
      }}
    >
      <Icon size={sizeStyle.icon} style={{ flexShrink: 0 }} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

// Progress bar showing progress to next tier
interface LoyaltyProgressProps {
  currentPoints: number;
  currentTier: string;
  nextTier?: string;
  nextTierThreshold?: number;
}

export function LoyaltyProgress({ currentPoints, currentTier, nextTier, nextTierThreshold }: LoyaltyProgressProps) {
  if (!nextTier || !nextTierThreshold) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
        <Crown size={24} style={{ marginBottom: '0.5rem', color: '#9333ea' }} />
        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>Maximum Tier Achieved!</div>
      </div>
    );
  }

  const tierThresholds: Record<string, number> = {
    bronze: 0,
    silver: 100,
    gold: 500,
    platinum: 1000,
    vip: 5000,
  };

  const currentThreshold = tierThresholds[currentTier] || 0;
  const pointsInTier = currentPoints - currentThreshold;
  const pointsNeeded = nextTierThreshold - currentThreshold;
  const progress = Math.min((pointsInTier / pointsNeeded) * 100, 100);

  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
        <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>{currentTier}</span>
        <span style={{ fontWeight: '600', textTransform: 'capitalize' }}>{nextTier}</span>
      </div>
      <div style={{ 
        width: '100%', 
        height: '8px', 
        backgroundColor: '#e2e8f0', 
        borderRadius: '999px',
        overflow: 'hidden',
        marginBottom: '0.5rem',
      }}>
        <div 
          style={{ 
            width: `${progress}%`, 
            height: '100%', 
            backgroundColor: tierConfig[currentTier as keyof typeof tierConfig]?.color || '#3b82f6',
            transition: 'width 0.3s ease',
          }} 
        />
      </div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
        {Math.round(nextTierThreshold - currentPoints)} points to {nextTier}
      </div>
    </div>
  );
}

