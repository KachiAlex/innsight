import { format } from 'date-fns';
import { 
  LogIn, LogOut, Calendar, X, CreditCard, MessageSquare, 
  Gift, Award, AlertCircle, FileText, User 
} from 'lucide-react';

interface Activity {
  id: string;
  activityType: string;
  title: string;
  description?: string;
  metadata?: any;
  performedBy?: string;
  createdAt: Date;
}

interface ActivityTimelineProps {
  activities: Activity[];
}

const activityIcons: Record<string, any> = {
  check_in: LogIn,
  check_out: LogOut,
  reservation: Calendar,
  cancellation: X,
  payment: CreditCard,
  complaint: AlertCircle,
  request: MessageSquare,
  note: FileText,
  loyalty_earned: Gift,
  loyalty_redeemed: Award,
  profile_created: User,
  profile_updated: User,
};

const activityColors: Record<string, string> = {
  check_in: '#10b981',
  check_out: '#64748b',
  reservation: '#3b82f6',
  cancellation: '#ef4444',
  payment: '#10b981',
  complaint: '#ef4444',
  request: '#f59e0b',
  note: '#6366f1',
  loyalty_earned: '#9333ea',
  loyalty_redeemed: '#ec4899',
  profile_created: '#06b6d4',
  profile_updated: '#64748b',
};

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem 1rem', 
        color: '#94a3b8' 
      }}>
        <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
        <p style={{ fontSize: '1rem', fontWeight: '500' }}>No activity yet</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>Guest activities will appear here</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      {activities.map((activity, index) => {
        const Icon = activityIcons[activity.activityType] || FileText;
        const color = activityColors[activity.activityType] || '#64748b';
        const isLast = index === activities.length - 1;

        return (
          <div 
            key={activity.id} 
            style={{ 
              display: 'flex', 
              gap: '1rem',
              position: 'relative',
              paddingBottom: isLast ? 0 : '1.5rem',
            }}
          >
            {/* Timeline line */}
            {!isLast && (
              <div 
                style={{
                  position: 'absolute',
                  left: '1.125rem',
                  top: '2.5rem',
                  bottom: 0,
                  width: '2px',
                  backgroundColor: '#e2e8f0',
                }}
              />
            )}

            {/* Icon */}
            <div 
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                backgroundColor: `${color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <Icon size={18} style={{ color }} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, paddingTop: '0.25rem' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '0.25rem',
              }}>
                <h4 style={{ 
                  margin: 0, 
                  fontSize: '0.9375rem', 
                  fontWeight: '600',
                  color: '#1e293b',
                }}>
                  {activity.title}
                </h4>
                <span style={{ 
                  fontSize: '0.75rem', 
                  color: '#94a3b8',
                  whiteSpace: 'nowrap',
                  marginLeft: '1rem',
                }}>
                  {format(new Date(activity.createdAt), 'MMM d, yyyy HH:mm')}
                </span>
              </div>

              {activity.description && (
                <p style={{ 
                  margin: '0.25rem 0 0', 
                  fontSize: '0.875rem', 
                  color: '#64748b',
                  lineHeight: '1.5',
                }}>
                  {activity.description}
                </p>
              )}

              {/* Metadata badges */}
              {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.5rem', 
                  marginTop: '0.5rem' 
                }}>
                  {Object.entries(activity.metadata)
                    .filter(([key]) => !['migration', 'updatedBy', 'createdBy'].includes(key))
                    .map(([key, value]) => (
                      <span
                        key={key}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          borderRadius: '4px',
                          fontWeight: '500',
                        }}
                      >
                        {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

