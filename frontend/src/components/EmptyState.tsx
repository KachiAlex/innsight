import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '3rem 1.5rem',
      color: '#64748b',
    }}>
      <Icon
        size={64}
        style={{
          margin: '0 auto 1rem',
          opacity: 0.5,
          color: '#94a3b8',
        }}
      />
      <h3 style={{
        margin: '0 0 0.5rem',
        color: '#1e293b',
        fontSize: '1.25rem',
        fontWeight: '600',
      }}>
        {title}
      </h3>
      {description && (
        <p style={{
          margin: '0 0 1.5rem',
          color: '#64748b',
          fontSize: '0.875rem',
          maxWidth: '400px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#2563eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#3b82f6';
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

