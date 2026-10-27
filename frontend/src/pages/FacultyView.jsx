import { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { normalizeName } from '../utils/normalizeName';
import api from '../api/axios';
import TimetableGrid from '../components/TimetableGrid';

import Layout from '../components/Layout';
import MiniCalendar from '../components/MiniCalendar';
import styles from './FacultyView.module.css';

// ─── Modes ────────────────────────────────────────────────
// null      = view only
// 'cancel'  = click own slots to cancel
// 'add'     = click free cells OR open slots to add/claim a lecture
const MODES = { CANCEL: 'cancel', ADD: 'add' };

export default function FacultyView() {
  const { user } = useContext(AuthContext);
  const { socket, joinSection } = useContext(SocketContext) || {};

  // My Faculty._id (not User._id) — critical for slot ownership check
  const myFacultyId = user?.facultyProfileId || null;

  // ── State ────────────────────────────────────────────────
  const [slots, setSlots]               = useState([]);
  const [timetableId, setTimetableId]   = useState(null);
  const [sectionId, setSectionId]       = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  // Interaction state
  const [activeMode, setActiveMode]     = useState(null); // MODES.* or null
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDay, setSelectedDay]   = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [toast, setToast]               = useState('');

  // Add lecture form state
  const [extraSubjectId, setExtraSubjectId] = useState('');
  const [extraRoomId, setExtraRoomId]       = useState('');
  const [subjects, setSubjects]             = useState([]);
  const [rooms, setRooms]                   = useState([]);

  // ── Show Toast ────────────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  // ── Load subjects and rooms for the extra lecture form ────
  useEffect(() => {
    api.get('/subjects').then((r) => setSubjects(r.data?.data ?? r.data ?? [])).catch(() => {});
    api.get('/rooms').then((r) => setRooms(r.data?.data ?? r.data ?? [])).catch(() => {});
  }, []);

  // ── Fetch ALL timetables (fully populated) ───────────────
  const fetchPopulated = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const listRes = await api.get('/timetable');
      const allTimetables = listRes.data?.data ?? [];

      // Fetch each fully populated in parallel
      const populated = await Promise.all(
        allTimetables.map((tt) =>
          api.get(`/timetable/${tt.sectionId?._id || tt.sectionId}`)
            .then((r) => ({ ...r.data?.data, _rawId: tt._id }))
            .catch(() => ({ ...tt, _rawId: tt._id }))
        )
      );

      const allSlots = [];
      let defaultTimetableId = null;
      let defaultSectionId = null;

      populated.forEach((tt) => {
        const ttId = tt._id || tt._rawId;
        const secId = tt.sectionId?._id || tt.sectionId;
        if (!defaultTimetableId) { defaultTimetableId = ttId; defaultSectionId = secId; }
        (tt.slots || []).forEach((slot) => {
          allSlots.push({ ...slot, _timetableId: ttId });
        });
      });

      setSlots(allSlots);
      setTimetableId(defaultTimetableId);
      setSectionId(defaultSectionId);

      // Join the section socket room for live updates
      if (defaultSectionId && joinSection) joinSection(defaultSectionId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load timetable.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, joinSection]);

  useEffect(() => { fetchPopulated(); }, [fetchPopulated]);

  // ── Socket listeners ─────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => fetchPopulated();
    socket.on('slot-opened',       onUpdate);
    socket.on('timetable-updated', onUpdate);
    socket.on('slot-claimed',      onUpdate);
    return () => {
      socket.off('slot-opened',       onUpdate);
      socket.off('timetable-updated', onUpdate);
      socket.off('slot-claimed',      onUpdate);
    };
  }, [socket, fetchPopulated]);

  // ── Mode management ──────────────────────────────────────
  const enterMode = (mode) => {
    setActiveMode((prev) => (prev === mode ? null : mode));
    setSelectedSlot(null);
    setSelectedDay(null);
    setSelectedTime(null);
    setExtraSubjectId('');
    setExtraRoomId('');
  };

  // Returns true if the slot being clicked is an open (yellow) slot in ADD mode
  const isOpenSlot = (slot) => slot && slot.status === 'open';

  const exitMode = () => {
    setActiveMode(null);
    setSelectedSlot(null);
    setSelectedDay(null);
    setSelectedTime(null);
    setExtraSubjectId('');
    setExtraRoomId('');
  };

  // ── Slot click handler ───────────────────────────────────
  const handleSlotClick = (slot, day, time) => {
    if (!activeMode) return;

    if (slot && slot._id === selectedSlot?._id) {
      // Deselect
      setSelectedSlot(null);
      setSelectedDay(null);
      setSelectedTime(null);
      setExtraSubjectId('');
      setExtraRoomId('');
      return;
    }

    setSelectedSlot(slot || null);
    setSelectedDay(day || null);
    setSelectedTime(time || null);
    // Reset extra form when switching slot
    setExtraSubjectId('');
    setExtraRoomId('');
  };

  // ── Ownership helper ────────────────────────────────────
  const isMySlot = (slot) => {
    if (!slot) return false;
    if (myFacultyId) {
      const fId = slot.facultyId?._id || slot.facultyId;
      if (String(fId) === String(myFacultyId)) return true;
    }
    
    const facultyName = slot.facultyId?.name;
    const userName = user?.name;
    if (userName && facultyName) {
      const myClean = normalizeName(userName).toLowerCase().trim();
      const slotClean = normalizeName(facultyName).toLowerCase().trim();
      if (myClean === slotClean) return true;
    }
    return false;
  };

  // ── Submit action ────────────────────────────────────────
  const handleSubmit = async () => {
    const tId = selectedSlot?._timetableId || timetableId;

    setSubmitting(true);
    try {
      if (activeMode === MODES.CANCEL && selectedSlot) {
        await api.post('/timetable/cancel-slot', {
          timetableId: tId,
          slotId: selectedSlot._id,
          facultyProfileId: myFacultyId,
        });
        showToast('✅ Lecture cancelled — slot is now open for others');

      } else if (activeMode === MODES.ADD) {
        if (selectedSlot && isOpenSlot(selectedSlot)) {
          // Claiming an open (yellow) slot
          await api.post('/timetable/claim-slot', {
            timetableId: tId,
            slotId: selectedSlot._id,
            facultyProfileId: myFacultyId,
            subjectId: extraSubjectId || null,
            roomId: extraRoomId || null,
          });
          showToast('✅ Slot claimed successfully!');
        } else {
          // Adding a new extra lecture to a free cell
          if (!selectedDay || !selectedTime) {
            showToast('Please select a free slot first.');
            return;
          }
          await api.post('/timetable/add-extra-slot', {
            timetableId: tId,
            day: selectedDay,
            time: selectedTime,
            subjectId: extraSubjectId || null,
            roomId: extraRoomId || null,
            facultyProfileId: myFacultyId,
          });
          showToast('✅ Lecture added!');
        }
      }

      exitMode();
      fetchPopulated();
    } catch (err) {
      showToast(err.response?.data?.message || '❌ Action failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Dynamic Text Preview ─────────────────────────────────
  const buildDynamicText = () => {
    if (!activeMode) {
      return 'Choose an action — Cancel Lecture or Add Lecture — then click a slot.';
    }

    if (activeMode === MODES.CANCEL) {
      if (!selectedSlot) {
        return 'Cancel mode active. Click one of your lectures (green) to select it for cancellation.';
      }
      const subj = selectedSlot.subjectId?.name || 'this lecture';
      const day  = selectedSlot.day || '';
      const time = selectedSlot.time || '';
      return `"${subj}" on ${day} at ${time} will be cancelled and become claimable. Press Confirm Cancel.`;
    }

    if (activeMode === MODES.ADD) {
      if (!selectedSlot && !selectedDay) {
        return 'Add Lecture mode — click a free cell to schedule a new lecture, or click an open (yellow) slot to claim it.';
      }
      if (selectedSlot && isOpenSlot(selectedSlot)) {
        const subj = selectedSlot.subjectId?.name || 'Open slot';
        return `"${subj}" on ${selectedSlot.day} at ${selectedSlot.time} is open. Press Confirm Add to claim it.`;
      }
      const subjName = subjects.find((s) => s._id === extraSubjectId)?.name || '';
      const roomNum  = rooms.find((r) => r._id === extraRoomId)?.roomNumber || '';
      let msg = `New lecture on ${selectedDay} at ${selectedTime}.`;
      if (subjName) msg += ` Subject: ${subjName}.`;
      if (roomNum)  msg += ` Room: ${roomNum}.`;
      msg += ' Press Add Lecture to save.';
      return msg;
    }

    return '';
  };

  const dynamicText = buildDynamicText();

  // ── Last updated ─────────────────────────────────────────
  let lastUpdatedText = 'Unknown';
  if (slots.length > 0) {
    const recent = [...slots].sort(
      (a, b) => new Date(b.lastUpdatedAt || 0) - new Date(a.lastUpdatedAt || 0)
    )[0];
    if (recent?.lastUpdatedAt) {
      const diff = Math.floor((Date.now() - new Date(recent.lastUpdatedAt)) / 60000);
      if (diff < 1) lastUpdatedText = 'Just now';
      else if (diff < 60) lastUpdatedText = `${diff} min ago`;
      else lastUpdatedText = `${Math.floor(diff / 60)} hr ago`;
    }
  }

  // ── Can submit? ───────────────────────────────────────────
  const canSubmit = !submitting && (
    (activeMode === MODES.CANCEL && selectedSlot && isMySlot(selectedSlot)) ||
    (activeMode === MODES.ADD && selectedSlot && isOpenSlot(selectedSlot)) ||
    (activeMode === MODES.ADD && !selectedSlot && selectedDay)
  );

  // ── Share helpers ─────────────────────────────────────────
  const handleCopy     = () => navigator.clipboard.writeText(dynamicText).catch(() => {});
  const handleWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(dynamicText)}`, '_blank');

  // ── Header Actions (passed to Layout) ────────────────────
  const headerActions = (
    <>
      {/* Cancel Lecture mode button */}
      <button
        className={`${styles.actionBtn} ${styles.cancelBtn} ${activeMode === MODES.CANCEL ? styles.btnActive : ''}`}
        onClick={() => enterMode(MODES.CANCEL)}
        title="Enter Cancel Lecture mode"
      >
        🚫 Cancel Lecture
      </button>

      {/* Add Lecture mode button */}
      <button
        className={`${styles.actionBtn} ${styles.extraBtn} ${activeMode === MODES.ADD ? styles.btnActive : ''}`}
        onClick={() => enterMode(MODES.ADD)}
        title="Add a lecture to a free slot, or claim an open slot"
      >
        ➕ Add Lecture
      </button>

      {/* Submit */}
      <button
        className={`${styles.actionBtn} ${styles.submitBtn}`}
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{ opacity: canSubmit ? 1 : 0.4 }}
      >
        {submitting
          ? '...'
          : activeMode === MODES.CANCEL
            ? 'Confirm Cancel'
            : (selectedSlot && isOpenSlot(selectedSlot))
              ? 'Confirm Claim'
              : 'Add Lecture'}
      </button>

      <span className={styles.lastUpdated}>last updated — {lastUpdatedText}</span>
    </>
  );

  // ── Right Panel ───────────────────────────────────────────
  const rightPanel = (
    <>

      {/* Mini Calendar */}
      <div className={styles.calendarBox}>
        <div className={styles.boxHeader}>Calendar</div>
        <div className={styles.boxContent}>
          <MiniCalendar />
        </div>
      </div>

      {/* Dynamic Text Preview */}
      <div className={styles.previewBox}>
        <div className={styles.boxHeader}>Preview</div>
        <div className={styles.boxContent}>
          <p className={styles.previewText}>{dynamicText}</p>
        </div>
      </div>

      {/* Share */}
      <div className={styles.bottomActions}>
        <button className={styles.copyBtn} onClick={handleCopy}>📋 Copy</button>
        <button className={styles.whatsappBtn} onClick={handleWhatsApp}>💬 WhatsApp</button>
      </div>
    </>
  );

  // ── Render ────────────────────────────────────────────────
  return (
    <Layout headerActions={headerActions} rightPanel={rightPanel}>
      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.timetableWrapper}>
        {/* Active mode banner */}
        {activeMode && (
          <div className={`${styles.modeBanner} ${styles[`modeBanner_${activeMode}`]}`}>
            {activeMode === MODES.CANCEL && '🚫 Cancel mode — click your lectures (green) to select, then press Confirm Cancel.'}
            {activeMode === MODES.ADD    && '➕ Add Lecture mode — click a free cell to add a new lecture, or click an open (yellow) slot to claim it.'}
            <button className={styles.exitModeBtn} onClick={exitMode}>✕ Exit</button>
          </div>
        )}

        {/* Subject + Room form — shows for free cells AND open slots in ADD mode */}
        {activeMode === MODES.ADD && (selectedDay || isOpenSlot(selectedSlot)) && (
          <div className={styles.extraForm}>
            <span className={styles.extraFormTitle}>
              {isOpenSlot(selectedSlot)
                ? <>🟡 Claim open slot on <strong>{selectedSlot.day}</strong> at <strong>{selectedSlot.time}</strong> — update subject &amp; room</>
                : <>📅 Add lecture on <strong>{selectedDay}</strong> at <strong>{selectedTime}</strong></>}
            </span>
            <div className={styles.extraFormFields}>
              <div className={styles.extraFormField}>
                <label className={styles.extraFormLabel}>Subject</label>
                <select
                  className={styles.extraFormSelect}
                  value={extraSubjectId}
                  onChange={(e) => setExtraSubjectId(e.target.value)}
                >
                  <option value="">— Select subject —</option>
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.extraFormField}>
                <label className={styles.extraFormLabel}>Classroom / Room</label>
                <select
                  className={styles.extraFormSelect}
                  value={extraRoomId}
                  onChange={(e) => setExtraRoomId(e.target.value)}
                >
                  <option value="">— Select room —</option>
                  {rooms.map((r) => (
                    <option key={r._id} value={r._id}>Room {r.roomNumber}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className={styles.loadingState}>Loading timetable…</div>
        ) : error ? (
          <div className={styles.errorState}>{error}</div>
        ) : (
          <TimetableGrid
            slots={slots}
            role="faculty"
            myFacultyId={myFacultyId}
            userName={user?.name}
            isEditing={!!activeMode}
            isCancelMode={activeMode === MODES.CANCEL}
            selectedSlotId={selectedSlot?._id}
            onSlotClick={handleSlotClick}
          />
        )}
      </div>
    </Layout>
  );
}
