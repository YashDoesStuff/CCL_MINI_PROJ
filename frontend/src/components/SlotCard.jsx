import { useAuth } from '../context/AuthContext';
import styles from './SlotCard.module.css';

const STATUS_LABELS = {
  scheduled: 'Scheduled',
  cancelled: 'Cancelled',
  open: 'Open',
};

/**
 * SlotCard — reusable slot display (Person 4 also uses this)
 *
 * Props:
 *   slot      — slot object (populated: subjectId, facultyId, roomId objects)
 *   role      — "admin" | "faculty" | "student"
 *   onCancel  — callback(slot) when cancel button clicked
 *   draggable — boolean, shows drag handle when true
 */
export default function SlotCard({ slot, role, onCancel, draggable = false }) {
  const { user } = useAuth();

  if (!slot) return null;

  // Backend returns populated objects or null
  const subjectName = slot.subjectId?.name || '—';
  const facultyName = slot.facultyId?.name || '—';
  const roomNumber  = slot.roomId?.roomNumber || '—';
  const facultyId   = slot.facultyId?._id || slot.facultyId;

  // Format lastUpdatedAt
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  };

  // Cancel button visibility
  const showCancel =
    role === 'admin' ||
    (role === 'faculty' && user?.id && facultyId?.toString() === user.id?.toString());

  return (
    <div className={`${styles.card} ${styles[`status_${slot.status}`]}`}>
      {draggable && <span className={styles.dragHandle} title="Drag to move">⠿</span>}

      <div className={styles.header}>
        <span className={`${styles.badge} ${styles[`badge_${slot.status}`]}`}>
          {STATUS_LABELS[slot.status] || slot.status}
        </span>
      </div>

      <div className={styles.subject}>{subjectName}</div>

      <div className={styles.meta}>
        <span>👤 {facultyName}</span>
        <span>🏫 {roomNumber}</span>
      </div>

      {slot.lastUpdatedAt && (
        <div className={styles.updated}>
          Updated: {formatDate(slot.lastUpdatedAt)}
        </div>
      )}

      {showCancel && slot.status === 'scheduled' && (
        <button
          className={styles.cancelBtn}
          onClick={(e) => {
            e.stopPropagation();
            onCancel && onCancel(slot);
          }}
        >
          Cancel
        </button>
      )}
    </div>
  );
}
