import { useState, useEffect } from 'react';
import api from '../api/axios';
import styles from './ClaimSlotModal.module.css';

/**
 * ClaimSlotModal
 * Props:
 *   slot         — { _id, day, time, subjectId: { name }, roomId: { roomNumber }, timetableId? }
 *   timetableId  — fallback timetableId if not on slot object
 *   onClose      — close the modal
 *   onClaimed    — called after successful claim (re-fetch parent timetable)
 *
 * Auto-dismisses after 30 seconds.
 * Does NOT close on claim failure — lets faculty retry or dismiss.
 */
export default function ClaimSlotModal({ slot, timetableId, onClose, onClaimed }) {
  const [claiming, setClaiming] = useState(false);
  const [error, setError]       = useState('');
  const [countdown, setCountdown] = useState(30);

  // Auto-dismiss timer — 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onClose]);

  if (!slot) return null;

  const subjectName  = slot.subjectId?.name     || slot.subject?.name || 'Unknown Subject';
  const roomNumber   = slot.roomId?.roomNumber  || slot.room?.roomNumber || 'Unknown Room';
  const ttId         = slot.timetableId         || timetableId;

  const handleClaim = async () => {
    if (!ttId || !slot._id) {
      setError('Slot data is incomplete. Cannot claim.');
      return;
    }
    setClaiming(true);
    setError('');
    try {
      const res = await api.post('/timetable/claim-slot', {
        timetableId: ttId,
        slotId: slot._id,
      });
      if (res.data?.success) {
        onClaimed();
        onClose();
      } else {
        // Race condition — another faculty claimed it first
        setError(res.data?.message || 'This slot was already claimed by another faculty.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (err.response?.status === 409 || msg.toLowerCase().includes('conflict')) {
        setError('This slot was already claimed by another faculty.');
      } else {
        setError('Failed to claim slot. Try again.');
      }
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Claim open slot">
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.headerIcon}>🔓</span>
          <div>
            <h2 className={styles.title}>Open Slot Available</h2>
            <p className={styles.headerSub}>
              Auto-dismisses in <strong className={styles.countdown}>{countdown}s</strong>
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Dismiss">×</button>
        </div>

        {/* Slot details */}
        <div className={styles.slotDetails}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Subject</span>
            <span className={styles.detailValue}>{subjectName}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Day</span>
            <span className={styles.detailValue}>{slot.day}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Time</span>
            <span className={styles.detailValue}>{slot.time}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Room</span>
            <span className={styles.detailValue}>{roomNumber}</span>
          </div>
        </div>

        {/* Error message — stays visible so faculty can retry */}
        {error && (
          <div className={styles.errorBox} role="alert">
            ⚠️ {error}
          </div>
        )}

        {/* Progress bar showing countdown */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(countdown / 30) * 100}%` }}
          />
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button className={styles.dismissBtn} onClick={onClose} disabled={claiming}>
            Dismiss
          </button>
          <button
            className={styles.claimBtn}
            onClick={handleClaim}
            disabled={claiming}
            id="claim-slot-btn"
          >
            {claiming ? (
              <><span className={styles.spinner} /> Claiming…</>
            ) : (
              '⚡ Claim Slot'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
