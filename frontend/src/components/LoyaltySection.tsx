import { useState } from 'react';
import { format } from 'date-fns';
import { Plus, Minus, Gift, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import LoyaltyBadge, { LoyaltyProgress } from './LoyaltyBadge';
import Button from './Button';
import toast from 'react-hot-toast';

interface LoyaltyTransaction {
  id: string;
  transactionType: string;
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  reservationId?: string;
  metadata?: any;
  createdAt: Date;
}

interface LoyaltySectionProps {
  currentPoints: number;
  loyaltyTier: string;
  transactions: LoyaltyTransaction[];
  onAwardPoints: (points: number, description: string) => Promise<void>;
}

export default function LoyaltySection({ currentPoints, loyaltyTier, transactions, onAwardPoints }: LoyaltySectionProps) {
  const [showPointsForm, setShowPointsForm] = useState(false);
  const [pointsAmount, setPointsAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tierThresholds: Record<string, { next?: string; threshold?: number }> = {
    bronze: { next: 'silver', threshold: 100 },
    silver: { next: 'gold', threshold: 500 },
    gold: { next: 'platinum', threshold: 1000 },
    platinum: { next: 'vip', threshold: 5000 },
    vip: {},
  };

  const handleSubmitPoints = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const points = parseInt(pointsAmount);
    if (isNaN(points) || points === 0) {
      toast.error('Please enter a valid points amount');
      return;
    }

    if (!description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAwardPoints(points, description);
      toast.success(points > 0 ? 'Points awarded!' : 'Points redeemed!');
      setPointsAmount('');
      setDescription('');
      setShowPointsForm(false);
    } catch (error) {
      toast.error('Failed to process points');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      {/* Current Status */}
      <div style={{
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: '#1e293b' }}>
            Loyalty Status
          </h3>
          <LoyaltyBadge tier={loyaltyTier as any} size="lg" />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 0',
          borderTop: '1px solid #e2e8f0',
          borderBottom: '1px solid #e2e8f0',
          margin: '1rem 0',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: '700', color: '#1e293b', lineHeight: 1 }}>
              {currentPoints.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem', fontWeight: '500' }}>
              LOYALTY POINTS
            </div>
          </div>
        </div>

        {/* Progress to Next Tier */}
        <LoyaltyProgress
          currentPoints={currentPoints}
          currentTier={loyaltyTier}
          nextTier={tierThresholds[loyaltyTier].next}
          nextTierThreshold={tierThresholds[loyaltyTier].threshold}
        />
      </div>

      {/* Award/Redeem Points */}
      <div style={{ marginBottom: '1.5rem' }}>
        {!showPointsForm ? (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button 
              onClick={() => setShowPointsForm(true)}
              style={{ flex: 1 }}
            >
              <Plus size={16} />
              Award Points
            </Button>
            <Button 
              onClick={() => {
                setPointsAmount('-');
                setShowPointsForm(true);
              }}
              variant="secondary"
              style={{ flex: 1 }}
            >
              <Minus size={16} />
              Redeem Points
            </Button>
          </div>
        ) : (
          <div style={{
            backgroundColor: '#f8fafc',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}>
            <form onSubmit={handleSubmitPoints}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Points Amount
                </label>
                <input
                  type="number"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  placeholder={pointsAmount.startsWith('-') ? 'Enter negative value to redeem' : 'Enter positive value to award'}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Reason for points adjustment"
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setShowPointsForm(false);
                    setPointsAmount('');
                    setDescription('');
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Confirm'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Transactions History */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1e293b' }}>
          Transaction History
        </h3>
        
        {transactions.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '2rem 1rem', 
            color: '#94a3b8',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
          }}>
            <Gift size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p style={{ fontSize: '0.875rem' }}>No transactions yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {transactions.map((transaction) => {
              const isEarned = transaction.transactionType === 'earned';
              const isRedeemed = transaction.transactionType === 'redeemed';
              const Icon = isEarned ? TrendingUp : isRedeemed ? TrendingDown : Clock;
              const color = isEarned ? '#10b981' : isRedeemed ? '#ef4444' : '#64748b';

              return (
                <div
                  key={transaction.id}
                  style={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <div
                      style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        backgroundColor: `${color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.9375rem', fontWeight: '500', color: '#1e293b', marginBottom: '0.125rem' }}>
                        {transaction.description}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {format(new Date(transaction.createdAt), 'MMM d, yyyy HH:mm')}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '1.125rem',
                        fontWeight: '700',
                        color,
                      }}
                    >
                      {transaction.points > 0 ? '+' : ''}{transaction.points.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Balance: {transaction.balanceAfter.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

