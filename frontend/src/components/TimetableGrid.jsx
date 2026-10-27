import { useState, useEffect } from 'react';
import { normalizeName } from '../utils/normalizeName';
import styles from './TimetableGrid.module.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_COLS = [
  { id: 't1', label: '08:45 – 09:45', type: 'slot', time: '8:45' },
  { id: 't2', label: '09:45 – 10:45', type: 'slot', time: '9:45' },
  { id: 'sb', label: '10:45 – 11:00', type: 'break', title: 'Short Break' },
  { id: 't3', label: '11:00 – 12:00', type: 'slot', time: '11:00' },
  { id: 't4', label: '12:00 – 13:00', type: 'slot', time: '12:00' },
  { id: 'lb', label: '13:00 – 13:30', type: 'break', title: 'Long Break' },
  { id: 't5', label: '13:30 – 14:30', type: 'slot', time: '13:30' },
  { id: 't6', label: '14:30 – 15:30', type: 'slot', time: '14:30' },
  { id: 't7', label: '15:30 – 16:30', type: 'slot', time: '15:30' },
  { id: 't8', label: '16:30 – 17:30', type: 'slot', time: '16:30' },
];

const SLOT_TIMES = TIME_COLS.filter((c) => c.type === 'slot').map((c) => c.time);

export default function TimetableGrid({
  slots = [],
  onSlotClick,
  role = 'student',
  myFacultyId = null,   // Faculty._id (not User._id)
  userName = '',        // Fallback user name
  isEditing = false,
  isCancelMode = false,  // highlights only own slots for cancellation
  selectedSlotId = null,
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const today = new Date().getDay(); // 0=Sun
    if (today >= 1 && today <= 6) setCurrentDayIndex(today - 1);
  }, []);

  const handlePrevDay = () => setCurrentDayIndex((p) => (p > 0 ? p - 1 : DAYS.length - 1));
  const handleNextDay = () => setCurrentDayIndex((p) => (p < DAYS.length - 1 ? p + 1 : 0));

  // Build lookup: "Day-time" → slot
  const slotMap = {};
  slots.forEach((slot) => {
    const key = `${slot.day}-${slot.time.replace(/\s+/g, '')}`;
    // Prefer the most recently updated if duplicates exist
    if (!slotMap[key] || (slot.lastUpdatedAt > (slotMap[key].lastUpdatedAt || 0))) {
      slotMap[key] = slot;
    }
  });

  const isMySlot = (slot) => {
    if (!slot) return false;
    
    // 1. Check ID match
    if (myFacultyId) {
      const fId = slot.facultyId?._id || slot.facultyId;
      if (String(fId) === String(myFacultyId)) return true;
    }

    // 2. Check Name match fallback
    const facultyName = slot.facultyId?.name;
    if (userName && facultyName) {
      const myClean = normalizeName(userName).toLowerCase().trim();
      const slotClean = normalizeName(facultyName).toLowerCase().trim();
      if (myClean === slotClean) return true;
    }

    return false;
  };

  const isClickable = (slot) => {
    if (role !== 'faculty' || !isEditing) return false;
    if (!slot) return !isCancelMode; // free cell — clickable in Add mode, not Cancel mode
    if (isCancelMode) return isMySlot(slot) && slot.status === 'scheduled';
    // In Add mode: open slots are claimable, own scheduled slots are not targeted
    return slot.status === 'open';
  };

  const getCellClass = (slot) => {
    const classes = [styles.gridCellContent];

    if (!slot) {
      classes.push(styles.cellFree);
    } else if (slot.status === 'cancelled') {
      classes.push(styles.cellCancelled);
    } else if (slot.status === 'open') {
      // Students see open (cancelled-by-faculty) slots as a neutral free period
      if (role === 'student') {
        classes.push(styles.cellFreeLecture);
      } else {
        classes.push(styles.cellOpen);
      }
    } else {
      // scheduled
      if (role === 'faculty' && isMySlot(slot)) {
        classes.push(styles.cellMine);
      } else {
        classes.push(styles.cellOther);
      }
    }

    if (isEditing && slot && selectedSlotId === slot._id) {
      classes.push(styles.cellSelected);
    }

    if (isEditing && isClickable(slot)) {
      classes.push(styles.cellClickable);
    }

    return classes.join(' ');
  };

  const renderSlotCard = (slot, day, time) => {
    if (!slot) {
      // Free / empty slot
      return (
        <div className={styles.freeSlot}>
          <span className={styles.freeLabel}>Free</span>
          {isEditing && role === 'faculty' && (
            <span className={styles.addHint}>+ Extra Lecture</span>
          )}
        </div>
      );
    }

    // Students see open (faculty-cancelled) slots as a simple free period
    if (role === 'student' && slot.status === 'open') {
      return (
        <div className={styles.freeSlot}>
          <span className={styles.freeLectureLabel}>Free Lecture</span>
        </div>
      );
    }

    const subjectName = slot.subjectId?.name || (slot.status === 'open' ? 'Open Slot' : 'Extra Lecture');
    const facultyName = normalizeName(slot.facultyId?.name || '');
    const roomNum = slot.roomId?.roomNumber || '';

    return (
      <div className={styles.slotCard}>
        <div className={styles.slotSubject}>{subjectName}</div>
        {slot.status === 'open' ? (
          <div className={styles.slotOpenLabel}>🟡 Open / Claimable</div>
        ) : facultyName ? (
          <div className={styles.slotFaculty}>{facultyName}</div>
        ) : (
          <div className={styles.slotUnassigned}>Unassigned</div>
        )}
        {roomNum && <div className={styles.slotRoom}>{roomNum}</div>}
      </div>
    );
  };

  const currentDayName = DAYS[currentDayIndex];

  // ── Mobile ──────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.mobileControls}>
          <button className={styles.arrowBtn} onClick={handlePrevDay}>←</button>
          <div className={styles.datePickerWrapper}>
            <button className={styles.calendarBtn} onClick={() => setShowDatePicker(!showDatePicker)}>
              📅 {currentDayName}
            </button>
            {showDatePicker && (
              <div className={styles.datePickerMenu}>
                {DAYS.map((d, i) => (
                  <button
                    key={d}
                    className={styles.datePickerItem}
                    onClick={() => { setCurrentDayIndex(i); setShowDatePicker(false); }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={styles.arrowBtn} onClick={handleNextDay}>→</button>
        </div>

        <div className={styles.mobileList}>
          {TIME_COLS.map((col, idx) => {
            if (col.type === 'break') {
              return (
                <div key={idx} className={`${styles.mobileRow} ${styles.mobileBreakRow}`}>
                  <div className={styles.mobileTimeLabel}>{col.label}</div>
                  <div className={styles.mobileBreakCell}>{col.title}</div>
                </div>
              );
            }

            const key = `${currentDayName}-${col.time}`;
            const slot = slotMap[key];
            const clickable = isClickable(slot);

            return (
              <div key={idx} className={styles.mobileRow}>
                <div className={styles.mobileTimeLabel}>{col.label}</div>
                <div
                  className={`${styles.mobileCell} ${getCellClass(slot)}`}
                  onClick={() => clickable && onSlotClick && onSlotClick(slot, currentDayName, col.time)}
                  style={{ cursor: clickable ? 'pointer' : 'default' }}
                >
                  {renderSlotCard(slot, currentDayName, col.time)}
                </div>
              </div>
            );
          })}
        </div>
        <Legend role={role} />
      </div>
    );
  }

  // ── Desktop ──────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      <div className={styles.desktopGridContainer}>
        <table className={styles.desktopGrid}>
          <thead>
            <tr>
              <th className={styles.gridCorner}>Day / Time</th>
              {TIME_COLS.map((col, idx) => (
                <th key={idx} className={col.type === 'break' ? styles.gridThBreak : styles.gridTh}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day) => (
              <tr key={day}>
                <td className={styles.gridDayLabel}>{day}</td>
                {TIME_COLS.map((col, idx) => {
                  if (col.type === 'break') {
                    if (day === 'Monday') {
                      return (
                        <td key={idx} rowSpan={DAYS.length} className={styles.gridBreakCell}>
                          <div className={styles.breakTextVertical}>{col.title}</div>
                        </td>
                      );
                    }
                    return null;
                  }

                  const key = `${day}-${col.time}`;
                  const slot = slotMap[key];
                  const clickable = isClickable(slot);

                  return (
                    <td key={idx} className={styles.gridTd}>
                      <div
                        className={getCellClass(slot)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (clickable && onSlotClick) onSlotClick(slot, day, col.time);
                        }}
                        style={{ cursor: clickable ? 'pointer' : 'default' }}
                      >
                        {renderSlotCard(slot, day, col.time)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Legend role={role} />
    </div>
  );
}

function Legend({ role }) {
  return (
    <div className={styles.legend}>
      {role === 'faculty' && (
        <div className={styles.legendItem}>
          <div className={`${styles.legendBox} ${styles.cellMine}`} />
          <span>Your Lecture</span>
        </div>
      )}
      <div className={styles.legendItem}>
        <div className={`${styles.legendBox} ${styles.cellOther}`} />
        <span>Scheduled</span>
      </div>
      {role !== 'student' && (
        <div className={styles.legendItem}>
          <div className={`${styles.legendBox} ${styles.cellOpen}`} />
          <span>Open / Claimable</span>
        </div>
      )}
      {role === 'student' && (
        <div className={styles.legendItem}>
          <div className={`${styles.legendBox} ${styles.cellFreeLecture}`} />
          <span>Free Lecture</span>
        </div>
      )}
      <div className={styles.legendItem}>
        <div className={`${styles.legendBox} ${styles.cellFree}`} />
        <span>Free</span>
      </div>
    </div>
  );
}
