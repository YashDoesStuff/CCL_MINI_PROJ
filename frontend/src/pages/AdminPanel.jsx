import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';
import TimetableUploader from '../components/TimetableUploader';
import styles from './AdminPanel.module.css';

const TABS = ['CRUD Management', 'Generate Timetable', 'Upload Timetable'];
const CRUD_ENTITIES = ['Faculty', 'Rooms', 'Subjects', 'Sections'];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
        <h1 className={styles.title}>Admin Panel</h1>
        <p className={styles.subtitle}>Manage timetables, faculty, rooms and more</p>
      </div>

      {/* Tab Bar */}
      <div className={styles.tabBar} role="tablist">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === i}
            className={`${styles.tabBtn} ${activeTab === i ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 0 && <CrudTab />}
        {activeTab === 1 && <GenerateTab />}
        {activeTab === 2 && <TimetableUploader />}
      </div>
      </div>
    </Layout>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB 1 — CRUD MANAGEMENT
══════════════════════════════════════════════════════════ */
function CrudTab() {
  const [entity, setEntity] = useState('Faculty');
  return (
    <div>
      <div className={styles.subTabBar}>
        {CRUD_ENTITIES.map((e) => (
          <button
            key={e}
            className={`${styles.subTab} ${entity === e ? styles.subTabActive : ''}`}
            onClick={() => setEntity(e)}
          >
            {e}
          </button>
        ))}
      </div>
      {entity === 'Faculty'   && <EntityTable entity="faculty"  />}
      {entity === 'Rooms'     && <EntityTable entity="rooms"    />}
      {entity === 'Subjects'  && <EntityTable entity="subjects" />}
      {entity === 'Sections'  && <EntityTable entity="sections" />}
    </div>
  );
}

/* Generic entity CRUD table */
function EntityTable({ entity }) {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [modal, setModal]       = useState(null); // null | { mode:'add'|'edit', item?:{} }
  const [formData, setFormData] = useState({});
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState('');

  // Extra data for dropdowns
  const [facultyList, setFacultyList]   = useState([]);
  const [subjectList, setSubjectList]   = useState([]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/${entity}`);
      const data = res.data?.data ?? res.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to load ${entity}`);
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    // Pre-fetch faculty & subjects for dropdowns
    api.get('/faculty').then(r => setFacultyList(r.data?.data ?? r.data ?? [])).catch(() => {});
    api.get('/subjects').then(r => setSubjectList(r.data?.data ?? r.data ?? [])).catch(() => {});
  }, []);

  const openAdd = () => {
    setFormData({});
    setFormError('');
    setModal({ mode: 'add' });
  };

  const openEdit = (item) => {
    setFormData({ ...item });
    setFormError('');
    setModal({ mode: 'edit', item });
  };

  const closeModal = () => setModal(null);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await api.delete(`/${entity}/${id}`);
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (modal.mode === 'add') {
        await api.post(`/${entity}`, formData);
      } else {
        await api.put(`/${entity}/${modal.item._id}`, formData);
      }
      closeModal();
      fetchItems();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => setFormData((p) => ({ ...p, [key]: value }));

  // Column headers per entity
  const columns = {
    faculty:  ['Name', 'Subjects', 'Actions'],
    rooms:    ['Room Number', 'Capacity', 'Actions'],
    subjects: ['Name', 'Faculty', 'Actions'],
    sections: ['Name', 'Semester', 'Actions'],
  };

  const renderCell = (item, entity) => {
    switch (entity) {
      case 'faculty':
        return (
          <>
            <td className={styles.td}>{item.name}</td>
            <td className={styles.td}>{item.subjects?.map(s => s.name || s).join(', ') || '—'}</td>
          </>
        );
      case 'rooms':
        return (
          <>
            <td className={styles.td}>{item.roomNumber}</td>
            <td className={styles.td}>{item.capacity}</td>
          </>
        );
      case 'subjects':
        return (
          <>
            <td className={styles.td}>{item.name}</td>
            <td className={styles.td}>{item.facultyId?.name || item.facultyId || '—'}</td>
          </>
        );
      case 'sections':
        return (
          <>
            <td className={styles.td}>{item.name}</td>
            <td className={styles.td}>{item.semester}</td>
          </>
        );
      default:
        return null;
    }
  };

  const renderFormFields = () => {
    switch (entity) {
      case 'faculty':
        return (
          <>
            <FormField label="Name" id="f-name">
              <input id="f-name" className={styles.input} value={formData.name || ''} onChange={e => updateField('name', e.target.value)} required />
            </FormField>
            <FormField label="Subjects (IDs, comma-separated)" id="f-subjects">
              <input id="f-subjects" className={styles.input} value={Array.isArray(formData.subjects) ? formData.subjects.join(',') : (formData.subjects || '')} onChange={e => updateField('subjects', e.target.value.split(',').map(s => s.trim()))} placeholder="subject ObjectId, ..." />
            </FormField>
          </>
        );
      case 'rooms':
        return (
          <>
            <FormField label="Room Number" id="f-room">
              <input id="f-room" className={styles.input} value={formData.roomNumber || ''} onChange={e => updateField('roomNumber', e.target.value)} required />
            </FormField>
            <FormField label="Capacity" id="f-cap">
              <input id="f-cap" type="number" className={styles.input} value={formData.capacity || ''} onChange={e => updateField('capacity', Number(e.target.value))} required />
            </FormField>
          </>
        );
      case 'subjects':
        return (
          <>
            <FormField label="Name" id="f-subname">
              <input id="f-subname" className={styles.input} value={formData.name || ''} onChange={e => updateField('name', e.target.value)} required />
            </FormField>
            <FormField label="Faculty" id="f-fac">
              <select id="f-fac" className={styles.select} value={formData.facultyId || ''} onChange={e => updateField('facultyId', e.target.value)}>
                <option value="">— Select Faculty —</option>
                {facultyList.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
              </select>
            </FormField>
          </>
        );
      case 'sections':
        return (
          <>
            <FormField label="Section Name" id="f-secname">
              <input id="f-secname" className={styles.input} value={formData.name || ''} onChange={e => updateField('name', e.target.value)} required />
            </FormField>
            <FormField label="Semester" id="f-sem">
              <input id="f-sem" type="number" className={styles.input} value={formData.semester || ''} onChange={e => updateField('semester', Number(e.target.value))} required />
            </FormField>
            <FormField label="Subjects (IDs, comma-separated)" id="f-subs">
              <input id="f-subs" className={styles.input} value={Array.isArray(formData.subjects) ? formData.subjects.join(',') : (formData.subjects || '')} onChange={e => updateField('subjects', e.target.value.split(',').map(s => s.trim()))} placeholder="subject ObjectId, ..." />
            </FormField>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className={styles.tableHeader}>
        <span className={styles.tableTitle}>{entity.charAt(0).toUpperCase() + entity.slice(1)}</span>
        <button className={styles.addBtn} onClick={openAdd}>+ Add New</button>
      </div>

      {loading && <LoadingSpinner />}
      {error   && <ErrorBox msg={error} onRetry={fetchItems} />}

      {!loading && !error && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                {(columns[entity] || []).map(col => (
                  <th key={col} className={styles.th}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={3} className={styles.emptyRow}>No items found</td></tr>
              ) : (
                items.map(item => (
                  <tr key={item._id} className={styles.tr}>
                    {renderCell(item, entity)}
                    <td className={styles.td}>
                      <div className={styles.rowActions}>
                        <button className={styles.editBtn} onClick={() => openEdit(item)}>Edit</button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(item._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {modal.mode === 'add' ? 'Add New' : 'Edit'} {entity.slice(0, -1)}
              </h3>
              <button className={styles.modalClose} onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSave} className={styles.form}>
              {renderFormFields()}
              {formError && <ErrorBox msg={formError} />}
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelModalBtn} onClick={closeModal}>Cancel</button>
                <button type="submit" className={styles.saveBtn} disabled={saving}>
                  {saving ? <span className={styles.spinner} /> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB 2 — GENERATE TIMETABLE
══════════════════════════════════════════════════════════ */

const GRID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Convert "9:45" → minutes for sorting / break insertion
const toMins = (t = '0:0') => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

// Format "09:45 – 10:45" from start time string
const fmtLabel = (t) => {
  const [h, m] = t.split(':').map(Number);
  const end = toMins(t) + 60;
  const eh = Math.floor(end / 60), em = end % 60;
  return `${String(h).padStart(2,'0')}:${String(m||0).padStart(2,'0')} – ${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
};

// Build display rows from actual backend times, inserting break rows
function buildRows(slots) {
  const times = [...new Set(slots.map(s => s.time))].sort((a, b) => toMins(a) - toMins(b));
  const rows = [];
  let sb = false, lb = false;
  times.forEach(time => {
    const m = toMins(time);
    if (!sb && m >= 660) { rows.push({ type: 'shortBreak' }); sb = true; }   // >= 11:00
    if (!lb && m >= 780) { rows.push({ type: 'longBreak'  }); lb = true; }   // >= 13:00
    rows.push({ type: 'slot', time });
  });
  // If no slots yet, show default college structure
  if (times.length === 0) {
    ['8:45','9:45'].forEach(t => rows.push({ type:'slot', time: t }));
    rows.push({ type:'shortBreak' });
    ['11:00','12:00'].forEach(t => rows.push({ type:'slot', time: t }));
    rows.push({ type:'longBreak' });
    ['13:30','14:30','15:30','16:30'].forEach(t => rows.push({ type:'slot', time: t }));
  }
  return rows;
}

function GenerateTab() {
  const [sections, setSections]         = useState([]);
  const [selectedSection, setSelected]  = useState('');
  const [generating, setGenerating]     = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [sectionsLoading, setSectLoading] = useState(true);
  const [timetable, setTimetable]       = useState(null);
  const [published, setPublished]       = useState(false);
  const [error, setError]               = useState('');

  // For assign modal
  const [facultyList, setFacultyList]   = useState([]);  // [{_id,name,subjects:[{_id,name}]}]
  const [roomList, setRoomList]         = useState([]);
  const [subjectList, setSubjectList]   = useState([]);
  const [assignTarget, setAssignTarget] = useState(null); // { day, time, slot? }
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError]   = useState('');
  const [manualFacultyId, setManualFacultyId] = useState('');
  const [manualSubjectId, setManualSubjectId] = useState('');
  const [manualRoomId, setManualRoomId] = useState('');

  const refreshFacultyAndRooms = useCallback(async () => {
    try {
      const [fRes, rRes, sRes] = await Promise.all([
        api.get('/faculty'),
        api.get('/rooms'),
        api.get('/subjects'),
      ]);
      setFacultyList(fRes.data?.data ?? fRes.data ?? []);
      setRoomList(rRes.data?.data ?? rRes.data ?? []);
      setSubjectList(sRes.data?.data ?? sRes.data ?? []);
    } catch {
      // Ignore refresh errors
    }
  }, []);

  useEffect(() => {
    api.get('/sections').then(r => setSections(r.data?.data ?? r.data ?? [])).catch(() => setError('Failed to load sections')).finally(() => setSectLoading(false));
    refreshFacultyAndRooms();
  }, []);

  useEffect(() => {
    if (!assignTarget?.slot) {
      setManualFacultyId('');
      setManualSubjectId('');
      setManualRoomId('');
      return;
    }
    const slot = assignTarget.slot;
    setManualFacultyId(slot.facultyId?._id || slot.facultyId || '');
    setManualSubjectId(slot.subjectId?._id || slot.subjectId || '');
    setManualRoomId(slot.roomId?._id || slot.roomId || '');
  }, [assignTarget]);

  const subjectsByFaculty = useMemo(() => {
    const map = new Map();
    subjectList.forEach((subject) => {
      const facId = subject.facultyId?._id || subject.facultyId;
      if (!facId) return;
      const key = facId.toString();
      const existing = map.get(key) || [];
      existing.push({ _id: subject._id, name: subject.name });
      map.set(key, existing);
    });
    return map;
  }, [subjectList]);

  const showQuickAssign = false;

  const handleGenerate = async () => {
    if (!selectedSection) return;
    setGenerating(true); setError(''); setTimetable(null); setPublished(false);
    try {
      await api.post('/timetable/generate-timetable', { sectionId: selectedSection });
      const ttRes = await api.get(`/timetable/${selectedSection}`);
      setTimetable(ttRes.data?.data ?? ttRes.data);
      refreshFacultyAndRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Timetable generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadExisting = async () => {
    if (!selectedSection) return;
    setLoadingExisting(true); setError(''); setTimetable(null); setPublished(false);
    try {
      const ttRes = await api.get(`/timetable/${selectedSection}`);
      setTimetable(ttRes.data?.data ?? ttRes.data);
      refreshFacultyAndRooms();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load timetable.');
    } finally {
      setLoadingExisting(false);
    }
  };

  // Handle faculty+subject row click in AssignModal
  const handleAssign = async (faculty, subject) => {
    if (!assignTarget || !timetable) return;
    setAssignSaving(true); setAssignError('');
    try {
      const slot = assignTarget.slot;
      if (slot) {
        // Update existing slot
        await api.put('/timetable/update-slot', {
          timetableId: timetable._id,
          slotId: slot._id,
          updates: { facultyId: faculty._id, subjectId: subject._id },
        });
        setTimetable(prev => ({
          ...prev,
          slots: prev.slots.map(s => s._id === slot._id
            ? { ...s, facultyId: { _id: faculty._id, name: faculty.name }, subjectId: { _id: subject._id, name: subject.name } }
            : s
          ),
        }));
      }
      setAssignTarget(null);
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Failed to assign. Try again.');
    } finally {
      setAssignSaving(false);
    }
  };

  const handleManualAssign = async () => {
    if (!assignTarget?.slot || !timetable) return;
    setAssignSaving(true); setAssignError('');
    try {
      await api.put('/timetable/update-slot', {
        timetableId: timetable._id,
        slotId: assignTarget.slot._id,
        updates: {
          facultyId: manualFacultyId || null,
          subjectId: manualSubjectId || null,
          roomId: manualRoomId || null,
        },
      });
      setTimetable(prev => ({
        ...prev,
        slots: prev.slots.map(s => s._id === assignTarget.slot._id
          ? {
              ...s,
              facultyId: manualFacultyId ? { _id: manualFacultyId, name: facultyList.find(f => f._id === manualFacultyId)?.name } : null,
              subjectId: manualSubjectId ? { _id: manualSubjectId, name: subjectList.find(sj => sj._id === manualSubjectId)?.name } : null,
              roomId: manualRoomId ? { _id: manualRoomId, roomNumber: roomList.find(r => r._id === manualRoomId)?.roomNumber } : null,
            }
          : s
        ),
      }));
      setAssignTarget(null);
    } catch (err) {
      setAssignError(err.response?.data?.message || 'Failed to update slot.');
    } finally {
      setAssignSaving(false);
    }
  };

  // Slot lookup map: "Day-time" → slot
  const slotMap = {};
  timetable?.slots?.forEach(s => { slotMap[`${s.day}-${s.time}`] = s; });

  const displayRows  = timetable ? buildRows(timetable.slots) : [];
  const sectionName  = sections.find(s => s._id === selectedSection)?.name || 'Section';

  return (
    <div>
      <h2 className={styles.sectionTitle}>Generate Timetable</h2>
      <p className={styles.sectionDesc}>Select a section, generate, then click any slot’s <strong>+</strong> to assign a faculty member.</p>

      {/* Controls row */}
      <div className={styles.row}>
        {sectionsLoading ? <LoadingSpinner /> : (
          <select id="gen-section" className={styles.select} value={selectedSection}
            onChange={e => { setSelected(e.target.value); setTimetable(null); setPublished(false); }}>
            <option value="">— Select Section —</option>
            {sections.map(s => <option key={s._id} value={s._id}>{s.name} (Sem {s.semester})</option>)}
          </select>
        )}
        <button id="gen-btn" className={styles.primaryBtn} onClick={handleGenerate} disabled={!selectedSection || generating}>
          {generating ? <><span className={styles.spinner} /> Generating…</> : '⚡ Generate'}
        </button>
        <button className={styles.primaryBtn} onClick={handleLoadExisting} disabled={!selectedSection || loadingExisting}>
          {loadingExisting ? <><span className={styles.spinner} /> Loading…</> : '📥 Load Existing'}
        </button>
      </div>

      {error && <ErrorBox msg={error} />}

      {/* Timetable grid */}
      {timetable && (
        <div className={styles.editableGrid}>
          <div className={styles.gridTopBar}>
            <span className={styles.gridSectionLabel}>📅 {sectionName}</span>
            {published
              ? <span className={styles.publishedBadge}>✅ Published &amp; Live</span>
              : <button id="publish-btn" className={styles.publishBtn} onClick={() => setPublished(true)}>🚀 Publish</button>
            }
          </div>
          {published && (
            <div className={styles.successBox} style={{ marginBottom: '0.75rem' }}>
              Timetable is live! Students can now view it.
            </div>
          )}

          <div className={styles.ttGridWrapper}>
            <table className={styles.ttTable}>
              <thead>
                <tr>
                  <th className={styles.ttCornerTh}>Time</th>
                  {GRID_DAYS.map(d => <th key={d} className={styles.ttTh}>{d.slice(0,3)}</th>)}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, ri) => {
                  // Break rows
                  if (row.type === 'shortBreak') return (
                    <tr key="sb">
                      <td className={styles.ttBreakTime}>10:45 – 11:00</td>
                      <td colSpan={6} className={styles.ttBreakCell}>Short Break</td>
                    </tr>
                  );
                  if (row.type === 'longBreak') return (
                    <tr key="lb">
                      <td className={styles.ttBreakTime}>13:00 – 13:30</td>
                      <td colSpan={6} className={styles.ttBreakCell}>Long Break</td>
                    </tr>
                  );
                  // Normal slot row
                  const { time } = row;
                  return (
                    <tr key={time}>
                      <td className={styles.ttTimeCell}>{fmtLabel(time)}</td>
                      {GRID_DAYS.map(day => {
                        const slot = slotMap[`${day}-${time}`];
                        const hasFaculty = slot && (slot.facultyId?.name || slot.facultyId);
                        return (
                          <td key={day} className={styles.ttCell}>
                            {slot ? (
                              <div className={`${styles.ttSlotCard} ${hasFaculty ? styles.slotFilled : styles.slotEmpty}`}>
                                <span className={styles.ttSubject}>{slot.subjectId?.name || '—'}</span>
                                {hasFaculty
                                  ? <span className={styles.ttFaculty}>{slot.facultyId?.name}</span>
                                  : <span className={styles.ttUnassigned}>Unassigned</span>
                                }
                                {slot.roomId?.roomNumber && (
                                  <span className={styles.ttRoom}>{slot.roomId.roomNumber}</span>
                                )}
                                <button
                                  className={styles.ttAssignBtn}
                                  onClick={() => setAssignTarget({ day, time, slot })}
                                  title="Assign / Reassign faculty"
                                >
                                  {hasFaculty ? '✏️' : '+'}
                                </button>
                              </div>
                            ) : (
                              <button
                                className={styles.ttAddBtn}
                                onClick={() => setAssignTarget({ day, time, slot: null })}
                                title={`Add lecture — ${day} ${fmtLabel(time)}`}
                              >
                                <span className={styles.ttAddPlus}>+</span>
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.gridHint}>Click <strong>+</strong> on any slot to assign faculty. Click <strong>✏️</strong> to reassign.</p>
        </div>
      )}

      {/* Assign Faculty Modal */}
      {assignTarget && (
        <div className={styles.modalOverlay} onClick={() => { setAssignTarget(null); setAssignError(''); }}>
          <div className={styles.assignModal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Assign Faculty</h3>
                <p className={styles.assignSlotInfo}>{assignTarget.day} • {fmtLabel(assignTarget.time)}</p>
              </div>
              <button className={styles.modalClose} onClick={() => { setAssignTarget(null); setAssignError(''); }}>×</button>
            </div>

            {assignError && <div className={styles.errorBox2} style={{ marginBottom: '0.75rem' }}>{assignError}</div>}

            {assignTarget.slot && (
              <div className={styles.assignForm}>
                <div className={styles.assignRow}>
                  <select className={styles.select} value={manualFacultyId} onChange={e => setManualFacultyId(e.target.value)}>
                    <option value="">— Select Faculty —</option>
                    {facultyList.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                  </select>
                  <select className={styles.select} value={manualSubjectId} onChange={e => setManualSubjectId(e.target.value)}>
                    <option value="">— Select Subject —</option>
                    {subjectList.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                  <select className={styles.select} value={manualRoomId} onChange={e => setManualRoomId(e.target.value)}>
                    <option value="">— Select Room —</option>
                    {roomList.map(r => <option key={r._id} value={r._id}>{r.roomNumber}</option>)}
                  </select>
                </div>
                <button className={styles.primaryBtn} onClick={handleManualAssign} disabled={assignSaving}>
                  {assignSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            )}

            <div className={styles.noSubjects}>
              Use the dropdowns above to edit this slot.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



/* ══════════════════════════════════════════════════════════
   TAB 4 — FACULTY AVAILABILITY (read-only for admin)
══════════════════════════════════════════════════════════ */
const ALL_DAYS  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ALL_TIMES = ['9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

function FacultyAvailabilityTab() {
  const [faculty, setFaculty]           = useState([]);
  const [selected, setSelected]         = useState('');
  const [unavailable, setUnavailable]   = useState([]);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    api.get('/faculty').then(r => setFaculty(r.data?.data ?? r.data ?? [])).catch(() => {});
  }, []);

  const handleSelect = async (e) => {
    const id = e.target.value;
    setSelected(id);
    if (!id) { setUnavailable([]); return; }
    setLoading(true);
    try {
      const res = await api.get(`/faculty/${id}`);
      const f = res.data?.data ?? res.data;
      setUnavailable(f.unavailableSlots || []);
    } catch {
      setUnavailable([]);
    } finally {
      setLoading(false);
    }
  };

  const isUnavailable = (day, time) =>
    unavailable.some(s => s.day === day && s.time === time);

  const selectedFaculty = faculty.find(f => f._id === selected);
  const unavailableCount = unavailable.length;

  return (
    <div>
      <h2 className={styles.sectionTitle}>Faculty Availability</h2>
      <p className={styles.sectionDesc}>
        View when each faculty member is unavailable. Faculty manage their own availability through their profile page.
      </p>

      <div className={styles.row}>
        <select id="avail-faculty" className={styles.select} value={selected} onChange={handleSelect}>
          <option value="">— Select Faculty —</option>
          {faculty.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
        </select>
      </div>

      {loading && <LoadingSpinner />}

      {selected && !loading && (
        <>
          <div className={styles.availInfoBar}>
            <span className={styles.availName}>{selectedFaculty?.name}</span>
            {unavailableCount === 0
              ? <span className={styles.availAllFree}>✅ Fully available all week</span>
              : <span className={styles.availBlocked2}>{unavailableCount} slot{unavailableCount !== 1 ? 's' : ''} marked unavailable</span>
            }
          </div>

          {/* Read-only legend */}
          <div className={styles.availLegend}>
            <span className={styles.legendPill}><span className={styles.legendDotGreen}/>Available</span>
            <span className={styles.legendPill}><span className={styles.legendDotRed}/>Unavailable (set by faculty)</span>
          </div>

          <div className={styles.availGrid}>
            <div className={styles.availCorner} />
            {ALL_DAYS.map(d => (
              <div key={d} className={styles.availDayHeader}>{d.slice(0,3)}</div>
            ))}
            {ALL_TIMES.map(time => (
              <>
                <div key={`t-${time}`} className={styles.availTimeLabel}>{time}</div>
                {ALL_DAYS.map(day => {
                  const blocked = isUnavailable(day, time);
                  return (
                     <div
                      key={`${day}-${time}`}
                      className={`${styles.availCell} ${styles.availCellRO} ${blocked ? styles.availBlocked : ''}`}
                      title={`${day} ${time} — ${blocked ? 'Unavailable' : 'Available'}`}
                    >
                      {blocked ? '✗' : ''}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════
   SHARED HELPERS
══════════════════════════════════════════════════════════ */
function LoadingSpinner() {
  return (
    <div className={styles.loadingRow}>
      <span className={styles.spinner} /> Loading…
    </div>
  );
}

function ErrorBox({ msg, onRetry }) {
  return (
    <div className={styles.errorBox2}>
      {msg}
      {onRetry && <button className={styles.retryBtn} onClick={onRetry}>Retry</button>}
    </div>
  );
}

function FormField({ label, id, children }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      {children}
    </div>
  );
}
