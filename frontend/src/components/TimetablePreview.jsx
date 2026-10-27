import styles from './TimetableUploader.module.css';

export default function TimetablePreview({ preview, onConfirm, onCancel, loading, strategy }) {
  const { slots = [], warnings = [], conflicts = [] } = preview || {};
  const previewRows = slots.slice(0, 50);
  const remainingCount = slots.length - previewRows.length;

  return (
    <div className={styles.previewBox}>
      <div className={styles.previewHeader}>
        <div>
          <h3 className={styles.previewTitle}>Preview</h3>
          <p className={styles.previewSubtitle}>
            {slots.length} slots • Strategy: {strategy === 'replace' ? 'Replace' : 'Merge'}
          </p>
        </div>
        <div className={styles.previewActions}>
          <button className={styles.cancelBtn} type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className={styles.confirmBtn} type="button" onClick={onConfirm} disabled={loading}>
            {loading ? 'Applying…' : 'Confirm Upload'}
          </button>
        </div>
      </div>

      {(warnings.length > 0 || conflicts.length > 0) && (
        <div className={styles.noticeGrid}>
          {warnings.length > 0 && (
            <div className={styles.noticeBox}>
              <div className={styles.noticeTitle}>Warnings ({warnings.length})</div>
              <ul className={styles.noticeList}>
                {warnings.slice(0, 6).map((warning, idx) => (
                  <li key={`warn-${idx}`}>{warning}</li>
                ))}
                {warnings.length > 6 && <li>+ {warnings.length - 6} more</li>}
              </ul>
            </div>
          )}
          {conflicts.length > 0 && (
            <div className={`${styles.noticeBox} ${styles.noticeDanger}`}>
              <div className={styles.noticeTitle}>Conflicts ({conflicts.length})</div>
              <ul className={styles.noticeList}>
                {conflicts.slice(0, 6).map((conflict, idx) => (
                  <li key={`conf-${idx}`}>Row {conflict.index}: {conflict.reason}</li>
                ))}
                {conflicts.length > 6 && <li>+ {conflicts.length - 6} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className={styles.tableWrapper}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th>Day</th>
              <th>Time</th>
              <th>Subject</th>
              <th>Faculty</th>
              <th>Room</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((slot, idx) => (
              <tr key={`${slot.day}-${slot.time}-${idx}`}>
                <td>{slot.day}</td>
                <td>{slot.time}</td>
                <td>{slot.subjectLabel || slot.subjectId || '—'}</td>
                <td>{slot.facultyLabel || slot.facultyId || '—'}</td>
                <td>{slot.roomLabel || slot.roomId || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {remainingCount > 0 && (
          <div className={styles.previewFooter}>Showing 50 rows. {remainingCount} more not shown.</div>
        )}
      </div>
    </div>
  );
}
