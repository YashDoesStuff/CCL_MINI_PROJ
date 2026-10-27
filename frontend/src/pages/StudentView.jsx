import { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { normalizeName } from '../utils/normalizeName';
import api from '../api/axios';
import TimetableGrid from '../components/TimetableGrid';
import Layout from '../components/Layout';
import styles from './StudentView.module.css';

export default function StudentView() {
  const { user } = useContext(AuthContext);
  const { socket, joinSection } = useContext(SocketContext) || {};

  const [sections, setSections]               = useState([]);
  const [selectedYear, setSelectedYear]       = useState('');
  const [selectedSectionId, setSelectedId]    = useState('');
  const [timetable, setTimetable]             = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [error, setError]                     = useState('');
  const [updateBanner, setUpdateBanner]       = useState(false);
  const [infoMessage, setInfoMessage]         = useState('');

  // ── Derived State: Filtered Sections ─────────────────────
  const filteredSections = selectedYear
    ? sections.filter((s) => {
        if (selectedYear === 'FE') return s.semester === 1 || s.semester === 2;
        if (selectedYear === 'SE') return s.semester === 3 || s.semester === 4;
        if (selectedYear === 'TE') return s.semester === 5 || s.semester === 6;
        if (selectedYear === 'BE') return s.semester === 7 || s.semester === 8;
        return true;
      })
    : sections;

  // ── Fetch sections, then auto-select the first one ──────
  useEffect(() => {
    api.get('/sections')
      .then((r) => {
        const data = r.data?.data ?? r.data ?? [];
        setSections(data);

        // Auto-select first section so timetable loads immediately
        if (data.length > 0) {
          const firstId = data[0]._id;
          setSelectedId(firstId);
          fetchTimetable(firstId);
          // Join socket room for live updates
          if (joinSection) joinSection(firstId);
        }
      })
      .catch(() => setError('Failed to load sections.'))
      .finally(() => setSectionsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch timetable for selected section ────────────────
  const fetchTimetable = useCallback(async (sectionId) => {
    if (!sectionId) return;
    setLoading(true);
    setError('');
    setTimetable(null);
    try {
      const res = await api.get(`/timetable/${sectionId}`);
      setTimetable(res.data?.data ?? res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load timetable.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSectionChange = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    if (id) {
      fetchTimetable(id);
      if (joinSection) joinSection(id);
    } else {
      setTimetable(null);
    }
  };

  // ── Socket listeners ─────────────────────────────────────
  useEffect(() => {
    if (!socket || !selectedSectionId) return;

    const onTimetableUpdated = (data) => {
      // Accept updates for this section OR general updates (no sectionId in payload)
      const payloadSection = data?.sectionId?.toString?.() ?? data?.sectionId;
      if (payloadSection && payloadSection !== selectedSectionId.toString()) return;
      setUpdateBanner(true);
      setTimeout(() => setUpdateBanner(false), 4000);
      fetchTimetable(selectedSectionId);
    };

    const onSlotOpened = (data) => {
      const slot = data?.slot ?? data;
      const msg = slot
        ? `A lecture has been cancelled: ${slot.day} at ${slot.time}`
        : 'A lecture has been cancelled.';
      setInfoMessage(msg);
      setTimeout(() => setInfoMessage(''), 5000);
      fetchTimetable(selectedSectionId);
    };

    const onSlotClaimed = () => {
      fetchTimetable(selectedSectionId);
    };

    socket.on('timetable-updated', onTimetableUpdated);
    socket.on('slot-opened',       onSlotOpened);
    socket.on('slot-claimed',      onSlotClaimed);

    return () => {
      socket.off('timetable-updated', onTimetableUpdated);
      socket.off('slot-opened',       onSlotOpened);
      socket.off('slot-claimed',      onSlotClaimed);
    };
  }, [socket, selectedSectionId, fetchTimetable]);

  // ── Last updated ─────────────────────────────────────────
  const lastUpdated = timetable?.slots
    ?.filter((s) => s.lastUpdatedAt)
    ?.sort((a, b) => new Date(b.lastUpdatedAt) - new Date(a.lastUpdatedAt))[0];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString().padStart(2, '0')}/${d.getFullYear()} ${d
      .getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <Layout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Class Timetable</h1>
            <p className={styles.subtitle}>
              Welcome, <span className={styles.name}>{normalizeName(user?.name)}</span> — live schedule view
            </p>
          </div>
          <span className={styles.roleBadge}>Student</span>
        </div>

        {/* Year & Section selector */}
        <div className={styles.selectorRow}>
          <div className={styles.selectorGroup}>
            <label htmlFor="year-select" className={styles.selectLabel}>Year</label>
            <select
              id="year-select"
              className={styles.select}
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setSelectedId('');
                setTimetable(null);
              }}
            >
              <option value="">— All Years —</option>
              <option value="FE">First Year (FE)</option>
              <option value="SE">Second Year (SE)</option>
              <option value="TE">Third Year (TE)</option>
              <option value="BE">Fourth Year (BE)</option>
            </select>
          </div>

          <div className={styles.selectorGroup}>
            <label htmlFor="section-select" className={styles.selectLabel}>Section</label>
            {sectionsLoading ? (
              <div className={styles.loadingRow}>
                <span className={styles.spinner} /> Loading sections…
              </div>
            ) : (
              <select
                id="section-select"
                className={styles.select}
                value={selectedSectionId}
                onChange={handleSectionChange}
              >
                <option value="">— Choose your section —</option>
                {filteredSections.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}{s.semester ? ` (Sem ${s.semester})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Live update banner */}
        {updateBanner && (
          <div className={styles.updateBanner} role="status">
            🔄 Timetable updated — showing latest version
          </div>
        )}

        {/* Info (slot cancelled) */}
        {infoMessage && (
          <div className={styles.infoBanner} role="status">
            ℹ️ {infoMessage}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className={styles.errorBox}>
            ⚠️ {error}
            {selectedSectionId && (
              <button className={styles.retryBtn} onClick={() => fetchTimetable(selectedSectionId)}>
                Retry
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className={styles.loadingCenter}>
            <span className={styles.spinner} />
            <span>Loading timetable…</span>
          </div>
        )}

        {/* No section selected */}
        {!loading && !error && !selectedSectionId && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📅</span>
            <p className={styles.emptyTitle}>No section selected</p>
            <p className={styles.emptyHint}>Select your section above to view the timetable.</p>
          </div>
        )}

        {/* No timetable for selected section */}
        {!loading && !error && selectedSectionId && !timetable && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📭</span>
            <p className={styles.emptyTitle}>No timetable found</p>
            <p className={styles.emptyHint}>The admin hasn't created a timetable for this section yet.</p>
          </div>
        )}

        {/* Timetable — read-only, live updates */}
        {!loading && !error && timetable?.slots?.length > 0 && (
          <>
            <div className={styles.gridHeader}>
              <span className={styles.gridTitle}>
                {sections.find((s) => s._id === selectedSectionId)?.name || 'Section'} — Weekly Schedule
              </span>
              <span className={styles.readOnlyBadge}>Live · Read-only</span>
            </div>

            <TimetableGrid
              slots={timetable.slots}
              role="student"
              isEditing={false}
            />

            {lastUpdated && (
              <div className={styles.lastUpdated}>
                Last updated
                {lastUpdated.lastUpdatedBy?.name
                  ? ` by ${normalizeName(lastUpdated.lastUpdatedBy.name)}`
                  : ''}
                {' '}at {formatDate(lastUpdated.lastUpdatedAt)}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
