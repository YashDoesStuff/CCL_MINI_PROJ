import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import api from '../api/axios';
import Layout from '../components/Layout';
import styles from './Analytics.module.css';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CHART_OPTIONS = (titleText) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: titleText,
      color: '#000',
      font: { family: 'Sora', size: 15, weight: '900' },
      padding: { bottom: 16 },
    },
    tooltip: {
      backgroundColor: '#fff',
      borderColor: '#000',
      borderWidth: 2,
      titleColor: '#000',
      bodyColor: '#333',
      titleFont: { family: 'Sora', weight: '700' },
      bodyFont: { family: 'Inter' },
    },
  },
  scales: {
    x: {
      ticks: {
        color: '#000',
        font: { family: 'Inter', size: 11, weight: '600' },
      },
      grid: { color: 'rgba(0,0,0,0.08)' },
    },
    y: {
      ticks: {
        color: '#000',
        font: { family: 'Inter', size: 11 },
        stepSize: 1,
      },
      grid: { color: 'rgba(0,0,0,0.08)' },
      beginAtZero: true,
    },
  },
});

export default function Analytics() {
  const [workload, setWorkload]     = useState([]);
  const [utilization, setUtil]      = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/timetable/analytics/faculty-workload'),
      api.get('/timetable/analytics/room-utilization'),
    ])
      .then(([wRes, uRes]) => {
        setWorkload(wRes.data?.data ?? wRes.data ?? []);
        setUtil(uRes.data?.data    ?? uRes.data    ?? []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load analytics data.');
      })
      .finally(() => setLoading(false));
  }, []);

  const workloadChartData = {
    labels: workload.map((f) => f.name || f.facultyName || f._id),
    datasets: [
      {
        label: 'Scheduled Slots',
        data: workload.map((f) => f.scheduledSlots ?? f.count ?? 0),
        backgroundColor: '#14b8a6',
        borderColor: '#000',
        borderWidth: 2,
        borderRadius: 0,
        borderSkipped: false,
      },
    ],
  };

  const utilizationChartData = {
    labels: utilization.map((r) => r.roomNumber || r.name || r._id),
    datasets: [
      {
        label: 'Total Scheduled Slots',
        data: utilization.map((r) => r.scheduledSlots ?? r.count ?? 0),
        backgroundColor: '#8b5cf6',
        borderColor: '#000',
        borderWidth: 2,
        borderRadius: 0,
        borderSkipped: false,
      },
    ],
  };

  return (
    <Layout>
      <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Analytics</h1>
        <p className={styles.subtitle}>Faculty workload and room utilization — computed on demand</p>
      </div>

      {loading && (
        <div className={styles.loadingState}>
          <span className={styles.spinner} />
          <span>Loading analytics data…</span>
        </div>
      )}

      {error && (
        <div className={styles.errorBox}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && (
        <div className={styles.chartCard}>
          {workload.length === 0 ? (
            <EmptyState label="Faculty Workload" />
          ) : (
            <>
              <div className={styles.chartMeta}>
                <span className={styles.chartDot} style={{ background: '#14b8a6' }} />
                <span className={styles.chartLabel}>Faculty Workload</span>
                <span className={styles.chartCount}>{workload.length} faculty</span>
              </div>
              <div className={styles.chartBoxFull}>
                <Bar
                  id="faculty-workload-chart"
                  data={workloadChartData}
                  options={CHART_OPTIONS('Faculty Workload')}
                />
              </div>
            </>
          )}
        </div>
      )}
      </div>
    </Layout>
  );
}

function EmptyState({ label }) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>📭</span>
      <p className={styles.emptyText}>No data available for {label}</p>
      <p className={styles.emptyHint}>Generate a timetable first to see analytics.</p>
    </div>
  );
}
