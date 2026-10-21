import StatusBadge from './StatusBadge';
import styles from './RoomTile.module.css';

interface RoomTileProps {
  number: string;
  category?: string;
  floor?: string | number;
  /** Occupancy state — shown separately from housekeeping per blueprint */
  occupancyStatus?: string;
  housekeepingStatus?: string;
  /** Guest name when occupied */
  guestName?: string;
  /** Nightly rate for the room */
  rate?: string;
  onClick?: () => void;
  selected?: boolean;
}

/**
 * Room board tile. Occupancy and housekeeping are separate signals —
 * a room can be occupied AND dirty; never collapse into one label.
 */
export default function RoomTile({
  number,
  category,
  floor,
  occupancyStatus,
  housekeepingStatus,
  guestName,
  rate,
  onClick,
  selected,
}: RoomTileProps) {
  return (
    <button
      type="button"
      className={`${styles.tile} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className={styles.head}>
        <strong className={styles.number}>{number}</strong>
        {occupancyStatus && <StatusBadge status={occupancyStatus} dot={false} />}
      </div>
      {category && (
        <span className={styles.category}>
          {category}
          {floor != null && ` · F${floor}`}
        </span>
      )}
      {guestName && <span className={styles.guest}>{guestName}</span>}
      <div className={styles.foot}>
        {housekeepingStatus && <StatusBadge status={housekeepingStatus} />}
        {rate && <span className={styles.rate}>{rate}</span>}
      </div>
    </button>
  );
}
