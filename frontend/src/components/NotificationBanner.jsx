import { useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import styles from './NotificationBanner.module.css';

/**
 * NotificationBanner — toast stack at top-right corner
 * Reads notifications from SocketContext.
 * Each toast: message + Copy + WhatsApp + ✕ + auto-dismiss 5s
 */
export default function NotificationBanner() {
  const { notifications, clearNotification } = useSocket() || {};
  const timersRef = useRef({});

  // Auto-dismiss each notification after 5 seconds
  useEffect(() => {
    if (!notifications) return;
    notifications.forEach(({ id }) => {
      if (!timersRef.current[id]) {
        timersRef.current[id] = setTimeout(() => {
          clearNotification && clearNotification(id);
          delete timersRef.current[id];
        }, 5000);
      }
    });
  }, [notifications, clearNotification]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  if (!notifications || notifications.length === 0) return null;

  const handleCopy = (message) => {
    navigator.clipboard.writeText(message).catch(() => {});
  };

  const handleWhatsApp = (message) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className={styles.container} role="region" aria-label="Notifications">
      {notifications.map(({ id, message }) => (
        <div key={id} className={styles.toast}>
          <div className={styles.toastHeader}>
            <span className={styles.toastIcon}>🔔</span>
            <span className={styles.toastTitle}>Notification</span>
            <button
              className={styles.closeBtn}
              onClick={() => clearNotification(id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
          <p className={styles.message}>{message}</p>
          <div className={styles.actions}>
            <button
              className={styles.actionBtn}
              onClick={() => handleCopy(message)}
              title="Copy to clipboard"
            >
              📋 Copy
            </button>
            <button
              className={styles.whatsappBtn}
              onClick={() => handleWhatsApp(message)}
              title="Share via WhatsApp"
            >
              💬 WhatsApp
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
