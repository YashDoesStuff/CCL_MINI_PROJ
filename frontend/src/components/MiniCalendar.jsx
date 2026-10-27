import { useState } from 'react';
import styles from './MiniCalendar.module.css';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MiniCalendar() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today.getDate());

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay   = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const isToday = (d) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const cells = [];
  // Leading blanks
  for (let i = 0; i < firstDay; i++) cells.push(null);
  // Days
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className={styles.cal}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={prevMonth}>‹</button>
        <span className={styles.monthLabel}>{MONTHS[month]} {year}</span>
        <button className={styles.navBtn} onClick={nextMonth}>›</button>
      </div>

      {/* Day headers */}
      <div className={styles.grid}>
        {DAYS.map((d) => (
          <div key={d} className={styles.dayName}>{d}</div>
        ))}
        {/* Cells */}
        {cells.map((d, i) => (
          <button
            key={i}
            className={[
              styles.cell,
              d === null ? styles.blank : '',
              d && isToday(d) ? styles.today : '',
              d && selected === d &&
              month === today.getMonth() &&
              year === today.getFullYear()
                ? styles.selected
                : '',
            ].join(' ')}
            onClick={() => d && setSelected(d)}
            disabled={!d}
          >
            {d || ''}
          </button>
        ))}
      </div>
    </div>
  );
}
