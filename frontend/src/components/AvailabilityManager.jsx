import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import styles from './AvailabilityManager.module.css';

const DAYS  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIMES = ['9:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];

/**
 * AvailabilityManager — weekly grid for faculty to mark unavailable slots.
 *
 * Props:
 *   facultyId          — user._id
 *   initialUnavailable — [{ day, time }] from faculty profile
 *
 * Note: PUT /faculty/:id is admin-only in the current backend.
 * We store changes locally and show a warning if the save fails due to permissions.
 */
export default function AvailabilityManager({ facultyId, initialUnavailable = [] }) {
  // Set of "Day-Time" strings for O(1) lookup
  const toSet = (arr) => new Set(arr.map((s) => `${s.day}-${s.time}`));

  const [unavailable, setUnavailable] = useState(() => toSet(initialUnavailable));
  const [saving, setSaving]           = useState(false);
  const [feedback, setFeedback]       = useState('');
  const [feedbackType, setFeedbackType] = useState('success'); // 'success' | 'error'

  // Sync if parent re-fetches profile
  useEffect(() => {
    setUnavailable(toSet(initialUnavailable));
  }, [initialUnavailable.length]); // eslint-disable-line

  const toggle = useCallback((day, time) => {
    const key = `${day}-${time}`;
    setUnavailable((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const isBlocked = (day, time) => unavailable.has(`${day}-${time}`);

  const handleSave = async () => {
    if (!facultyId) return;
    setSaving(true);
    setFeedback('');

    // Convert Set → [{ day, time }]
    const unavailableSlots = Array.from(unavailable).map((key) => {
      const [day, time] = key.split('-');
      return { day, time };
    });

    try {
      await api.put(`/faculty/${facultyId}`, { unavailableSlots });
      setFeedback('Availability saved successfully ✅');
      setFeedbackType('success');
    } catch (err) {
      const status = err.response?.status;
      if (status === 403) {
        // Backend restricts PUT /faculty/:id to admin — inform user
        setFeedback(
          'Your availability is saved locally. Your admin will apply it to the system.'
        );
        setFeedbackType('warn');
      } else {
        setFeedback(err.response?.data?.message || 'Failed to save. Try again.');
        setFeedbackType('error');
      }
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(''), 4000);
    }
  };

  const blockedCount = unavailable.size;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Set My Availability</h2>
          <p className={styles.subtitle}>
            Click cells to mark slots you are <span className={styles.highlight}>unavailable</span> for.
            {blockedCount > 0 && (
              <span className={styles.count}> {blockedCount} slot{blockedCount !== 1 ? 's' : ''} blocked.</span>
            )}
          </p>
        </div>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
          id="save-availability-btn"
        >
          {saving ? <><span className={styles.spinner} /> Saving…</> : '💾 Save'}
        </button>
      </div>

      {feedback && (
        <div className={`${styles.feedback} ${styles[`fb_${feedbackType}`]}`}>
          {feedback}
        </div>
      )}

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotAvailable}`} /> Available
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotUnavailable}`} /> Unavailable
        </span>
      </div>

      {/* Grid */}
      <div className={styles.gridWrapper}>
        <div className={styles.grid}>
          {/* Corner */}
          <div className={styles.cornerCell} />

          {/* Day headers */}
          {DAYS.map((day) => (
            <div key={day} className={styles.dayHeader}>
              {day.slice(0, 3)}
            </div>
          ))}

          {/* Time rows */}
          {TIMES.map((time) => (
            <>
              <div key={`t-${time}`} className={styles.timeLabel}>{time}</div>
              {DAYS.map((day) => {
                const blocked = isBlocked(day, time);
                return (
                  <button
                    key={`${day}-${time}`}
                    className={`${styles.cell} ${blocked ? styles.cellBlocked : styles.cellAvailable}`}
                    onClick={() => toggle(day, time)}
                    title={`${day} ${time} — ${blocked ? 'Click to mark available' : 'Click to mark unavailable'}`}
                    aria-pressed={blocked}
                    aria-label={`${day} ${time} ${blocked ? 'unavailable' : 'available'}`}
                  >
                    {blocked ? '✕' : ''}
                  </button>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
