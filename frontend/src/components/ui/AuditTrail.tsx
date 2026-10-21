import Timeline, { TimelineEvent } from './Timeline';
import EmptyState from './EmptyState';

export interface AuditEntry {
  id: string | number;
  action: string;
  actor?: string;
  timestamp: string | Date;
  detail?: string;
}

interface AuditTrailProps {
  entries: AuditEntry[];
  loading?: boolean;
}

const toEvent = (entry: AuditEntry): TimelineEvent => ({
  id: entry.id,
  title: entry.action,
  description: entry.detail,
  actor: entry.actor,
  timestamp:
    typeof entry.timestamp === 'string'
      ? entry.timestamp
      : entry.timestamp.toLocaleString(),
  tone: 'neutral',
});

/**
 * Read-only history view for reservations, folios, tickets and tenant actions.
 * Presentational only — backend audit records are the source of truth.
 */
export default function AuditTrail({ entries }: AuditTrailProps) {
  if (!entries.length) {
    return <EmptyState contained={false} title="No activity recorded" />;
  }
  return <Timeline events={entries.map(toEvent)} />;
}
