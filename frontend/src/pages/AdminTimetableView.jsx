import { useContext, useEffect, useState, useCallback } from 'react';
import { SocketContext } from '../context/SocketContext';
import api from '../api/axios';
import TimetableGrid from '../components/TimetableGrid';
import Layout from '../components/Layout';
import styles from './AdminTimetableView.module.css';

export default function AdminTimetableView() {
  const { socket, joinSection } = useContext(SocketContext) || {};

  const [sections, setSections]             = useState([]);
  const [selectedSectionId, setSelectedId] = useState('');
  const [timetable, setTimetable]           = useState(null);
  const [loading, setLoading]               = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [error, setError]                   = useState('');
  const [liveBanner, setLiveBanner]         = useState(false);

  // ── Fetch all sections ──────────────────────────────────
  useEffect(() => {
    api.get('/sections')
      .then((r) => {
        const data = r.data?.data ?? r.data ?? [];
        setSections(data);
        if (data.length > 0) {
          const firstId = data[0]._id;
          setSelectedId(firstId);
          fetchTimetable(firstId);
          if (joinSection) joinSection(firstId);
        }
      })
      .catch(() => setError('Failed to load sections.'))
      .finally(() => setSectionsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch timetable ─────────────────────────────────────
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

  // ── Socket live updates ─────────────────────────────────
  useEffect(() => {
    if (!socket || !selectedSectionId) return;

    const onUpdated = (data) => {
      const ps = data?.sectionId?.toString?.() ?? data?.sectionId;
      if (ps && ps !== selectedSectionId.toString()) return;
      setLiveBanner(true);
      setTimeout(() => setLiveBanner(false), 4000);
      fetchTimetable(selectedSectionId);
    };

    socket.on('timetable-updated', onUpdated);
    socket.on('slot-opened',       onUpdated);
    socket.on('slot-claimed',      onUpdated);

    return () => {
      socket.off('timetable-updated', onUpdated);
      socket.off('slot-opened',       onUpdated);
      socket.off('slot-claimed',      onUpdated);
    };
  }, [socket, selectedSectionId, fetchTimetable]);

  const sectionName = sections.find((s) => s._id === selectedSectionId)?.name || '';

  return (
    <Layout>
      <div className={styles.page}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>View Timetable</h1>
            <p className={styles.subtitle}>Real-time read-only view — updates live as faculty make changes</p>
          </div>
          <span className={styles.roleBadge}>Admin · Live</span>
        </div>

        {/* Section selector */}
        <div className={styles.selectorRow}>
          <label htmlFor="admin-section-select" className={styles.selectLabel}>Section</label>
          {sectionsLoading ? (
            <div className={styles.loadingRow}>
              <span className={styles.spinner} /> Loading sections…
            </div>
          ) : (
            <select
              id="admin-section-select"
              className={styles.select}
              value={selectedSectionId}
              onChange={handleSectionChange}
            >
              <option value="">— Choose a section —</option>
              {sections.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}{s.semester ? ` (Sem ${s.semester})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Live update banner */}
        {liveBanner && (
          <div className={styles.liveBanner} role="status">
            🔄 Timetable updated live — showing latest version
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

        {/* Empty */}
        {!loading && !error && selectedSectionId && !timetable && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📭</span>
            <p className={styles.emptyTitle}>No Timetable Found</p>
            <p className={styles.emptyHint}>Generate a timetable for this section from the Admin Panel first.</p>
          </div>
        )}

        {/* Timetable Grid */}
        {!loading && !error && timetable?.slots?.length > 0 && (
          <>
            <div className={styles.gridHeader}>
              <span className={styles.gridTitle}>
                {sectionName} — Weekly Schedule
              </span>
              <span className={styles.liveDot}>● Live</span>
            </div>

            <TimetableGrid
              slots={timetable.slots}
              role="admin"
              isEditing={false}
            />
          </>
        )}
      </div>
    </Layout>
  );
}
