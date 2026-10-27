import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import TimetablePreview from './TimetablePreview';
import styles from './TimetableUploader.module.css';

const INPUT_MODES = [
  { id: 'file', label: 'Upload File (PDF/DOCX/JSON/XLSX/Image)' },
];

export default function TimetableUploader() {
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [inputMode, setInputMode] = useState('file');
  const [file, setFile] = useState(null);
  const [jsonText, setJsonText] = useState('');
  const [url, setUrl] = useState('');
  const [strategy, setStrategy] = useState('merge');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState(null);
  const [uploadId, setUploadId] = useState(null);

  useEffect(() => {
    api
      .get('/sections')
      .then((res) => setSections(res.data?.data ?? res.data ?? []))
      .catch(() => setSections([]));
  }, []);

  const selectedSectionName = useMemo(() => {
    const section = sections.find((s) => s._id === sectionId);
    return section ? `${section.name} (Sem ${section.semester})` : '—';
  }, [sections, sectionId]);

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleUpload = async () => {
    resetMessages();
    setLoading(true);
    try {
      let response = null;
      if (inputMode === 'file') {
        if (!file) {
          setError('Please choose a file to upload.');
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        if (sectionId) formData.append('sectionId', sectionId);
        response = await api.post('/timetable/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      if (inputMode === 'json') {
        if (!jsonText.trim()) {
          setError('Please paste JSON data before uploading.');
          setLoading(false);
          return;
        }
        response = await api.post('/timetable/upload', {
          json: jsonText,
          sectionId: sectionId || undefined,
        });
      }

      if (inputMode === 'url') {
        if (!url.trim()) {
          setError('Please enter a valid URL.');
          setLoading(false);
          return;
        }
        response = await api.post('/timetable/upload', {
          url,
          sectionId: sectionId || undefined,
        });
      }

      const payload = response?.data?.preview || null;
      if (!payload) {
        throw new Error('Preview data not returned from server.');
      }
      setPreview(payload);
      setUploadId(response.data.uploadId);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!uploadId) return;
    resetMessages();
    setLoading(true);
    try {
      await api.post('/timetable/confirm-upload', {
        uploadId,
        sectionId: sectionId || preview?.sectionId,
        strategy,
      });
      setSuccess('Timetable uploaded successfully.');
      setPreview(null);
      setUploadId(null);
      setFile(null);
      setJsonText('');
      setUrl('');
    } catch (err) {
      setError(err.response?.data?.message || 'Confirm failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (uploadId) {
      try {
        await api.delete(`/timetable/upload/${uploadId}`);
      } catch {
        // Ignore cleanup errors
      }
    }
    setPreview(null);
    setUploadId(null);
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Upload Timetable</h2>
      <p className={styles.subtitle}>
        Upload a PDF, DOCX, or JSON file (or paste JSON / URL). Preview before applying changes.
      </p>

      <div className={styles.sectionRow}>
        <label className={styles.label} htmlFor="upload-section">
          Section (optional if included in file)
        </label>
        <select
          id="upload-section"
          className={styles.select}
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        >
          <option value="">— Select Section —</option>
          {sections.map((section) => (
            <option key={section._id} value={section._id}>
              {section.name} (Sem {section.semester})
            </option>
          ))}
        </select>
        <div className={styles.sectionHint}>Selected: {selectedSectionName}</div>
      </div>

      <div className={styles.modeRow}>
        {INPUT_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`${styles.modeButton} ${inputMode === mode.id ? styles.modeActive : ''}`}
            onClick={() => setInputMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className={styles.inputArea}>
        {inputMode === 'file' && (
          <input
            type="file"
            accept=".pdf,.docx,.json,.xlsx,.xls,.png,.jpg,.jpeg"
            className={styles.fileInput}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        )}
        {inputMode === 'json' && null}
        {inputMode === 'url' && null}
      </div>

      <div className={styles.actionsRow}>
        <div className={styles.strategyBox}>
          <label className={styles.label} htmlFor="strategy">
            Merge Strategy
          </label>
          <select
            id="strategy"
            className={styles.select}
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
          >
            <option value="merge">Merge (keep existing slots)</option>
            <option value="replace">Replace (overwrite all slots)</option>
          </select>
        </div>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={handleUpload}
          disabled={loading}
        >
          {loading ? 'Uploading…' : 'Upload & Preview'}
        </button>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}
      {success && <div className={styles.successBox}>{success}</div>}

      {preview && (
        <TimetablePreview
          preview={preview}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          loading={loading}
          strategy={strategy}
        />
      )}
    </div>
  );
}
